import { THE_PLACE } from "@/lib/config";
import type {
  ChatResponse,
  ChatSource,
  SourceManifestEntry,
} from "@/lib/knowledge/types";

const OFFICIAL_HOME_SOURCE: ChatSource = {
  id: "the-place-official-home",
  title: "The Place — Official Website",
  url: `${THE_PLACE.canonicalOrigin}/`,
  sourceType: "official_website",
};

function normalizeConversationalMessage(message: string): string {
  return message
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const DOCUMENT_MATCH_STOP_WORDS = new Set([
  "document",
  "official",
  "place",
  "the",
  "version",
]);

function words(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
}

function asksAboutDocumentAccess(message: string): boolean {
  const messageWordCount = words(message).length;
  return (
    /^(?:do (?:you|u) (?:have|got)(?: access to)?|can (?:you|u) (?:access|read|reference|see|use)|are (?:you|u) able to (?:access|read|reference|see|use))\b/.test(
      message,
    ) ||
    /^(?:can|could|will|would) (?:you|u) help(?: me)? (?:with|using)\b/.test(
      message,
    ) ||
    /^i (?:need|want) help (?:with|using)\b/.test(message) ||
    /^do (?:you|u) know about\b/.test(message) ||
    /^is .+ (?:available to (?:you|u)|in your (?:knowledge base|sources))$/.test(
      message,
    ) ||
    messageWordCount <= 3
  );
}

function matchingOfficialDocument(
  normalizedMessage: string,
  manifest: SourceManifestEntry[],
): SourceManifestEntry | undefined {
  if (!asksAboutDocumentAccess(normalizedMessage)) return undefined;
  const messageWords = new Set(words(normalizedMessage));
  const candidates = manifest
    .filter(
      (entry) => entry.sourceType === "official_document" && Boolean(entry.url),
    )
    .map((entry) => {
      const baseTitle = entry.title.replace(/\s+-\s+Version\b.*$/i, "");
      const titleWords = words(baseTitle).filter(
        (word) =>
          word.length >= 4 &&
          !/^\d+$/.test(word) &&
          !DOCUMENT_MATCH_STOP_WORDS.has(word),
      );
      const identifyingTitleWord = titleWords.at(-1);
      const documentWords = new Set(
        words(`${entry.id} ${entry.title}`).filter(
          (word) =>
            word.length >= 4 &&
            !/^\d+$/.test(word) &&
            !DOCUMENT_MATCH_STOP_WORDS.has(word),
        ),
      );
      const matchedWords = [...documentWords].filter((word) =>
        messageWords.has(word),
      );
      return {
        entry,
        score: matchedWords.length,
        hasDistinctiveSingleMatch: matchedWords.some(
          (word) =>
            word.length >= 8 && word === identifyingTitleWord,
        ),
      };
    })
    .filter(
      ({ score, hasDistinctiveSingleMatch }) =>
        score >= 2 || hasDistinctiveSingleMatch,
    )
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) return undefined;
  if (
    candidates.length > 1 &&
    candidates[0]?.score === candidates[1]?.score
  ) {
    return undefined;
  }
  return candidates[0]?.entry;
}

function answered(
  answer: string,
  sources: ChatSource[] = [OFFICIAL_HOME_SOURCE],
): ChatResponse {
  return {
    status: "answered",
    answer,
    sources,
    contactRecommended: false,
  };
}

export function getLocalConversationalResponse(
  message: string,
  manifest: SourceManifestEntry[] = [],
): ChatResponse | undefined {
  const normalized = normalizeConversationalMessage(message);

  const officialDocument = matchingOfficialDocument(normalized, manifest);
  if (officialDocument?.url) {
    const conversationalTitle = officialDocument.title.replace(
      /\s+-\s+Version\b.*$/i,
      "",
    );
    return answered(
      `Yes—I have ${conversationalTitle} available as an approved source and can help answer questions from it. What would you like to know?`,
      [
        {
          id: officialDocument.id,
          title: officialDocument.title,
          url: officialDocument.url,
          sourceType: "official_document",
        },
      ],
    );
  }

  if (
    /^(hi|hello|hey|hey there|hello there|hi there|howdy|good morning|good afternoon|good evening)$/.test(
      normalized,
    )
  ) {
    return answered(
      "Hi! I can help you find confirmed information about The Place’s services, donations, volunteering, locations, hours, contacts, and events. What would you like help with?",
    );
  }

  if (
    /^(what|which) (questions|things|topics) can (you answer|i ask)$/.test(
      normalized,
    ) ||
    /^(what|how) can you help( me)?( with)?$/.test(normalized)
  ) {
    return answered(
      "You can ask about food or financial assistance, thrift-store donations and hours, volunteering, hosting a drive, locations, contacts, and upcoming events. Ask naturally and use follow-up questions if you need more detail. I can’t check a personal application or case, and I’ll direct you to staff when the approved information doesn’t confirm an answer.",
    );
  }

  if (/^(thanks|thank you|thank you so much|thanks so much|thx)$/.test(normalized)) {
    return answered(
      "You’re welcome! Let me know if you have another question about The Place.",
    );
  }

  return undefined;
}
