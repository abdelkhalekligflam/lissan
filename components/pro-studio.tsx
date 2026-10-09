"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  BookOpen,
  Volume2,
  Check,
  ArrowLeft,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  languages,
  normalize,
  type Language,
  type Locale,
} from "@/lib/learning/content";
const word = z.object({
  word: z.string(),
  ar: z.string(),
  en: z.string(),
  fr: z.string(),
  example: z.string(),
  emoji: z.string(),
});
const lesson = z.object({
  id: z.string().regex(/^(es|en|fr)-[4-6]$/),
  language: z.enum(["es", "en", "fr"]),
  title: z.object({ ar: z.string(), en: z.string(), fr: z.string() }),
  words: z.array(word).length(4),
  exercises: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        prompt: z.string(),
        target: z.string(),
        options: z.array(z.string()),
        answer: z.string(),
        explanation: z.string(),
      }),
    )
    .length(4),
});
type Lesson = z.infer<typeof lesson>;
type Props = {
  onLanguage: (language: Language) => void;
  language: Language;
  locale: Locale;
  completed: string[];
  reviews: Record<string, { interval: number; due: string }>;
  onUpdate: () => Promise<void>;
};
export function ProStudio({
  onLanguage,
  language,
  locale,
  completed,
  reviews,
  onUpdate,
}: Props) {
  const [lessons, setLessons] = useState<Lesson[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Lesson | null>(null),
    [mode, setMode] = useState<"read" | "quiz" | "cards">("read"),
    [card, setCard] = useState(0),
    [flipped, setFlipped] = useState(false),
    [answers, setAnswers] = useState<string[]>([]),
    [answer, setAnswer] = useState(""),
    [tokens, setTokens] = useState<number[]>([]),
    [result, setResult] = useState<{
      score: number;
      xp: number;
      passed: boolean;
    } | null>(null);
  const t = (ar: string, en: string, fr: string) =>
    locale === "ar" ? ar : locale === "fr" ? fr : en;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning?pro=1", { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "تعذر التحميل");
        setLessons(z.object({ lessons: z.array(lesson) }).parse(data).lessons);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  const speak = (text: string, slow = false) => {
    if (!("speechSynthesis" in window)) {
      setError(
        t(
          "المتصفح لا يدعم الصوت",
          "Speech is unavailable in this browser",
          "Audio indisponible dans ce navigateur",
        ),
      );
      return;
    }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = languages.find((l) => l.id === language)!.speech;
    speech.rate = slow ? 0.7 : 1;
    window.speechSynthesis.speak(speech);
  };
  async function post(data: Record<string, unknown>) {
    const response = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 429)
        throw new Error(
          t(
            `حاول بعد ${response.headers.get("Retry-After") || 60} ثانية`,
            `Try again in ${response.headers.get("Retry-After") || 60} seconds`,
            `Réessayez dans ${response.headers.get("Retry-After") || 60} secondes`,
          ),
        );
      throw new Error(
        body.error ||
          t("تعذر الحفظ", "Could not save", "Sauvegarde impossible"),
      );
    }
    return body;
  }
  function open(l: Lesson, m: "read" | "cards" = "read") {
    setSelected({
      ...l,
      exercises: l.exercises.map((e) =>
        e.type === "build"
          ? { ...e, options: [...e.options].sort((a, b) => a.localeCompare(b)) }
          : e,
      ),
    });
    setMode(m);
    setCard(0);
    setAnswers([]);
    setAnswer("");
    setTokens([]);
    setFlipped(false);
    setResult(null);
    setError("");
  }
  async function submit() {
    if (!selected || !answer.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const all = [...answers, z.string().trim().min(1).max(300).parse(answer)];
      if (all.length === 4) {
        const body = await post({
          action: "quiz",
          lesson_id: selected.id,
          answers: all,
        });
        setAnswers(all);
        setResult(body);
        await onUpdate();
      } else {
        setAnswers(all);
        setAnswer("");
        setTokens([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  async function review(known: boolean) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await post({
        action: "review",
        card_id: `${language}-${Number(selected.id.split("-")[1]) - 1}-${card}`,
        known,
      });
      await onUpdate();
      setCard((card + 1) % 4);
      setFlipped(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  const current = selected?.exercises[answers.length];
  return (
    <section className="page-container pro-studio">
      <div className="page-heading">
        <div>
          <span className="chip violet">
            <Sparkles size={14} /> Lissan Pro
          </span>
          <h1>
            {t(
              "لغات للحياة والخدمة",
              "Language for life & work",
              "Des langues pour la vie et le travail",
            )}
          </h1>
          <p>
            {t(
              "مسارات عملية، اختبارات ومراجعة ذكية.",
              "Practical paths, quizzes and smart review.",
              "Parcours pratiques, quiz et révision intelligente.",
            )}
          </p>
        </div>
      </div>
      <label className="field">
        {t("لغة المسار", "Path language", "Langue du parcours")}
        <select
          value={language}
          onChange={(e) => {
            setSelected(null);
            onLanguage(e.target.value as Language);
          }}
        >
          {languages.map((l) => (
            <option value={l.id} key={l.id}>
              {l.flag}{" "}
              {locale === "ar" ? l.name : locale === "fr" ? l.fr : l.en}
            </option>
          ))}
        </select>
      </label>
      {loading && (
        <p role="status">
          {t("تحميل المحتوى…", "Loading content…", "Chargement…")}
        </p>
      )}
      {error && (
        <p className="pro-error" role="alert">
          {error}
        </p>
      )}
      {!selected && (
        <div className="pro-lessons">
          {lessons
            .filter((l) => l.language === language)
            .map((l) => {
              const done = completed.includes(l.id);
              return (
                <article className="panel" key={l.id}>
                  <span className="chip violet">
                    PRO {done && <Check size={14} />}
                  </span>
                  <h2>{l.title[locale]}</h2>
                  <p>
                    {t(
                      "4 عبارات · استماع · اختبار · بطاقات",
                      "4 phrases · listening · quiz · cards",
                      "4 expressions · audio · quiz · cartes",
                    )}
                  </p>
                  <div className="pro-actions">
                    <button className="btn primary" onClick={() => open(l)}>
                      <BookOpen size={16} />
                      {t("ابدأ الدرس", "Start lesson", "Commencer")}
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => open(l, "cards")}
                    >
                      <Layers size={16} />
                      {t("راجع البطاقات", "Review cards", "Réviser les cartes")}
                    </button>
                  </div>
                </article>
              );
            })}
        </div>
      )}
      {selected && (
        <>
          <button
            className="text-btn"
            onClick={() => {
              setSelected(null);
              window.speechSynthesis?.cancel();
            }}
          >
            <ArrowLeft size={16} />
            {t("جميع المسارات", "All paths", "Tous les parcours")}
          </button>
          <article className="panel pro-learning">
            <h2>{selected.title[locale]}</h2>
            {mode === "read" && (
              <>
                <div className="pro-word">
                  <small>{card + 1} / 4</small>
                  <h3 dir="ltr">{selected.words[card].word}</h3>
                  <p>{selected.words[card][locale]}</p>
                  <p dir="ltr">{selected.words[card].example}</p>
                  <div className="pro-actions">
                    <button
                      className="btn secondary"
                      onClick={() => speak(selected.words[card].example)}
                    >
                      <Volume2 size={16} />
                      {t(
                        "اسمع المثال",
                        "Listen to example",
                        "Écouter l’exemple",
                      )}
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => speak(selected.words[card].example, true)}
                    >
                      0.7×
                    </button>
                  </div>
                </div>
                <div className="pro-actions">
                  {card > 0 && (
                    <button
                      className="btn secondary"
                      onClick={() => setCard(card - 1)}
                    >
                      {t("السابق", "Previous", "Précédent")}
                    </button>
                  )}
                  <button
                    className="btn primary"
                    onClick={() =>
                      card < 3
                        ? setCard(card + 1)
                        : (setMode("quiz"), setCard(0))
                    }
                  >
                    {card < 3
                      ? t("التالي", "Next", "Suivant")
                      : t("ابدأ الاختبار", "Start quiz", "Commencer le quiz")}
                  </button>
                </div>
              </>
            )}
            {mode === "cards" && (
              <>
                {(() => {
                  const id = `${language}-${Number(selected.id.split("-")[1]) - 1}-${card}`,
                    r = reviews[id];
                  return (
                    <>
                      <p>
                        {card + 1}/4 ·{" "}
                        {r
                          ? t(
                              r.interval >= 7 ? "متقن" : "قيد التعلم",
                              r.interval >= 7 ? "Mastered" : "Learning",
                              r.interval >= 7 ? "Maîtrisé" : "En cours",
                            )
                          : t("جديد", "New", "Nouveau")}
                        {r &&
                          ` · ${t("المراجعة", "Review", "Révision")}: ${new Date(r.due).toLocaleDateString(locale)}`}
                      </p>
                      <button
                        className="pro-flip"
                        onClick={() => setFlipped(!flipped)}
                        aria-label={t(
                          "اقلب البطاقة",
                          "Flip card",
                          "Retourner la carte",
                        )}
                      >
                        <h3 dir={flipped && locale === "ar" ? "rtl" : "ltr"}>
                          {flipped
                            ? selected.words[card][locale]
                            : selected.words[card].word}
                        </h3>
                        {flipped && (
                          <p dir="ltr">{selected.words[card].example}</p>
                        )}
                        <small>
                          {t(
                            "اضغط لقلب البطاقة",
                            "Tap to flip",
                            "Appuyez pour retourner",
                          )}
                        </small>
                      </button>
                    </>
                  );
                })()}
                <div className="pro-actions">
                  <button
                    className="btn secondary"
                    onClick={() => speak(selected.words[card].word)}
                  >
                    <Volume2 size={16} />
                    {t("اسمع", "Listen", "Écouter")}
                  </button>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void review(false)}
                  >
                    {t("راجع مجدداً", "Review again", "À revoir")}
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => void review(true)}
                  >
                    {t("أعرفها", "I know it", "Je connais")}
                  </button>
                </div>
              </>
            )}
            {mode === "quiz" && !result && current && (
              <>
                <p>
                  {answers.length + 1}/4 ·{" "}
                  {t(
                    "ترجم العبارة",
                    "Translate the phrase",
                    "Traduisez l’expression",
                  )}
                </p>
                <h3>
                  {locale === "ar"
                    ? current.prompt
                    : selected.words[answers.length][locale]}
                </h3>
                {current.type === "choice" && (
                  <div className="pro-options">
                    {current.options.map((o) => (
                      <button
                        className={`option-card ${answer === o ? "chosen" : ""}`}
                        key={o}
                        onClick={() => setAnswer(o)}
                        dir="ltr"
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                {current.type === "fill" && (
                  <label className="field">
                    {t(
                      "اكتب باللّغة التي تتعلمها",
                      "Write in your target language",
                      "Écrivez dans la langue apprise",
                    )}
                    <input
                      dir="ltr"
                      value={answer}
                      maxLength={300}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                  </label>
                )}
                {current.type === "build" && (
                  <>
                    <p>
                      {t(
                        "رتّب كلمات المثال",
                        "Build the example sentence",
                        "Reconstituez la phrase de l’exemple",
                      )}
                    </p>
                    <div className="pro-sentence" dir="ltr">
                      {answer || "…"}
                    </div>
                    <div className="pro-actions" dir="ltr">
                      {current.options.map((o, i) => (
                        <button
                          className="btn secondary"
                          key={i}
                          disabled={tokens.includes(i)}
                          onClick={() => {
                            const next = [...tokens, i];
                            setTokens(next);
                            setAnswer(
                              next.map((n) => current.options[n]).join(" "),
                            );
                          }}
                        >
                          {o}
                        </button>
                      ))}
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setTokens([]);
                          setAnswer("");
                        }}
                      >
                        {t("إعادة", "Reset", "Effacer")}
                      </button>
                    </div>
                  </>
                )}
                <button
                  className="btn primary"
                  disabled={!answer.trim() || busy}
                  onClick={() => void submit()}
                >
                  {busy
                    ? t("حفظ…", "Saving…", "Sauvegarde…")
                    : t("تأكيد", "Confirm", "Valider")}
                </button>
              </>
            )}
            {result && (
              <div className="pro-result" role="status">
                <span className="chip violet">
                  {result.score}% · +{result.xp} XP
                </span>
                <h3>
                  {result.passed
                    ? t("أحسنت!", "Well done!", "Bravo !")
                    : t(
                        "راجع الأمثلة وحاول مجدداً",
                        "Review the examples and try again",
                        "Révisez puis réessayez",
                      )}
                </h3>
                <p>
                  {t(
                    "النقاط تُحتسب مرة واحدة لكل درس ناجح.",
                    "XP is awarded once per passed lesson.",
                    "Les XP sont attribués une seule fois par leçon réussie.",
                  )}
                </p>
                {selected.exercises.map((e, i) => (
                  <p key={e.id} dir="ltr">
                    {normalize(answers[i]) === normalize(e.answer) ? "✓" : "↻"}{" "}
                    {e.answer}
                  </p>
                ))}
                <div className="pro-actions">
                  <button
                    className="btn primary"
                    onClick={() => open(selected, "cards")}
                  >
                    {t("راجع البطاقات", "Review cards", "Réviser les cartes")}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => open(selected)}
                  >
                    {t("أعد الدرس", "Repeat lesson", "Reprendre")}
                  </button>
                </div>
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
