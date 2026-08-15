import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, ExternalLink, Flag, KeyRound, Radio, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/sb/app-header";
import { useAppAuth } from "@/hooks/use-app-auth";
import {
  completeCampaign,
  listChannels,
  listGrowthWorkspace,
  revokeCampaignToken,
} from "@/lib/streamboost.functions";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const ready = useAppAuth();
  const queryClient = useQueryClient();
  const channelsFn = useServerFn(listChannels);
  const workspaceFn = useServerFn(listGrowthWorkspace);
  const revokeFn = useServerFn(revokeCampaignToken);
  const completeFn = useServerFn(completeCampaign);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: () => channelsFn({}),
    enabled: ready,
  });
  const { data: growth } = useQuery({
    queryKey: ["growth-workspace"],
    queryFn: () => workspaceFn({}),
    enabled: ready,
  });
  const tokens = growth?.tokens ?? [];
  const revoke = useMutation({
    mutationFn: ({ tokenId, reason }: { tokenId: string; reason: string }) =>
      revokeFn({ data: { tokenId, reason } }),
    onSuccess: async () => {
      toast.success("Campaign token revoked.");
      await queryClient.invalidateQueries({ queryKey: ["growth-workspace"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const complete = useMutation({
    mutationFn: (tokenId: string) => completeFn({ data: { tokenId } }),
    onSuccess: async () => {
      toast.success("Campaign completed and the streamer was notified.");
      await queryClient.invalidateQueries({ queryKey: ["growth-workspace"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const channelName = (id: string) => channels.find((channel) => channel.id === id)?.username;
  const active = tokens.filter((token) => token.status === "active").length;
  const verified = tokens.filter((token) => token.payment_verified_at).length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Campaign Administration</h1>
            <p className="mt-2 text-muted-foreground">
              Verify Fiverr orders, monitor active campaigns, and revoke compromised tokens.
            </p>
          </div>
          <a
            href="https://www.fiverr.com/harper_harvey_f"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-neon px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Open Fiverr <ExternalLink className="size-4" />
          </a>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Users} label="Tracked channels" value={channels.length} />
          <Metric icon={KeyRound} label="Tokens issued" value={tokens.length} />
          <Metric icon={Radio} label="Active campaigns" value={active} />
          <Metric icon={CheckCircle2} label="Verified payments" value={verified} />
        </section>

        <section className="mt-8 sb-card overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="font-display text-xl font-bold">Order and token registry</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fiverr references are unique. Only cryptographic token previews are stored.
            </p>
          </div>
          <div className="divide-y divide-border">
            {tokens.map((token) => {
              const username = channelName(token.channel_id) ?? "Unknown channel";
              return (
                <article
                  key={token.id}
                  className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{username}</h3>
                      <Status status={token.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{token.token_preview}</p>
                    <Link
                      to="/r/$username"
                      params={{
                        username:
                          channels.find((channel) => channel.id === token.channel_id)
                            ?.public_slug ?? username.toLowerCase(),
                      }}
                      className="mt-2 inline-block text-xs font-bold text-neon"
                    >
                      Open public report
                    </Link>
                  </div>
                  <div className="text-sm">
                    <p>
                      <b>Fiverr order:</b> #{token.fiverr_order_reference ?? "Not recorded"}
                    </p>
                    <p className="mt-1">
                      <b>Verified:</b>{" "}
                      {token.payment_verified_at
                        ? new Date(token.payment_verified_at).toLocaleString()
                        : "No"}
                    </p>
                    <p className="mt-1">
                      <b>Issued:</b> {new Date(token.issued_at).toLocaleString()}
                    </p>
                    {token.activated_at ? (
                      <p className="mt-1 text-neon">
                        <b>Activated:</b> {new Date(token.activated_at).toLocaleString()}
                      </p>
                    ) : null}
                    {token.revocation_reason ? (
                      <p className="mt-1 text-red-400">
                        <b>Revoked:</b> {token.revocation_reason}
                      </p>
                    ) : null}
                  </div>
                  {token.status !== "revoked" && token.status !== "completed" ? (
                    <div className="flex gap-2 lg:w-80">
                      {token.status === "active" ? (
                        <button
                          type="button"
                          disabled={complete.isPending}
                          onClick={() => complete.mutate(token.id)}
                          className="rounded-lg border border-neon/50 px-3 py-2 text-neon disabled:opacity-40"
                          aria-label={`Complete campaign for ${username}`}
                        >
                          <Flag className="size-4" />
                        </button>
                      ) : null}
                      <input
                        value={reasons[token.id] ?? ""}
                        onChange={(event) =>
                          setReasons((current) => ({ ...current, [token.id]: event.target.value }))
                        }
                        placeholder="Revocation reason"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={(reasons[token.id]?.trim().length ?? 0) < 3 || revoke.isPending}
                        onClick={() =>
                          revoke.mutate({ tokenId: token.id, reason: reasons[token.id]!.trim() })
                        }
                        className="rounded-lg border border-red-500/50 px-3 py-2 text-red-400 disabled:opacity-40"
                        aria-label={`Revoke token for ${username}`}
                      >
                        <Ban className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No longer usable</span>
                  )}
                </article>
              );
            })}
            {!tokens.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No campaign tokens yet. Issue one from a channel analysis after verifying its Fiverr
                order.
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="sb-card p-5">
      <Icon className="size-5 text-neon" />
      <p className="mt-4 text-3xl font-extrabold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-neon/15 text-neon"
      : status === "revoked"
        ? "bg-red-500/15 text-red-400"
        : "bg-orange/15 text-orange";
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${color}`}>
      {status}
    </span>
  );
}
