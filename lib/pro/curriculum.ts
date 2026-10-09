// Imported by server routes and seed scripts only. Never bundle paid content in the client.
import type { Language, Word } from "../learning/content";
export type ProLesson = {
  id: string;
  language: Language;
  title: { ar: string; en: string; fr: string };
  words: Word[];
};
const titles = [
  { ar: "مقابلة العمل", en: "Job interview", fr: "Entretien d’embauche" },
  {
    ar: "التواصل في العمل",
    en: "Workplace communication",
    fr: "Communication au travail",
  },
  { ar: "الفندق والمطار", en: "Hotel & airport", fr: "Hôtel et aéroport" },
];
const rows: Record<Language, string[][][]> = {
  es: [
    [
      [
        "Tengo experiencia",
        "لدي خبرة",
        "I have experience",
        "J’ai de l’expérience",
        "Tengo experiencia en ventas.",
      ],
      [
        "Busco trabajo",
        "أبحث عن عمل",
        "I am looking for work",
        "Je cherche du travail",
        "Busco trabajo en una empresa internacional.",
      ],
      [
        "Mis habilidades",
        "مهاراتي",
        "My skills",
        "Mes compétences",
        "Mis habilidades incluyen la comunicación.",
      ],
      [
        "Estoy disponible",
        "أنا متاح",
        "I am available",
        "Je suis disponible",
        "Estoy disponible para una entrevista.",
      ],
    ],
    [
      [
        "Una reunión",
        "اجتماع",
        "A meeting",
        "Une réunion",
        "Tenemos una reunión a las diez.",
      ],
      [
        "El plazo",
        "الموعد النهائي",
        "The deadline",
        "La date limite",
        "El plazo es el viernes.",
      ],
      [
        "¿Puedes ayudarme?",
        "هل يمكنك مساعدتي؟",
        "Can you help me?",
        "Peux-tu m’aider ?",
        "¿Puedes ayudarme con este informe?",
      ],
      [
        "Te envío el documento",
        "سأرسل لك الوثيقة",
        "I am sending you the document",
        "Je t’envoie le document",
        "Te envío el documento por correo.",
      ],
    ],
    [
      [
        "Tengo una reserva",
        "لدي حجز",
        "I have a reservation",
        "J’ai une réservation",
        "Tengo una reserva para dos noches.",
      ],
      [
        "Mi equipaje",
        "أمتعتي",
        "My luggage",
        "Mes bagages",
        "Mi equipaje no ha llegado.",
      ],
      [
        "La puerta de embarque",
        "بوابة الصعود",
        "The boarding gate",
        "La porte d’embarquement",
        "¿Dónde está la puerta de embarque?",
      ],
      [
        "¿A qué hora sale el vuelo?",
        "في أي ساعة تقلع الطائرة؟",
        "What time does the flight depart?",
        "À quelle heure part le vol ?",
        "¿A qué hora sale el vuelo a París?",
      ],
    ],
  ],
  en: [
    [
      [
        "I have experience",
        "لدي خبرة",
        "I have experience",
        "J’ai de l’expérience",
        "I have experience in customer service.",
      ],
      [
        "I am looking for work",
        "أبحث عن عمل",
        "I am looking for work",
        "Je cherche du travail",
        "I am looking for work in technology.",
      ],
      [
        "My skills",
        "مهاراتي",
        "My skills",
        "Mes compétences",
        "My skills include problem solving.",
      ],
      [
        "I am available",
        "أنا متاح",
        "I am available",
        "Je suis disponible",
        "I am available for an interview.",
      ],
    ],
    [
      [
        "A meeting",
        "اجتماع",
        "A meeting",
        "Une réunion",
        "We have a meeting at ten.",
      ],
      [
        "The deadline",
        "الموعد النهائي",
        "The deadline",
        "La date limite",
        "The deadline is Friday.",
      ],
      [
        "Can you help me?",
        "هل يمكنك مساعدتي؟",
        "Can you help me?",
        "Peux-tu m’aider ?",
        "Can you help me with this report?",
      ],
      [
        "I will send the document",
        "سأرسل الوثيقة",
        "I will send the document",
        "J’enverrai le document",
        "I will send the document by email.",
      ],
    ],
    [
      [
        "I have a reservation",
        "لدي حجز",
        "I have a reservation",
        "J’ai une réservation",
        "I have a reservation for two nights.",
      ],
      [
        "My luggage",
        "أمتعتي",
        "My luggage",
        "Mes bagages",
        "My luggage has not arrived.",
      ],
      [
        "The boarding gate",
        "بوابة الصعود",
        "The boarding gate",
        "La porte d’embarquement",
        "Where is the boarding gate?",
      ],
      [
        "What time does the flight depart?",
        "في أي ساعة تقلع الطائرة؟",
        "What time does the flight depart?",
        "À quelle heure part le vol ?",
        "What time does the flight depart for Paris?",
      ],
    ],
  ],
  fr: [
    [
      [
        "J’ai de l’expérience",
        "لدي خبرة",
        "I have experience",
        "J’ai de l’expérience",
        "J’ai de l’expérience dans la vente.",
      ],
      [
        "Je cherche du travail",
        "أبحث عن عمل",
        "I am looking for work",
        "Je cherche du travail",
        "Je cherche du travail dans une entreprise internationale.",
      ],
      [
        "Mes compétences",
        "مهاراتي",
        "My skills",
        "Mes compétences",
        "Mes compétences incluent la communication.",
      ],
      [
        "Je suis disponible",
        "أنا متاح",
        "I am available",
        "Je suis disponible",
        "Je suis disponible pour un entretien.",
      ],
    ],
    [
      [
        "Une réunion",
        "اجتماع",
        "A meeting",
        "Une réunion",
        "Nous avons une réunion à dix heures.",
      ],
      [
        "La date limite",
        "الموعد النهائي",
        "The deadline",
        "La date limite",
        "La date limite est vendredi.",
      ],
      [
        "Peux-tu m’aider ?",
        "هل يمكنك مساعدتي؟",
        "Can you help me?",
        "Peux-tu m’aider ?",
        "Peux-tu m’aider avec ce rapport ?",
      ],
      [
        "Je t’envoie le document",
        "سأرسل لك الوثيقة",
        "I am sending you the document",
        "Je t’envoie le document",
        "Je t’envoie le document par courriel.",
      ],
    ],
    [
      [
        "J’ai une réservation",
        "لدي حجز",
        "I have a reservation",
        "J’ai une réservation",
        "J’ai une réservation pour deux nuits.",
      ],
      [
        "Mes bagages",
        "أمتعتي",
        "My luggage",
        "Mes bagages",
        "Mes bagages ne sont pas arrivés.",
      ],
      [
        "La porte d’embarquement",
        "بوابة الصعود",
        "The boarding gate",
        "La porte d’embarquement",
        "Où est la porte d’embarquement ?",
      ],
      [
        "À quelle heure part le vol ?",
        "في أي ساعة تقلع الطائرة؟",
        "What time does the flight depart?",
        "À quelle heure part le vol ?",
        "À quelle heure part le vol pour Paris ?",
      ],
    ],
  ],
};
export const proLessons: ProLesson[] = (
  ["es", "en", "fr"] as Language[]
).flatMap((language) =>
  rows[language].map((words, i) => ({
    id: `${language}-${i + 4}`,
    language,
    title: titles[i],
    words: words.map(([word, ar, en, fr, example]) => ({
      word,
      ar,
      en,
      fr,
      example,
      emoji: ["💼", "🤝", "✈️"][i],
    })),
  })),
);
export function proExercises(id: string) {
  const lesson = proLessons.find((l) => l.id === id);
  if (!lesson) throw new Error("Unknown lesson");
  return lesson.words.map((w, i) => ({
    id: `${id}-q${i}`,
    type: i === 1 ? "fill" : i === 3 ? "build" : "choice",
    prompt: w.ar,
    target: w.word,
    options: i === 3 ? w.example.split(" ") : lesson.words.map((x) => x.word),
    answer: i === 3 ? w.example : w.word,
    explanation: w.example,
  }));
}
