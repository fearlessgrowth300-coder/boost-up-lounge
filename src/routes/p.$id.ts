import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function parseVisitDevice(userAgent: string) {
  const deviceType = /tablet|ipad/i.test(userAgent)
    ? "Tablet"
    : /mobile|iphone|ipod|android/i.test(userAgent)
      ? "Mobile"
      : "Desktop";
  const operatingSystem = /windows/i.test(userAgent)
    ? "Windows"
    : /android/i.test(userAgent)
      ? "Android"
      : /iphone|ipad|ipod/i.test(userAgent)
        ? "iOS"
        : /mac os|macintosh/i.test(userAgent)
          ? "macOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "Other";
  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /opr\//i.test(userAgent)
      ? "Opera"
      : /firefox\//i.test(userAgent)
        ? "Firefox"
        : /chrome\//i.test(userAgent)
          ? "Chrome"
          : /safari\//i.test(userAgent)
            ? "Safari"
            : "Other";
  return { deviceType, operatingSystem, browser };
}

export const Route = createFileRoute("/p/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const parsed = z.string().uuid().safeParse(params.id);
        if (!parsed.success) return new Response("Not found", { status: 404 });

        const { createClient } = await import("@supabase/supabase-js");
        const publicClient = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: channel } = await publicClient
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

        const userAgent = request.headers.get("user-agent") ?? "";
        const device = parseVisitDevice(userAgent);
        const language = request.headers.get("accept-language")?.split(",")[0] ?? null;
        const { error: trackingError } = await publicClient.rpc("record_promo_click", {
          p_channel_id: channel.id,
          p_country: country,
          p_country_code: code ?? null,
          p_referrer: referrer,
          p_source_domain: sourceDomain,
          p_user_agent: userAgent || null,
          p_device_type: device.deviceType,
          p_operating_system: device.operatingSystem,
          p_browser: device.browser,
          p_language: language,
        });
        if (trackingError) {
          console.warn("Promotion click could not be recorded", trackingError.message);
        }

        return new Response(null, { status: 302, headers: { Location: channel.channel_url } });
      },
    },
  },
});
