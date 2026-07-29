import { ShieldIcon } from "@/components/chatbot/Icons";
import { CHAT_UI_COPY, type ChatUiLanguage } from "@/lib/chat/language";

export function PrivacyNotice({ language = "en" }: { language?: ChatUiLanguage }) {
  const copy = CHAT_UI_COPY[language];
  return (
    <div className="chat-privacy" role="note">
      <ShieldIcon size={16} />
      <p>{copy.privacy}</p>
    </div>
  );
}

