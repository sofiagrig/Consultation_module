import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Email notifications. Each email says only that there is something new in request #N, with
 * a link: no patient or medical details. Recipients come from consult_notify_emails(), which
 * only the service role may call, so this runs on the server only.
 *
 * Needs (Vercel environment variables): SUPABASE_SECRET_KEY, RESEND_API_KEY, NOTIFY_FROM
 * (e.g. "התייעצות מומחים <consult@shinaim.biz>") and APP_URL (e.g. https://consult.shinaim.net).
 * Without them nothing is sent and the app works as before.
 */

export type Audience = "ops" | "doctor" | "clinic";
export type NotifyEvent =
  | "new_request" // to ops
  | "clinic_reply" // to ops
  | "doctor_reply" // to ops
  | "forwarded" // to the specialist
  | "ops_to_doctor" // to the specialist
  | "answered"; // to the clinic

const COPY: Record<NotifyEvent, { audience: Audience; subject: (id: number) => string; line: string }> = {
  new_request: { audience: "ops", subject: (id) => `פנייה חדשה מס׳ ${id}`, line: "נפתחה פנייה חדשה להתייעצות." },
  clinic_reply: { audience: "ops", subject: (id) => `תגובה מהמרפאה בפנייה מס׳ ${id}`, line: "המרפאה הוסיפה תגובה לפנייה." },
  doctor_reply: { audience: "ops", subject: (id) => `הרופא המומחה ענה בפנייה מס׳ ${id}`, line: "הרופא המומחה כתב בפנייה." },
  forwarded: { audience: "doctor", subject: (id) => `הועברה אליך פנייה מס׳ ${id}`, line: "הועברה אליך פנייה להתייעצות." },
  ops_to_doctor: { audience: "doctor", subject: (id) => `הודעה חדשה בפנייה מס׳ ${id}`, line: "יש הודעה חדשה בפנייה שהועברה אליך." },
  answered: { audience: "clinic", subject: (id) => `התקבלה תשובה לפנייה מס׳ ${id}`, line: "התקבלה תשובה מצוות ההתייעצות." },
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function notify(requestId: number, event: NotifyEvent, opts: { urgent?: boolean } = {}) {
  const { RESEND_API_KEY, NOTIFY_FROM, APP_URL, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_FROM || !APP_URL || !SUPABASE_SECRET_KEY || !NEXT_PUBLIC_SUPABASE_URL) {
    console.info(`notify skipped (email not configured): ${event} #${requestId}`);
    return;
  }

  const copy = COPY[event];
  const admin = createAdminClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("consult_notify_emails", {
    p_request_id: requestId,
    p_audience: copy.audience,
  });
  if (error) {
    console.error("notify: recipients lookup failed", error.message);
    return;
  }
  const recipients = ((data ?? []) as string[]).filter(Boolean);
  if (recipients.length === 0) return;

  const link = `${APP_URL.replace(/\/$/, "")}/requests/${requestId}`;
  const subject = `${opts.urgent ? "דחוף: " : ""}${copy.subject(requestId)}`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#13232b">
<p>שלום,</p>
<p>${escapeHtml(copy.line)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0e7c86;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">לצפייה בפנייה מס׳ ${requestId}</a></p>
<p style="color:#5b6b72;font-size:13px">ההודעה נשלחה אוטומטית ממערכת ההתייעצות. פרטי המטופל מוצגים רק במערכת.</p>
</div>`;
  const text = `שלום,\n${copy.line}\nלצפייה בפנייה מס׳ ${requestId}: ${link}`;

  // One email per recipient, so addresses are not shared between recipients.
  await Promise.all(
    recipients.map(async (to) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: NOTIFY_FROM, to: [to], subject, html, text }),
      });
      if (!res.ok) console.error(`notify: send failed (${res.status}) for ${event} #${requestId}`);
    }),
  );
}
