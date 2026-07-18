import rawManifest from "@/generated/knowledge-manifest.json";
import { isApprovedWebsiteUrl } from "@/lib/config";
import type { SourceManifestEntry } from "@/lib/knowledge/types";

function isManifestEntry(value: unknown): value is SourceManifestEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.fileName === "string" &&
    typeof entry.documentPath === "string" &&
    typeof entry.title === "string" &&
    (entry.sourceType === "official_website" ||
      entry.sourceType === "manager_faq") &&
    typeof entry.priority === "number" &&
    (entry.url === undefined || typeof entry.url === "string")
  );
}

export function getKnowledgeManifest(): SourceManifestEntry[] {
  const manifestValue: unknown = rawManifest;
  if (!Array.isArray(manifestValue)) return [];
  return manifestValue.filter(isManifestEntry).filter((entry) => {
    if (entry.sourceType === "official_website") {
      return Boolean(entry.url && isApprovedWebsiteUrl(entry.url));
    }
    return entry.url === undefined;
  });
}

export function findManifestEntry(
  reference: string,
  manifest = getKnowledgeManifest(),
): SourceManifestEntry | undefined {
  const normalized = reference.trim().toLowerCase();
  return manifest.find((entry) =>
    [entry.id, entry.fileName, entry.documentPath, entry.url]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase() === normalized),
  );
}
