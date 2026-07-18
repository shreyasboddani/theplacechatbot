import { ArrowIcon } from "@/components/chatbot/Icons";

export const QUICK_ACTIONS = [
  { label: "I need food", question: "I need food. How can The Place help?" },
  {
    label: "Financial assistance",
    question: "How do I request help with rent or a utility bill?",
  },
  { label: "Volunteer", question: "How do I become a volunteer?" },
  { label: "Donate food", question: "Where can I donate food?" },
  {
    label: "Thrift store donations",
    question: "How and when can I donate to the thrift store?",
  },
  {
    label: "Hours and locations",
    question: "What are The Place's office hours and locations?",
  },
] as const;

interface QuickActionsProps {
  disabled?: boolean;
  onSelect: (question: string) => void;
}

export function QuickActions({ disabled, onSelect }: QuickActionsProps) {
  return (
    <div className="quick-actions" aria-label="Suggested questions">
      {QUICK_ACTIONS.map((action) => (
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
