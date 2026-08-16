import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Clock3,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/sb/logo";
import {
  buildGrowthAudit,
  calculateHealthScore,
  getAuditActionPlan,
} from "@/lib/channel-growth-audit";
import { activateCampaignToken, getPublicReport } from "@/lib/streamboost.functions";

const TITLE = "Channel Growth Report — StreamBoost";
const DESC =
  "Live channel health score, monetization progress and traffic sources for this stream.";

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

const TRANSFORMATIONS = [
  {
    name: "Jlesto",
    before: "/transformations/jlesto-before.png",
    after: "/transformations/jlesto-after.png",
    beforeLabel: "50 followers · 2 live viewers",
    afterLabel: "1.3M followers · 4K live viewers",
  },
  {
    name: "Thegamelord",
    before: "/transformations/thegamelord-before.png",
    after: "/transformations/thegamelord-after.png",
    beforeLabel: "25 followers · 1 live viewer",
    afterLabel: "72.5K followers · stronger broadcast reach",
  },
  {
    name: "ROCKJES",
    before: "/transformations/rockjes-before.png",
    after: "/transformations/rockjes-after.png",
    beforeLabel: "31 followers",
    afterLabel: "3.1M followers · high replay reach",
  },
];

export const Route = createFileRoute("/channel-preview/$id")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: ChannelPreview,
});

function GoalBar({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = Math.min(100, goal ? (value / goal) * 100 : 0);
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-4 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">
          {value} / {goal} <span className="text-destructive">(-{Math.max(0, goal - value)})</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-cyan/80">
        <div className="h-full rounded-full bg-neon" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OfflineCover({ children, offline }: { children: React.ReactNode; offline: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-background">
      <div className={offline ? "pointer-events-none blur-[2px]" : undefined}>{children}</div>
      {offline ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/30">
          <span className="flex items-center gap-2 rounded-xl bg-destructive px-5 py-3 font-bold text-destructive-foreground shadow-xl">
            <Clock3 className="size-5" /> Currently Offline
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ChannelPreview() {
  const { id } = Route.useParams();
  return <ChannelReport identifier={id} />;
}

export function ChannelReport({ identifier }: { identifier: string }) {
  const report = useServerFn(getPublicReport);
  const activateToken = useServerFn(activateCampaignToken);
  const [campaignToken, setCampaignToken] = useState("");
  const [activating, setActivating] = useState(false);
  const [campaignActive, setCampaignActive] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ["public-report", identifier],
    queryFn: () => report({ data: { identifier } }),
  });

  if (isPending) {
    return <div className="flex min-h-screen items-center justify-center">Loading report…</div>;
  }
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-3xl font-bold">Report not found</h1>
        <Link to="/" className="rounded-lg bg-neon px-5 py-3 font-bold text-primary-foreground">
          Go home
        </Link>
      </div>
    );
  }

  const { channel, clicks, progress = [] } = data;
  const followers = channel.followers ?? 0;
  const growthAudit = buildGrowthAudit(channel);
  const completedIds = progress.filter((item) => item.completed).map((item) => item.issue_id);
  const health = calculateHealthScore(growthAudit, completedIds);
  const benchmarkLabel =
    followers < 50
      ? "Emerging channel · 0–49 followers"
      : followers < 1000
        ? "Growing channel · 50–999 followers"
        : "Established channel · 1,000+ followers";
  const recentVideos = (
    Array.isArray(channel.recent_videos) ? channel.recent_videos : []
  ) as RecentVideo[];
  const sources = Object.entries(
    clicks.reduce<Record<string, number>>((acc, click) => {
      const source = click.source_domain ?? "Direct";
      acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, {}),
  );
  const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const playerUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(channel.username)}&parent=${encodeURIComponent(parent)}`;
  const chatUrl = `https://www.twitch.tv/embed/${encodeURIComponent(channel.username)}/chat?parent=${encodeURIComponent(parent)}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-neon/60 bg-gradient-to-r from-neon via-neon to-orange text-primary-foreground">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-4">
            <Link to="/" className="rounded-lg bg-background px-3 py-2">
              <Logo />
            </Link>
            <div className="hidden sm:block">
              <p className="text-xs font-extrabold uppercase">Channel Growth Analysis</p>
              <p className="text-xs opacity-70">Professional Stream Promotion Network</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
        <div>
          <h1 className="font-display text-3xl font-extrabold">
            {channel.username} Performance Report
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Real-time analysis and monetization progress tracking
          </p>
        </div>

        <section className="sb-card overflow-hidden">
          {channel.banner_url ? (
            <div className="aspect-[4/1] min-h-36 overflow-hidden border-b border-border bg-secondary">
              <img
                src={channel.banner_url}
                alt={`${channel.username} channel banner`}
                className="size-full object-cover"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-4 border-b border-border p-6">
            {channel.avatar_url ? (
              <img
                src={channel.avatar_url}
                alt={`${channel.username} profile`}
                className="size-16 rounded-full object-cover"
              />
            ) : null}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold">{channel.username}</h2>
                <span className="rounded-full bg-cyan/10 px-2.5 py-1 text-xs capitalize text-cyan">
                  {channel.platform}
                </span>
                {channel.verified ? (
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">
                    Verified
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Last checked{" "}
                {channel.last_checked_at
                  ? new Date(channel.last_checked_at).toLocaleString()
                  : "recently"}
              </p>
              {channel.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{channel.description}</p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <p
                className={`mt-1 font-display text-xl font-bold ${channel.is_live ? "text-neon" : "text-destructive"}`}
              >
                {channel.is_live ? "Live" : "Offline"}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Total Followers</p>
              <p className="mt-1 font-display text-xl font-bold text-cyan">
                {followers.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Current Viewers</p>
              <p className="mt-1 font-display text-xl font-bold text-orange">
                {channel.viewer_count ?? 0}
              </p>
            </div>
          </div>
          <div className="grid gap-4 border-t border-border p-6 md:grid-cols-3">
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Current Category</p>
              <p className="mt-1 font-semibold">
                {channel.current_category ?? "Not currently set"}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-4 md:col-span-2">
              <p className="text-xs text-muted-foreground">Latest Stream Title</p>
              <p className="mt-1 font-semibold">{channel.current_title ?? "Not currently set"}</p>
            </div>
          </div>
          <div className="grid gap-4 border-t border-border p-6 md:grid-cols-2">
            <OfflineCover offline={!channel.is_live}>
              <iframe
                title="Twitch stream"
                src={playerUrl}
                className="aspect-video w-full"
                allowFullScreen
              />
            </OfflineCover>
            <OfflineCover offline={!channel.is_live}>
              <iframe title="Twitch chat" src={chatUrl} className="aspect-video w-full" />
            </OfflineCover>
          </div>
        </section>

        <section className="sb-card p-6">
          <h2 className="font-display text-xl font-bold">Recent Broadcasts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest public Twitch broadcasts and performance.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>{video.category || "Uncategorized"}</span>
                      <span>{video.viewCount.toLocaleString()} views</span>
                    </div>
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                      <span>{video.duration}</span>
                    </div>
                  </div>
                </a>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent public broadcasts were returned by Twitch.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
          <div className="flex flex-wrap items-center gap-3 text-destructive">
            <span className="rounded-lg border border-destructive p-3">
              <AlertTriangle className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">TWITCH CHANNEL HEALTH</h2>
              <p className="text-xs font-semibold text-foreground">
                Channel checks and growth actions for this streamer.
              </p>
            </div>
            <span className="rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">
              {growthAudit.length} ISSUES IDENTIFIED
            </span>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-xl bg-background/70 p-5 text-center">
              <p className="text-xs text-muted-foreground">Overall Health Score</p>
              <p className="mt-2 font-display text-4xl font-bold text-destructive">{health}%</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-destructive"
                  style={{ width: `${health}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl bg-background/70 p-5 text-center">
              <p className="text-xs text-muted-foreground">Your Followers</p>
              <p className="mt-2 font-display text-4xl font-bold">{followers.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-background/70 p-5 text-center">
              <p className="text-xs text-muted-foreground">Relevant Channel Benchmark</p>
              <p className="mt-3 text-sm font-bold text-cyan">{benchmarkLabel}</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {growthAudit.map((issue) => {
              const saved = progress.find((item) => item.issue_id === issue.id);
              const plan = getAuditActionPlan(issue);
              return (
                <article
                  key={issue.id}
                  className={`rounded-xl border p-5 ${saved?.completed ? "border-neon bg-neon/10" : "border-destructive bg-destructive/15"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {issue.phase}
                      </p>
                      <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-destructive">
                        <AlertTriangle className="size-5 shrink-0" /> {issue.title}
                      </h3>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full border border-foreground px-2.5 py-1 text-xs font-bold uppercase text-foreground">
                        {saved?.completed
                          ? "Completed"
                          : issue.classification === "process"
                            ? "Recommended"
                            : issue.status === "critical"
                              ? "Critical"
                              : "Warning"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${issue.classification === "verified" ? "bg-cyan/15 text-cyan" : "bg-orange/15 text-orange"}`}
                      >
                        {issue.classification === "verified"
                          ? "Verified issue · Twitch backend assessment"
                          : "Process to follow"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 border-t border-destructive/40 pt-4">
                    <p className="text-sm">
                      <strong>What it is:</strong> {issue.whatItIs}
                    </p>
                    <p className="text-sm">
                      <strong>Why you need to fix it:</strong> {issue.whyFixIt}
                    </p>
                    <details className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                      <summary className="cursor-pointer font-bold">
                        Action plan · {plan.priority} priority · {plan.deadlineDays} days
                      </summary>
                      <ol className="mt-3 list-decimal space-y-1 pl-5">
                        {plan.actions.map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ol>
                      {saved?.evidence_url ? (
                        <a
                          href={saved.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block font-bold text-cyan"
                        >
                          View completion evidence →
                        </a>
                      ) : null}
                    </details>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-7">
            <h3 className="font-display font-bold text-neon">↗ Path to Monetization</h3>
            <div className="mt-4 space-y-4 rounded-xl bg-background/70 p-5">
              <div className="flex justify-between">
                <h4 className="font-bold">Twitch Affiliate</h4>
                <span className="rounded-full border border-border px-2 py-1 text-xs">
                  In Progress
                </span>
              </div>
              <GoalBar label="Followers" value={followers} goal={25} />
              <GoalBar label="Hours Streamed (30 days)" value={channel.is_live ? 1 : 0} goal={4} />
              <GoalBar
                label="Average Viewers (7 days)"
                value={channel.viewer_count ?? 0}
                goal={3}
              />
            </div>
            <div className="mt-4 space-y-4 rounded-xl bg-background/70 p-5">
              <div className="flex justify-between">
                <h4 className="font-bold">Twitch Partner</h4>
                <span className="rounded-full border border-border px-2 py-1 text-xs">
                  In Progress
                </span>
              </div>
              <GoalBar label="Average Viewers" value={channel.viewer_count ?? 0} goal={75} />
              <GoalBar label="Hours Streamed (30 days)" value={channel.is_live ? 1 : 0} goal={75} />
              <GoalBar label="Stream Days (30 days)" value={channel.is_live ? 1 : 0} goal={12} />
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-gradient-to-r from-destructive to-orange p-6 text-destructive-foreground">
            <div className="flex gap-4">
              <Target className="size-10" />
              <div>
                <h3 className="font-display text-xl font-bold">⚡ FIX ALL ISSUES NOW</h3>
                <p className="mt-2 text-sm font-semibold">
                  Our promotion network distributes your stream to 500+ gaming sites automatically —
                  get more viewers, followers, and revenue FAST!
                </p>
                <p className="mt-2 text-xs">
                  ✓ Instant visibility boost · ✓ 24/7 promotion · ✓ No extra work required
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="sb-card overflow-hidden border-neon/30">
          <div className="border-b border-border bg-gradient-to-r from-neon/15 via-cyan/10 to-orange/15 p-7 text-center">
            <TrendingUp className="mx-auto size-8 text-neon" />
            <h2 className="mt-3 font-display text-2xl font-extrabold">
              Before & After Channel Transformations
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              See how channels can look before growth work and after building stronger visibility,
              reach, content performance, and audience momentum.
            </p>
          </div>
          <div className="space-y-8 p-6">
            <article className="rounded-xl border border-neon/40 bg-neon/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-neon">
                    User-verified recording
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold">
                    Verified Channel Transformation
                  </h3>
                </div>
                <span className="rounded-full bg-neon/15 px-3 py-1 text-xs font-bold text-neon">
                  Video proof
                </span>
              </div>
              <video
                controls
                playsInline
                preload="metadata"
                className="mt-4 aspect-video w-full rounded-lg border border-neon/40 bg-black"
              >
                <source
                  src="/transformations/verified-channel-transformation.mp4"
                  type="video/mp4"
                />
                Your browser does not support video playback.
              </video>
              <p className="mt-3 text-sm text-muted-foreground">
                This real transformation recording was supplied and verified by the report owner.
              </p>
            </article>

            {TRANSFORMATIONS.map((result) => (
              <article
                key={result.name}
                className="rounded-xl border border-border bg-secondary/25 p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold">{result.name}</h3>
                  <span className="rounded-full bg-neon/10 px-3 py-1 text-xs font-bold text-neon">
                    Channel transformation
                  </span>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <figure>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">
                        BEFORE
                      </span>
                      <span className="text-xs text-muted-foreground">{result.beforeLabel}</span>
                    </div>
                    <img
                      src={result.before}
                      alt={`${result.name} channel before transformation`}
                      className="aspect-video w-full rounded-lg border border-destructive/50 object-cover object-top"
                    />
                  </figure>
                  <figure>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded bg-neon px-2.5 py-1 text-xs font-bold text-primary-foreground">
                        AFTER
                      </span>
                      <span className="text-xs text-muted-foreground">{result.afterLabel}</span>
                    </div>
                    <img
                      src={result.after}
                      alt={`${result.name} channel after transformation`}
                      className="aspect-video w-full rounded-lg border border-neon/50 object-cover object-top"
                    />
                  </figure>
                </div>
              </article>
            ))}
          </div>
          <p className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
            Examples are based on supplied channel screenshots. Individual growth results vary and
            are not guaranteed.
          </p>
        </section>

        <section className="rounded-xl border border-neon/10 bg-neon/5 p-7 text-center">
          <h2 className="font-display text-lg font-bold">
            <BarChart3 className="mr-2 inline size-5 text-cyan" />
            Growth Tracking
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your channel is being tracked. Growth metrics will appear here once we have historical
            data.
          </p>
        </section>

        <section className="rounded-xl border border-neon/10 bg-neon/5 p-7">
          <h2 className="font-display text-lg font-bold text-neon">↗ Sites Sending You Traffic</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            These partner sites are actively promoting your channel
          </p>
          <div className="mt-5 rounded-xl bg-background/60 p-7 text-center">
            <Rocket className="mx-auto size-6 text-neon" />
            <h3 className="mt-2 font-bold">Activate Your Campaign</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Get a campaign token to start receiving traffic from our premium partner network
            </p>
            {sources.length > 0 && (
              <p className="mt-3 text-xs text-neon">
                {sources.length} traffic source{sources.length === 1 ? "" : "s"} already recorded
              </p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl bg-gradient-to-br from-neon via-neon to-orange p-7 text-primary-foreground">
          <div className="text-center">
            <span className="inline-flex rounded-full bg-primary-foreground/10 p-4">
              <Zap className="size-8" />
            </span>
            <h2 className="mt-3 font-display text-2xl font-extrabold">Supercharge Your Growth</h2>
            <p className="mt-2 text-sm">
              One-time payment · Lifetime traffic · Premium partner network
            </p>
            <p className="mt-4 rounded-full bg-primary-foreground/10 py-2 text-xs font-bold">
              ◷ LIMITED SLOTS AVAILABLE — ACT NOW!
            </p>
          </div>
          <div className="mt-5 rounded-xl bg-primary-foreground/10 p-6">
            <ul className="space-y-3 text-sm">
              {[
                "Distributed across 50+ gaming and streaming sites",
                "Real-time analytics and performance tracking",
                "Priority placement on partner sites",
                "Guaranteed minimum 10,000 impressions per month",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="size-5" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 rounded-xl bg-background p-6 text-foreground">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Investment</span>
              <span className="text-right">
                <b className="font-display text-3xl text-neon">$99</b>
                <br />
                <small>one-time payment</small>
              </span>
            </div>
            {data.fiverrProfileUrl ? (
              <a
                href={data.fiverrProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 block w-full rounded-lg bg-neon/10 py-3 text-center font-bold text-neon transition hover:bg-neon/20"
              >
                ✨ Purchase Campaign Token Now
              </a>
            ) : (
              <p className="mt-5 rounded-lg bg-secondary px-4 py-3 text-center text-sm text-muted-foreground">
                Campaign purchases are not configured for this report yet.
              </p>
            )}
            <p className="mt-4 text-center text-xs text-muted-foreground">Already have a token?</p>
            <div className="mt-2 flex gap-2">
              <input
                value={campaignToken}
                onChange={(event) => setCampaignToken(event.target.value.toUpperCase())}
                placeholder={`${channel.username.toUpperCase()}-SB-SECRET-CODE`}
                className="min-w-0 flex-1 rounded-lg border border-border bg-input px-4 py-3 text-sm"
              />
              <button
                disabled={activating || campaignActive || !campaignToken.trim()}
                onClick={async () => {
                  setActivating(true);
                  try {
                    const result = await activateToken({
                      data: { channelId: channel.id, token: campaignToken },
                    });
                    setCampaignActive(true);
                    toast.success(
                      result.alreadyActive
                        ? "Campaign is already active"
                        : "Campaign activated successfully",
                    );
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Token activation failed");
                  } finally {
                    setActivating(false);
                  }
                }}
                className="rounded-lg border border-border px-5 text-sm font-bold disabled:opacity-50"
              >
                {campaignActive ? "Active" : activating ? "Checking…" : "Activate"}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Tokens contain an unguessable 192-bit secret, are locked to this channel, and can only
              activate once. The database stores only a secure hash—not the full token.
            </p>
          </div>
          <p className="mt-4 text-center text-xs">
            <ShieldCheck className="mr-1 inline size-4" />
            Secure payment · Money-back guarantee · Instant activation
          </p>
        </section>

        <footer className="rounded-xl border border-border p-7 text-center text-sm text-muted-foreground">
          <p className="font-bold text-neon">Powered by StreamBoost</p>
          <p className="mt-2 text-xs">
            Professional stream promotion network · Helping streamers reach monetization goals
            faster
          </p>
        </footer>
      </main>
    </div>
  );
}
