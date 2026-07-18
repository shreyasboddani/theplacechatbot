import { THE_PLACE } from "@/lib/config";
import type { ChatResponse, ChatSource } from "@/lib/knowledge/types";

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

function answered(answer: string): ChatResponse {
  return {
    status: "answered",
    answer,
    sources: [OFFICIAL_HOME_SOURCE],
    contactRecommended: false,
  };
}

export function getLocalConversationalResponse(
  message: string,
): ChatResponse | undefined {
  const normalized = normalizeConversationalMessage(message);

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
    return answered("You’re welcome! Let me know if you have another question about The Place.");
  }

  return undefined;
}
