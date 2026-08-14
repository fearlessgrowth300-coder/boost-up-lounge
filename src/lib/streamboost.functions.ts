import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseChannelUrl } from "./channel-url";

const urlInput = z.object({ url: z.string().min(4).max(300) });
const bulkUrlInput = z.object({
  urls: z.array(z.string().min(4).max(300)).min(1).max(25),
});

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
          banner_url: stats.bannerUrl,
          description: stats.description,
          broadcaster_type: stats.broadcasterType,
          current_category: stats.currentCategory,
          current_title: stats.currentTitle,
          recent_categories: stats.recentCategories,
          recent_videos: stats.recentVideos,
          ai_insights: stats.aiInsights,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,username" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("activity").insert({
        channel_id: row.id,
        user_id: context.userId,
        event_type: "channel_submitted",
        platform: parsed.platform,
      });
    }

    return { id: row.id as string };
  });

export const createBulkCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => bulkUrlInput.parse(data))
  .handler(async ({ data, context }) => {
    const parsedChannels = data.urls.map((url) => {
      const parsed = parseChannelUrl(url);
      if (!parsed) throw new Error(`Invalid channel URL: ${url}`);
      return parsed;
    });

    const supabaseAdmin = process.env["SUPABASE_SERVICE_ROLE_KEY"]
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : null;
    const created: Array<{ id: string; username: string; platform: string }> = [];

    for (const parsed of parsedChannels) {
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
            banner_url: stats.bannerUrl,
            description: stats.description,
            broadcaster_type: stats.broadcasterType,
            current_category: stats.currentCategory,
            current_title: stats.currentTitle,
            recent_categories: stats.recentCategories,
            recent_videos: stats.recentVideos,
            ai_insights: stats.aiInsights,
            last_checked_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,username" },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);

      if (supabaseAdmin) {
        await supabaseAdmin.from("activity").insert({
          channel_id: row.id,
          user_id: context.userId,
          event_type: "channel_submitted",
          platform: parsed.platform,
        });
      }
      created.push({ id: row.id, username: row.username, platform: row.platform });
    }

    return { created };
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
        banner_url: stats.bannerUrl,
        description: stats.description,
        broadcaster_type: stats.broadcasterType,
        current_category: stats.currentCategory,
        current_title: stats.currentTitle,
        recent_categories: stats.recentCategories,
        recent_videos: stats.recentVideos,
        ai_insights: stats.aiInsights,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return stats;
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [channelsRes, activityRes] = await Promise.all([
      context.supabase.from("channels").select("id").eq("user_id", context.userId),
      context.supabase
        .from("activity")
        .select("event_type, platform, country, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const ids = (channelsRes.data ?? []).map((c) => c.id);
    let clicks: Array<{
      id: string;
      channel_id: string;
      created_at: string;
      country: string | null;
      country_code: string | null;
      source_domain: string | null;
      referrer: string | null;
      converted: boolean;
      user_agent: string | null;
      device_type: string | null;
      operating_system: string | null;
      browser: string | null;
      language: string | null;
    }> = [];
    if (ids.length) {
      const { data } = await context.supabase
        .from("clicks")
        .select(
          "id, channel_id, created_at, country, country_code, source_domain, referrer, converted, user_agent, device_type, operating_system, browser, language",
        )
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
      .select(
        "id, platform, username, channel_url, followers, is_live, viewer_count, avatar_url, last_checked_at",
      )
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

type RecentVideo = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  viewCount: number;
  createdAt: string;
  duration: string;
  category: string;
};

type Stats = {
  followers: number;
  isLive: boolean;
  viewers: number;
  avatarUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  broadcasterType: string | null;
  currentCategory: string | null;
  currentTitle: string | null;
  recentCategories: string[];
  recentVideos: RecentVideo[];
  aiInsights: string[];
};

async function fetchTwitchStats(platform: string, username: string): Promise<Stats> {
  const empty: Stats = {
    followers: 0,
    isLive: false,
    viewers: 0,
    avatarUrl: null,
    bannerUrl: null,
    description: null,
    broadcasterType: null,
    currentCategory: null,
    currentTitle: null,
    recentCategories: [],
    recentVideos: [],
    aiInsights: [],
  };
  if (platform !== "twitch") return empty;

  const clientId = process.env["TWITCH_CLIENT_ID"];
  const clientSecret = process.env["TWITCH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return empty;

  try {
    const accessToken = await getTwitchAppToken(clientId, clientSecret);
    const base = "https://api.twitch.tv/helix";
    const headers = { Authorization: `Bearer ${accessToken}`, "Client-Id": clientId };
    const userRes = await fetch(`${base}/users?login=${encodeURIComponent(username)}`, { headers });
    if (!userRes.ok) {
      console.error(`Twitch users failed [${userRes.status}]: ${await userRes.text()}`);
      return empty;
    }
    const user = (await userRes.json()).data?.[0];
    if (!user) return empty;

    const [streamRes, followRes, channelRes, videosRes] = await Promise.all([
      fetch(`${base}/streams?user_id=${user.id}`, { headers }),
      fetch(`${base}/channels/followers?broadcaster_id=${user.id}`, { headers }),
      fetch(`${base}/channels?broadcaster_id=${user.id}`, { headers }),
      fetch(`${base}/videos?user_id=${user.id}&first=10&type=archive`, { headers }),
    ]);

    const stream = streamRes.ok ? (await streamRes.json()).data?.[0] : null;
    const followers = followRes.ok ? ((await followRes.json()).total ?? 0) : 0;
    const channel = channelRes.ok ? (await channelRes.json()).data?.[0] : null;
    const videos = videosRes.ok ? ((await videosRes.json()).data ?? []) : [];
    const gameIds = [
      ...new Set(videos.map((video: { game_id?: string }) => video.game_id).filter(Boolean)),
    ];
    const gamesRes = gameIds.length
      ? await fetch(
          `${base}/games?${gameIds.map((id) => `id=${encodeURIComponent(String(id))}`).join("&")}`,
          {
            headers,
          },
        )
      : null;
    const games = gamesRes?.ok ? ((await gamesRes.json()).data ?? []) : [];
    const gameNames = new Map(
      games.map((game: { id: string; name: string }) => [game.id, game.name]),
    );
    const recentVideos: RecentVideo[] = videos.map(
      (video: {
        id: string;
        title: string;
        url: string;
        thumbnail_url: string;
        view_count: number;
        created_at: string;
        duration: string;
        game_id?: string;
      }) => ({
        id: video.id,
        title: video.title,
        url: video.url,
        thumbnailUrl:
          video.thumbnail_url?.replace("%{width}", "640").replace("%{height}", "360") ?? "",
        viewCount: video.view_count ?? 0,
        createdAt: video.created_at,
        duration: video.duration,
        category: gameNames.get(video.game_id ?? "") ?? "Uncategorized",
      }),
    );
    const recentCategories = [...new Set(recentVideos.map((video) => video.category))].filter(
      (category) => category !== "Uncategorized",
    );
    const aiInsights = await generateGeminiInsights({
      username,
      followers,
      isLive: Boolean(stream),
      viewers: stream?.viewer_count ?? 0,
      currentCategory: stream?.game_name ?? channel?.game_name ?? null,
      recentCategories,
      recentVideos,
    });

    return {
      followers,
      isLive: Boolean(stream),
      viewers: stream?.viewer_count ?? 0,
      avatarUrl: user.profile_image_url ?? null,
      bannerUrl: user.offline_image_url ?? null,
      description: user.description ?? null,
      broadcasterType: user.broadcaster_type || null,
      currentCategory: stream?.game_name ?? channel?.game_name ?? null,
      currentTitle: stream?.title ?? channel?.title ?? null,
      recentCategories,
      recentVideos,
      aiInsights,
    };
  } catch (err) {
    console.error("Twitch lookup failed", err);
    return empty;
  }
}

let twitchTokenCache: { token: string; expiresAt: number } | null = null;

async function getTwitchAppToken(clientId: string, clientSecret: string) {
  if (twitchTokenCache && twitchTokenCache.expiresAt > Date.now() + 60_000) {
    return twitchTokenCache.token;
  }
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!response.ok) throw new Error(`Twitch authentication failed [${response.status}]`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  twitchTokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function generateGeminiInsights(input: {
  username: string;
  followers: number;
  isLive: boolean;
  viewers: number;
  currentCategory: string | null;
  recentCategories: string[];
  recentVideos: RecentVideo[];
}) {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return [];
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Act as a Twitch growth coach. Return exactly 4 concise, practical recommendations, one per line, with no numbering. Analyze this public channel data: ${JSON.stringify(input)}`,
                },
              ],
            },
          ],
        }),
      },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    return text
      .split("\n")
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 4);
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return [];
  }
}
