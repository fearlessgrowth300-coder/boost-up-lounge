import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/sb/logo";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Sign In — StreamBoost";
const DESC = "Sign in to StreamBoost to distribute your Kick and Twitch streams across 500+ gaming sites.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          toast.success("Account created — check your email to confirm.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Authentication failed";
      const message = /weak|pwned|known to be weak/i.test(raw)
        ? "That password has appeared in known data breaches. Please pick a stronger, unique password."
        : /email not confirmed/i.test(raw)
          ? "Your email isn't confirmed yet. Tap 'No account? Sign up' and submit the same email and password once to activate it."
          : raw;
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center px-5 py-16">
      <Link to="/">
        <Logo />
      </Link>
      <form onSubmit={handleSubmit} className="sb-card mt-8 w-full max-w-md space-y-5 p-7">
        <h1 className="font-display text-2xl font-extrabold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        {errorMsg ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </p>
        ) : null}
        {checkEmail ? (
          <p className="rounded-lg border border-neon/40 bg-neon/10 px-4 py-3 text-sm text-neon">
            Confirmation email sent to {email}. Click the link, then sign in.
          </p>
        ) : null}
        <div className="space-y-2">
          <label className="block text-sm font-semibold" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm outline-none focus:border-neon"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm outline-none focus:border-neon"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="glow-neon flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3.5 font-display font-bold text-primary-foreground disabled:opacity-70"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "signin" ? "Sign In" : "Sign Up"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
