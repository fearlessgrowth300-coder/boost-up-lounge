import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Logo } from "@/components/sb/logo";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  createBulkCampaigns,
  deleteChannel,
  getDashboard,
  listChannels,
  refreshChannel,
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

type Channel = Tables<"channels">;
type Click = Tables<"clicks">;
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

function ClickChart({ clicks, days }: { clicks: Click[]; days: number | null }) {
  const points = useMemo(() => {
    const count = days ?? 30;
    const now = new Date();
    const rows = Array.from({ length: count }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (count - index - 1));
      return {
        key: date.toISOString().slice(0, 10),
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: 0,
      };
    });
    const map = new Map(rows.map((row) => [row.key, row]));
    clicks.forEach((click) => {
      const row = map.get(click.created_at.slice(0, 10));
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

function ChannelAnalysis({
  channel,
  onRefresh,
  onDelete,
}: {
  channel: Channel;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const host = typeof window === "undefined" ? "localhost" : window.location.hostname;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const promoUrl = `${origin}/p/${channel.id}`;
  const followers = channel.followers ?? 0;
  const issues = Number(!channel.is_live) + Number(followers < 1000);
  const health = Math.max(0, 100 - issues * 50);
  const twitchPlayer = `https://player.twitch.tv/?channel=${encodeURIComponent(channel.username)}&parent=${encodeURIComponent(host)}`;
  const twitchChat = `https://www.twitch.tv/embed/${encodeURIComponent(channel.username)}/chat?parent=${encodeURIComponent(host)}&darkpopout`;
  const recentVideos = (
    Array.isArray(channel.recent_videos) ? channel.recent_videos : []
  ) as RecentVideo[];
  const recentCategories = (
    Array.isArray(channel.recent_categories) ? channel.recent_categories : []
  ) as string[];
  const aiInsights = (Array.isArray(channel.ai_insights) ? channel.ai_insights : []) as string[];

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
            aria-label={`Refresh ${channel.username}`}
            className="rounded-lg border border-border p-2.5 hover:border-neon hover:text-neon"
          >
            <RefreshCw className="size-4" />
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

      <section className="border-t border-destructive/40 bg-destructive/5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          <h3 className="font-display font-bold text-destructive">CHANNEL ISSUES DETECTED</h3>
          <span className="rounded bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
            {issues} CRITICAL
          </span>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(`${origin}/channel-preview/${channel.id}`)
                .then(() => toast.success("Report link copied"))
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
            <p className="text-xs text-muted-foreground">Avg Successful Streamer</p>
            <p className="mt-2 font-display text-4xl font-bold">8,000</p>
          </div>
        </div>
        {!channel.is_live && (
          <div className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <h4 className="font-display font-bold text-destructive">
              CHANNEL OFFLINE — LOSING MOMENTUM
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Go live consistently to grow viewers, followers and revenue opportunities.
            </p>
          </div>
        )}
        {followers < 1000 && (
          <div className="mt-3 rounded-lg border border-orange/40 bg-orange/10 p-4">
            <h4 className="font-display font-bold text-orange">FOLLOWER COUNT NEEDS ATTENTION</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Current: {followers.toLocaleString()} · Target: 1,000 · Gap:{" "}
              {Math.max(0, 1000 - followers).toLocaleString()}
            </p>
          </div>
        )}
      </section>

      <section className="border-t border-border p-6">
        <h3 className="font-display text-lg font-bold">Path to Monetization</h3>
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-semibold text-cyan">Twitch Affiliate</h4>
            <ProgressRow label="Followers" value={followers} goal={50} />
            <ProgressRow
              label="Hours Streamed (30 days)"
              value={channel.is_live ? 1 : 0}
              goal={8}
            />
            <ProgressRow
              label="Average Viewers (7 days)"
              value={channel.viewer_count ?? 0}
              goal={3}
            />
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-orange">Twitch Partner</h4>
            <ProgressRow label="Average Viewers" value={channel.viewer_count ?? 0} goal={75} />
            <ProgressRow
              label="Hours Streamed (30 days)"
              value={channel.is_live ? 1 : 0}
              goal={75}
            />
            <ProgressRow label="Stream Days (30 days)" value={channel.is_live ? 1 : 0} goal={12} />
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
    </article>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [days, setDays] = useState<number | null>(7);
  const [bulkUrls, setBulkUrls] = useState("");
  const dashboard = useServerFn(getDashboard);
  const channelsFn = useServerFn(listChannels);
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
  const countryRows = Object.entries(
    clicks.reduce<Record<string, number>>((acc, click) => {
      const key = click.country ?? "Unknown";
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

  async function refresh(id: string) {
    try {
      await refreshFn({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Channel refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
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
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/">
            <Logo suffix="Dashboard" />
          </Link>
          <div className="flex gap-2">
            <Link
              to="/"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-neon"
            >
              Home
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-neon"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
        <div>
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

        <div className="grid gap-6 xl:grid-cols-3">
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
            <div className="mt-5 space-y-3">
              {countryRows.length ? (
                countryRows.map(([country, count]) => (
                  <div
                    key={country}
                    className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm"
                  >
                    <span>{country}</span>
                    <span className="font-bold text-neon">
                      {count} ({((count / clicks.length) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No geographic data yet.</p>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
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

        <section className="sb-card p-6">
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

        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Your Verified Channels</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Live Twitch data, embeds and growth recommendations.
              </p>
            </div>
            <Users className="size-7 text-cyan" />
          </div>
          <div className="space-y-8">
            {(channels ?? []).map((channel) => (
              <ChannelAnalysis
                key={channel.id}
                channel={channel}
                onRefresh={() => refresh(channel.id)}
                onDelete={() => remove(channel.id)}
              />
            ))}
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
