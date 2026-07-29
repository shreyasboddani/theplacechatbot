export const CHAT_LANGUAGE_PREFERENCES = ["auto", "en", "es"] as const;

export type ChatLanguagePreference =
  (typeof CHAT_LANGUAGE_PREFERENCES)[number];
export type ChatUiLanguage = "en" | "es";

export function isChatLanguagePreference(
  value: unknown,
): value is ChatLanguagePreference {
  return (
    typeof value === "string" &&
    (CHAT_LANGUAGE_PREFERENCES as readonly string[]).includes(value)
  );
}

export function chatUiLanguage(
  preference: ChatLanguagePreference,
): ChatUiLanguage {
  return preference === "es" ? "es" : "en";
}

export const CHAT_UI_COPY = {
  en: {
    assistant: "Assistant",
    officialInformation: "Official information",
    prototypeBy: "Prototype technology by",
    today: "Today",
    welcome:
      "Hi! I can help you find approved information from The Place about services, donations, volunteering, and more. What would you like help with?",
    languageSelector: "Response language",
    languageAuto: "Auto",
    languageEnglish: "English",
    languageSpanish: "Español",
    restart: "Restart conversation",
    minimize: "Minimize chat",
    close: "Close chat",
    typing: "Assistant is looking through approved sources",
    privacy:
      "Please do not share Social Security numbers, bank information, medical details, passwords, or private documents in this chat.",
    inputLabel: "Ask The Place information assistant",
    inputPlaceholder: "Ask about services, donations, or volunteering...",
    send: "Send message",
    groundingNote: "Answers require a confirmed official source.",
    suggestedQuestions: "Suggested questions",
    sources: "Sources",
    officialSources: "Official sources",
    viewSource: "View on The Place website",
    assistantMessage: "Assistant message",
    userMessage: "Your message",
    invalidLong:
      "That message is too long to send. Please shorten it and try again.",
    invalidMessage:
      "The chat control could not read that message. Please type your question in the message box and try again.",
    unavailable:
      "The information assistant is temporarily unavailable. Please try again in a moment. If you still need help, contact The Place at 770-887-1098 or use the contact page.",
    sensitiveReplacement: "Sensitive information was not sent.",
    quickActions: [
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
    ],
  },
  es: {
    assistant: "Asistente",
    officialInformation: "Información oficial",
    prototypeBy: "Tecnología prototipo de",
    today: "Hoy",
    welcome:
      "¡Hola! Puedo ayudarte a encontrar información aprobada de The Place sobre servicios, donaciones, voluntariado y más. ¿En qué puedo ayudarte?",
    languageSelector: "Idioma de respuesta",
    languageAuto: "Auto",
    languageEnglish: "English",
    languageSpanish: "Español",
    restart: "Reiniciar conversación",
    minimize: "Minimizar chat",
    close: "Cerrar chat",
    typing: "El asistente está consultando fuentes aprobadas",
    privacy:
      "No compartas números de Seguro Social, información bancaria, datos médicos, contraseñas ni documentos privados en este chat.",
    inputLabel: "Pregúntale al asistente de información de The Place",
    inputPlaceholder: "Pregunta sobre servicios, donaciones o voluntariado...",
    send: "Enviar mensaje",
    groundingNote: "Las respuestas requieren una fuente oficial confirmada.",
    suggestedQuestions: "Preguntas sugeridas",
    sources: "Fuentes",
    officialSources: "Fuentes oficiales",
    viewSource: "Ver en el sitio web de The Place",
    assistantMessage: "Mensaje del asistente",
    userMessage: "Tu mensaje",
    invalidLong:
      "Ese mensaje es demasiado largo. Acórtalo e inténtalo de nuevo.",
    invalidMessage:
      "El chat no pudo leer ese mensaje. Escribe tu pregunta en el cuadro e inténtalo de nuevo.",
    unavailable:
      "El asistente de información no está disponible temporalmente. Inténtalo de nuevo en un momento. Si aún necesitas ayuda, llama a The Place al 770-887-1098 o usa la página de contacto.",
    sensitiveReplacement: "La información confidencial no se envió.",
    quickActions: [
      {
        label: "Necesito alimentos",
        question: "Necesito alimentos. ¿Cómo puede ayudarme The Place?",
      },
      {
        label: "Asistencia financiera",
        question: "¿Cómo solicito ayuda con el alquiler o una factura de servicios?",
      },
      {
        label: "Voluntariado",
        question: "¿Cómo puedo ser voluntario en The Place?",
      },
      {
        label: "Donar alimentos",
        question: "¿Dónde puedo donar alimentos?",
      },
      {
        label: "Donaciones a tiendas",
        question: "¿Cómo y cuándo puedo donar a la tienda de segunda mano?",
      },
      {
        label: "Horarios y ubicaciones",
        question: "¿Cuáles son los horarios y las ubicaciones de The Place?",
      },
    ],
  },
} as const;
