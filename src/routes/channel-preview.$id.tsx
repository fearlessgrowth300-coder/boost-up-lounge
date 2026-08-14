import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Activity,
  Share2,
  Copy,
  ExternalLink,
  Users,
  MousePointerClick,
  Globe,
  Rocket,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/sb/logo";
import { getPublicReport } from "@/lib/streamboost.functions";

const TITLE = "Channel Growth Report — StreamBoost";
const DESC = "Live channel health score, monetization progress and traffic sources for this stream.";

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

function Bar({ label, value, goal, tone }: { label: string; value: number; goal: number; tone: string }) {
  const pct = Math.min(100, goal ? (value / goal) * 100 : 0);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value} / {goal}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-secondary">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ChannelPreview() {
  const { id } = Route.useParams();
  const report = useServerFn(getPublicReport);
  const { data, isPending } = useQuery({
    queryKey: ["public-report", id],
    queryFn: () => report({ data: { id } }),
  });

  if (isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading report…</div>;
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="font-display text-3xl font-extrabold">Report not found</h1>
        <p className="text-muted-foreground">This channel report doesn't exist or was removed.</p>
        <Link to="/" className="rounded-lg bg-neon px-5 py-2.5 font-bold text-primary-foreground">Go home</Link>
      </div>
    );
  }

  const { channel, clicks } = data;
  const promoUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${channel.id}` : `/p/${channel.id}`;
  const issues = [
    !channel.is_live && "Channel offline — losing money right now",
    (channel.followers ?? 0) < 50 && "Below Twitch Affiliate follower requirement",
  ].filter(Boolean) as string[];
  const health = Math.max(0, 100 - issues.length * 50);
  const sources = Object.entries(
    clicks.reduce<Record<string, number>>((acc, c) => {
      const key = c.source_domain ?? "direct";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/"><Logo /></Link>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Report link copied");
            }}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-neon hover:text-neon"
          >
            <Share2 className="size-4" /> Share
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
        <div>
          <h1 className="font-display text-3xl font-extrabold">
            {channel.username} <span className="text-neon">Performance Report</span>
          </h1>
          <p className="mt-2 text-sm capitalize text-muted-foreground">
            {channel.platform} · {channel.is_live ? `Live · ${channel.viewer_count ?? 0} viewers` : "Offline"}
          </p>
        </div>

        {issues.length > 0 ? (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6">
            <div className="flex items-center gap-2 font-display font-bold text-destructive">
              <AlertTriangle className="size-5" /> CHANNEL ISSUES DETECTED
              <span className="ml-auto rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                {issues.length} CRITICAL
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {issues.map((issue) => <li key={issue}>• {issue}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="sb-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Overall Health Score</p>
          <p className={`mt-2 font-display text-6xl font-extrabold ${health > 50 ? "text-neon" : "text-destructive"}`}>
            {health}%
          </p>
          <div className="mt-4 h-2 rounded-full bg-secondary">
            <div className={`h-2 rounded-full ${health > 50 ? "bg-neon" : "bg-destructive"}`} style={{ width: `${health}%` }} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Users, label: "Followers", value: channel.followers ?? 0, tone: "text-cyan" },
            { icon: MousePointerClick, label: "Total Clicks", value: clicks.length, tone: "text-neon" },
            { icon: Globe, label: "Traffic Sources", value: sources.length, tone: "text-orange" },
          ].map((s) => (
            <div key={s.label} className="sb-card p-5">
              <s.icon className={`size-5 ${s.tone}`} />
              <p className={`mt-3 font-display text-2xl font-extrabold ${s.tone}`}>{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="sb-card space-y-5 p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Activity className="size-5 text-neon" /> Path to Monetization
          </h2>
          <Bar label="Followers (Affiliate)" value={channel.followers ?? 0} goal={50} tone="bg-neon" />
          <Bar label="Average Viewers" value={channel.viewer_count ?? 0} goal={3} tone="bg-cyan" />
          <Bar label="Promo Clicks" value={clicks.length} goal={100} tone="bg-orange" />
        </section>

        <section className="sb-card p-6">
          <h2 className="font-display text-xl font-bold">Sites Sending You Traffic</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {sources.length === 0 ? (
              <li className="text-muted-foreground">No traffic recorded yet.</li>
            ) : (
              sources.map(([site, count]) => (
                <li key={site} className="flex justify-between rounded-lg bg-secondary/60 px-4 py-3">
                  <span>{site}</span>
                  <span className="font-semibold text-neon">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="sb-card p-6">
          <h2 className="font-display text-xl font-bold">Your Promotion Link</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              readOnly
              value={promoUrl}
              className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(promoUrl);
                toast.success("Promo link copied");
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-neon px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              <Copy className="size-4" /> Copy
            </button>
            <a
              href={promoUrl}
              className="flex items-center justify-center gap-2 rounded-lg border border-cyan px-4 py-3 text-sm font-bold text-cyan"
            >
              <ExternalLink className="size-4" /> Open
            </a>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            {["Share in gaming Discords", "Post on X, Reddit and TikTok bios", "Pin it in your stream chat"].map((tip) => (
              <li key={tip} className="flex items-center gap-2">
                <span className="flex size-4 items-center justify-center rounded bg-success">
                  <Check className="size-3 text-primary-foreground" />
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-neon/50 bg-neon/10 p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Rocket className="size-5 text-neon" /> Supercharge Your Growth
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            One-time $99 campaign token — priority placement across all 500+ partner sites, boosted rotation and
            detailed conversion reporting. Limited slots each week.
          </p>
        </section>

        <footer className="pb-10 text-center text-sm text-muted-foreground">
          Powered by <span className="font-bold text-neon">StreamBoost</span>
        </footer>
      </main>
    </div>
  );
}
