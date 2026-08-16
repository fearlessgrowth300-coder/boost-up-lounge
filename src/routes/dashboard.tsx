import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MousePointerClick,
  Percent,
  RefreshCw,
  Rocket,
  Share2,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/sb/app-header";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildGrowthAudit,
  calculateHealthScore,
  getAuditActionPlan,
} from "@/lib/channel-growth-audit";
import {
  createBulkCampaigns,
  deleteChannel,
  generateCampaignToken,
  getDashboard,
  listGrowthWorkspace,
  listChannelSnapshots,
  listChannels,
  recordPaymentAwaitingVerification,
  refreshChannel,
  saveChannelWorkspace,
  saveIssueProgress,
} from "@/lib/streamboost.functions";

const TITLE = "Dashboard — StreamBoost";
const DESC = "Track clicks, conversions, channel health and partner-site traffic.";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: DashboardPage,
});

type Channel = Tables<"channels"> & { public_slug?: string };
type Click = Tables<"clicks">;
type ChannelSnapshot = Tables<"channel_snapshots">;
type IssueProgress = Tables<"channel_issue_progress">;
type ChannelWorkspace = Tables<"channel_workspace">;
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
  category: string;
  isRecurring: boolean;
  isCanceled: boolean;
};

type ChannelIssue = {
  id: string;
  title: string;
  evidence: string;
  fix: string;
  severity: "critical" | "warning";
};

function durationSeconds(duration: string) {
  const match = duration.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function ProgressRow({ label, value, goal }: { label: string; value: number; goal: number }) {
  const percent = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">
          {value} / {goal} <span className="text-destructive">(-{Math.max(0, goal - value)})</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-neon transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ClickChart({ clicks, days }: { clicks: Click[]; days: number | null }) {
  const points = useMemo(() => {
    const count = days ?? 30;
    const now = new Date();
    const rows = Array.from({ length: count }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (count - index - 1));
      return {
        key: localDateKey(date),
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: 0,
      };
    });
    const map = new Map(rows.map((row) => [row.key, row]));
    clicks.forEach((click) => {
      const row = map.get(localDateKey(new Date(click.created_at)));
      if (row) row.value += 1;
    });
    return rows;
  }, [clicks, days]);
  const max = Math.max(1, ...points.map((point) => point.value));

  return (
    <div className="mt-6 flex h-44 items-end gap-1 overflow-hidden rounded-lg border border-border bg-background/40 p-4">
      {points.map((point, index) => (
        <div
          key={point.key}
          className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
        >
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
            {point.value}
          </span>
          <div
            className="w-full min-w-1 rounded-t bg-neon/80 transition hover:bg-neon"
            style={{ height: `${Math.max(3, (point.value / max) * 110)}px` }}
            title={`${point.label}: ${point.value} clicks`}
          />
          {(points.length <= 7 || index % Math.ceil(points.length / 6) === 0) && (
            <span className="text-[10px] text-muted-foreground">{point.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

type CountryProperties = { name: string };
type WorldTopology = Topology<{ countries: GeometryCollection<CountryProperties> }>;

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "United States": "United States of America",
  "Dominican Republic": "Dominican Rep.",
  "Central African Republic": "Central African Rep.",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "Republic of the Congo": "Congo",
  "South Sudan": "S. Sudan",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "Equatorial Guinea": "Eq. Guinea",
};

function GlobalClickMap({ rows }: { rows: [string, number][] }) {
  const [hovered, setHovered] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  const max = Math.max(1, ...rows.map(([, count]) => count));
  const counts = new Map(rows.map(([name, count]) => [COUNTRY_NAME_ALIASES[name] ?? name, count]));
  const countries = useMemo(() => {
    const topology = worldAtlas as unknown as WorldTopology;
    const collection = feature<CountryProperties>(topology, topology.objects.countries);
    const projection = geoEqualEarth().fitExtent(
      [
        [20, 15],
        [980, 485],
      ],
      collection,
    );
    const path = geoPath(projection);
    return collection.features.map((country) => ({
      name: country.properties?.name ?? "Unknown",
      path: path(country) ?? "",
    }));
  }, []);
  return (
    <section className="sb-card p-6">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Globe className="size-5 text-neon" /> Global Click Distribution
      </h2>
      <div
        className="relative mt-5 aspect-[2/1] overflow-hidden rounded-xl bg-background/60"
        onMouseLeave={() => setHovered(null)}
      >
        <svg viewBox="0 0 1000 500" className="h-full w-full" aria-label="World click map">
          {countries.map((country) => {
            const count = counts.get(country.name) ?? 0;
            const strength = count / max;
            const fill =
              count === 0
                ? "hsl(var(--secondary))"
                : strength > 0.66
                  ? "#59ff00"
                  : strength > 0.33
                    ? "#38b900"
                    : "#245f08";
            return (
              <path
                key={country.name}
                d={country.path}
                fill={fill}
                stroke="hsl(var(--background))"
                strokeWidth="0.8"
                onMouseEnter={(event) =>
                  setHovered({
                    name: country.name,
                    count,
                    x: event.nativeEvent.offsetX,
                    y: event.nativeEvent.offsetY,
                  })
                }
                onMouseMove={(event) =>
                  setHovered((current) =>
                    current
                      ? {
                          ...current,
                          x: event.nativeEvent.offsetX,
                          y: event.nativeEvent.offsetY,
                        }
                      : current,
                  )
                }
                className={`${count > 0 ? "animate-pulse" : ""} cursor-crosshair transition-all duration-200 hover:brightness-150`}
                style={{
                  filter:
                    hovered?.name === country.name ? "drop-shadow(0 0 7px #59ff00)" : undefined,
                  stroke: hovered?.name === country.name ? "#59ff00" : undefined,
                  strokeWidth: hovered?.name === country.name ? 2 : 0.8,
                }}
              >
                <title>{`${country.name}: ${count} clicks`}</title>
              </path>
            );
          })}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-lg border border-neon/50 bg-background/95 px-3 py-2 text-xs shadow-[0_0_20px_rgba(89,255,0,0.25)] backdrop-blur"
            style={{ left: hovered.x, top: hovered.y - 10 }}
          >
            <p className="font-bold text-foreground">{hovered.name}</p>
            <p className={hovered.count ? "text-neon" : "text-muted-foreground"}>
              {hovered.count} {hovered.count === 1 ? "click" : "clicks"} ·{" "}
              {hovered.count === 0
                ? "No data"
                : hovered.count / max > 0.66
                  ? "High"
                  : hovered.count / max > 0.33
                    ? "Medium"
                    : "Low"}
            </p>
          </div>
        )}
        {!rows.length && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Location markers will appear after geographically identified clicks.
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
        <span>
          <i className="mr-2 inline-block size-3 rounded bg-secondary" />
          No data
        </span>
        <span>
          <i className="mr-2 inline-block size-3 rounded bg-neon/40" />
          Low
        </span>
        <span>
          <i className="mr-2 inline-block size-3 rounded bg-neon/70" />
          Medium
        </span>
        <span>
          <i className="mr-2 inline-block size-3 rounded bg-neon" />
          High
        </span>
      </div>
    </section>
  );
}

function ChannelAnalysis({
  channel,
  snapshots,
  onRefresh,
  onDelete,
  refreshing,
  progress = [],
  workspace,
  onSaveIssue,
  onSaveWorkspace,
}: {
  channel: Channel;
  snapshots: ChannelSnapshot[];
  onRefresh: () => Promise<void>;
  onDelete: () => void;
  refreshing: boolean;
  progress: IssueProgress[];
  workspace: ChannelWorkspace | undefined;
  onSaveIssue: (input: {
    issueId: string;
    completed: boolean;
    evidenceUrl?: string | null;
    notes?: string | null;
    targetDate?: string | null;
  }) => Promise<void>;
  onSaveWorkspace: (input: {
    tags: string[];
    notes: string;
    followUpAt: string | null;
    monitoringEnabled: boolean;
  }) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const generateTokenFn = useServerFn(generateCampaignToken);
  const recordPaymentFn = useServerFn(recordPaymentAwaitingVerification);
  const [fiverrOrderReference, setFiverrOrderReference] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");
  const [generatingToken, setGeneratingToken] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState({
    tags: workspace?.tags.join(", ") ?? "",
    notes: workspace?.owner_notes ?? "",
    followUpAt: workspace?.follow_up_at?.slice(0, 16) ?? "",
    monitoringEnabled: workspace?.monitoring_enabled ?? true,
  });
  useEffect(() => {
    setWorkspaceDraft({
      tags: workspace?.tags.join(", ") ?? "",
      notes: workspace?.owner_notes ?? "",
      followUpAt: workspace?.follow_up_at?.slice(0, 16) ?? "",
      monitoringEnabled: workspace?.monitoring_enabled ?? true,
    });
  }, [workspace]);
  const host = typeof window === "undefined" ? "localhost" : window.location.hostname;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicSlug = channel.public_slug ?? channel.username.toLowerCase();
  const promoUrl = `${origin}/go/${encodeURIComponent(publicSlug)}`;
  const reportUrl = `${origin}/r/${encodeURIComponent(publicSlug)}`;
  const followers = channel.followers ?? 0;
  const twitchPlayer = `https://player.twitch.tv/?channel=${encodeURIComponent(channel.username)}&parent=${encodeURIComponent(host)}`;
  const twitchChat = `https://www.twitch.tv/embed/${encodeURIComponent(channel.username)}/chat?parent=${encodeURIComponent(host)}&darkpopout`;
  const recentVideos = (
    Array.isArray(channel.recent_videos) ? channel.recent_videos : []
  ) as RecentVideo[];
  const recentCategories = (
    Array.isArray(channel.recent_categories) ? channel.recent_categories : []
  ) as string[];
  const scheduleSegments = (
    Array.isArray(channel.schedule_segments) ? channel.schedule_segments : []
  ) as ScheduleSegment[];
  const scheduleVacation = channel.schedule_vacation as {
    startTime?: string;
    endTime?: string;
  } | null;
  const aiInsights = (Array.isArray(channel.ai_insights) ? channel.ai_insights : []) as string[];
  const growthAudit = buildGrowthAudit(channel);
  const orderedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );
  const firstSnapshot = orderedSnapshots[0];
  const latestSnapshot = orderedSnapshots.at(-1);
  const hasHistoricalData = orderedSnapshots.length >= 2;
  const followerChange =
    firstSnapshot && latestSnapshot ? latestSnapshot.followers - firstSnapshot.followers : 0;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent30 = recentVideos.filter(
    (video) => new Date(video.createdAt).getTime() >= thirtyDaysAgo,
  );
  const streamHours30 =
    recent30.reduce((sum, video) => sum + durationSeconds(video.duration), 0) / 3600;
  const streamDays30 = new Set(
    recent30.map((video) => new Date(video.createdAt).toISOString().slice(0, 10)),
  ).size;
  const averageVodViews = recentVideos.length
    ? recentVideos.reduce((sum, video) => sum + video.viewCount, 0) / recentVideos.length
    : 0;
  const channelIssues: ChannelIssue[] = [];

  if (!channel.is_live) {
    channelIssues.push({
      id: "offline",
      title: "CHANNEL OFFLINE — LOSING MOMENTUM",
      evidence:
        "The channel is currently offline, reducing opportunities for live discovery and engagement.",
      fix: "Publish a consistent weekly schedule and go live during the hours your audience is most active.",
      severity: "critical",
    });
  }
  if (followers < 25) {
    channelIssues.push({
      id: "affiliate-followers",
      title: "AFFILIATE FOLLOWER REQUIREMENT NOT MET",
      evidence: `Current: ${followers.toLocaleString()} · Required: 25 · Gap: ${25 - followers}`,
      fix: "Add a clear follow call-to-action, promote short highlights, and collaborate with adjacent creators.",
      severity: "critical",
    });
  }
  if (streamHours30 < 4) {
    channelIssues.push({
      id: "affiliate-hours",
      title: "STREAM HOURS BELOW AFFILIATE REQUIREMENT",
      evidence: `Estimated ${streamHours30.toFixed(1)} of 4 public archived hours in the last 30 days.`,
      fix: `Stream at least ${(4 - streamHours30).toFixed(1)} more hours while keeping the broadcasts archived.`,
      severity: "critical",
    });
  }
  if (streamDays30 < 4) {
    channelIssues.push({
      id: "affiliate-days",
      title: "NOT ENOUGH UNIQUE STREAM DAYS",
      evidence: `Estimated ${streamDays30} of 4 public archived stream days in the last 30 days.`,
      fix: `Schedule streams on ${4 - streamDays30} additional unique day${4 - streamDays30 === 1 ? "" : "s"}.`,
      severity: "critical",
    });
  }
  if (channel.is_live && (channel.viewer_count ?? 0) < 3) {
    channelIssues.push({
      id: "live-viewers",
      title: "CURRENT LIVE VIEWERSHIP IS LOW",
      evidence: `${channel.viewer_count ?? 0} current viewers; Affiliate uses a 3-viewer average achievement.`,
      fix: "Announce streams before going live, raid similar channels, and start with a strong first-hour segment.",
      severity: "critical",
    });
  }
  if (!channel.banner_url) {
    channelIssues.push({
      id: "banner",
      title: "CHANNEL BANNER IS MISSING",
      evidence: "Twitch returned no offline banner for this channel.",
      fix: "Upload a clear 1920×1080 offline banner with your schedule, social handle, and channel promise.",
      severity: "warning",
    });
  }
  if (!channel.avatar_url) {
    channelIssues.push({
      id: "avatar",
      title: "PROFILE LOGO IS MISSING",
      evidence: "Twitch returned no profile image.",
      fix: "Add a high-contrast square logo that remains recognizable at small sizes.",
      severity: "warning",
    });
  }
  if (!channel.description || channel.description.trim().length < 80) {
    channelIssues.push({
      id: "about-description",
      title: "ABOUT DESCRIPTION IS TOO SHORT",
      evidence: channel.description
        ? `The public About description is only ${channel.description.trim().length} characters.`
        : "No public About description was returned.",
      fix: "Expand the channel bio with the games you stream, your schedule, and a clear reason to follow. Twitch panels are checked separately on the live About page.",
      severity: "warning",
    });
  }
  if (!recentVideos.length) {
    channelIssues.push({
      id: "vods",
      title: "NO RECENT ARCHIVED BROADCASTS",
      evidence: "Twitch returned no recent public archives.",
      fix: "Enable VOD storage and keep recent broadcasts public so new viewers can discover past content.",
      severity: "warning",
    });
  } else if (averageVodViews < 25) {
    channelIssues.push({
      id: "vod-reach",
      title: "RECENT VOD REACH IS LOW",
      evidence: `${averageVodViews.toFixed(1)} average public views across the latest ${recentVideos.length} archived broadcasts.`,
      fix: "Use benefit-led titles, stronger thumbnails, clips, and cross-platform posts to drive replay discovery.",
      severity: "warning",
    });
  }

  const completedIds = progress.filter((item) => item.completed).map((item) => item.issue_id);
  const health = calculateHealthScore(growthAudit, completedIds, channel);
  const verifiedIssues = growthAudit.filter((issue) => issue.classification === "verified");
  const processIssues = growthAudit.filter((issue) => issue.classification === "process");
  const completedCount = completedIds.filter((id) =>
    verifiedIssues.some((issue) => issue.id === id),
  ).length;
  const topVideo = [...recentVideos].sort((a, b) => b.viewCount - a.viewCount)[0];
  const benchmarkLabel =
    followers < 50
      ? "Emerging channel (0–49 followers)"
      : followers < 1000
        ? "Growing channel (50–999 followers)"
        : "Established channel (1,000+ followers)";

  return (
    <article className="sb-card overflow-hidden">
      {channel.banner_url ? (
        <div className="relative aspect-[4/1] min-h-32 overflow-hidden border-b border-border bg-secondary">
          <img
            src={channel.banner_url}
            alt={`${channel.username} Twitch banner`}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      ) : null}
      <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {channel.avatar_url ? (
            <img src={channel.avatar_url} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-secondary font-display text-xl font-bold text-cyan">
              {channel.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold">{channel.username}</h2>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs capitalize text-cyan">
                {channel.platform}
              </span>
              {channel.verified && (
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">
                  Verified
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Last checked{" "}
              {channel.last_checked_at
                ? new Date(channel.last_checked_at).toLocaleString()
                : "just now"}
            </p>
            {channel.description ? (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{channel.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={`Refresh ${channel.username}`}
            className="rounded-lg border border-border p-2.5 hover:border-neon hover:text-neon disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${channel.username}`}
            className="rounded-lg border border-border p-2.5 hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-3">
        <div className="rounded-lg bg-secondary/60 p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <p
            className={`mt-1 font-display text-xl font-bold ${channel.is_live ? "text-neon" : "text-destructive"}`}
          >
            {channel.is_live ? "Live" : "Offline"}
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-4">
          <p className="text-xs text-muted-foreground">Total Followers</p>
          <p className="mt-1 font-display text-xl font-bold text-cyan">
            {followers.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-4">
          <p className="text-xs text-muted-foreground">Current Viewers</p>
          <p className="mt-1 font-display text-xl font-bold text-orange">
            {channel.viewer_count ?? 0}
          </p>
        </div>
      </div>

      <section className="border-t border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">Improvement Tracking</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasHistoricalData
                ? "Comparing saved Twitch snapshots over time."
                : "A baseline is being established. Refresh the channel again to begin a historical comparison."}
            </p>
          </div>
          <span className="rounded-full bg-neon/10 px-3 py-1 text-xs font-bold text-neon">
            {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-secondary/60 p-4">
            <p className="text-xs text-muted-foreground">Follower Change</p>
            <p
              className={`mt-1 font-display text-2xl font-bold ${!hasHistoricalData || followerChange >= 0 ? "text-neon" : "text-destructive"}`}
            >
              {hasHistoricalData ? `${followerChange >= 0 ? "+" : ""}${followerChange}` : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-4">
            <p className="text-xs text-muted-foreground">First Tracked</p>
            <p className="mt-1 font-semibold">
              {firstSnapshot
                ? new Date(firstSnapshot.recorded_at).toLocaleDateString()
                : "No saved baseline yet"}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-4">
            <p className="text-xs text-muted-foreground">Latest Snapshot</p>
            <p className="mt-1 font-semibold">
              {latestSnapshot
                ? new Date(latestSnapshot.recorded_at).toLocaleString()
                : "Not recorded yet"}
            </p>
          </div>
        </div>
      </section>

      {(channel.current_category || channel.current_title) && (
        <section className="border-t border-border p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Current Category</p>
              <p className="mt-1 font-semibold">{channel.current_category ?? "Not set"}</p>
            </div>
            <div className="rounded-lg bg-secondary/60 p-4 md:col-span-2">
              <p className="text-xs text-muted-foreground">Latest Stream Title</p>
              <p className="mt-1 font-semibold">{channel.current_title ?? "Not set"}</p>
            </div>
          </div>
        </section>
      )}

      {channel.platform === "twitch" && (
        <section className="border-t border-border p-6">
          <h3 className="font-display text-lg font-bold">Twitch Embed Status</h3>
          <p className="mt-2 break-all text-xs text-muted-foreground">Current domain: {host}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">Embed URL: {twitchPlayer}</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold">
                Stream Preview · {channel.is_live ? "Live" : "Currently Offline"}
              </p>
              <iframe
                title={`${channel.username} stream`}
                src={twitchPlayer}
                allowFullScreen
                className="aspect-video w-full rounded-lg border border-border bg-black"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">
                Chat Preview · {channel.is_live ? "Live" : "Currently Offline"}
              </p>
              <iframe
                title={`${channel.username} chat`}
                src={twitchChat}
                className="aspect-video w-full rounded-lg border border-border bg-black"
              />
            </div>
          </div>
        </section>
      )}

      {channel.platform === "twitch" && (
        <section className="border-t border-border p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold">Recently Streamed Categories</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Categories detected from the latest archived broadcasts.
              </p>
            </div>
            <a
              href={`https://www.twitch.tv/${channel.username}/about`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-cyan px-4 py-2.5 text-sm font-bold text-cyan"
            >
              <ExternalLink className="size-4" /> View Twitch Panels
            </a>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {recentCategories.length ? (
              recentCategories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-cyan/10 px-3 py-1.5 text-sm font-semibold text-cyan"
                >
                  {category}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No archived category history is available yet.
              </p>
            )}
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-secondary/30 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold">Upcoming Twitch Schedule</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Official upcoming segments returned by Twitch.
                  </p>
                </div>
                <a
                  href={`https://www.twitch.tv/${channel.username}/schedule`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan hover:underline"
                >
                  Open <ExternalLink className="ml-1 inline size-3.5" />
                </a>
              </div>
              {scheduleVacation?.startTime && scheduleVacation.endTime ? (
                <p className="mt-4 rounded-lg bg-orange/10 p-3 text-sm text-orange">
                  Vacation: {new Date(scheduleVacation.startTime).toLocaleDateString()} –{" "}
                  {new Date(scheduleVacation.endTime).toLocaleDateString()}
                </p>
              ) : null}
              <div className="mt-4 space-y-3">
                {scheduleSegments.length ? (
                  scheduleSegments.map((segment) => (
                    <div
                      key={segment.id}
                      className="rounded-lg border border-border bg-background/60 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{segment.title || "Scheduled stream"}</p>
                        {segment.isRecurring ? (
                          <span className="rounded-full bg-cyan/10 px-2 py-1 text-xs text-cyan">
                            Recurring
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(segment.startTime).toLocaleString()} ·{" "}
                        {segment.category || "No category"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No upcoming scheduled streams are currently published on Twitch.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-5">
              <h3 className="font-display text-lg font-bold">Twitch Panels</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Twitch does not provide channel panel images or panel text through its official API.
                Open the live About page below to see the real, current panels.
              </p>
              {channel.description ? (
                <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-cyan">
                    Public channel bio
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{channel.description}</p>
                </div>
              ) : null}
              <a
                href={`https://www.twitch.tv/${channel.username}/about`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan px-4 py-3 text-sm font-bold text-background"
              >
                View Live Twitch Panels <ExternalLink className="size-4" />
              </a>
            </div>
          </div>

          <h3 className="mt-8 font-display text-lg font-bold">Recent Broadcasts</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentVideos.length ? (
              recentVideos.slice(0, 6).map((video) => (
                <a
                  key={video.id}
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-border bg-secondary/40 transition hover:border-neon"
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-video bg-secondary" />
                  )}
                  <div className="space-y-2 p-4">
                    <p className="line-clamp-2 font-semibold group-hover:text-neon">
                      {video.title}
                    </p>
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span>{video.category}</span>
                      <span>{video.viewCount.toLocaleString()} views</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                      <span>{video.duration}</span>
                    </div>
                  </div>
                </a>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No archived broadcasts were returned by Twitch.
              </p>
            )}
          </div>
        </section>
      )}

      {aiInsights.length ? (
        <section className="border-t border-cyan/40 bg-cyan/5 p-6">
          <h3 className="font-display text-lg font-bold text-cyan">Gemini AI Growth Coach</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Recommendations generated from current Twitch data and recent broadcasts.
          </p>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {aiInsights.map((insight) => (
              <li
                key={insight}
                className="rounded-lg border border-cyan/20 bg-background/50 p-4 text-sm"
              >
                {insight}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">Growth Control Center</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Track the channel from verified backend evidence through every improvement step.
            </p>
          </div>
          <span className="rounded-full bg-neon/10 px-3 py-1 text-xs font-bold text-neon">
            {completedCount}/{verifiedIssues.length} verified completed
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="text-xs text-muted-foreground">Verified backend issues</p>
            <p className="mt-1 font-display text-2xl font-bold text-destructive">
              {verifiedIssues.length}
            </p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="text-xs text-muted-foreground">Process steps</p>
            <p className="mt-1 font-display text-2xl font-bold text-orange">
              {processIssues.length}
            </p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="text-xs text-muted-foreground">Relevant benchmark</p>
            <p className="mt-1 text-sm font-bold text-cyan">{benchmarkLabel}</p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="text-xs text-muted-foreground">Best recent broadcast</p>
            <p className="mt-1 text-sm font-bold">
              {topVideo ? `${topVideo.viewCount.toLocaleString()} views` : "No public VOD data"}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-border p-5">
            <h4 className="font-display font-bold">Branding Scorecard</h4>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["Profile image", Boolean(channel.avatar_url)],
                ["Offline banner", Boolean(channel.banner_url)],
                [
                  "Complete About description",
                  Boolean(channel.description && channel.description.length >= 80),
                ],
                ["Published stream schedule", scheduleSegments.length > 0],
              ].map(([label, ready]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                >
                  <span>{String(label)}</span>
                  <span className={ready ? "font-bold text-neon" : "font-bold text-destructive"}>
                    {ready ? "Detected" : "Missing"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <form
            className="rounded-xl border border-border p-5"
            onSubmit={async (event) => {
              event.preventDefault();
              await onSaveWorkspace({
                tags: workspaceDraft.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                notes: workspaceDraft.notes,
                followUpAt: workspaceDraft.followUpAt
                  ? new Date(workspaceDraft.followUpAt).toISOString()
                  : null,
                monitoringEnabled: workspaceDraft.monitoringEnabled,
              });
            }}
          >
            <h4 className="font-display font-bold">Owner Workspace</h4>
            <div className="mt-4 grid gap-3">
              <input
                value={workspaceDraft.tags}
                onChange={(event) =>
                  setWorkspaceDraft((draft) => ({ ...draft, tags: event.target.value }))
                }
                placeholder="Tags: affiliate, priority, follow-up"
                className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
              />
              <textarea
                value={workspaceDraft.notes}
                onChange={(event) =>
                  setWorkspaceDraft((draft) => ({ ...draft, notes: event.target.value }))
                }
                placeholder="Private owner notes"
                className="min-h-20 rounded-lg border border-border bg-input px-3 py-2 text-sm"
              />
              <label className="text-xs text-muted-foreground">
                Follow-up date
                <input
                  type="datetime-local"
                  value={workspaceDraft.followUpAt}
                  onChange={(event) =>
                    setWorkspaceDraft((draft) => ({ ...draft, followUpAt: event.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={workspaceDraft.monitoringEnabled}
                  onChange={(event) =>
                    setWorkspaceDraft((draft) => ({
                      ...draft,
                      monitoringEnabled: event.target.checked,
                    }))
                  }
                />
                Monitor changes whenever Twitch data refreshes
              </label>
              <button className="rounded-lg bg-neon px-4 py-2 text-sm font-bold text-primary-foreground">
                Save Workspace
              </button>
            </div>
          </form>
        </div>
        <div className="mt-5 rounded-xl border border-cyan/30 bg-cyan/5 p-5">
          <h4 className="font-display font-bold text-cyan">Automated Change Monitor</h4>
          <p className="mt-2 text-sm text-muted-foreground">
            Every refresh saves a timestamped snapshot and checks followers, live status, viewers,
            broadcasts, issue count, health score, branding, and schedule changes.
          </p>
        </div>
        <div className="mt-5 rounded-xl border border-orange/40 bg-orange/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-display font-bold text-orange">Owner Campaign Token Issuer</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                After confirming the streamer paid through Fiverr, enter the Fiverr order reference
                and generate one secure, unguessable token locked to {channel.username}.
              </p>
            </div>
            <span className="rounded-full bg-orange/10 px-3 py-1 text-xs font-bold text-orange">
              Owner only
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              value={fiverrOrderReference}
              onChange={(event) => setFiverrOrderReference(event.target.value)}
              placeholder="Fiverr order reference"
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-4 py-2.5 text-sm"
            />
            <input
              type="email"
              value={notificationEmail}
              onChange={(event) => setNotificationEmail(event.target.value)}
              placeholder="Streamer notification email"
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-4 py-2.5 text-sm"
            />
            <button
              disabled={
                recordingPayment ||
                fiverrOrderReference.trim().length < 2 ||
                !notificationEmail.includes("@")
              }
              onClick={async () => {
                setRecordingPayment(true);
                try {
                  await recordPaymentFn({
                    data: {
                      channelId: channel.id,
                      fiverrOrderReference: fiverrOrderReference.trim(),
                      notificationEmail: notificationEmail.trim(),
                    },
                  });
                  await queryClient.invalidateQueries({ queryKey: ["growth-workspace"] });
                  toast.success("Payment recorded and verification email queued");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Payment could not be recorded",
                  );
                } finally {
                  setRecordingPayment(false);
                }
              }}
              className="rounded-lg border border-orange/50 px-5 py-2.5 text-sm font-bold text-orange disabled:opacity-50"
            >
              {recordingPayment ? "Recording…" : "Record Awaiting Verification"}
            </button>
            <button
              disabled={
                generatingToken ||
                fiverrOrderReference.trim().length < 2 ||
                !notificationEmail.includes("@")
              }
              onClick={async () => {
                setGeneratingToken(true);
                try {
                  const result = await generateTokenFn({
                    data: {
                      channelId: channel.id,
                      fiverrOrderReference: fiverrOrderReference.trim(),
                      notificationEmail: notificationEmail.trim() || undefined,
                    },
                  });
                  setGeneratedToken(result.token);
                  await queryClient.invalidateQueries({ queryKey: ["growth-workspace"] });
                  toast.success("Secure campaign token generated");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Token generation failed");
                } finally {
                  setGeneratingToken(false);
                }
              }}
              className="rounded-lg bg-orange px-5 py-2.5 text-sm font-bold text-background disabled:opacity-50"
            >
              {generatingToken ? "Issuing…" : "Verify & Issue Token"}
            </button>
          </div>
          {generatedToken ? (
            <div className="mt-4 rounded-lg border border-neon/40 bg-background p-4">
              <p className="text-xs font-bold uppercase text-neon">Copy now — shown in full once</p>
              <code className="mt-2 block break-all text-sm text-cyan">{generatedToken}</code>
              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(generatedToken)
                    .then(() => toast.success("Token copied"))
                }
                className="mt-3 rounded-lg bg-neon px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                Copy Streamer Token
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-t border-destructive/40 bg-destructive/5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          <h3 className="font-display font-bold text-destructive">TWITCH CHANNEL HEALTH</h3>
          <span className="rounded bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
            {growthAudit.length} ISSUES IDENTIFIED
          </span>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(reportUrl)
                .then(() => toast.success("Public streamer report link copied"))
            }
            className="ml-auto flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <Share2 className="size-4" /> Share
          </button>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-lg bg-background/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Overall Health Score</p>
            <p className="mt-2 font-display text-4xl font-bold text-destructive">{health}%</p>
            <div className="mt-3 h-2 rounded bg-secondary">
              <div className="h-2 rounded bg-destructive" style={{ width: `${health}%` }} />
            </div>
          </div>
          <div className="rounded-lg bg-background/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Your Followers</p>
            <p className="mt-2 font-display text-4xl font-bold">{followers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-background/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Relevant Channel Benchmark</p>
            <p className="mt-2 text-sm font-bold text-cyan">{benchmarkLabel}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {growthAudit.map((issue) => {
            const saved = progress.find((item) => item.issue_id === issue.id);
            const plan = getAuditActionPlan(issue);
            return (
              <article
                key={issue.id}
                className={`rounded-xl border p-5 ${saved?.completed ? "border-neon/60 bg-neon/5" : "border-destructive/70 bg-destructive/10"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {issue.phase}
                    </p>
                    <h4 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-destructive">
                      <AlertTriangle className="size-5 shrink-0" /> {issue.title}
                    </h4>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="shrink-0 rounded-full border border-foreground px-2 py-1 text-[10px] font-bold uppercase text-foreground">
                      {issue.classification === "process"
                        ? "Recommended"
                        : issue.status === "critical"
                          ? "Critical"
                          : "Warning"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${issue.classification === "verified" ? "bg-cyan/15 text-cyan" : "bg-orange/15 text-orange"}`}
                    >
                      {issue.classification === "verified"
                        ? "Verified issue · Twitch backend assessment"
                        : "Process to follow"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-3 border-t border-destructive/30 pt-4 text-sm">
                  <p>
                    <strong>What it is:</strong> {issue.whatItIs}
                  </p>
                  <p>
                    <strong>Why you need to fix it:</strong> {issue.whyFixIt}
                  </p>
                  <div className="grid gap-2 rounded-lg bg-background/50 p-3 text-xs sm:grid-cols-3">
                    <span>
                      <strong>Priority:</strong> {plan.priority}
                    </span>
                    <span>
                      <strong>Impact:</strong> {plan.impact}
                    </span>
                    <span>
                      <strong>Target:</strong> {plan.deadlineDays} days
                    </span>
                  </div>
                  <details className="rounded-lg border border-border bg-background/40 p-3">
                    <summary className="cursor-pointer font-bold">Action plan</summary>
                    <ol className="mt-3 list-decimal space-y-1 pl-5">
                      {plan.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ol>
                  </details>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      id={`evidence-${channel.id}-${issue.id}`}
                      defaultValue={saved?.evidence_url ?? ""}
                      placeholder="Evidence link (screenshot, Twitch page, document)"
                      className="rounded-lg border border-border bg-input px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const evidence =
                          (
                            document.getElementById(
                              `evidence-${channel.id}-${issue.id}`,
                            ) as HTMLInputElement | null
                          )?.value ?? "";
                        await onSaveIssue({
                          issueId: issue.id,
                          completed: !saved?.completed,
                          evidenceUrl: evidence || null,
                          targetDate: new Date(Date.now() + plan.deadlineDays * 86400000)
                            .toISOString()
                            .slice(0, 10),
                        });
                      }}
                      className={`rounded-lg px-4 py-2 text-xs font-bold ${saved?.completed ? "bg-secondary text-foreground" : "bg-neon text-primary-foreground"}`}
                    >
                      {saved?.completed ? "Reopen issue" : "Mark complete"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-6 rounded-xl bg-gradient-to-r from-destructive to-orange p-5 text-destructive-foreground">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Target className="size-10 shrink-0" />
            <div className="flex-1">
              <h4 className="font-display text-xl font-extrabold">FIX ALL ISSUES NOW</h4>
              <p className="mt-1 text-sm font-semibold">
                Review every issue above, then refresh the channel analysis to measure progress.
              </p>
              <p className="mt-2 text-xs opacity-80">
                Affiliate requirements use Twitch's current public criteria. Private analytics
                remain authoritative for average viewers.
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 rounded-lg bg-background px-5 py-3 text-sm font-bold text-foreground disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing Twitch Data…" : "Refresh Analysis"}
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-border p-6">
        <h3 className="font-display text-lg font-bold">Path to Monetization</h3>
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-semibold text-cyan">Twitch Affiliate</h4>
            <ProgressRow label="Followers" value={followers} goal={25} />
            <ProgressRow
              label="Archived Hours (30 days)"
              value={Math.round(streamHours30)}
              goal={4}
            />
            <ProgressRow label="Unique Stream Days (30 days)" value={streamDays30} goal={4} />
            <ProgressRow
              label="Current Viewers (official average is private)"
              value={channel.viewer_count ?? 0}
              goal={3}
            />
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-orange">Twitch Partner</h4>
            <ProgressRow label="Recent Streams (30 days)" value={recent30.length} goal={6} />
            <ProgressRow
              label="Current Viewers (75 average required)"
              value={channel.viewer_count ?? 0}
              goal={75}
            />
            <p className="text-xs text-muted-foreground">
              Twitch requires qualifying performance across consecutive 30-day periods. Confirm
              official average viewers in Creator Dashboard → Achievements.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-neon/40 bg-neon/5 p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <Rocket className="size-5 text-neon" /> Your Promotion Link
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Share this link anywhere to drive traffic to your channel. Every click is tracked.
        </p>
        <code className="mt-4 block overflow-x-auto rounded-lg bg-background p-4 text-sm text-neon">
          {promoUrl}
        </code>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(promoUrl)
                .then(() => toast.success("Promotion link copied"))
            }
            className="flex items-center gap-2 rounded-lg bg-neon px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Copy className="size-4" /> Copy Link
          </button>
          <a
            href={promoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-cyan px-4 py-2.5 text-sm font-bold text-cyan"
          >
            <ExternalLink className="size-4" /> Open Preview
          </a>
        </div>
        <ul className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {[
            "Social media profiles and posts",
            "Discord and gaming communities",
            "Your website or blog",
            "Email signatures and gaming forums",
          ].map((tip) => (
            <li key={tip} className="flex items-center gap-2">
              <Check className="size-4 text-neon" />
              {tip}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-cyan/40 bg-cyan/5 p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <Share2 className="size-5 text-cyan" /> Public Streamer Report Link
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Send this link directly to the streamer. It opens the complete public report without
          requiring signup or login.
        </p>
        <code className="mt-4 block overflow-x-auto rounded-lg bg-background p-4 text-sm text-cyan">
          {reportUrl}
        </code>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(reportUrl)
                .then(() => toast.success("Public streamer report link copied"))
            }
            className="flex items-center gap-2 rounded-lg bg-cyan px-4 py-2.5 text-sm font-bold text-background"
          >
            <Copy className="size-4" /> Copy Report Link
          </button>
          <a
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-cyan px-4 py-2.5 text-sm font-bold text-cyan"
          >
            <ExternalLink className="size-4" /> Preview Public Report
          </a>
        </div>
      </section>
    </article>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [days, setDays] = useState<number | null>(7);
  const [bulkUrls, setBulkUrls] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "live" | "follow-up">("all");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const dashboard = useServerFn(getDashboard);
  const channelsFn = useServerFn(listChannels);
  const snapshotsFn = useServerFn(listChannelSnapshots);
  const growthWorkspaceFn = useServerFn(listGrowthWorkspace);
  const saveIssueFn = useServerFn(saveIssueProgress);
  const saveWorkspaceFn = useServerFn(saveChannelWorkspace);
  const bulkFn = useServerFn(createBulkCampaigns);
  const refreshFn = useServerFn(refreshChannel);
  const deleteFn = useServerFn(deleteChannel);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setReady(true);
    });
  }, [navigate]);

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboard({}),
    enabled: ready,
  });
  const { data: channels } = useQuery({
    queryKey: ["channels"],
    queryFn: () => channelsFn({}),
    enabled: ready,
  });
  const { data: snapshots } = useQuery({
    queryKey: ["channel-snapshots"],
    queryFn: () => snapshotsFn({}),
    enabled: ready,
  });
  const { data: growthWorkspace } = useQuery({
    queryKey: ["growth-workspace"],
    queryFn: () => growthWorkspaceFn({}),
    enabled: ready,
  });
  const bulkMutation = useMutation({
    mutationFn: (urls: string[]) => bulkFn({ data: { urls } }),
    onSuccess: async (result) => {
      toast.success(
        `${result.created.length} campaign${result.created.length === 1 ? "" : "s"} created`,
      );
      setBulkUrls("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["channels"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["channel-snapshots"] }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create campaigns"),
  });

  const clicks = (data?.clicks ?? []) as Click[];
  const conversions = clicks.filter((click) => click.converted).length;
  const rate = clicks.length ? ((conversions / clicks.length) * 100).toFixed(1) : "0.0";
  const sites = new Set(clicks.map((click) => click.source_domain).filter(Boolean)).size;
  const sourceRows = Object.entries(
    clicks.reduce<Record<string, number>>((acc, click) => {
      const key = click.source_domain ?? "Direct";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const locatedClicks = clicks.filter((click) => Boolean(click.country));
  const countryRows = Object.entries(
    locatedClicks.reduce<Record<string, number>>((acc, click) => {
      const key = click.country!;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const deviceRows = Object.entries(
    clicks.reduce<Record<string, number>>((acc, click) => {
      const key = click.device_type ?? "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const browserRows = Object.entries(
    clicks.reduce<Record<string, number>>((acc, click) => {
      const key = click.browser ?? "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const osRows = Object.entries(
    clicks.reduce<Record<string, number>>((acc, click) => {
      const key = click.operating_system ?? "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const stats = [
    {
      icon: MousePointerClick,
      label: "Total Clicks",
      value: String(clicks.length),
      tone: "text-neon",
    },
    { icon: Target, label: "Conversions", value: String(conversions), tone: "text-cyan" },
    { icon: Percent, label: "Conversion Rate", value: `${rate}%`, tone: "text-orange" },
    {
      icon: Globe,
      label: "Partner Sites Sending Traffic",
      value: String(sites),
      tone: "text-neon",
    },
  ];
  const filteredChannels = (channels ?? []).filter((channel) => {
    const workspace = (growthWorkspace?.workspace ?? []).find(
      (item) => item.channel_id === channel.id,
    );
    const query = channelSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [channel.username, channel.platform, ...(workspace?.tags ?? [])].some((value) =>
        value.toLowerCase().includes(query),
      );
    const matchesFilter =
      channelFilter === "all" ||
      (channelFilter === "live" && channel.is_live) ||
      (channelFilter === "follow-up" && Boolean(workspace?.follow_up_at));
    return matchesSearch && matchesFilter;
  });
  const selectedChannel =
    filteredChannels.find((channel) => channel.id === selectedChannelId) ?? filteredChannels[0];

  async function refresh(id: string) {
    if (refreshingId) return;
    setRefreshingId(id);
    try {
      await refreshFn({ data: { id } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["channels"] }),
        queryClient.invalidateQueries({ queryKey: ["channel-snapshots"] }),
      ]);
      toast.success("Channel refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setRefreshingId(null);
    }
  }
  async function remove(id: string) {
    try {
      await deleteFn({ data: { id } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["channels"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Channel removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
        <div id="overview" className="scroll-mt-28">
          <h1 className="font-display text-3xl font-extrabold">StreamBoost Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Channel intelligence, monetization progress and promotion analytics in one place.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="sb-card p-6">
              <stat.icon className={`size-5 ${stat.tone}`} />
              <p className={`mt-4 font-display text-3xl font-extrabold ${stat.tone}`}>
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div id="analytics" className="grid scroll-mt-28 gap-6 xl:grid-cols-3">
          <section className="sb-card p-6 xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">Clicks Over Time</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "7 Days", value: 7 },
                  { label: "30 Days", value: 30 },
                  { label: "90 Days", value: 90 },
                  { label: "All Time", value: null },
                ].map((option) => (
                  <button
                    key={option.label}
                    onClick={() => setDays(option.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${days === option.value ? "bg-neon text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <ClickChart clicks={clicks} days={days} />
          </section>
          <section className="sb-card p-6">
            <h2 className="font-display text-xl font-bold">Geographic Breakdown</h2>
            {clicks.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {locatedClicks.length} of {clicks.length} clicks include location data.
              </p>
            )}
            <div className="mt-5 space-y-3">
              {countryRows.length ? (
                countryRows.map(([country, count]) => (
                  <div
                    key={country}
                    className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm"
                  >
                    <span>{country}</span>
                    <span className="font-bold text-neon">
                      {count} ({((count / locatedClicks.length) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No geographic data yet.</p>
              )}
            </div>
          </section>
        </div>

        <GlobalClickMap rows={countryRows} />

        <div id="traffic" className="grid scroll-mt-28 gap-6 lg:grid-cols-2">
          <section className="sb-card p-6">
            <h2 className="font-display text-xl font-bold">Top Traffic Sources</h2>
            <div className="mt-5 space-y-3">
              {sourceRows.length ? (
                sourceRows.slice(0, 8).map(([source, count]) => (
                  <div
                    key={source}
                    className="flex justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm"
                  >
                    <span className="truncate">{source}</span>
                    <span className="font-bold text-cyan">{count} clicks</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No traffic recorded yet. Share a promotion link to begin tracking.
                </p>
              )}
            </div>
          </section>
          <section className="sb-card p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold">
              <Activity className="size-5 text-orange" /> Recent Activity
            </h2>
            <ul className="mt-5 space-y-2 text-sm">
              {(data?.activity ?? []).map((item, index) => (
                <li
                  key={`${item.created_at}-${index}`}
                  className="flex flex-wrap justify-between gap-2 rounded-lg bg-secondary/60 px-4 py-3"
                >
                  <span>
                    <span className="text-neon">{item.event_type}</span> ·{" "}
                    {item.platform ?? "channel"}
                    {item.country ? ` · ${item.country}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: "Device Types", rows: deviceRows },
            { title: "Browsers", rows: browserRows },
            { title: "Operating Systems", rows: osRows },
          ].map((group) => (
            <section key={group.title} className="sb-card p-6">
              <h2 className="font-display text-xl font-bold">{group.title}</h2>
              <div className="mt-5 space-y-3">
                {group.rows.length ? (
                  group.rows.map(([label, count]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm"
                    >
                      <span>{label}</span>
                      <span className="font-bold text-neon">
                        {count} ({((count / clicks.length) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No visit data yet.</p>
                )}
              </div>
            </section>
          ))}
        </div>

        <section id="campaigns" className="sb-card scroll-mt-28 p-6">
          <h2 className="font-display text-xl font-bold">Bulk Campaign Tools</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create campaigns for multiple Twitch, Kick or YouTube channels. One URL per line, up to
            25.
          </p>
          <textarea
            value={bulkUrls}
            onChange={(event) => setBulkUrls(event.target.value)}
            placeholder={
              "https://www.twitch.tv/streamer1\nhttps://kick.com/streamer2\nhttps://www.youtube.com/@streamer3"
            }
            className="mt-5 min-h-32 w-full rounded-lg border border-border bg-input p-4 text-sm outline-none focus:border-neon"
          />
          <button
            disabled={bulkMutation.isPending || !bulkUrls.trim()}
            onClick={() =>
              bulkMutation.mutate(
                bulkUrls
                  .split(/\r?\n/)
                  .map((url) => url.trim())
                  .filter(Boolean),
              )
            }
            className="mt-3 flex items-center gap-2 rounded-lg bg-neon px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            {bulkMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}{" "}
            Create Campaigns
          </button>
        </section>

        <section id="channels" className="scroll-mt-28">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold">Your Verified Channels</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Live Twitch data, embeds and growth recommendations.
              </p>
            </div>
            <Users className="size-7 text-cyan" />
          </div>
          <div className="mb-5 grid gap-3 rounded-xl border border-border bg-secondary/30 p-4 sm:grid-cols-[1fr_auto]">
            <input
              value={channelSearch}
              onChange={(event) => setChannelSearch(event.target.value)}
              placeholder="Search saved channels, platforms, or tags"
              className="rounded-lg border border-border bg-input px-4 py-2.5 text-sm"
            />
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value as typeof channelFilter)}
              className="rounded-lg border border-border bg-input px-4 py-2.5 text-sm"
            >
              <option value="all">All saved channels</option>
              <option value="live">Live now</option>
              <option value="follow-up">Follow-up scheduled</option>
            </select>
          </div>
          {filteredChannels.length > 0 ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${selectedChannel?.id === channel.id ? "border-neon bg-neon/10" : "border-border bg-secondary/30 hover:border-cyan"}`}
                >
                  {channel.avatar_url ? (
                    <img src={channel.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-background font-display font-bold text-cyan">
                      {channel.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{channel.username}</span>
                    <span className="block text-xs text-muted-foreground">
                      {channel.platform} · {channel.followers.toLocaleString()} followers
                    </span>
                  </span>
                  <span className={`size-2.5 rounded-full ${channel.is_live ? "bg-neon" : "bg-muted-foreground"}`} />
                </button>
              ))}
            </div>
          ) : null}
          <div className="space-y-8">
            {selectedChannel ? (
                <ChannelAnalysis
                  key={selectedChannel.id}
                  channel={selectedChannel}
                  snapshots={(snapshots ?? []).filter(
                    (snapshot) => snapshot.channel_id === selectedChannel.id,
                  )}
                  onRefresh={() => refresh(selectedChannel.id)}
                  onDelete={() => remove(selectedChannel.id)}
                  refreshing={refreshingId === selectedChannel.id}
                  progress={(growthWorkspace?.progress ?? []).filter(
                    (item) => item.channel_id === selectedChannel.id,
                  )}
                  workspace={(growthWorkspace?.workspace ?? []).find(
                    (item) => item.channel_id === selectedChannel.id,
                  )}
                  onSaveIssue={async (input) => {
                    await saveIssueFn({ data: { channelId: selectedChannel.id, ...input } });
                    await queryClient.invalidateQueries({ queryKey: ["growth-workspace"] });
                    toast.success(input.completed ? "Issue marked complete" : "Issue reopened");
                  }}
                  onSaveWorkspace={async (input) => {
                    await saveWorkspaceFn({ data: { channelId: selectedChannel.id, ...input } });
                    await queryClient.invalidateQueries({ queryKey: ["growth-workspace"] });
                    toast.success("Channel workspace saved");
                  }}
                />
            ) : channels && channels.length > 0 ? (
              <div className="sb-card p-8 text-center text-muted-foreground">
                No saved channels match this search or filter.
              </div>
            ) : null}
            {channels && channels.length === 0 && (
              <div className="sb-card p-10 text-center">
                <p className="text-muted-foreground">No channels yet.</p>
                <Link
                  to="/"
                  className="mt-4 inline-block rounded-lg bg-neon px-5 py-2.5 font-bold text-primary-foreground"
                >
                  Submit your first channel
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
