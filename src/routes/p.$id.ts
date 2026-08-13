import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export const Route = createFileRoute("/p/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const parsed = z.string().uuid().safeParse(params.id);
        if (!parsed.success) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: channel } = await supabaseAdmin
          .from("channels")
          .select("id, user_id, platform, channel_url")
          .eq("id", parsed.data)
          .maybeSingle();
        if (!channel) return new Response("Not found", { status: 404 });

        const code = request.headers.get("cf-ipcountry");
        let country: string | null = null;
        if (code && code !== "XX" && code.length === 2) {
          try {
            country = COUNTRY_NAMES.of(code) ?? code;
          } catch {
            country = code;
          }
        }

        const referrer = request.headers.get("referer");
        let sourceDomain: string | null = null;
        if (referrer) {
          try {
            sourceDomain = new URL(referrer).hostname;
          } catch {
            sourceDomain = null;
          }
        }

        await supabaseAdmin.from("clicks").insert({
          channel_id: channel.id,
          country,
          country_code: code ?? null,
          referrer,
          source_domain: sourceDomain,
        });
        await supabaseAdmin.from("activity").insert({
          channel_id: channel.id,
          user_id: channel.user_id,
          event_type: "promo_click",
          platform: channel.platform,
          country,
        });

        return new Response(null, { status: 302, headers: { Location: channel.channel_url } });
      },
    },
  },
});