import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildGrowthAudit, calculateHealthScore } from "./channel-growth-audit";
import { parseChannelUrl } from "./channel-url";

function channelTokenName(username: string) {
  return username
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 24);
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureTokenPart() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function snapshotIssueMetrics(stats: Stats) {
  const count = buildGrowthAudit({
    followers: stats.followers,
    is_live: stats.isLive,
    description: stats.description,
    recent_videos: stats.recentVideos,
  }).length;
  const issues = buildGrowthAudit({
    followers: stats.followers,
    is_live: stats.isLive,
    description: stats.description,
    recent_videos: stats.recentVideos,
  });
  return { issue_count: count, health_score: calculateHealthScore(issues) };
}

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
          schedule_segments: stats.scheduleSegments,
          schedule_vacation: stats.scheduleVacation,
          ai_insights: stats.aiInsights,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,username" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("channel_snapshots").insert({
      channel_id: row.id,
      user_id: context.userId,
      followers: stats.followers,
      viewer_count: stats.viewers,
      is_live: stats.isLive,
      recent_broadcasts: stats.recentVideos.length,
      ...snapshotIssueMetrics(stats),
    });

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
            schedule_segments: stats.scheduleSegments,
            schedule_vacation: stats.scheduleVacation,
            ai_insights: stats.aiInsights,
            last_checked_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,username" },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);

      await context.supabase.from("channel_snapshots").insert({
        channel_id: row.id,
        user_id: context.userId,
        followers: stats.followers,
        viewer_count: stats.viewers,
        is_live: stats.isLive,
        recent_broadcasts: stats.recentVideos.length,
        ...snapshotIssueMetrics(stats),
      });

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

export const listChannelSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("channel_snapshots")
      .select("*")
      .eq("user_id", context.userId)
      .order("recorded_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listGrowthWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [progress, workspace, tokens] = await Promise.all([
      context.supabase.from("channel_issue_progress").select("*").eq("user_id", context.userId),
      context.supabase.from("channel_workspace").select("*").eq("user_id", context.userId),
      context.supabase
        .from("campaign_tokens")
        .select(
          "id, channel_id, token_preview, status, fiverr_order_reference, issued_at, activated_at, payment_verified_at, payment_verified_by, revoked_at, revocation_reason",
        )
        .eq("user_id", context.userId)
        .order("issued_at", { ascending: false }),
    ]);
    if (progress.error) throw new Error(progress.error.message);
    if (workspace.error) throw new Error(workspace.error.message);
    if (tokens.error) throw new Error(tokens.error.message);
    return {
      progress: progress.data ?? [],
      workspace: workspace.data ?? [],
      tokens: tokens.data ?? [],
    };
  });

export const generateCampaignToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ channelId: z.string().uuid(), fiverrOrderReference: z.string().min(2).max(120) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const orderReference = data.fiverrOrderReference.trim().replace(/^#/, "").toUpperCase();
    const { data: channel, error: channelError } = await context.supabase
      .from("channels")
      .select("id, username")
      .eq("id", data.channelId)
      .eq("user_id", context.userId)
      .single();
    if (channelError || !channel) throw new Error("Channel was not found.");

    const { data: active } = await context.supabase
      .from("campaign_tokens")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("status", "active")
      .maybeSingle();
    if (active) throw new Error("This channel already has an active campaign.");

    const { data: existingOrder, error: orderError } = await context.supabase
      .from("campaign_tokens")
      .select("id")
      .ilike("fiverr_order_reference", orderReference)
      .neq("status", "revoked")
      .limit(1)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (existingOrder) throw new Error("This Fiverr order reference has already been used.");

    await context.supabase
      .from("campaign_tokens")
      .update({ status: "revoked" })
      .eq("channel_id", channel.id)
      .eq("status", "issued");

    const token = `${channelTokenName(channel.username)}-SB-${secureTokenPart()}`;
    const { error } = await context.supabase.from("campaign_tokens").insert({
      channel_id: channel.id,
      user_id: context.userId,
      token_hash: await sha256(token),
      token_preview: `${token.slice(0, 18)}••••${token.slice(-6)}`,
      fiverr_order_reference: orderReference,
      payment_verified_at: new Date().toISOString(),
      payment_verified_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

export const revokeCampaignToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tokenId: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase
      .from("campaign_tokens")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revocation_reason: data.reason.trim(),
      })
      .eq("id", data.tokenId)
      .eq("user_id", context.userId)
      .neq("status", "revoked")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!token) throw new Error("Token was not found or is already revoked.");
    return { ok: true };
  });

export const activateCampaignToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ channelId: z.string().uuid(), token: z.string().min(20).max(160) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const normalized = data.token.trim().toUpperCase();
    const pieces = normalized.split("-");
    if (pieces.length !== 3 || pieces[1] !== "SB" || !/^[A-F0-9]{48}$/.test(pieces[2] ?? ""))
      throw new Error("This token format is invalid.");

    const { data: channel } = await client
      .from("channels")
      .select("id, username")
      .eq("id", data.channelId)
      .single();
    if (!channel || pieces[0] !== channelTokenName(channel.username)) {
      throw new Error("This token belongs to a different Twitch channel.");
    }

    const tokenHash = await sha256(normalized);
    const { data: result, error } = await client.rpc("activate_campaign_token", {
      p_channel_id: data.channelId,
      p_token_hash: tokenHash,
    });
    if (error) throw new Error(error.message);
    if (result === "invalid") throw new Error("This campaign token was not issued by StreamBoost.");
    if (result === "revoked") throw new Error("This campaign token has been revoked.");
    return { ok: true, alreadyActive: result === "already_active" };
  });

const issueProgressInput = z.object({
  channelId: z.string().uuid(),
  issueId: z.string().min(1).max(120),
  completed: z.boolean(),
  evidenceUrl: z.string().max(1000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  targetDate: z.string().nullable().optional(),
});

export const saveIssueProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => issueProgressInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("channel_issue_progress").upsert(
      {
        channel_id: data.channelId,
        user_id: context.userId,
        issue_id: data.issueId,
        completed: data.completed,
        evidence_url: data.evidenceUrl ?? null,
        notes: data.notes ?? null,
        target_date: data.targetDate ?? null,
        completed_at: data.completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,issue_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveChannelWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        channelId: z.string().uuid(),
        tags: z.array(z.string().max(40)).max(10),
        notes: z.string().max(4000),
        followUpAt: z.string().nullable(),
        monitoringEnabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("channel_workspace").upsert({
      channel_id: data.channelId,
      user_id: context.userId,
      tags: data.tags,
      owner_notes: data.notes,
      follow_up_at: data.followUpAt,
      monitoring_enabled: data.monitoringEnabled,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
    const { error: updateError } = await context.supabase
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
        schedule_segments: stats.scheduleSegments,
        schedule_vacation: stats.scheduleVacation,
        ai_insights: stats.aiInsights,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updateError) throw new Error(`Channel data could not be saved: ${updateError.message}`);
    await context.supabase.from("channel_snapshots").insert({
      channel_id: row.id,
      user_id: context.userId,
      followers: stats.followers,
      viewer_count: stats.viewers,
      is_live: stats.isLive,
      recent_broadcasts: stats.recentVideos.length,
      ...snapshotIssueMetrics(stats),
    });
    return stats;
  });

export const autoRefreshChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: channels, error } = await context.supabase
      .from("channels")
      .select("id, platform, username, last_checked_at")
      .eq("user_id", context.userId)
      .or(`last_checked_at.is.null,last_checked_at.lt.${staleBefore}`)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(10);
    if (error) throw new Error(error.message);

    let updated = 0;
    const failures: string[] = [];
    for (const channel of channels ?? []) {
      try {
        const stats = await fetchTwitchStats(channel.platform, channel.username);
        const checkedAt = new Date().toISOString();
        const { error: updateError } = await context.supabase
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
            schedule_segments: stats.scheduleSegments,
            schedule_vacation: stats.scheduleVacation,
            ai_insights: stats.aiInsights,
            last_checked_at: checkedAt,
          })
          .eq("id", channel.id)
          .eq("user_id", context.userId);
        if (updateError) throw updateError;
        const { error: snapshotError } = await context.supabase.from("channel_snapshots").insert({
          channel_id: channel.id,
          user_id: context.userId,
          followers: stats.followers,
          viewer_count: stats.viewers,
          is_live: stats.isLive,
          recent_broadcasts: stats.recentVideos.length,
          ...snapshotIssueMetrics(stats),
        });
        if (snapshotError) throw snapshotError;
        updated += 1;
      } catch (refreshError) {
        failures.push(
          `${channel.username}: ${refreshError instanceof Error ? refreshError.message : "refresh failed"}`,
        );
      }
    }
    return { checked: channels?.length ?? 0, updated, failures };
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
  .inputValidator((data: unknown) =>
    z.object({ identifier: z.string().min(1).max(100) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const channelQuery = client
      .from("channels")
      .select(
        "id, platform, username, channel_url, followers, is_live, viewer_count, avatar_url, banner_url, description, current_category, current_title, recent_categories, recent_videos, schedule_segments, verified, last_checked_at",
      );
    const uuid = z.string().uuid().safeParse(data.identifier);
    const { data: channel } = uuid.success
      ? await channelQuery.eq("id", uuid.data).maybeSingle()
      : await channelQuery
          .eq("platform", "twitch")
          .ilike("username", data.identifier)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
    if (!channel) return null;
    const channelId = channel.id;

    const [{ data: clicks }, { data: snapshots }, { data: progress }] = await Promise.all([
      client
        .from("clicks")
        .select("created_at, country, source_domain, referrer, converted")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(1000),
      client
        .from("channel_snapshots")
        .select(
          "followers, viewer_count, is_live, recent_broadcasts, issue_count, health_score, recorded_at",
        )
        .eq("channel_id", channelId)
        .order("recorded_at", { ascending: true })
        .limit(100),
      client
        .from("channel_issue_progress")
        .select("issue_id, completed, evidence_url, target_date, completed_at")
        .eq("channel_id", channelId),
    ]);

    return { channel, clicks: clicks ?? [], snapshots: snapshots ?? [], progress: progress ?? [] };
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

type ScheduleSegment = {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  category: string | null;
  isRecurring: boolean;
  isCanceled: boolean;
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
  scheduleSegments: ScheduleSegment[];
  scheduleVacation: { startTime: string; endTime: string } | null;
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
    scheduleSegments: [],
    scheduleVacation: null,
    aiInsights: [],
  };
  if (platform !== "twitch") return empty;

  const clientId = process.env["TWITCH_CLIENT_ID"];
  const clientSecret = process.env["TWITCH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("Twitch API credentials are not configured on the server.");
  }

  try {
    const accessToken = await getTwitchAppToken(clientId, clientSecret);
    const base = "https://api.twitch.tv/helix";
    const headers = { Authorization: `Bearer ${accessToken}`, "Client-Id": clientId };
    const userRes = await fetch(`${base}/users?login=${encodeURIComponent(username)}`, { headers });
    if (!userRes.ok) {
      throw new Error(`Twitch channel lookup failed [${userRes.status}].`);
    }
    const user = (await userRes.json()).data?.[0];
    if (!user) throw new Error(`Twitch channel @${username} was not found.`);

    const [streamRes, followRes, channelRes, videosRes, scheduleRes] = await Promise.all([
      fetch(`${base}/streams?user_id=${user.id}`, { headers }),
      fetch(`${base}/channels/followers?broadcaster_id=${user.id}`, { headers }),
      fetch(`${base}/channels?broadcaster_id=${user.id}`, { headers }),
      fetch(`${base}/videos?user_id=${user.id}&first=10&type=archive`, { headers }),
      fetch(`${base}/schedule?broadcaster_id=${user.id}&first=20`, { headers }),
    ]);

    if (!streamRes.ok) throw new Error(`Twitch live-status lookup failed [${streamRes.status}].`);
    if (!followRes.ok) throw new Error(`Twitch follower lookup failed [${followRes.status}].`);
    if (!channelRes.ok) throw new Error(`Twitch channel details failed [${channelRes.status}].`);
    if (!videosRes.ok) throw new Error(`Twitch broadcast lookup failed [${videosRes.status}].`);

    const stream = (await streamRes.json()).data?.[0] ?? null;
    const followers = (await followRes.json()).total ?? 0;
    const channel = (await channelRes.json()).data?.[0] ?? null;
    const videos = (await videosRes.json()).data ?? [];
    const scheduleData = scheduleRes.ok ? (await scheduleRes.json()).data : null;
    const scheduleSegments: ScheduleSegment[] = (scheduleData?.segments ?? []).map(
      (segment: {
        id: string;
        start_time: string;
        end_time: string;
        title: string;
        category?: { name?: string } | null;
        is_recurring?: boolean;
        canceled_until?: string | null;
      }) => ({
        id: segment.id,
        startTime: segment.start_time,
        endTime: segment.end_time,
        title: segment.title,
        category: segment.category?.name ?? null,
        isRecurring: Boolean(segment.is_recurring),
        isCanceled: Boolean(segment.canceled_until),
      }),
    );
    const scheduleVacation = scheduleData?.vacation
      ? {
          startTime: scheduleData.vacation.start_time,
          endTime: scheduleData.vacation.end_time,
        }
      : null;
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
      scheduleSegments,
      scheduleVacation,
      aiInsights,
    };
  } catch (err) {
    console.error("Twitch lookup failed", err);
    throw err instanceof Error ? err : new Error("Twitch lookup failed.");
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
