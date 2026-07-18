export const APPROVED_THE_PLACE_HOSTS = new Set([
  "theplacega.org",
  "www.theplacega.org",
]);

export function getApprovedWebsiteUrl(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !APPROVED_THE_PLACE_HOSTS.has(url.hostname)
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function isApprovedWebsiteUrl(value: string): boolean {
  return getApprovedWebsiteUrl(value) !== undefined;
}

export function canonicalizeThePlaceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!APPROVED_THE_PLACE_HOSTS.has(url.hostname)) return undefined;
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;

    url.protocol = "https:";
    url.hostname = "www.theplacega.org";
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return undefined;
  }
}
