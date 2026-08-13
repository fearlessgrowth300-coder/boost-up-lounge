import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Link2,
  Zap,
  TrendingUp,
  Target,
  Globe,
  BarChart3,
  Clock,
  Shield,
  Users,
  Check,
  Loader2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Logo } from "@/components/sb/logo";
import { submitChannel } from "@/lib/streamboost.functions";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "StreamBoost — Amplify Your Gaming Streams";
const DESC =
  "Automatically distribute your Kick & Twitch streams across 500+ top gaming networks and get discovered by millions of gamers instantly.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Index,
});

const STEPS = [
  {
    icon: Link2,
    tone: "text-neon",
    title: "Submit Your Stream",
    body: "Drop your Kick or Twitch channel URL. Takes less than 30 seconds.",
  },
  {
    icon: Zap,
    tone: "text-cyan",
    title: "Instant Distribution",
    body: "We automatically place your live stream across 500+ gaming sites and networks.",
  },
  {
    icon: TrendingUp,
    tone: "text-orange",
    title: "Watch Growth Explode",
    body: "Get real-time viewers clicking through from major gaming platforms directly to your stream.",
  },
];

const BENEFITS = [
  { icon: Target, title: "Targeted Placement", body: "Your stream appears on sites your audience actually visits" },
  { icon: Globe, title: "Global Network", body: "Reach gamers across 500+ gaming blogs and clip sites" },
  { icon: BarChart3, title: "Real-Time Analytics", body: "Track clicks, views, and engagement in real-time" },
  { icon: Clock, title: "24/7 Automation", body: "Set it once, we handle distribution automatically" },
  { icon: Shield, title: "Brand Safe", body: "Only premium gaming sites in our network" },
  { icon: Users, title: "Viewer Quality", body: "Direct traffic from engaged gaming communities" },
];

function Index() {
  const navigate = useNavigate();
  const submit = useServerFn(submitChannel);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        sessionStorage.setItem("sb_pending_channel", url.trim());
        navigate({ to: "/auth" });
        return;
      }
      await submit({ data: { url: url.trim() } });
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-foreground">How It Works</a>
            <a href="#benefits" className="hover:text-foreground">Benefits</a>
            <a href="#start" className="hover:text-foreground">Get Started</a>
          </nav>
          <Link
            to="/auth"
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-neon hover:text-neon"
          >
            Sign In
          </Link>
        </div>
      </header>

      <section className="grid-bg relative overflow-hidden border-b border-border/60">
        <div className="mx-auto max-w-4xl px-5 py-24 text-center md:py-32">
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
            <span className="text-gradient-hero">STREAM. DISTRIBUTE. DOMINATE.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground">{DESC}</p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <a
              href="#start"
              className="glow-neon rounded-lg bg-neon px-8 py-3.5 font-display text-base font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Start Distribution
            </a>
            <a
              href="#how-it-works"
              className="rounded-lg border border-cyan px-8 py-3.5 font-display text-base font-bold text-cyan hover:bg-cyan/10"
            >
              How It Works
            </a>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              { value: "500+", label: "Gaming Sites", tone: "text-neon" },
              { value: "50M+", label: "Monthly Reach", tone: "text-cyan" },
              { value: "24/7", label: "Auto Distribution", tone: "text-orange" },
            ].map((stat) => (
              <div key={stat.label} className="sb-card px-6 py-7">
                <p className={`font-display text-4xl font-extrabold ${stat.tone}`}>{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-border/60 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--neon)_10%,transparent),transparent_60%)]">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="text-center font-display text-4xl font-extrabold md:text-5xl">
            How It <span className="text-neon">Works</span>
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            Three simple steps to reach millions of potential viewers
          </p>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.title} className="sb-card p-7">
                <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
                  <step.icon className={`size-6 ${step.tone}`} />
                </div>
                <h3 className="mt-7 font-display text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="text-center font-display text-4xl font-extrabold md:text-5xl">
            Why Streamers <span className="text-cyan">Choose Us</span>
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            The most powerful distribution network for live streamers
          </p>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="sb-card p-7">
                <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
                  <benefit.icon className="size-5 text-cyan" />
                </div>
                <h3 className="mt-6 font-display text-lg font-bold">{benefit.title}</h3>
                <p className="mt-2 text-muted-foreground">{benefit.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="border-b border-border/60">
        <div className="mx-auto max-w-2xl px-5 py-24">
          <h2 className="text-center font-display text-4xl font-extrabold md:text-5xl">
            Start <span className="text-neon">Growing</span> Today
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            Drop your channel URL and watch your viewership skyrocket
          </p>

          <form onSubmit={handleSubmit} className="sb-card mt-10 space-y-5 p-7">
            <label className="block text-sm font-semibold" htmlFor="channel-url">
              Your Kick or Twitch Channel URL
            </label>
            <input
              id="channel-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://kick.com/yourchannel or https://twitch.tv/yourchannel"
              className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-neon"
            />
            <ul className="space-y-2 rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
              {[
                "Instant distribution to 500+ gaming sites",
                "Real-time click tracking & analytics",
                "No credit card required to start",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="flex size-4 items-center justify-center rounded bg-success">
                    <Check className="size-3 text-primary-foreground" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              type="submit"
              disabled={loading}
              className="glow-neon flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3.5 font-display font-bold text-primary-foreground disabled:opacity-70"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Distributing..." : "Start Distribution Now"}
            </button>
          </form>
        </div>
      </section>

      <footer className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
        <div>
          <p className="font-display text-xl font-extrabold text-neon">StreamBoost</p>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Amplifying streamers across the gaming universe. Get your content in front of millions.
          </p>
        </div>
        <div>
          <p className="font-display font-bold">Quick Links</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="#how-it-works" className="hover:text-foreground">How It Works</a></li>
            <li><a href="#start" className="hover:text-foreground">Submit Channel</a></li>
            <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-display font-bold">Legal</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Privacy Policy</li>
            <li>Terms of Service</li>
            <li>Contact</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
