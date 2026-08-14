import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, Target, Percent, Globe } from "lucide-react";
import { Logo } from "@/components/sb/logo";
import { supabase } from "@/integrations/supabase/client";
import { getDashboard, listChannels } from "@/lib/streamboost.functions";

const TITLE = "Dashboard — StreamBoost";
const DESC = "Track clicks, conversions and partner-site traffic for your distributed streams.";

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

function DashboardPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const dashboard = useServerFn(getDashboard);
  const channelsFn = useServerFn(listChannels);

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

  const clicks = data?.clicks ?? [];
  const conversions = clicks.filter((c) => c.converted).length;
  const rate = clicks.length ? ((conversions / clicks.length) * 100).toFixed(1) : "0.0";
  const sites = new Set(clicks.map((c) => c.source_domain).filter(Boolean)).size;

  const stats = [
    { icon: MousePointerClick, label: "Total Clicks", value: String(clicks.length), tone: "text-neon" },
    { icon: Target, label: "Conversions", value: String(conversions), tone: "text-cyan" },
    { icon: Percent, label: "Conversion Rate", value: `${rate}%`, tone: "text-orange" },
    { icon: Globe, label: "Partner Sites", value: String(sites), tone: "text-neon" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/"><Logo suffix="Dashboard" /></Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-neon hover:text-neon"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="sb-card p-6">
              <stat.icon className={`size-5 ${stat.tone}`} />
              <p className={`mt-4 font-display text-3xl font-extrabold ${stat.tone}`}>{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <section className="sb-card p-6">
          <h2 className="font-display text-xl font-bold">Your Verified Channels</h2>
          <div className="mt-5 space-y-3">
            {(channels ?? []).map((channel) => (
              <div key={channel.id} className="flex items-center justify-between rounded-lg bg-secondary/60 p-4">
                <div>
                  <p className="font-semibold">{channel.username}</p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {channel.platform} · {channel.is_live ? "Live" : "Offline"}
                  </p>
                </div>
                <Link
                  to="/p/$id"
                  params={{ id: channel.id }}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-neon hover:text-neon"
                >
                  Promo link
                </Link>
              </div>
            ))}
            {channels && channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No channels yet — <Link to="/" className="text-neon">submit one</Link>.
              </p>
            ) : null}
          </div>
        </section>

        <section className="sb-card p-6">
          <h2 className="font-display text-xl font-bold">Recent Activity</h2>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            {(data?.activity ?? []).map((item, i) => (
              <li key={i} className="flex justify-between rounded-lg bg-secondary/60 px-4 py-3">
                <span>{item.event_type.replace(/_/g, " ")}</span>
                <span>{new Date(item.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
