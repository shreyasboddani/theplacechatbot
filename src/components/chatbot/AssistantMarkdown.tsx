import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getApprovedWebsiteUrl } from "@/lib/security/source-url";

function SafeMarkdownLink({
  href,
  children,
}: ComponentPropsWithoutRef<"a">) {
  const approvedUrl = getApprovedWebsiteUrl(href);
  if (!approvedUrl) {
    return <span className="markdown-link-disabled">{children}</span>;
  }
  return (
    <a
      href={approvedUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{ a: SafeMarkdownLink }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
