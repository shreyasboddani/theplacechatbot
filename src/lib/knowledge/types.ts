export type SourceType = "official_website" | "manager_faq";

export type FaqStatus =
  | "approved"
  | "pending"
  | "conflicting"
  | "needs_review";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  status: FaqStatus;
  contacts: string[];
  relatedUrls: string[];
  notes: string[];
  sourceType: "manager_faq";
}

export interface WebsiteSource {
  id: string;
  title: string;
  canonicalUrl: string;
  fetchedAt: string;
  text: string;
  headings: string[];
  links: Array<{ label: string; url: string }>;
  sourceType: "official_website";
}

export interface SourceManifestEntry {
  id: string;
  fileName: string;
  documentPath: string;
  title: string;
  url?: string;
  fetchedAt?: string;
  sourceType: SourceType;
  priority: number;
}

export interface ChatSource {
  id: string;
  title: string;
  url?: string;
  sourceType: SourceType;
}

export type ChatStatus =
  | "answered"
  | "not_found"
  | "conflicting_information"
  | "sensitive_information"
  | "service_unavailable"
  | "invalid_request";

export interface ChatResponse {
  status: ChatStatus;
  answer: string;
  sources: ChatSource[];
  contactRecommended: boolean;
}

