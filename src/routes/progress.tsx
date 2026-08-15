import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/sb/app-header";
import { useAppAuth } from "@/hooks/use-app-auth";
import { buildGrowthAudit, calculateHealthScore } from "@/lib/channel-growth-audit";
import {
  listChannels,
  listChannelSnapshots,
  listGrowthWorkspace,
} from "@/lib/streamboost.functions";

export const Route = createFileRoute("/progress")({
  validateSearch: (search: Record<string, unknown>) => ({
    channel: typeof search["channel"] === "string" ? search["channel"] : undefined,
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const ready = useAppAuth();
  const { channel: selectedId } = Route.useSearch();
  const channelsFn = useServerFn(listChannels);
  const snapshotsFn = useServerFn(listChannelSnapshots);
  const workspaceFn = useServerFn(listGrowthWorkspace);
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
  const { data: growth } = useQuery({
    queryKey: ["growth-workspace"],
    queryFn: () => workspaceFn({}),
    enabled: ready,
  });
  const visible = selectedId
    ? (channels ?? []).filter((channel) => channel.id === selectedId)
    : (channels ?? []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Channel Progress</h1>
          <p className="mt-2 text-muted-foreground">
            Compare the first analysis with the latest Twitch snapshot and completed work.
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {visible.map((channel) => {
            const rows = (snapshots ?? [])
              .filter((row) => row.channel_id === channel.id)
              .sort(
                (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
              );
            const first = rows[0];
            const latest = rows.at(-1);
            const audit = buildGrowthAudit(channel);
            const completed = (growth?.progress ?? []).filter(
              (item) => item.channel_id === channel.id && item.completed,
            );
            const followerChange = first && latest ? latest.followers - first.followers : 0;
            return (
              <article key={channel.id} className="sb-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {channel.avatar_url ? (
                      <img src={channel.avatar_url} alt="" className="size-12 rounded-full" />
                    ) : null}
                    <div>
                      <h2 className="font-display text-xl font-bold">{channel.username}</h2>
                      <p className="text-xs text-muted-foreground">
                        Tracked since{" "}
                        {first ? new Date(first.recorded_at).toLocaleDateString() : "today"}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/r/${encodeURIComponent(channel.username)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-neon px-4 py-2 text-sm font-bold text-neon"
                  >
                    Open Streamer Report
                  </a>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    icon={TrendingUp}
                    label="Follower change"
                    value={`${followerChange >= 0 ? "+" : ""}${followerChange}`}
                  />
                  <Metric
                    icon={Activity}
                    label="Current health"
                    value={`${calculateHealthScore(
                      audit,
                      completed.map((item) => item.issue_id),
                    )}%`}
                  />
                  <Metric
                    icon={CheckCircle2}
                    label="Issues completed"
                    value={`${completed.length}/${audit.length}`}
                  />
                  <Metric icon={Activity} label="Saved snapshots" value={String(rows.length)} />
                </div>
                <div className="mt-6 overflow-x-auto">
                  <div className="flex min-w-max gap-3">
                    {rows.slice(-12).map((row) => (
                      <div key={row.id} className="w-40 rounded-lg bg-secondary/60 p-3 text-xs">
                        <b className="block text-sm">
                          {new Date(row.recorded_at).toLocaleDateString()}
                        </b>
                        <span className="mt-2 block text-cyan">{row.followers} followers</span>
                        <span className="block text-neon">{row.health_score}% health</span>
                        <span className="block text-muted-foreground">
                          {row.issue_count} issues
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/60 p-4">
      <Icon className="size-4 text-neon" />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
