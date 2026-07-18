import { ShieldIcon } from "@/components/chatbot/Icons";

export function PrivacyNotice() {
  return (
    <div className="chat-privacy" role="note">
      <ShieldIcon size={16} />
      <p>
        Please do not share Social Security numbers, bank information, medical
        details, passwords, or private documents in this chat.
      </p>
    </div>
  );
}

