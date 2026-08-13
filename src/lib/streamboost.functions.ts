import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseChannelUrl } from "./channel-url";

const urlInput = z.object({ url: z.string().min(4).max(300) });

export const submitChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => urlInput.parse(data))
  .handler(async ({ data, context }) => {
    const parsed = parseChannelUrl(data.url);
    if (!parsed) throw new Error("Enter a valid Twitch, Kick or YouTube channel URL.");

    const stats = await fetchTwitchStats(parsed.platform, parsed.username);

    const { data: row, error } = await context.supabase
      .from("channels")
      .upsert(
        {
          user_id: context.userId,
          platform: parsed.platform,
          username: parsed.username,
          channel_url: parsed.url,
          verified: true,
          followers: stats.followers,
          is_live: stats.isLive,
          viewer_count: stats.viewers,
          avatar_url: stats.avatarUrl,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,username" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity").insert({
      channel_id: row.id,
      user_id: context.userId,
      event_type: "channel_submitted",
      platform: parsed.platform,
    });

    return { id: row.id as string };
  });

export const listChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("channels")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("channels")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("channels")
      .select("id, platform, username")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);

    const stats = await fetchTwitchStats(row.platform, row.username);
    await context.supabase
      .from("channels")
      .update({
        followers: stats.followers,
        is_live: stats.isLive,
        viewer_count: stats.viewers,
        avatar_url: stats.avatarUrl,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return stats;
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [channelsRes, activityRes] = await Promise.all([
      context.supabase
        .from("channels")
        .select("id")
        .eq("user_id", context.userId),
      context.supabase
        .from("activity")
        .select("event_type, platform, country, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const ids = (channelsRes.data ?? []).map((c) => c.id);
    let clicks: Array<{
      created_at: string;
      country: string | null;
      source_domain: string | null;
      referrer: string | null;
      converted: boolean;
    }> = [];
    if (ids.length) {
      const { data } = await context.supabase
        .from("clicks")
        .select("created_at, country, source_domain, referrer, converted")
        .in("channel_id", ids)
        .order("created_at", { ascending: false })
        .limit(1000);
      clicks = data ?? [];
    }

    return { clicks, activity: activityRes.data ?? [] };
  });

export const getPublicReport = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: channel } = await client
      .from("channels")
      .select("id, platform, username, channel_url, followers, is_live, viewer_count, avatar_url, last_checked_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!channel) return null;

    const { data: clicks } = await client
      .from("clicks")
      .select("created_at, country, source_domain, referrer, converted")
      .eq("channel_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1000);

    return { channel, clicks: clicks ?? [] };
  });

type Stats = { followers: number; isLive: boolean; viewers: number; avatarUrl: string | null };

async function fetchTwitchStats(platform: string, username: string): Promise<Stats> {
  const empty: Stats = { followers: 0, isLive: false, viewers: 0, avatarUrl: null };
  if (platform !== "twitch") return empty;

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twitchKey = process.env["TWITCH_API_KEY"];
  if (!lovableKey || !twitchKey) return empty;

  const base = "https://connector-gateway.lovable.dev/twitch";
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": twitchKey,
  };

  try {
    const userRes = await fetch(`${base}/users?login=${encodeURIComponent(username)}`, { headers });
    if (!userRes.ok) {
      console.error(`Twitch users failed [${userRes.status}]: ${await userRes.text()}`);
      return empty;
    }
    const user = (await userRes.json()).data?.[0];
    if (!user) return empty;

    const [streamRes, followRes] = await Promise.all([
      fetch(`${base}/streams?user_id=${user.id}`, { headers }),
      fetch(`${base}/channels/followers?broadcaster_id=${user.id}`, { headers }),
    ]);

    const stream = streamRes.ok ? (await streamRes.json()).data?.[0] : null;
    const followers = followRes.ok ? ((await followRes.json()).total ?? 0) : 0;

    return {
      followers,
      isLive: Boolean(stream),
      viewers: stream?.viewer_count ?? 0,
      avatarUrl: user.profile_image_url ?? null,
    };
  } catch (err) {
    console.error("Twitch lookup failed", err);
    return empty;
  }
}