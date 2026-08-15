import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function validCountryCode(value: string | null) {
  const code = value?.trim().toUpperCase() ?? null;
  return code && code !== "XX" && /^[A-Z]{2}$/.test(code) ? code : null;
}

async function resolveCountry(request: Request) {
  let code = validCountryCode(
    request.headers.get("cf-ipcountry") ??
      request.headers.get("x-vercel-ip-country") ??
      request.headers.get("x-country-code"),
  );
  let country: string | null = null;

  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidateIp = forwardedIp || realIp;
  const isLocalIp =
    !candidateIp ||
    candidateIp === "::1" ||
    candidateIp === "127.0.0.1" ||
    candidateIp.startsWith("10.") ||
    candidateIp.startsWith("192.168.") ||
    candidateIp.startsWith("172.");

  if (!code) {
    try {
      const lookupUrl = isLocalIp
        ? "https://ipwho.is/"
        : `https://ipwho.is/${encodeURIComponent(candidateIp)}`;
      const response = await fetch(lookupUrl, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const result = (await response.json()) as {
          success?: boolean;
          country?: string;
          country_code?: string;
        };
        if (result.success !== false) {
          code = validCountryCode(result.country_code ?? null);
          country = result.country?.trim() || null;
        }
      }
    } catch {
      // Geographic enrichment is optional; never block the promotion redirect.
    }
  }

  if (!country && code) {
    try {
      country = COUNTRY_NAMES.of(code) ?? code;
    } catch {
      country = code;
    }
  }
  return { code, country };
}

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

        const { code, country } = await resolveCountry(request);

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

        if (!trackingError && process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { count } = await supabaseAdmin
            .from("clicks")
            .select("id", { count: "exact", head: true })
            .eq("channel_id", channel.id);
          const total = count ?? 0;
          const milestone = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
            .filter((value) => value <= total)
            .at(-1);
          if (milestone) {
            const { data: campaign } = await supabaseAdmin
              .from("campaign_tokens")
              .update({ delivery_clicks: total, last_delivery_milestone: milestone })
              .eq("channel_id", channel.id)
              .eq("status", "active")
              .lt("last_delivery_milestone", milestone)
              .select("id, user_id, notification_email")
              .maybeSingle();
            if (campaign) {
              const { data: details } = await supabaseAdmin
                .from("channels")
                .select("username")
                .eq("id", channel.id)
                .single();
              const { data: slug } = await supabaseAdmin
                .from("channel_public_slugs")
                .select("slug")
                .eq("channel_id", channel.id)
                .single();
              const { sendNotification } = await import("@/lib/notifications.server");
              await sendNotification({
                event: "delivery_milestone",
                eventKey: `delivery-${campaign.id}-${milestone}`,
                to: campaign.notification_email,
                channelId: channel.id,
                campaignTokenId: campaign.id,
                userId: campaign.user_id,
                channelName: details?.username ?? "Twitch channel",
                heading: `${milestone.toLocaleString()} campaign clicks delivered`,
                message: `Your StreamBoost promotion link has reached ${milestone.toLocaleString()} verified tracked clicks.`,
                actionPath: `/r/${encodeURIComponent(slug?.slug ?? details?.username ?? "channel")}`,
              });
            }
          }
        }

        return new Response(null, { status: 302, headers: { Location: channel.channel_url } });
      },
    },
  },
});
