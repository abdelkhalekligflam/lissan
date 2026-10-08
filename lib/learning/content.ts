export type Language = "es" | "en" | "fr";
export type Locale = "ar" | "en" | "fr";
export type Word = {
  word: string;
  ar: string;
  en: string;
  fr: string;
  example: string;
  emoji: string;
};
export const languages = [
  {
    id: "es" as Language,
    name: "الإسبانية",
    en: "Spanish",
    fr: "Espagnol",
    flag: "🇪🇸",
    color: "#ff7a45",
    speech: "es-ES",
    hello: "Hola, ¿cómo estás?",
    translation: "مرحباً، كيف حالك؟",
  },
  {
    id: "en" as Language,
    name: "الإنجليزية",
    en: "English",
    fr: "Anglais",
    flag: "🇬🇧",
    color: "#4c8dff",
    speech: "en-GB",
    hello: "Nice to meet you",
    translation: "سعيد بلقائك",
  },
  {
    id: "fr" as Language,
    name: "الفرنسية",
    en: "French",
    fr: "Français",
    flag: "🇫🇷",
    color: "#ff5c8a",
    speech: "fr-FR",
    hello: "Je voudrais un café",
    translation: "أود فنجان قهوة",
  },
];
export const units = [
  {
    ar: "التعارف والتحيات",
    en: "Greetings & introductions",
    fr: "Salutations et présentations",
    icon: "👋",
  },
  { ar: "في المقهى والمطعم", en: "At the café", fr: "Au café", icon: "☕" },
  { ar: "المدينة والسفر", en: "Around the city", fr: "En ville", icon: "🧭" },
];
const w = (
  word: string,
  ar: string,
  en: string,
  fr: string,
  example: string,
  emoji: string,
): Word => ({ word, ar, en, fr, example, emoji });
export const vocabulary: Record<Language, Word[][]> = {
  es: [
    [
      w("Hola", "مرحباً", "Hello", "Bonjour", "Hola, me llamo Sara.", "👋"),
      w(
        "Gracias",
        "شكراً",
        "Thank you",
        "Merci",
        "Muchas gracias por tu ayuda.",
        "💜",
      ),
      w(
        "¿Cómo estás?",
        "كيف حالك؟",
        "How are you?",
        "Comment vas-tu ?",
        "Hola, ¿cómo estás hoy?",
        "💬",
      ),
      w(
        "Me llamo Sara",
        "اسمي سارة",
        "My name is Sara",
        "Je m’appelle Sara",
        "Me llamo Sara. Mucho gusto.",
        "🙋",
      ),
    ],
    [
      w(
        "Un café",
        "فنجان قهوة",
        "A coffee",
        "Un café",
        "Quisiera un café, por favor.",
        "☕",
      ),
      w("Agua", "ماء", "Water", "Eau", "Un vaso de agua, por favor.", "💧"),
      w(
        "La cuenta",
        "الفاتورة",
        "The bill",
        "L’addition",
        "La cuenta, por favor.",
        "🧾",
      ),
      w(
        "Por favor",
        "من فضلك",
        "Please",
        "S’il vous plaît",
        "Un café, por favor.",
        "🤝",
      ),
    ],
    [
      w(
        "La estación",
        "المحطة",
        "The station",
        "La gare",
        "¿Dónde está la estación?",
        "🚉",
      ),
      w(
        "A la derecha",
        "إلى اليمين",
        "To the right",
        "À droite",
        "Gira a la derecha.",
        "➡️",
      ),
      w(
        "Un billete",
        "تذكرة",
        "A ticket",
        "Un billet",
        "Quiero un billete a Madrid.",
        "🎫",
      ),
      w(
        "El hotel",
        "الفندق",
        "The hotel",
        "L’hôtel",
        "El hotel está cerca.",
        "🏨",
      ),
    ],
  ],
  en: [
    [
      w("Hello", "مرحباً", "Hello", "Bonjour", "Hello, my name is Sara.", "👋"),
      w(
        "Thank you",
        "شكراً",
        "Thank you",
        "Merci",
        "Thank you for your help.",
        "💜",
      ),
      w(
        "How are you?",
        "كيف حالك؟",
        "How are you?",
        "Comment vas-tu ?",
        "Hello! How are you today?",
        "💬",
      ),
      w(
        "Nice to meet you",
        "سعيد بلقائك",
        "Nice to meet you",
        "Enchanté",
        "I’m Sara. Nice to meet you.",
        "🙋",
      ),
    ],
    [
      w(
        "A coffee",
        "فنجان قهوة",
        "A coffee",
        "Un café",
        "I would like a coffee, please.",
        "☕",
      ),
      w("Water", "ماء", "Water", "Eau", "A glass of water, please.", "💧"),
      w(
        "The bill",
        "الفاتورة",
        "The bill",
        "L’addition",
        "Could I have the bill, please?",
        "🧾",
      ),
      w(
        "Please",
        "من فضلك",
        "Please",
        "S’il vous plaît",
        "A coffee, please.",
        "🤝",
      ),
    ],
    [
      w(
        "The station",
        "المحطة",
        "The station",
        "La gare",
        "Where is the station?",
        "🚉",
      ),
      w(
        "To the right",
        "إلى اليمين",
        "To the right",
        "À droite",
        "Turn to the right.",
        "➡️",
      ),
      w(
        "A ticket",
        "تذكرة",
        "A ticket",
        "Un billet",
        "A ticket to London, please.",
        "🎫",
      ),
      w(
        "The hotel",
        "الفندق",
        "The hotel",
        "L’hôtel",
        "The hotel is nearby.",
        "🏨",
      ),
    ],
  ],
  fr: [
    [
      w(
        "Bonjour",
        "مرحباً",
        "Hello",
        "Bonjour",
        "Bonjour, je m’appelle Sara.",
        "👋",
      ),
      w("Merci", "شكراً", "Thank you", "Merci", "Merci pour votre aide.", "💜"),
      w(
        "Comment vas-tu ?",
        "كيف حالك؟",
        "How are you?",
        "Comment vas-tu ?",
        "Bonjour ! Comment vas-tu ?",
        "💬",
      ),
      w(
        "Enchanté",
        "سعيد بلقائك",
        "Nice to meet you",
        "Enchanté",
        "Je m’appelle Omar. Enchanté.",
        "🙋",
      ),
    ],
    [
      w(
        "Un café",
        "فنجان قهوة",
        "A coffee",
        "Un café",
        "Je voudrais un café, s’il vous plaît.",
        "☕",
      ),
      w(
        "De l’eau",
        "ماء",
        "Water",
        "Eau",
        "Un verre d’eau, s’il vous plaît.",
        "💧",
      ),
      w(
        "L’addition",
        "الفاتورة",
        "The bill",
        "L’addition",
        "L’addition, s’il vous plaît.",
        "🧾",
      ),
      w(
        "S’il vous plaît",
        "من فضلك",
        "Please",
        "S’il vous plaît",
        "Un café, s’il vous plaît.",
        "🤝",
      ),
    ],
    [
      w(
        "La gare",
        "المحطة",
        "The station",
        "La gare",
        "Où est la gare ?",
        "🚉",
      ),
      w(
        "À droite",
        "إلى اليمين",
        "To the right",
        "À droite",
        "Tournez à droite.",
        "➡️",
      ),
      w(
        "Un billet",
        "تذكرة",
        "A ticket",
        "Un billet",
        "Un billet pour Paris, s’il vous plaît.",
        "🎫",
      ),
      w(
        "L’hôtel",
        "الفندق",
        "The hotel",
        "L’hôtel",
        "L’hôtel est tout près.",
        "🏨",
      ),
    ],
  ],
};
export function lessonId(language: Language, index: number) {
  return `${language}-${index + 1}`;
}
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[.,!?¿¡؟،]/g, "")
    .replace(/\s+/g, " ")
    .trim();
export function getExercises(language: Language, lesson: number) {
  const words = vocabulary[language][lesson];
  return words.map((word, i) => ({
    id: `${lessonId(language, lesson)}-q${i}`,
    type: i === 1 ? "fill" : i === 3 ? "build" : "choice",
    prompt: word.ar,
    target: word.word,
    options: i === 3 ? word.example.split(" ") : words.map((w) => w.word),
    answer: i === 3 ? word.example : word.word,
    explanation: word.example,
  }));
}
