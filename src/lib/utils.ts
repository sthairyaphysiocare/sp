import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize a phone number for wa.me links: strips spaces, dashes, and all
 * special characters, and defaults to the +91 country code when a bare
 * 10-digit Indian mobile number is stored.
 */
export function waPhone(raw: string | undefined | null): string {
  let digits = String(raw ?? "").replace(/[^0-9]/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

/** Open a prefilled WhatsApp chat in a new, sandboxed window. */
export function openWhatsApp(phone: string | undefined | null, message: string) {
  const dest = waPhone(phone);
  if (!dest) return false;
  window.open(
    `https://wa.me/${dest}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );
  return true;
}

/** Indian-system amount in words: 5558 -> "Rupees Five Thousand Five Hundred Fifty Eight Only". */
export function amountInWordsINR(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (!isFinite(n)) return "";
  if (n === 0) return "Rupees Zero Only";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const two = (x: number): string =>
    x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? " " + ones[x % 10] : ""}`;
  const three = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return `${h ? ones[h] + " Hundred" : ""}${h && r ? " " : ""}${r ? two(r) : ""}`;
  };
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `Rupees ${parts.join(" ")} Only`;
}
