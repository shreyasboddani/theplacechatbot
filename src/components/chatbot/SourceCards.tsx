import { ExternalIcon } from "@/components/chatbot/Icons";
import type { ChatSource } from "@/lib/knowledge/types";
import { getApprovedWebsiteUrl } from "@/lib/security/source-url";

export function SourceCards({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="source-list" aria-label="Official sources">
      <p className="source-list-label">Sources</p>
      {sources.map((source) => {
        if (source.sourceType === "manager_faq") {
          return (
            <div className="source-card source-card-staff" key={source.id}>
              <span className="source-dot" aria-hidden="true" />
              <span>Information provided by The Place staff</span>
            </div>
          );
        }
        const url = getApprovedWebsiteUrl(source.url);
        if (!url) return null;
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
