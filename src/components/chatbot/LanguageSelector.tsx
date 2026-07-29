import {
  CHAT_UI_COPY,
  type ChatLanguagePreference,
  type ChatUiLanguage,
} from "@/lib/chat/language";

interface LanguageSelectorProps {
  disabled?: boolean;
  value: ChatLanguagePreference;
  uiLanguage: ChatUiLanguage;
  onChange: (language: ChatLanguagePreference) => void;
}

export function LanguageSelector({
  disabled,
  value,
  uiLanguage,
  onChange,
}: LanguageSelectorProps) {
  const copy = CHAT_UI_COPY[uiLanguage];
  const options: Array<{
    value: ChatLanguagePreference;
    label: string;
  }> = [
    { value: "auto", label: copy.languageAuto },
    { value: "en", label: copy.languageEnglish },
    { value: "es", label: copy.languageSpanish },
  ];

  return (
    <div className="chat-language-control">
      <span className="chat-language-label">{copy.languageLabel}</span>
      <div
        className="chat-language-options"
        role="group"
        aria-label={copy.languageSelector}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="chat-language-option"
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
