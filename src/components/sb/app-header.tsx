import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { autoRefreshChannels } from "@/lib/streamboost.functions";
import { Logo } from "./logo";

const APP_LINKS = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Channels", to: "/channels" },
  { label: "Progress", to: "/progress" },
  { label: "Campaigns", to: "/campaigns" },
  { label: "Admin", to: "/admin" },
] as const;

export function AppHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refreshChannels = useServerFn(autoRefreshChannels);

  useEffect(() => {
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const result = await refreshChannels({});
        if (result.updated > 0) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["channels"] }),
            queryClient.invalidateQueries({ queryKey: ["channel-snapshots"] }),
            queryClient.invalidateQueries({ queryKey: ["growth-workspace"] }),
          ]);
        }
      } catch {
        // The next interval retries transient Twitch or network failures silently.
      } finally {
        running = false;
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [queryClient, refreshChannels]);
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link to="/dashboard" aria-label="Open dashboard">
          <Logo suffix="Dashboard" />
        </Link>
        <nav
          className="order-3 flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/30 p-1 lg:order-none lg:w-auto"
          aria-label="Application pages"
        >
          {APP_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-neon text-primary-foreground" }}
              inactiveProps={{
                className: "text-muted-foreground hover:bg-background hover:text-neon",
              }}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-2">
          <Link
            to="/"
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-neon"
          >
            Public Website
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-neon"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
