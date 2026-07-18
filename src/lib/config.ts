import {
  APPROVED_THE_PLACE_HOSTS,
  canonicalizeThePlaceUrl,
  isApprovedWebsiteUrl,
} from "@/lib/security/source-url";

export const THE_PLACE = {
  canonicalOrigin: "https://www.theplacega.org",
  allowedHosts: APPROVED_THE_PLACE_HOSTS,
  contact: {
    phone: "770-887-1098",
    email: "info@theplacega.org",
    url: "https://www.theplacega.org/contact-us",
  },
} as const;

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export interface RuntimeConfig {
  apiKey?: string;
  fileSearchStore?: string;
  model: string;
  siteUrl: string;
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    fileSearchStore:
      process.env.GEMINI_FILE_SEARCH_STORE?.trim() || undefined,
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  };
}

export { canonicalizeThePlaceUrl, isApprovedWebsiteUrl };
