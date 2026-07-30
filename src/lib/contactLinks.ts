/**
 * Prefilled contact links for the public site.
 *
 * Every public WhatsApp and email entry point routes through here so that a
 * visitor never lands on an empty compose window, and so the wording only has
 * to be changed in one place. Because the contact and footer sections build
 * their links from the branch list, any branch added later picks this up
 * automatically with no further work.
 *
 * Staff-side messaging — prescription delivery and appointment reminders — is
 * deliberately NOT routed through here: those compose their own patient-specific
 * text and must keep it.
 */

/** Default enquiry text used for both WhatsApp and email bodies. */
export const APPOINTMENT_MESSAGE =
  "Hi, I would like to book an appointment for a physiotherapy session.";

/** Default subject line for email enquiries. */
export const APPOINTMENT_SUBJECT = "Appointment Request";

/**
 * The floating contact widget is a general "get in touch" entry point rather
 * than a booking CTA, and already opened WhatsApp with this wording. Its email
 * action now matches it, so the widget stays internally consistent instead of
 * offering an enquiry on one action and an appointment request on the other.
 */
export const ENQUIRY_MESSAGE =
  "Hello Sthairya Physiocare, I'd like to know more about your services.";

/** Subject line paired with ENQUIRY_MESSAGE. */
export const ENQUIRY_SUBJECT = "Enquiry";

/**
 * Builds a wa.me link with the message prefilled.
 * `digits` must already be stripped to digits (see whatsappDigits).
 */
export function whatsappLink(digits: string, message: string = APPOINTMENT_MESSAGE): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Builds a mailto: link with the subject and body prefilled. */
export function mailtoLink(
  email: string,
  subject: string = APPOINTMENT_SUBJECT,
  body: string = APPOINTMENT_MESSAGE,
): string {
  const params = new URLSearchParams({ subject, body });
  // URLSearchParams encodes spaces as "+", which mail clients show literally in
  // the subject line. mailto: expects percent-encoding, so convert them back.
  return `mailto:${email}?${params.toString().replace(/\+/g, "%20")}`;
}
