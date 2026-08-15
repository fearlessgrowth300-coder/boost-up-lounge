import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/go/$username")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: channel } = await client
          .from("channels")
          .select("id")
          .eq("platform", "twitch")
          .ilike("username", params.username)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!channel) return new Response("Channel not found", { status: 404 });
        const url = new URL(request.url);
        return new Response(null, {
          status: 307,
          headers: { Location: `${url.origin}/p/${channel.id}` },
        });
      },
    },
  },
});
