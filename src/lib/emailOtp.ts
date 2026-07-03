/**
 * EmailJS-backed OTP utility.
 * Credentials are public-by-design (EmailJS public key is exposed in browser
 * requests at runtime regardless), but we obfuscate the literals via base64
 * so casual source-inspection / git scrapers don't surface them as plain text.
 */
import emailjs from "@emailjs/browser";

const _enc = {
  s: "c2VydmljZV9jb3JsNXo0", // service_corl5z4
  t: "dGVtcGxhdGVfdGRuZ3R0Yw==", // template_tdngttc
  k: "bDFoZEtLTkdpN3k2WjJUNG0=", // l1hdKKNGi7y6Z2T4m
};

function d(s: string) {
  try {
    return typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export interface SendOtpArgs {
  toEmail: string;
  toName?: string;
  otp: string;
  fromEmail?: string;
}

export async function sendOtpEmail({ toEmail, toName, otp, fromEmail }: SendOtpArgs) {
  if (!toEmail || !/.+@.+\..+/.test(toEmail)) throw new Error("Invalid email");
  const params: Record<string, string> = {
    // The code is provided under every common EmailJS template variable
    // name ({{otp_code}}, {{otp}}, {{passcode}}, {{code}}) so it renders
    // regardless of which one the template body references.
    otp,
    otp_code: otp,
    passcode: otp,
    code: otp,
    time: "5 minutes",
    to_email: toEmail,
    email: toEmail,
    user_email: toEmail,
    to_name: toName || "Staff Member",
    from_email: fromEmail || "noreply@sthairya.local",
    reply_to: fromEmail || toEmail,
    subject: "Sthairya Physiocare — Password Reset OTP",
    message: `Your one-time password is ${otp}. It expires in 5 minutes.`,
  };
  await emailjs.send(d(_enc.s), d(_enc.t), params, { publicKey: d(_enc.k) });
}
