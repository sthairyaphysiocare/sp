import logoAsset from "@/assets/logo.jpg.asset.json";
import type { Branch, AppSettings } from "./types";

export const LOGO_URL: string = logoAsset.url;

export const CLINIC = {
  name: "Sthairya Physiocare",
  tagline: "Resilience • Firmness • Balance",
  domain: "sthairya-physiocare.co.in",
  address: "Vivekananda College Road, Nehru Nagar, Puttur - 574203",
  mapRef: "Q5HJ+MR Nehru Nagar, Puttur, Karnataka",
  mapUrl: "https://maps.app.goo.gl/MZ4wvMrzUvT4CGFM8",
  phone: "+91 9900315254",
  whatsapp: "919900315254",
  email: "Gana.Plinija@gmail.com",
};

export const DEFAULT_BRANCH: Branch = {
  id: "br-puttur",
  name: "Puttur",
  address: CLINIC.address,
  mapUrl: CLINIC.mapUrl,
  phone: CLINIC.phone,
  license: "",
  enabled: true,
};

export function enabledBranches(s: AppSettings): Branch[] {
  return (s.branches ?? []).filter((b) => b.enabled);
}

export function branchById(s: AppSettings, id?: string): Branch | undefined {
  if (!id) return undefined;
  return (s.branches ?? []).find((b) => b.id === id);
}

export function whatsappDigits(s: AppSettings): string {
  return (s.whatsappNumber || CLINIC.whatsapp).replace(/[^0-9]/g, "");
}
