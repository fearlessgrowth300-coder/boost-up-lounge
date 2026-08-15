type NotificationEvent =
  | "payment_awaiting_verification"
  | "token_issued"
  | "token_activated"
  | "campaign_started"
  | "delivery_milestone"
  | "channel_improved"
  | "campaign_completed";

type NotificationInput = {
  event: NotificationEvent;
  eventKey: string;
  to?: string | null;
  channelId?: string | null;
  campaignTokenId?: string | null;
  userId?: string | null;
  channelName: string;
  heading: string;
  message: string;
  actionPath?: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!,
  );
}

async function logEvent(
  input: NotificationInput,
  status: "sent" | "skipped" | "failed",
  providerMessageId?: string | null,
  errorMessage?: string | null,
) {
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notification_events").upsert(
    {
      user_id: input.userId ?? null,
      channel_id: input.channelId ?? null,
      campaign_token_id: input.campaignTokenId ?? null,
      event_key: input.eventKey,
      event_type: input.event,
      recipient_email: input.to ?? null,
      provider_message_id: providerMessageId ?? null,
      status,
      error_message: errorMessage ?? null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    },
    { onConflict: "event_key", ignoreDuplicates: status === "sent" },
  );
}

export async function sendNotification(input: NotificationInput) {
  const apiKey = process.env["RESEND_API_KEY"];
  const recipient = input.to?.trim() || process.env["NOTIFICATION_EMAIL"]?.trim();
  if (!apiKey || !recipient) {
    await logEvent(input, "skipped", null, !apiKey ? "RESEND_API_KEY is missing" : "No recipient");
    return { sent: false };
  }

  const appUrl = (process.env["APP_URL"] ?? "https://boost-up-lounge.vercel.app").replace(
    /\/$/,
    "",
  );
  const actionUrl = `${appUrl}${input.actionPath ?? "/campaigns"}`;
  const from = process.env["RESEND_FROM_EMAIL"] ?? "StreamBoost <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.eventKey.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `${input.heading} — ${input.channelName}`,
      html: `<!doctype html><html><body style="margin:0;background:#070807;color:#f8fafc;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:36px 20px"><div style="color:#7cff00;font-size:24px;font-weight:800">StreamBoost</div><div style="margin-top:24px;padding:28px;border:1px solid #263125;border-radius:16px;background:#111411"><div style="color:#7cff00;font-size:12px;font-weight:700;text-transform:uppercase">${escapeHtml(input.channelName)}</div><h1 style="font-size:25px;margin:10px 0 14px">${escapeHtml(input.heading)}</h1><p style="color:#cbd5e1;line-height:1.65">${escapeHtml(input.message)}</p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:18px;padding:12px 18px;border-radius:9px;background:#7cff00;color:#071007;text-decoration:none;font-weight:700">Open StreamBoost</a></div><p style="color:#64748b;font-size:12px;margin-top:20px">This is an automated campaign notification from StreamBoost.</p></div></body></html>`,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    const message = result.message ?? result.error?.message ?? `Resend failed [${response.status}]`;
    await logEvent(input, "failed", null, message);
    console.error("Notification delivery failed", input.event, message);
    return { sent: false };
  }
  await logEvent(input, "sent", result.id ?? null);
  return { sent: true, id: result.id };
}
