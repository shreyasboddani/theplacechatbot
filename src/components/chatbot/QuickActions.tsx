import { ArrowIcon } from "@/components/chatbot/Icons";
import { CHAT_UI_COPY, type ChatUiLanguage } from "@/lib/chat/language";

export const QUICK_ACTIONS = CHAT_UI_COPY.en.quickActions;

interface QuickActionsProps {
  disabled?: boolean;
  onSelect: (question: string) => void;
  language?: ChatUiLanguage;
}

export function QuickActions({
  disabled,
  onSelect,
  language = "en",
}: QuickActionsProps) {
  const copy = CHAT_UI_COPY[language];
  return (
    <div className="quick-actions" aria-label={copy.suggestedQuestions}>
      {copy.quickActions.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(action.question)}
          className="quick-action"
        >
          <span>{action.label}</span>
          <ArrowIcon size={15} />
        </button>
      ))}
    </div>
  );
}
