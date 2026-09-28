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
 * Resend will only send FROM a domain you have verified with them. A
 * free-mail address such as a gmail.com one can never be a valid sender —
 * nobody can send as gmail.com except Google — so Resend rejects it with a
 * 403 and no email arrives.
 *
 * Without a verified domain, Resend's shared test sender
 * (onboarding@resend.dev) is the supported route. Per their documentation it
 * delivers ONLY to the email address that owns the Resend account, which is
 * exactly this use case: the booking alert goes to the clinic's own inbox.
 *
 * So rather than fail on an address Resend will certainly reject, fall back
 * to the test sender and log why. The alternative — sending nothing — is
 * worse, and the clinic would have no idea the setting was unusable.
 */
const RESEND_TEST_SENDER = "onboarding@resend.dev";

function resolveEnv(): { apiKey: string; from: string } {
  const env = process.env;
  const apiKey = env.RESEND_API_KEY || "";
  const configuredFrom = (env.RESEND_FROM || "").trim();

  if (!configuredFrom) return { apiKey, from: RESEND_TEST_SENDER };

  // Extract the domain, tolerating a "Name <addr@domain>" style value.
  const addr = configuredFrom.match(/<([^>]+)>/)?.[1] ?? configuredFrom;
  const domain = addr.split("@")[1]?.toLowerCase() ?? "";

  // Domains nobody can send as. Not exhaustive by design — it only needs to
  // catch the realistic mistake of using the clinic's own mailbox address.
  const UNSENDABLE = new Set([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.in",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "rediffmail.com",
  ]);

  if (UNSENDABLE.has(domain)) {
    console.warn(
      `[booking-email] RESEND_FROM is "${addr}", but Resend cannot send from ${domain} — ` +
        `that domain is not yours to send as. Falling back to ${RESEND_TEST_SENDER}, which ` +
        `delivers to the Resend account owner's address. To send from your own address, ` +
        `verify a domain at https://resend.com/domains and set RESEND_FROM to an address on it.`,
    );
    return { apiKey, from: RESEND_TEST_SENDER };
  }

  return { apiKey, from: configuredFrom };
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

  // No API key — do nothing, quietly. This keeps the site working normally
  // before Resend is set up, rather than logging an error on every booking.
  // `from` always resolves (to the test sender if nothing usable is set), so
  // only the key can leave this unconfigured.
  if (!apiKey) {
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
