/**
 * Booking notification email — server-side, via Resend.
 *
 * Runs entirely on the server, so the API key never reaches the browser. This
 * is deliberately independent of the EmailJS path used for staff OTP: EmailJS
 * credentials are necessarily exposed in the browser bundle, and reusing its
 * OTP template for bookings meant the booking details rendered through a
 * password-reset layout.
 *
 * Failure is always silent to the visitor. A booking is already saved before
 * this is called; the notification is a convenience for the clinic, and an
 * email problem must never make a patient think their booking failed.
 */

export interface BookingNotification {
  /** Where the alert goes — the clinic's Global Email. */
  toEmail: string;
  patientName: string;
  phone: string;
  patientEmail: string;
  concern: string;
  when: string;
  branch: string;
}

/**
 * Resolve Resend configuration from the environment.
 *
 * RESEND_FROM is optional: Resend requires the sender to be on a domain you
 * have verified with them, so this is left configurable rather than hardcoded
 * to a domain that may not be verified yet.
 */
function resolveEnv(): { apiKey: string; from: string } {
  const env = process.env;
  return {
    apiKey: env.RESEND_API_KEY || "",
    from: env.RESEND_FROM || "",
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send the clinic a notification that a booking arrived.
 *
 * Returns a result rather than throwing: the caller treats this as
 * fire-and-forget, and a notification failure must never surface to the
 * visitor or affect the booking that was already stored.
 */
export async function sendBookingNotification(
  n: BookingNotification,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const { apiKey, from } = resolveEnv();

  // Not configured yet — do nothing, quietly. This keeps the site working
  // normally before the Resend key is added, rather than logging an error on
  // every booking.
  if (!apiKey || !from) {
    return { ok: false, skipped: true, error: "resend-not-configured" };
  }
  if (!n.toEmail || !/.+@.+\..+/.test(n.toEmail)) {
    return { ok: false, error: "invalid-recipient" };
  }

  const lines = [
    ["Name", n.patientName],
    ["Phone", n.phone],
    ["Email", n.patientEmail || "—"],
    ["Preferred", n.when],
    ["Branch", n.branch || "—"],
    ["Concern", n.concern || "—"],
  ];

  const text =
    `New appointment request\n\n` + lines.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n`;

  const html =
    `<h2 style="margin:0 0 12px;font:600 18px system-ui,sans-serif">New appointment request</h2>` +
    `<table style="border-collapse:collapse;font:14px system-ui,sans-serif">` +
    lines
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 16px 4px 0;color:#555">${escapeHtml(k)}</td>` +
          `<td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`,
      )
      .join("") +
    `</table>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [n.toEmail],
        // So the clinic can reply straight to the patient when they gave an
        // address; otherwise replies go back to the clinic's own inbox.
        reply_to: n.patientEmail && /.+@.+\..+/.test(n.patientEmail) ? n.patientEmail : n.toEmail,
        subject: `New appointment request — ${n.patientName} (${n.when})`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      // Read the body for the log only; never surfaced to the visitor.
      const detail = await res.text().catch(() => "");
      console.error(
        "[booking-email] Resend rejected the request:",
        res.status,
        detail.slice(0, 300),
      );
      return { ok: false, error: `resend-${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[booking-email] send failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
