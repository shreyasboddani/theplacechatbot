import { ExternalIcon } from "@/components/chatbot/Icons";
import type { ChatSource } from "@/lib/knowledge/types";
import { getApprovedWebsiteUrl } from "@/lib/security/source-url";
import { CHAT_UI_COPY, type ChatUiLanguage } from "@/lib/chat/language";

export function SourceCards({
  sources,
  language = "en",
}: {
  sources: ChatSource[];
  language?: ChatUiLanguage;
}) {
  const copy = CHAT_UI_COPY[language];
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
    <div className="source-list" aria-label={copy.officialSources}>
      <p className="source-list-label">{copy.sources}</p>
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
              <small>{copy.viewSource}</small>
            </span>
            <ExternalIcon />
          </a>
        );
      })}
    </div>
  );
}
