import { THE_PLACE } from "@/lib/config";
import type { ChatResponse, ChatSource } from "@/lib/knowledge/types";

export const CONTACT_SOURCE: ChatSource = {
  id: "contact-the-place",
  title: "Contact The Place",
  url: THE_PLACE.contact.url,
  sourceType: "official_website",
};

export const CONTACT_FALLBACK_TEXT =
  `I could not find a confirmed answer to that question in The Place's available information. ` +
  `Please contact The Place at ${THE_PLACE.contact.phone} or use their contact page so a staff member can help.`;

export function contactFallback(
  status: "not_found" | "conflicting_information" = "not_found",
  sources: ChatSource[] = [CONTACT_SOURCE],
): ChatResponse {
  const answer =
    status === "conflicting_information"
      ? `The available information does not agree on this detail. Please confirm it with The Place at ${THE_PLACE.contact.phone} or through their contact page.`
      : CONTACT_FALLBACK_TEXT;

  return {
    status,
    answer,
    sources: sources.length > 0 ? sources : [CONTACT_SOURCE],
    contactRecommended: true,
  };
}

export function serviceUnavailableResponse(): ChatResponse {
  return {
    status: "service_unavailable",
    answer:
      `The information assistant is not available right now. Please contact The Place at ${THE_PLACE.contact.phone} or use their contact page for help.`,
    sources: [CONTACT_SOURCE],
    contactRecommended: true,
  };
}

export function sensitiveInformationResponse(): ChatResponse {
  return {
    status: "sensitive_information",
    answer:
      "For your privacy, please do not share personal account numbers, passwords, medical details, or private documents in this chat. Contact The Place directly so a staff member can help safely.",
    sources: [CONTACT_SOURCE],
    contactRecommended: true,
  };
}

