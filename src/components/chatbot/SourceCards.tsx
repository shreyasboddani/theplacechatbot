import { ExternalIcon } from "@/components/chatbot/Icons";
import type { ChatSource } from "@/lib/knowledge/types";
import { getApprovedWebsiteUrl } from "@/lib/security/source-url";

export function SourceCards({ sources }: { sources: ChatSource[] }) {
  const linkedSources = Array.from(
    new Map(
      sources
        .map((source) => ({ source, url: getApprovedWebsiteUrl(source.url) }))
        .filter((entry): entry is { source: ChatSource; url: string } =>
          Boolean(entry.url),
        )
        .map((entry) => [entry.url, entry] as const),
    ).values(),
  );
  if (linkedSources.length === 0) return null;
  return (
    <div className="source-list" aria-label="Official sources">
      <p className="source-list-label">Sources</p>
      {linkedSources.map(({ source, url }) => {
        return (
          <a
            className="source-card"
            key={source.id}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
          >
            <span>
              <strong>{source.title}</strong>
              <small>View on The Place website</small>
            </span>
            <ExternalIcon />
          </a>
        );
      })}
    </div>
  );
}
