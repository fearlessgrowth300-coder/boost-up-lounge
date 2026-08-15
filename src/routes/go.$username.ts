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
        const { data: slug } = await client
          .from("channel_public_slugs")
          .select("channel_id")
          .eq("slug", params.username.toLowerCase())
          .maybeSingle();
        if (!slug) return new Response("Channel not found", { status: 404 });
        const url = new URL(request.url);
        return new Response(null, {
          status: 307,
          headers: { Location: `${url.origin}/p/${slug.channel_id}` },
        });
      },
    },
  },
});
