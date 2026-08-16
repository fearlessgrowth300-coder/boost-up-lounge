import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, FileText, MousePointerClick, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/sb/app-header";
import { useAppAuth } from "@/hooks/use-app-auth";
import { getAccountSettings, listChannels, listGrowthWorkspace } from "@/lib/streamboost.functions";

export const Route = createFileRoute("/campaigns")({ component: CampaignsPage });

function CampaignsPage() {
  const ready = useAppAuth();
  const channelsFn = useServerFn(listChannels);
  const workspaceFn = useServerFn(listGrowthWorkspace);
  const settingsFn = useServerFn(getAccountSettings);
  const { data: channels } = useQuery({
    queryKey: ["channels"],
    queryFn: () => channelsFn({}),
    enabled: ready,
  });
  const { data: growth } = useQuery({
    queryKey: ["growth-workspace"],
    queryFn: () => workspaceFn({}),
    enabled: ready,
  });
  const { data: settings } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => settingsFn({}),
    enabled: ready,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Channel Campaigns</h1>
            <p className="mt-2 text-muted-foreground">
              All analyzed channels, share links, promotion links, and issued campaign tokens.
            </p>
          </div>
          <Rocket className="size-8 text-neon" />
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {(channels ?? []).map((channel) => {
            const token = growth?.tokens.find(
              (item) => item.channel_id === channel.id && item.status !== "revoked",
            );
            const slug = channel.public_slug ?? channel.username.toLowerCase();
            const promo = `${window.location.origin}/go/${encodeURIComponent(slug)}`;
            const report = `${window.location.origin}/r/${encodeURIComponent(slug)}`;
            return (
              <article key={channel.id} className="sb-card p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold">{channel.username}</h2>
                    <p className="text-xs text-muted-foreground">
                      {channel.platform} · analyzed{" "}
                      {channel.last_checked_at
                        ? new Date(channel.last_checked_at).toLocaleDateString()
                        : "recently"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${token?.status === "active" ? "bg-neon/15 text-neon" : token?.status === "issued" ? "bg-orange/15 text-orange" : "bg-secondary text-muted-foreground"}`}
                  >
                    {token?.status ?? "No token"}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <LinkCard
                    icon={FileText}
                    label="Streamer Report"
                    description="Send this to the streamer"
                    display={`/r/${slug}`}
                    value={report}
                  />
                  <LinkCard
                    icon={MousePointerClick}
                    label="Promotion Link"
                    description="Tracks visits before Twitch opens"
                    display={`/go/${slug}`}
                    value={promo}
                  />
                </div>
                {token ? (
                  <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4 text-xs">
                    <p>
                      <b>Token:</b> {token.token_preview}
                    </p>
                    <p className="mt-1">
                      <b>Fiverr order:</b> {token.fiverr_order_reference ?? "Not recorded"}
                    </p>
                    <p className="mt-1">
                      <b>Issued:</b> {new Date(token.issued_at).toLocaleString()}
                    </p>
                    {token.activated_at ? (
                      <p className="mt-1 text-neon">
                        <b>Activated:</b> {new Date(token.activated_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  {settings?.fiverrProfileUrl ? (
                    <a
                      href={settings.fiverrProfileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
                    >
                      Verify Fiverr Payment
                    </a>
                  ) : null}
                  <a
                    href={`/dashboard#channels`}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
                  >
                    Manage & Issue Token
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function LinkCard({
  icon: Icon,
  label,
  description,
  display,
  value,
}: {
  icon: typeof FileText;
  label: string;
  description: string;
  display: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-background p-2 text-cyan">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-background px-3 py-2">
        <p className="truncate text-xs font-semibold text-cyan">{display}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() =>
            navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`))
          }
          className="flex items-center justify-center gap-1.5 rounded-lg bg-neon px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          <Copy className="size-3" /> Copy
        </button>
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold"
        >
          <ExternalLink className="size-3" /> Open
        </a>
      </div>
    </div>
  );
}
