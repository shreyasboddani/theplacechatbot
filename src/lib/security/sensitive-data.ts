const SSN_PATTERN = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/;
const PASSWORD_PATTERN =
  /\b(?:my\s+)?(?:password|passcode|pin)\s*(?:is|=|:|-)\s*\S{4,}/i;
const BANK_CONTEXT_PATTERN =
  /\b(?:bank|routing|checking|savings|account)\b[\s\S]{0,45}\b\d{8,17}\b/i;
const CARD_CANDIDATE_PATTERN = /(?:\d[ -]*?){13,19}/g;
const PRIVATE_DOCUMENT_PATTERN =
  /\b(?:social security|date of birth|medical record|bank statement|tax return|driver'?s license)\b/i;

function passesLuhn(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let total = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
    doubleDigit = !doubleDigit;
  }
  return total % 10 === 0;
}

export function containsLikelySensitiveInformation(message: string): boolean {
  if (SSN_PATTERN.test(message)) return true;
  if (PASSWORD_PATTERN.test(message)) return true;
  if (BANK_CONTEXT_PATTERN.test(message)) return true;

  const cardCandidates = message.match(CARD_CANDIDATE_PATTERN) ?? [];
  if (cardCandidates.some(passesLuhn)) return true;

  const lineCount = message.split(/\r?\n/).length;
  if (
    message.length > 850 &&
    lineCount >= 8 &&
    PRIVATE_DOCUMENT_PATTERN.test(message)
  ) {
    return true;
  }

  return false;
}

