import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/sb/app-header";
import { useAppAuth } from "@/hooks/use-app-auth";
import { buildGrowthAudit, calculateHealthScore } from "@/lib/channel-growth-audit";
import { listChannels, listGrowthWorkspace } from "@/lib/streamboost.functions";

export const Route = createFileRoute("/channels")({ component: ChannelsPage });

function ChannelsPage() {
  const ready = useAppAuth();
  const channelsFn = useServerFn(listChannels);
  const workspaceFn = useServerFn(listGrowthWorkspace);
  const [search, setSearch] = useState("");
  const { data: channels, isPending } = useQuery({
    queryKey: ["channels"],
    queryFn: () => channelsFn({}),
    enabled: ready,
  });
  const { data: growth } = useQuery({
    queryKey: ["growth-workspace"],
    queryFn: () => workspaceFn({}),
    enabled: ready,
  });
  const filtered = (channels ?? []).filter((channel) => {
    const tags = growth?.workspace.find((item) => item.channel_id === channel.id)?.tags ?? [];
    const query = search.trim().toLowerCase();
    return (
      !query ||
      [channel.username, channel.platform, ...tags].some((value) =>
        value.toLowerCase().includes(query),
      )
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Saved Channels</h1>
            <p className="mt-2 text-muted-foreground">
              Every analyzed channel and its permanent streamer report.
            </p>
          </div>
          <Users className="size-8 text-cyan" />
        </div>
        <label className="mt-7 flex items-center gap-3 rounded-xl border border-border bg-input px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search channel, platform, or tag"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((channel) => {
            const issues = buildGrowthAudit(channel);
            const completed = (growth?.progress ?? [])
              .filter((item) => item.channel_id === channel.id && item.completed)
              .map((item) => item.issue_id);
            const reportUrl = `${window.location.origin}/r/${encodeURIComponent(channel.public_slug ?? channel.username.toLowerCase())}`;
            return (
              <article key={channel.id} className="sb-card overflow-hidden">
                {channel.banner_url ? (
                  <img
                    src={channel.banner_url}
                    alt=""
                    className="aspect-[4/1] w-full object-cover"
                  />
                ) : null}
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    {channel.avatar_url ? (
                      <img src={channel.avatar_url} alt="" className="size-12 rounded-full" />
                    ) : null}
                    <div>
                      <h2 className="font-display text-xl font-bold">{channel.username}</h2>
                      <p className="text-xs text-muted-foreground">
                        {channel.platform} · {channel.is_live ? "Live" : "Offline"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-secondary/60 p-3">
                      <b className="block text-lg text-cyan">{channel.followers}</b>Followers
                    </div>
                    <div className="rounded-lg bg-secondary/60 p-3">
                      <b className="block text-lg text-destructive">{issues.length}</b>Issues
                    </div>
                    <div className="rounded-lg bg-secondary/60 p-3">
                      <b className="block text-lg text-neon">
                        {calculateHealthScore(issues, completed)}%
                      </b>
                      Health
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      to="/progress"
                      search={{ channel: channel.id }}
                      className="rounded-lg bg-neon px-3 py-2 text-xs font-bold text-primary-foreground"
                    >
                      View Progress
                    </Link>
                    <a
                      href={reportUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold"
                    >
                      <ExternalLink className="size-3" /> Public Report
                    </a>
                    <button
                      onClick={() =>
                        navigator.clipboard
                          .writeText(reportUrl)
                          .then(() => toast.success("Report link copied"))
                      }
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold"
                    >
                      <Copy className="size-3" /> Copy
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {isPending ? <p className="mt-8 text-muted-foreground">Loading saved channels…</p> : null}
        {!isPending && !filtered.length ? (
          <div className="sb-card mt-8 p-10 text-center text-muted-foreground">
            No matching saved channels.
          </div>
        ) : null}
      </main>
    </div>
  );
}
