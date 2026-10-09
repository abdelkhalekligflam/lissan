"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  Flame,
  Gamepad2,
  Headphones,
  Heart,
  Home,
  Layers,
  Languages,
  Link2,
  Brain,
  Lock,
  LogOut,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Trophy,
  User,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import {
  getExercises,
  languages,
  lessonId,
  normalize,
  units,
  vocabulary,
  type Language,
  type Locale,
} from "@/lib/learning/content";
import { z } from "zod";
import { AuthPanel } from "./auth-panel";
import { Pronunciation } from "./pronunciation";
import { Leaderboard } from "./leaderboard";
import { Game } from "./practice-games";
import { Listening } from "./listening";

type View =
  | "landing"
  | "onboarding"
  | "home"
  | "lesson"
  | "quiz"
  | "complete"
  | "flashcards"
  | "games"
  | "matching"
  | "speed"
  | "memory"
  | "pronunciation"
  | "listening"
  | "profile"
  | "pricing";
type Profile = {
  name: string;
  language: Language;
  locale: Locale;
  goal: number;
  level: string;
  xp: number;
  completed: string[];
  activity: Record<string, number>;
  reviews: Record<string, { interval: number; due: string }>;
};
const initial: Profile = {
  name: "",
  language: "es",
  locale: "ar",
  goal: 10,
  level: "beginner",
  xp: 0,
  completed: [],
  activity: {},
  reviews: {},
};
const discoverySchema = z.object({
  name: z.string().max(60),
  language: z.enum(["es", "en", "fr"]),
  locale: z.enum(["ar", "en", "fr"]),
  goal: z.number().refine((n) => [5, 10, 20].includes(n)),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  xp: z.number().int().min(0),
  completed: z.array(z.string().regex(/^(es|en|fr)-[1-3]$/)).max(9),
  activity: z.record(z.string(), z.number().min(0)),
  reviews: z.record(
    z.string(),
    z.object({
      interval: z.number().int().min(0).max(60),
      due: z.string().datetime(),
    }),
  ),
});
const localKey = "lissan-discovery-v1";
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" });
function streak(activity: Record<string, number>) {
  let n = 0;
  const d = new Date();
  if (!activity[today()]) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const key = d.toLocaleDateString("en-CA", {
      timeZone: "Africa/Casablanca",
    });
    if (!activity[key]) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export default function LissanApp({ configured }: { configured: boolean }) {
  const [view, setView] = useState<View>("landing");
  const [p, setP] = useState<Profile>(initial);
  const [ready, setReady] = useState(false);
  const [signed, setSigned] = useState(false);
  const [auth, setAuth] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [lesson, setLesson] = useState(0);
  const [word, setWord] = useState(0);
  const [q, setQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [tokens, setTokens] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [earned, setEarned] = useState(0);
  const [deck, setDeck] = useState(0);
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [practiceEarly, setPracticeEarly] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [yearly, setYearly] = useState(true);
  const lang = languages.find((l) => l.id === p.language)!;
  const words = vocabulary[p.language][lesson];
  const exercises = getExercises(p.language, lesson);
  const current = exercises[q];
  const t = (ar: string, en: string, fr: string) =>
    p.locale === "ar" ? ar : p.locale === "fr" ? fr : en;
  const dueCards = [0, 1, 2, 3].filter(
    (i) =>
      !p.reviews[`${p.language}-${deck}-${i}`] ||
      new Date(p.reviews[`${p.language}-${deck}-${i}`].due).getTime() <=
        Date.now(),
  );
  const unitTitle = (i: number) => units[i][p.locale];
  const navigate = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  async function api(action: string, data: Record<string, unknown> = {}) {
    const r = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });
    const body = await r.json();
    if (!r.ok)
      throw new Error(
        body.error ||
          t(
            "تعذر حفظ التقدم. حاول مرة أخرى.",
            "Could not save progress. Try again.",
            "Impossible de sauvegarder. Réessayez.",
          ),
      );
    return body;
  }
  async function sync() {
    try {
      const r = await fetch("/api/learning");
      if (r.status === 401) {
        setSigned(false);
        return;
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSigned(true);
      setP(data.profile);
      navigate(data.profile.name ? "home" : "onboarding");
    } catch {
      setNotice(
        t(
          "تعذر الاتصال. تقدم الحساب لم يتم تحميله.",
          "Connection unavailable. Account progress has not loaded.",
          "Connexion indisponible. Progression non chargée.",
        ),
      );
    }
  }
  useEffect(() => {
    try {
      const saved = discoverySchema.safeParse(
        JSON.parse(localStorage.getItem(localKey) || "null"),
      );
      if (saved.success) setP(saved.data);
    } catch {}
    setReady(true);
    if (new URLSearchParams(window.location.search).has("auth_error"))
      setNotice(
        "رابط الدخول غير صالح أو منتهي. حاول من جديد. / This sign-in link is invalid or expired.",
      );
    if (configured) void sync();
  }, []); // Initial session bootstrap only.
  useEffect(() => {
    if (ready && !signed) {
      try {
        localStorage.setItem(localKey, JSON.stringify(p));
      } catch {}
    }
    document.documentElement.dir = p.locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = p.locale;
  }, [p, ready, signed]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const completed = p.completed.filter((id) => id.startsWith(p.language));
  const nextLesson = Math.min(completed.length, 2);
  const startLesson = (i: number) => {
    setLesson(i);
    setWord(0);
    navigate("lesson");
  };
  const beginQuiz = () => {
    setQ(0);
    setAnswer("");
    setTokens([]);
    setAnswers([]);
    setFeedback(null);
    navigate("quiz");
  };
  async function finishQuiz(finalAnswers: string[]) {
    setBusy(true);
    try {
      let result;
      if (signed)
        result = await api("quiz", {
          lesson_id: lessonId(p.language, lesson),
          answers: finalAnswers,
        });
      else {
        const correct = exercises.filter(
          (e, i) => normalize(finalAnswers[i] || "") === normalize(e.answer),
        ).length;
        const passed = correct >= 3;
        const id = lessonId(p.language, lesson);
        const xp = passed && !p.completed.includes(id) ? correct * 10 : 0;
        result = { score: Math.round((correct / 4) * 100), xp, passed };
        setP((prev) => ({
          ...prev,
          xp: prev.xp + xp,
          completed: passed
            ? Array.from(new Set([...prev.completed, id]))
            : prev.completed,
          activity: {
            ...prev.activity,
            [today()]: (prev.activity[today()] || 0) + xp,
          },
        }));
      }
      setScore(result.score);
      setEarned(result.xp);
      if (signed) {
        const r = await fetch("/api/learning");
        if (r.ok) setP((await r.json()).profile);
      }
      navigate("complete");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function checkAnswer() {
    const a =
      current.type === "build"
        ? tokens.map((i) => current.options[i]).join(" ")
        : answer;
    setAnswer(a);
    setFeedback(normalize(a) === normalize(current.answer));
  }
  function nextQuestion() {
    const updated = [...answers, answer];
    if (q === 3) {
      void finishQuiz(updated);
      return;
    }
    setAnswers(updated);
    setQ(q + 1);
    setAnswer("");
    setTokens([]);
    setFeedback(null);
  }
  async function saveOnboarding() {
    setBusy(true);
    try {
      if (signed)
        await api("profile", {
          name: p.name || "متعلم",
          language: p.language,
          locale: p.locale,
          goal: p.goal,
          level: p.level,
        });
      setP((prev) => ({
        ...prev,
        name: prev.name || t("متعلم", "Learner", "Apprenant"),
      }));
      navigate("home");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSettings() {
    setBusy(true);
    try {
      if (signed)
        await api("profile", {
          name: p.name,
          language: p.language,
          locale: p.locale,
          goal: p.goal,
          level: p.level,
        });
      setNotice(
        t("تم حفظ الإعدادات", "Settings saved", "Paramètres enregistrés"),
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(known: boolean) {
    const key = `${p.language}-${deck}-${card}`;
    setBusy(true);
    try {
      let review;
      if (signed) review = await api("review", { card_id: key, known });
      else {
        const interval = known
          ? Math.min((p.reviews[key]?.interval || 0) * 2 + 1, 60)
          : 0;
        review = {
          interval,
          due: new Date(
            Date.now() + Math.max(1, interval) * 86400000,
          ).toISOString(),
        };
      }
      setP((prev) => ({
        ...prev,
        reviews: { ...prev.reviews, [key]: review },
      }));
      setReviewed((prev) => [...prev, key]);
      setFlipped(false);
      const updatedReviews = { ...p.reviews, [key]: review };
      const next = [1, 2, 3, 4]
        .map((n) => (card + n) % 4)
        .find(
          (i) =>
            !updatedReviews[`${p.language}-${deck}-${i}`] ||
            new Date(
              updatedReviews[`${p.language}-${deck}-${i}`].due,
            ).getTime() <= Date.now(),
        );
      setCard(next ?? (card + 1) % 4);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function speak(text: string, rate = 1) {
    if (!("speechSynthesis" in window)) {
      setNotice(
        t(
          "الصوت غير مدعوم في هذا المتصفح",
          "Audio is unavailable in this browser",
          "Audio indisponible dans ce navigateur",
        ),
      );
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang.speech;
    u.rate = rate;
    speechSynthesis.speak(u);
  }
  const Arrow = p.locale === "ar" ? ArrowLeft : ArrowRight;
  const navItems: [View, string, typeof Home][] = [
    ["home", t("المسار", "Learn", "Parcours"), BookOpen],
    ["flashcards", t("البطاقات", "Cards", "Cartes"), Layers],
    ["games", t("الألعاب", "Games", "Jeux"), Gamepad2],
    ["pronunciation", t("النطق", "Speaking", "Prononciation"), Mic],
  ];
  const ring = (value: number, label: string) => (
    <div
      className="ring"
      style={{ "--progress": `${value}%` } as CSSProperties}
    >
      <div>
        <strong>{value}%</strong>
        <small>{label}</small>
      </div>
    </div>
  );
  const primary = (label: string, onClick: () => void, disabled = false) => (
    <button
      className="btn primary"
      onClick={onClick}
      disabled={disabled || busy}
    >
      {busy ? t("لحظة…", "One moment…", "Un instant…") : label}
      <Arrow size={18} />
    </button>
  );
  const workspace = [
    "home",
    "flashcards",
    "games",
    "matching",
    "speed",
    "memory",
    "pronunciation",
    "listening",
    "profile",
  ].includes(view);
  const activeNav: View = ["matching", "speed", "memory"].includes(view)
    ? "games"
    : view === "listening"
      ? "pronunciation"
      : view;
  const authEntry = () => (configured ? setAuth(true) : navigate("onboarding"));
  return (
    <div
      className={`app-root ${workspace ? "workspace" : ""}`}
      style={{ "--language": lang.color } as CSSProperties}
    >
      <header className="header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate(signed ? "home" : "landing")}
            aria-label="Lissan"
          >
            <span className="brand-mark">
              <img src="/icon.svg" alt="" width={40} height={40} />
            </span>
            <span>
              <b>{t("لسان", "Lissan", "Lissan")}</b>
              <small>
                {t(
                  "تعلم اللغات بذكاء ومتعة",
                  "Make every word count",
                  "Chaque mot compte",
                )}
              </small>
            </span>
          </button>
          <nav
            className="desktop-nav"
            aria-label={t(
              "القائمة الرئيسية",
              "Main navigation",
              "Navigation principale",
            )}
          >
            {view === "landing" ? (
              <>
                <a href="#languages">{t("اللغات", "Languages", "Langues")}</a>
                <a href="#features">
                  {t("كيفاش كتخدم", "How it works", "Comment ça marche")}
                </a>
                <button onClick={() => navigate("pricing")}>
                  {t("الاشتراك", "Pricing", "Abonnement")}
                </button>
              </>
            ) : (
              navItems.map(([v, label, Icon]) => (
                <button
                  key={v}
                  className={activeNav === v ? "active" : ""}
                  onClick={() => navigate(v)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))
            )}
          </nav>
          <div className="header-actions">
            <div className="locale" aria-label="Interface language">
              {(["ar", "en", "fr"] as Locale[]).map((l) => (
                <button
                  key={l}
                  className={p.locale === l ? "selected" : ""}
                  onClick={() => setP({ ...p, locale: l })}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {view !== "landing" && (
              <span className="chip streak-chip">
                <Flame size={16} />
                {streak(p.activity)}
              </span>
            )}
            {view !== "landing" && (
              <span className="chip xp-chip">
                <Zap size={16} />
                {p.xp} XP
              </span>
            )}
            <button
              className="avatar"
              aria-label={t("الحساب", "Account", "Compte")}
              onClick={() =>
                signed || p.name ? navigate("profile") : authEntry()
              }
            >
              {p.name ? p.name.slice(0, 1) : <User size={19} />}
            </button>
          </div>
        </div>
      </header>
      {ready && !signed && view !== "landing" && (
        <div className="discovery-note">
          <Sparkles size={14} />
          {t(
            "وضع الاكتشاف — تقدم تجريبي محفوظ على هذا الجهاز",
            "Discovery mode — practice progress saved on this device",
            "Mode découverte — progression sauvegardée sur cet appareil",
          )}
          {configured && (
            <button onClick={() => setAuth(true)}>
              {t("احفظ في حسابك", "Sign in to save", "Se connecter")}
            </button>
          )}
        </div>
      )}
      {workspace && (
        <aside
          className="workspace-sidebar"
          aria-label={t(
            "مساحة التعلم",
            "Learning workspace",
            "Espace d’apprentissage",
          )}
        >
          <div className="sidebar-heading">
            <span className="sidebar-status" />
            {t("مساحة التعلم", "Your workspace", "Votre espace")}
          </div>
          <nav className="sidebar-nav">
            {navItems.map(([v, label, Icon]) => (
              <button
                key={v}
                className={activeNav === v ? "active" : ""}
                aria-current={activeNav === v ? "page" : undefined}
                onClick={() => navigate(v)}
              >
                <Icon size={18} strokeWidth={1.7} />
                <span>{label}</span>
                {activeNav === v && <span className="nav-indicator" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-heading secondary-heading">
            {t("حسابك", "Personal", "Personnel")}
          </div>
          <nav className="sidebar-nav">
            <button
              className={view === "profile" ? "active" : ""}
              aria-current={view === "profile" ? "page" : undefined}
              onClick={() => navigate("profile")}
            >
              <Settings size={18} strokeWidth={1.7} />
              {t(
                "الملف والإعدادات",
                "Profile & settings",
                "Profil et réglages",
              )}
            </button>
            <button onClick={() => navigate("pricing")}>
              <Sparkles size={18} strokeWidth={1.7} />
              {t("Lissan Premium", "Lissan Premium", "Lissan Premium")}
              <span className="sidebar-soon">
                {t("قريباً", "Soon", "Bientôt")}
              </span>
            </button>
          </nav>
          <div className="sidebar-bottom">
            <span className="sidebar-language">
              {lang.flag}
              <b>{t(lang.name, lang.en, lang.fr)}</b>
              <span>A1</span>
            </span>
            <p>
              {t(
                "خطوة صغيرة كل يوم.",
                "A little progress, every day.",
                "Un petit pas, chaque jour.",
              )}
            </p>
            <div className="progress">
              <i
                style={{
                  width: `${Math.round((completed.length / 3) * 100)}%`,
                }}
              />
            </div>
            <small>
              {completed.length} / 3{" "}
              {t("دروس مكتملة", "lessons completed", "leçons terminées")}
            </small>
          </div>
        </aside>
      )}
      <main>
        {view === "landing" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="live-dot" />
                  {t(
                    "ثلاث لغات. عالم من الإمكانيات.",
                    "Three languages. A world of possibilities.",
                    "Trois langues. Un monde de possibilités.",
                  )}
                </div>
                <h1>
                  {t("كل كلمة،", "Every word,", "Chaque mot,")}
                  <br />
                  <span className="gradient-text">
                    {t(
                      "بداية جديدة.",
                      "a new beginning.",
                      "un nouveau départ.",
                    )}
                  </span>
                </h1>
                <p>
                  {t(
                    "تعلم الإسبانية والإنجليزية والفرنسية بطريقة ممتعة وذكية. دروس قصيرة، تدريب حقيقي، وتقدم كتشوفو كل نهار.",
                    "Learn Spanish, English and French with short lessons, real practice and progress you can see every day.",
                    "Apprenez l’espagnol, l’anglais et le français avec des leçons courtes et une progression visible chaque jour.",
                  )}
                </p>
                <div className="hero-actions">
                  {primary(
                    t(
                      "ابدأ التعلم مجاناً",
                      "Start learning for free",
                      "Commencer gratuitement",
                    ),
                    authEntry,
                  )}
                  <button
                    className="btn secondary"
                    onClick={() => navigate("onboarding")}
                  >
                    <Play size={17} />
                    {t("جرب درساً", "Try a lesson", "Essayer une leçon")}
                  </button>
                </div>
                <div className="hero-proof">
                  <span>
                    <Check size={15} />
                    {t(
                      "بالعربية والدارجة",
                      "Made for Arabic speakers",
                      "Pour les arabophones",
                    )}
                  </span>
                  <span>
                    <Check size={15} />
                    {t(
                      "5 دقائق للبداية",
                      "Start with 5 minutes",
                      "Commencez en 5 minutes",
                    )}
                  </span>
                  <span>
                    <Check size={15} />
                    {t(
                      "بلا بطاقة بنكية",
                      "No credit card",
                      "Sans carte bancaire",
                    )}
                  </span>
                </div>
              </div>
              <div className="hero-preview">
                <div className="preview-head">
                  <div className="window-dots">
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>
                    lissan ·{" "}
                    {t(
                      "مسارك الشخصي",
                      "your personal journey",
                      "votre parcours",
                    )}
                  </span>
                  <span className="chip">🇪🇸 A1</span>
                </div>
                <div className="preview-grid">
                  <div className="preview-lesson">
                    <span className="chip orange">
                      {t("درس اليوم", "Today’s lesson", "La leçon du jour")}
                    </span>
                    <div className="preview-emoji">
                      <Languages size={36} strokeWidth={1.4} />
                    </div>
                    <h2 dir="ltr">Hola, ¿cómo estás?</h2>
                    <p>
                      {t(
                        "مرحباً، كيف حالك؟",
                        "Hello, how are you?",
                        "Bonjour, comment vas-tu ?",
                      )}
                    </p>
                    <button
                      className="round-audio"
                      onClick={() => {
                        const u = new SpeechSynthesisUtterance(
                          "Hola, ¿cómo estás?",
                        );
                        u.lang = "es-ES";
                        speechSynthesis.speak(u);
                      }}
                      aria-label="Listen to Spanish"
                    >
                      <Volume2 size={25} />
                    </button>
                    <div className="word-hint">
                      {t(
                        "بالدارجة: سلام، كيف داير؟",
                        "A little practice. A big first step.",
                        "Un petit exercice. Un grand premier pas.",
                      )}
                    </div>
                  </div>
                  <div className="preview-side">
                    <div className="preview-greeting">
                      <Sparkles size={22} />
                      <h3>
                        {t(
                          "خطوة صغيرة، فرق كبير",
                          "Small steps, big possibilities",
                          "Petits pas, grandes possibilités",
                        )}
                      </h3>
                      <p>
                        {t(
                          "كل كلمة جديدة كتفتح ليك باب",
                          "Every new word opens a door",
                          "Chaque nouveau mot ouvre une porte",
                        )}
                      </p>
                    </div>
                    <div className="preview-path">
                      <div className="node complete">
                        <Check size={22} />
                      </div>
                      <span className="path-connector" />
                      <div className="node current">
                        <Play size={22} />
                      </div>
                      <span className="path-connector muted" />
                      <div className="node locked">
                        <Lock size={18} />
                      </div>
                    </div>
                    <div className="preview-stat">
                      <span>
                        {t(
                          "درس واحد. بداية جديدة.",
                          "One lesson. A fresh start.",
                          "Une leçon. Un nouveau départ.",
                        )}
                      </span>
                      <span className="cyan">+40 XP</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section className="section" id="languages">
              <div className="section-heading">
                <span className="overline">
                  {t(
                    "اختار وجهتك",
                    "CHOOSE YOUR DIRECTION",
                    "CHOISISSEZ VOTRE DIRECTION",
                  )}
                </span>
                <h2>
                  {t(
                    "ثلاث لغات، عالم من الفرص",
                    "Three languages. A world of possibilities.",
                    "Trois langues. Un monde de possibilités.",
                  )}
                </h2>
                <p>
                  {t(
                    "من أول سلام، حتى أول محادثة بثقة.",
                    "From your first hello to your first confident conversation.",
                    "Du premier bonjour à votre première conversation.",
                  )}
                </p>
              </div>
              <div className="language-grid">
                {languages.map((l, i) => (
                  <button
                    key={l.id}
                    className="language-card"
                    style={{ "--accent": l.color } as CSSProperties}
                    onClick={() => {
                      setP({ ...p, language: l.id });
                      navigate("onboarding");
                    }}
                  >
                    <div className="language-card-top">
                      <span className="flag">{l.flag}</span>
                      <span className="tiny-tag">
                        A1 · {t("مبتدئ", "Beginner", "Débutant")}
                      </span>
                    </div>
                    <h3>{p.locale === "ar" ? l.name : l[p.locale]}</h3>
                    <p dir="ltr">{l.hello}</p>
                    <small>
                      {
                        [
                          t(
                            "للسفر والثقافة والتواصل",
                            "For travel, culture & connection",
                            "Voyage, culture et rencontres",
                          ),
                          t(
                            "للعمل والدراسة والعالم",
                            "For work, study & the world",
                            "Travail, études et découvertes",
                          ),
                          t(
                            "لفرص جديدة وقرب أكبر",
                            "For new opportunities",
                            "De nouvelles opportunités",
                          ),
                        ][i]
                      }
                    </small>
                    <div className="language-bottom">
                      <span>
                        {t(
                          "اكتشف المسار",
                          "Explore the path",
                          "Découvrir le parcours",
                        )}
                      </span>
                      <Arrow size={18} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <section className="section" id="features">
              <div className="section-heading">
                <span className="overline">
                  {t(
                    "أقل تعقيد، أكثر تعلم",
                    "LESS FRICTION. MORE LEARNING.",
                    "MOINS DE COMPLEXITÉ. PLUS D’APPRENTISSAGE.",
                  )}
                </span>
                <h2>
                  {t(
                    "تعلم كيناسب حياتك",
                    "Learning that fits your life",
                    "Un apprentissage qui vous ressemble",
                  )}
                </h2>
              </div>
              <div className="feature-grid">
                {[
                  [
                    BookOpen,
                    t(
                      "دروس قصيرة وواضحة",
                      "Small, focused lessons",
                      "Des leçons courtes",
                    ),
                    t(
                      "كلمات وعبارات كتحتاجها في الحياة اليومية.",
                      "Words and phrases for everyday life.",
                      "Des mots utiles au quotidien.",
                    ),
                  ],
                  [
                    Layers,
                    t(
                      "كلمات كتبقى معاك",
                      "Words that stay with you",
                      "Des mots qui restent",
                    ),
                    t(
                      "مراجعة ذكية بالتكرار المتباعد، حسب تقدمك.",
                      "Spaced repetition that follows your progress.",
                      "La répétition espacée suit vos progrès.",
                    ),
                  ],
                  [
                    Gamepad2,
                    t(
                      "تدرب بلا ملل",
                      "Practice without boredom",
                      "Pratiquez sans vous ennuyer",
                    ),
                    t(
                      "مطابقة كلمات، تحدي سرعة ولعبة الذاكرة.",
                      "Matching, speed rounds and memory games.",
                      "Association, rapidité et mémoire.",
                    ),
                  ],
                  [
                    Mic,
                    t(
                      "اسمع، قول، كرر",
                      "Listen, speak, repeat",
                      "Écoutez, parlez, répétez",
                    ),
                    t(
                      "تدرب على النطق وسجل صوتك باش تسمع التحسن.",
                      "Record yourself and hear your improvement.",
                      "Enregistrez-vous et écoutez vos progrès.",
                    ),
                  ],
                ].map(([Icon, title, desc], i) => {
                  const I = Icon as typeof BookOpen;
                  return (
                    <article className="feature" key={i}>
                      <span className="feature-icon">
                        <I size={24} />
                      </span>
                      <h3>{title as string}</h3>
                      <p>{desc as string}</p>
                    </article>
                  );
                })}
              </div>
            </section>
            <section className="section steps-section">
              <div className="section-heading">
                <h2>
                  {t(
                    "بداية بسيطة. مسار واضح.",
                    "A simple start. A clear path.",
                    "Un départ simple. Un parcours clair.",
                  )}
                </h2>
              </div>
              <div className="three-grid">
                {[
                  t(
                    "اختار اللغة والهدف",
                    "Choose your language & goal",
                    "Choisissez une langue et un objectif",
                  ),
                  t(
                    "تعلم وطبق بكلمات حقيقية",
                    "Learn with real words",
                    "Apprenez avec de vrais mots",
                  ),
                  t(
                    "راجع وشوف تقدمك",
                    "Review and see your progress",
                    "Révisez et suivez vos progrès",
                  ),
                ].map((s, i) => (
                  <div className="step-item" key={s}>
                    <span>0{i + 1}</span>
                    <h3>{s}</h3>
                  </div>
                ))}
              </div>
            </section>
            <section className="section final-cta">
              <Sparkles size={32} />
              <h2>
                {t(
                  "الكلمة الأولى عليك. الباقي علينا.",
                  "Take the first step. We’ll guide the rest.",
                  "Faites le premier pas. On vous accompagne.",
                )}
              </h2>
              <p>
                {t(
                  "خمس دقائق اليوم، بداية جديدة غداً.",
                  "Five minutes today. A new beginning tomorrow.",
                  "Cinq minutes aujourd’hui. Un nouveau départ demain.",
                )}
              </p>
              {primary(
                t(
                  "ابدأ المسار ديالك",
                  "Start your journey",
                  "Commencer mon parcours",
                ),
                authEntry,
              )}
            </section>
          </>
        )}
        {view === "onboarding" && (
          <section className="focus onboarding">
            <div className="focus-top">
              <button
                className="icon-btn"
                onClick={() => (step ? setStep(step - 1) : navigate("landing"))}
                aria-label="Back"
              >
                <ArrowRight />
              </button>
              <span>
                {t("خطوة", "Step", "Étape")} {step + 1} / 3
              </span>
              <span className="chip cyan">
                {t("بداية جديدة", "A fresh start", "Un nouveau départ")}
              </span>
            </div>
            <div className="progress">
              <i style={{ width: `${((step + 1) / 3) * 100}%` }} />
            </div>
            <div className="focus-title">
              <span className="big-emoji">{["🌍", "🌱", "🎯"][step]}</span>
              <h1>
                {
                  [
                    t(
                      "شنو هي اللغة اللي بغيتي تتعلم؟",
                      "Which language would you like to learn?",
                      "Quelle langue voulez-vous apprendre ?",
                    ),
                    t(
                      "فين وصلتي دابا؟",
                      "Where are you starting from?",
                      "Quel est votre niveau ?",
                    ),
                    t(
                      "شحال من دقيقة نعطيو للتعلم؟",
                      "Make a little room for learning",
                      "Quel est votre objectif quotidien ?",
                    ),
                  ][step]
                }
              </h1>
              <p>
                {t(
                  "نصممو ليك تجربة على قدك. تقدر تبدل هاد الخيارات من بعد.",
                  "Make this your own. You can change these choices later.",
                  "Personnalisez votre parcours. Ces choix restent modifiables.",
                )}
              </p>
            </div>
            {step === 0 && (
              <div className="three-grid">
                {languages.map((l) => (
                  <button
                    key={l.id}
                    className={`option-card ${p.language === l.id ? "chosen" : ""}`}
                    onClick={() => setP({ ...p, language: l.id })}
                  >
                    <span className="flag">{l.flag}</span>
                    <h3>{p.locale === "ar" ? l.name : l[p.locale]}</h3>
                    <small dir="ltr">{l.hello}</small>
                    {p.language === l.id && (
                      <CheckCircle2 className="option-check" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <div className="option-list">
                {["beginner", "intermediate", "advanced"].map((level, i) => (
                  <button
                    key={level}
                    className={`option-card horizontal ${p.level === level ? "chosen" : ""}`}
                    onClick={() => setP({ ...p, level })}
                  >
                    <span className="big-emoji">{["🌱", "🌿", "🌳"][i]}</span>
                    <span>
                      <b>
                        {
                          [
                            t("مبتدئ", "Beginner", "Débutant"),
                            t("متوسط", "Intermediate", "Intermédiaire"),
                            t("متقدم", "Advanced", "Avancé"),
                          ][i]
                        }
                      </b>
                      <small>
                        {
                          [
                            t(
                              "نبدا من أول كلمة",
                              "Start with the first word",
                              "Commencer par le premier mot",
                            ),
                            t(
                              "عندي أساسيات وبغيت نطورها",
                              "Build on the basics",
                              "Renforcer mes bases",
                            ),
                            t(
                              "بغيت نراجع ونزيد الثقة",
                              "Review and gain confidence",
                              "Réviser et gagner en confiance",
                            ),
                          ][i]
                        }
                      </small>
                    </span>
                    {p.level === level && <CheckCircle2 />}
                  </button>
                ))}
                <p className="muted">
                  {t(
                    "المحتوى الحالي مستوى A1. اختيار المستوى لا يمثل اختبار تحديد المستوى.",
                    "Current lessons cover A1. This preference is not a placement test.",
                    "Les leçons actuelles couvrent A1. Ce choix n’est pas un test de niveau.",
                  )}
                </p>
              </div>
            )}
            {step === 2 && (
              <>
                <div className="three-grid">
                  {[5, 10, 20].map((goal, i) => (
                    <button
                      key={goal}
                      className={`option-card ${p.goal === goal ? "chosen" : ""}`}
                      onClick={() => setP({ ...p, goal })}
                    >
                      <span className="big-emoji">{["☕", "⚡", "🚀"][i]}</span>
                      <h2>
                        {goal} <small>{t("دقائق", "minutes", "minutes")}</small>
                      </h2>
                      <p>
                        {
                          [
                            t("بداية خفيفة", "Easy start", "Un début léger"),
                            t(
                              "تقدم منتظم",
                              "Steady progress",
                              "Progrès réguliers",
                            ),
                            t("تحدي يومي", "Daily challenge", "Défi quotidien"),
                          ][i]
                        }
                      </p>
                    </button>
                  ))}
                </div>
                <label className="field">
                  {t(
                    "شنو نعيطو ليك؟",
                    "What should we call you?",
                    "Comment vous appeler ?",
                  )}
                  <input
                    maxLength={60}
                    value={p.name}
                    onChange={(e) => setP({ ...p, name: e.target.value })}
                    autoComplete="given-name"
                  />
                </label>
              </>
            )}
            <div className="focus-actions">
              {primary(
                step === 2
                  ? t("يلا نبداو", "Let’s get started", "C’est parti")
                  : t("متابعة", "Continue", "Continuer"),
                () => (step < 2 ? setStep(step + 1) : void saveOnboarding()),
              )}
            </div>
          </section>
        )}
        {view === "home" && (
          <section className="dashboard page-container">
            <div className="page-heading">
              <div>
                <span className="overline">
                  {lang.flag}{" "}
                  {t("مسارك في", "YOUR JOURNEY IN", "VOTRE PARCOURS EN")}{" "}
                  {p.locale === "ar" ? lang.name : lang[p.locale]}
                </span>
                <h1>
                  {t("مرحبا بعودتك،", "Welcome back,", "Bon retour,")}{" "}
                  {p.name || t("متعلم", "learner", "apprenant")} <span>👋</span>
                </h1>
                <p>
                  {t(
                    "كل خطوة كتقربك. شنو غادي نتعلمو اليوم؟",
                    "Every step counts. What will you learn today?",
                    "Chaque pas compte. Qu’allez-vous apprendre aujourd’hui ?",
                  )}
                </p>
              </div>
              <label className="language-select">
                <span>{t("اللغة الحالية", "Learning", "Langue")}</span>
                <select
                  value={p.language}
                  onChange={(e) =>
                    setP({ ...p, language: e.target.value as Language })
                  }
                >
                  {languages.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.flag} {p.locale === "ar" ? l.name : l[p.locale]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-main">
                <article className="continue-card">
                  <div>
                    <span className="chip violet">
                      {t(
                        "خطوتك التالية",
                        "YOUR NEXT STEP",
                        "VOTRE PROCHAINE ÉTAPE",
                      )}
                    </span>
                    <h2>{unitTitle(nextLesson)}</h2>
                    <p>
                      {t(
                        "4 عبارات جديدة · درس قصير · اختبار تفاعلي",
                        "4 new phrases · a short lesson · a quick quiz",
                        "4 expressions · une leçon courte · un quiz",
                      )}
                    </p>
                    {primary(
                      completed.length === 3
                        ? t(
                            "راجع آخر درس",
                            "Review the last lesson",
                            "Réviser la dernière leçon",
                          )
                        : t(
                            "واصل التعلم الآن",
                            "Continue learning",
                            "Continuer à apprendre",
                          ),
                      () => startLesson(nextLesson),
                    )}
                  </div>
                  {ring(
                    Math.round((completed.length / 3) * 100),
                    t("مكتمل", "complete", "terminé"),
                  )}
                </article>
                <article className="panel learning-map">
                  <div className="panel-title">
                    <h2>
                      <BookOpen size={22} />
                      {t(
                        "خريطة التقدم اللغوي",
                        "Your learning path",
                        "Votre parcours",
                      )}
                    </h2>
                    <small>
                      {completed.length} / 3 {t("دروس", "lessons", "leçons")}
                    </small>
                  </div>
                  <div className="map-track">
                    {units.map((unit, i) => {
                      const done = completed.includes(lessonId(p.language, i));
                      const locked = i > nextLesson;
                      return (
                        <div
                          className={`map-unit ${locked ? "dimmed" : ""}`}
                          key={i}
                        >
                          <span className="unit-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="unit-copy">
                            <small>
                              {t("الوحدة", "Unit", "Unité")} {i + 1} · 4{" "}
                              {t("عبارات", "phrases", "expressions")}
                            </small>
                            <span className="unit-label">{unitTitle(i)}</span>
                          </div>
                          <button
                            className={`node ${done ? "complete" : locked ? "locked" : "current"}`}
                            disabled={locked}
                            onClick={() => startLesson(i)}
                            aria-label={unitTitle(i)}
                          >
                            {done ? (
                              <Check size={29} />
                            ) : locked ? (
                              <Lock size={24} />
                            ) : (
                              <Play size={29} />
                            )}
                          </button>
                          <span className="lesson-caption">
                            {done
                              ? t(
                                  "أحسنت! تقدر تراجع",
                                  "Well done! Review anytime",
                                  "Bravo ! Révisez à tout moment",
                                )
                              : locked
                                ? t(
                                    "كمل الدرس السابق باش يتحل",
                                    "Complete the previous lesson to unlock",
                                    "Terminez la leçon précédente",
                                  )
                                : t(
                                    "أنت هنا الآن",
                                    "You are here",
                                    "Vous êtes ici",
                                  )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="daily-phrase">
                    <span className="phrase-icon">
                      <Volume2 size={22} strokeWidth={1.6} />
                    </span>
                    <div>
                      <small className="cyan">
                        {t(
                          "عبارة اليوم",
                          "PHRASE OF THE DAY",
                          "EXPRESSION DU JOUR",
                        )}
                      </small>
                      <h3 dir="ltr">{lang.hello}</h3>
                      <p>{lang.translation}</p>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => speak(lang.hello)}
                      aria-label="Listen"
                    >
                      <Volume2 />
                    </button>
                  </div>
                </article>
              </div>
              <aside className="dashboard-aside">
                <article className="panel streak-panel">
                  <div className="panel-title">
                    <h3>
                      {t(
                        "سلسلة التعلم",
                        "Learning streak",
                        "Série d’apprentissage",
                      )}
                    </h3>
                    <Flame className="orange-text" />
                  </div>
                  <h2>
                    {streak(p.activity)}{" "}
                    <small>{t("أيام", "days", "jours")}</small>
                  </h2>
                  <p>
                    {t(
                      "خمس دقائق اليوم تصنع الفرق",
                      "Five minutes today makes a difference",
                      "Cinq minutes aujourd’hui font la différence",
                    )}
                  </p>
                  <div className="week-streak">
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - 6 + i);
                      const k = d.toLocaleDateString("en-CA", {
                        timeZone: "Africa/Casablanca",
                      });
                      return (
                        <div key={k}>
                          <small>
                            {d.toLocaleDateString(p.locale, {
                              weekday: "narrow",
                            })}
                          </small>
                          <span className={p.activity[k] ? "lit" : ""}>
                            {p.activity[k] ? "🔥" : "·"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>
                <article className="panel">
                  <div className="panel-title">
                    <h3>
                      {t("الهدف اليومي", "Daily goal", "Objectif quotidien")}
                    </h3>
                    <span className="cyan">
                      {p.goal} {t("دقائق", "min", "min")}
                    </span>
                  </div>
                  <p>
                    {t(
                      "كمل درساً واحداً اليوم",
                      "Complete one lesson today",
                      "Terminez une leçon aujourd’hui",
                    )}
                  </p>
                  <div className="progress">
                    <i style={{ width: p.activity[today()] ? "100%" : "0%" }} />
                  </div>
                  <small>
                    {p.activity[today()]
                      ? t(
                          "هدفك مكتمل. برافو!",
                          "Goal complete. Great work!",
                          "Objectif atteint. Bravo !",
                        )
                      : t(
                          "خطوتك الأولى كتسناك",
                          "Your first step is waiting",
                          "Votre premier pas vous attend",
                        )}
                  </small>
                </article>
                <article className="panel quick-links">
                  <small className="overline">
                    {t("تدريب سريع", "QUICK PRACTICE", "EXERCICE RAPIDE")}
                  </small>
                  {[
                    [
                      "flashcards",
                      Layers,
                      t("بطاقات الكلمات", "Flashcards", "Cartes mémoire"),
                    ],
                    [
                      "games",
                      Gamepad2,
                      t("ألعاب وتحديات", "Games & challenges", "Jeux et défis"),
                    ],
                    [
                      "pronunciation",
                      Mic,
                      t(
                        "مختبر النطق",
                        "Speaking studio",
                        "Studio de prononciation",
                      ),
                    ],
                  ].map(([v, I, label]) => {
                    const Icon = I as typeof Layers;
                    return (
                      <button
                        key={v as string}
                        onClick={() => navigate(v as View)}
                      >
                        <span className="feature-icon">
                          <Icon size={20} />
                        </span>
                        <b>{label as string}</b>
                        <ChevronLeft size={18} />
                      </button>
                    );
                  })}
                </article>
                <article className="panel">
                  <div className="panel-title">
                    <h3>
                      {t(
                        "نشاط الأسبوع",
                        "Weekly activity",
                        "Activité de la semaine",
                      )}
                    </h3>
                    <span className="violet-text">XP</span>
                  </div>
                  <div className="activity-chart">
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - 6 + i);
                      const k = d.toLocaleDateString("en-CA", {
                        timeZone: "Africa/Casablanca",
                      });
                      const xp = p.activity[k] || 0;
                      return (
                        <div key={k}>
                          <div className="bar-track">
                            <i
                              style={{
                                height: xp
                                  ? `${Math.min(100, xp / 1.2)}%`
                                  : "4%",
                              }}
                              title={`${xp} XP`}
                            />
                          </div>
                          <small>
                            {d.toLocaleDateString(p.locale, {
                              weekday: "narrow",
                            })}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </article>
                <article className="panel challenge">
                  <Trophy className="orange-text" />
                  <h3>
                    {t("تحدي اليوم", "Today’s challenge", "Défi du jour")}
                  </h3>
                  <p>
                    {t(
                      "راجع 4 بطاقات كلمات",
                      "Review 4 flashcards",
                      "Révisez 4 cartes",
                    )}
                  </p>
                  <button
                    className="text-btn"
                    onClick={() => navigate("flashcards")}
                  >
                    {t("قبل التحدي", "Accept challenge", "Relever le défi")}{" "}
                    <Arrow size={16} />
                  </button>
                </article>
              </aside>
            </div>
          </section>
        )}
        {view === "lesson" && (
          <section className="focus lesson-focus">
            <div className="focus-top">
              <button
                className="icon-btn"
                onClick={() => navigate("home")}
                aria-label="Close"
              >
                <X />
              </button>
              <span>{unitTitle(lesson)}</span>
              <span className="chip">{word + 1} / 4</span>
            </div>
            <div className="progress">
              <i style={{ width: `${((word + 1) / 4) * 100}%` }} />
            </div>
            <article className="lesson-card">
              <span className="chip orange">
                {lang.flag}{" "}
                {t("كلمة جديدة", "NEW PHRASE", "NOUVELLE EXPRESSION")}
              </span>
              <div className="lesson-illustration">
                {words[word].emoji}
                <span className="orbit one" />
                <span className="orbit two" />
              </div>
              <h1 dir="ltr">{words[word].word}</h1>
              <p className="translation">{words[word][p.locale]}</p>
              <div className="audio-actions">
                <button
                  className="btn audio"
                  onClick={() => speak(words[word].word)}
                >
                  <Volume2 size={20} />
                  {t("اسمع النطق", "Listen", "Écouter")}
                </button>
                <button
                  className="btn secondary"
                  onClick={() => speak(words[word].word, 0.65)}
                >
                  🐢 {t("بشوية", "Slowly", "Lentement")}
                </button>
              </div>
              <div className="example-box">
                <small>
                  {t(
                    "في محادثة حقيقية",
                    "IN A REAL CONVERSATION",
                    "DANS UNE VRAIE CONVERSATION",
                  )}
                </small>
                <p dir="ltr">{words[word].example}</p>
                <button
                  className="icon-btn"
                  onClick={() => speak(words[word].example)}
                  aria-label="Listen to example"
                >
                  <Volume2 size={20} />
                </button>
              </div>
            </article>
            <div className="fixed-actions">
              {primary(
                word === 3
                  ? t("يلا نطبقو", "Let’s practice", "Passer au quiz")
                  : t("الكلمة التالية", "Next phrase", "Expression suivante"),
                () => (word === 3 ? beginQuiz() : setWord(word + 1)),
              )}
            </div>
          </section>
        )}
        {view === "quiz" && (
          <section className="focus quiz-focus">
            <div className="focus-top">
              <button
                className="icon-btn"
                onClick={() => navigate("home")}
                aria-label="Close"
              >
                <X />
              </button>
              <div className="progress">
                <i style={{ width: `${(q / 4) * 100}%` }} />
              </div>
              <span className="hearts">
                <Heart fill="currentColor" size={18} />
                {Math.max(
                  0,
                  3 -
                    answers.filter(
                      (a, i) => normalize(a) !== normalize(exercises[i].answer),
                    ).length,
                )}
              </span>
            </div>
            <div className="focus-title">
              <span className="chip violet">{q + 1} / 4</span>
              <h1>
                {current.type === "choice"
                  ? t(
                      "اختار الترجمة الصحيحة",
                      "Choose the right translation",
                      "Choisissez la bonne traduction",
                    )
                  : current.type === "fill"
                    ? t(
                        "كتب الترجمة",
                        "Type the translation",
                        "Écrivez la traduction",
                      )
                    : t(
                        "رتب الكلمات باش تكمل الجملة",
                        "Build the sentence",
                        "Reconstituez la phrase",
                      )}
              </h1>
              <p>
                {current.type === "build"
                  ? t(
                      "بدا بالكلمة الأولى من المثال اللي تعلمتي",
                      "Start with the first word of the example you learned",
                      "Commencez par le premier mot de l’exemple appris",
                    )
                  : t(
                      "كيفاش نقولو هاد العبارة؟",
                      "How do you say this phrase?",
                      "Comment dit-on cette expression ?",
                    )}
              </p>
            </div>
            <div className="question-prompt">
              {vocabulary[p.language][lesson][q][p.locale]}
            </div>
            {current.type === "choice" && (
              <div className="answer-grid" dir="ltr">
                {current.options.map((option, i) => (
                  <button
                    key={option}
                    disabled={feedback !== null}
                    className={`answer-option ${answer === option ? "chosen" : ""}`}
                    onClick={() => setAnswer(option)}
                  >
                    <span>{i + 1}</span>
                    {option}
                    {answer === option && <CheckCircle2 size={20} />}
                  </button>
                ))}
              </div>
            )}
            {current.type === "fill" && (
              <label className="field">
                <span>{t("جوابك", "Your answer", "Votre réponse")}</span>
                <input
                  dir="ltr"
                  value={answer}
                  maxLength={200}
                  disabled={feedback !== null}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && answer.trim()) checkAnswer();
                  }}
                />
              </label>
            )}
            {current.type === "build" && (
              <>
                <div
                  className="sentence-bank"
                  dir="ltr"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const i = Number(e.dataTransfer.getData("text/plain"));
                    if (
                      Number.isInteger(i) &&
                      i >= 0 &&
                      i < current.options.length &&
                      !tokens.includes(i) &&
                      feedback === null
                    )
                      setTokens([...tokens, i]);
                  }}
                >
                  {tokens.length === 0 && (
                    <span className="muted">
                      {t(
                        "اضغط الكلمات أو جرّها هنا",
                        "Tap or drag words here",
                        "Cliquez ou glissez les mots ici",
                      )}
                    </span>
                  )}
                  {tokens.map((i) => (
                    <button
                      className="word-token"
                      key={i}
                      disabled={feedback !== null}
                      onClick={() => setTokens(tokens.filter((j) => j !== i))}
                    >
                      {current.options[i]} <X size={12} />
                    </button>
                  ))}
                </div>
                <div className="word-bank" dir="ltr">
                  {[...current.options.keys()]
                    .sort((a, b) => ((a * 7) % 5) - ((b * 7) % 5))
                    .map((i) => (
                      <button
                        className="word-token"
                        key={i}
                        draggable={feedback === null && !tokens.includes(i)}
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", String(i))
                        }
                        disabled={feedback !== null || tokens.includes(i)}
                        onClick={() => setTokens([...tokens, i])}
                      >
                        {current.options[i]}
                      </button>
                    ))}
                </div>
              </>
            )}
            <div
              className={`quiz-footer ${feedback === null ? "" : feedback ? "correct" : "incorrect"}`}
              role="status"
            >
              {feedback !== null && (
                <div className="feedback-copy">
                  <span>{feedback ? <CheckCircle2 /> : <RotateCcw />}</span>
                  <div>
                    <b>
                      {feedback
                        ? t("برافو، جواب صحيح!", "Great work!", "Bravo !")
                        : t(
                            "قريب! جرب تتذكر هاد الجواب",
                            "Keep learning. Here’s the answer",
                            "Continuez ! Voici la réponse",
                          )}
                    </b>
                    <p dir="ltr">{current.answer}</p>
                    <small dir="ltr">{current.explanation}</small>
                  </div>
                </div>
              )}
              {primary(
                feedback === null
                  ? t("تحقق", "Check answer", "Vérifier")
                  : q === 3
                    ? t("شوف النتيجة", "See results", "Voir le résultat")
                    : t("متابعة", "Continue", "Continuer"),
                () => (feedback === null ? checkAnswer() : nextQuestion()),
                feedback === null && !answer.trim() && tokens.length === 0,
              )}
            </div>
          </section>
        )}
        {view === "complete" && (
          <section className="focus completion">
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 24 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${i * 4}%`,
                    animationDelay: `${(i % 5) * 0.15}s`,
                    background: ["#7c5cff", "#22d3ee", "#ff7a45"][i % 3],
                  }}
                />
              ))}
            </div>
            <div className="trophy-hero">{score >= 75 ? "🏆" : "🌱"}</div>
            <span className="overline">
              {t(
                "كل محاولة كتقدمك",
                "EVERY ATTEMPT IS PROGRESS",
                "CHAQUE ESSAI EST UN PROGRÈS",
              )}
            </span>
            <h1>
              {score >= 75
                ? t(
                    "درس جديد، خطوة جديدة!",
                    "Another step forward!",
                    "Un nouveau pas en avant !",
                  )
                : t(
                    "نراجعو ونحاولو مرة أخرى",
                    "Review and try again",
                    "Révisons et réessayons",
                  )}
            </h1>
            <p>
              {score >= 75
                ? t(
                    "أحسنت! كملتي هاد الدرس.",
                    "Well done! You’ve completed this lesson.",
                    "Bravo ! Vous avez terminé cette leçon.",
                  )
                : t(
                    "خاصك 75% باش يتحل الدرس التالي.",
                    "Reach 75% to unlock the next lesson.",
                    "Atteignez 75 % pour débloquer la suite.",
                  )}
            </p>
            <div className="completion-stats">
              <div>
                <CheckCircle2 />
                <strong>{score}%</strong>
                <small>{t("النتيجة", "Accuracy", "Résultat")}</small>
              </div>
              <div>
                <Zap />
                <strong>+{earned}</strong>
                <small>XP</small>
              </div>
              <div>
                <Flame />
                <strong>{streak(p.activity)}</strong>
                <small>{t("سلسلة أيام", "day streak", "jours de série")}</small>
              </div>
            </div>
            {primary(
              score >= 75
                ? t(
                    "كمل المسار",
                    "Continue your journey",
                    "Continuer le parcours",
                  )
                : t("راجع الدرس", "Review the lesson", "Réviser la leçon"),
              () => (score >= 75 ? navigate("home") : startLesson(lesson)),
            )}
            <button className="text-btn" onClick={beginQuiz}>
              {t("عاود الاختبار", "Try the quiz again", "Refaire le quiz")}
            </button>
          </section>
        )}
        {view === "flashcards" && (
          <section className="focus flashcards">
            <div className="page-heading">
              <div>
                <span className="overline">
                  {t(
                    "كلمة اليوم، ذاكرة الغد",
                    "TODAY’S WORD. TOMORROW’S MEMORY.",
                    "LE MOT DU JOUR. LA MÉMOIRE DE DEMAIN.",
                  )}
                </span>
                <h1>{t("بطاقات الكلمات", "Flashcards", "Cartes mémoire")}</h1>
              </div>
              <Layers className="violet-text" size={32} />
            </div>
            <div className="deck-tabs">
              {units.map((_, i) => (
                <button
                  key={i}
                  className={deck === i ? "active" : ""}
                  onClick={() => {
                    setDeck(i);
                    setCard(0);
                    setFlipped(false);
                    setReviewed([]);
                    setPracticeEarly(false);
                    const due = [0, 1, 2, 3].find(
                      (j) =>
                        !p.reviews[`${p.language}-${i}-${j}`] ||
                        new Date(
                          p.reviews[`${p.language}-${i}-${j}`].due,
                        ).getTime() <= Date.now(),
                    );
                    setCard(due ?? 0);
                  }}
                >
                  {unitTitle(i)}
                </button>
              ))}
            </div>
            <div className="panel-title">
              <span className="chip cyan">
                {p.reviews[`${p.language}-${deck}-${card}`]?.interval >= 7
                  ? t("متقن", "Mastered", "Maîtrisé")
                  : p.reviews[`${p.language}-${deck}-${card}`]
                    ? t("قيد التعلم", "Learning", "En cours")
                    : t("جديد", "New", "Nouveau")}
              </span>
              <small>
                {card + 1} / 4 · {reviewed.length}{" "}
                {t("مراجعة", "reviewed", "révisions")}
              </small>
            </div>
            {dueCards.length === 0 && !practiceEarly && (
              <div className="panel empty-state">
                <CheckCircle2 size={38} />
                <h2>
                  {t(
                    "مراجعة اليوم سالات!",
                    "You’re up to date!",
                    "Vos révisions sont à jour !",
                  )}
                </h2>
                <p>
                  {t(
                    "البطاقات ترجع في موعد المراجعة القادم.",
                    "Cards return when the next review is due.",
                    "Les cartes reviendront à la prochaine révision.",
                  )}
                </p>
                <button
                  className="btn secondary"
                  onClick={() => setPracticeEarly(true)}
                >
                  {t(
                    "نتدرب دابا على أي حال",
                    "Practise anyway",
                    "Pratiquer quand même",
                  )}
                </button>
              </div>
            )}
            <div hidden={dueCards.length === 0 && !practiceEarly}>
              <button
                className={`flip-card ${flipped ? "flipped" : ""}`}
                onClick={() => setFlipped(!flipped)}
                onTouchStart={(e) => {
                  e.currentTarget.dataset.start = String(e.touches[0].clientX);
                }}
                onTouchEnd={(e) => {
                  const delta =
                    e.changedTouches[0].clientX -
                    Number(e.currentTarget.dataset.start);
                  if (Math.abs(delta) > 70) void review(delta > 0);
                }}
              >
                <span className="big-emoji">
                  {vocabulary[p.language][deck][card].emoji}
                </span>
                <h2 dir={flipped && p.locale === "ar" ? "rtl" : "ltr"}>
                  {flipped
                    ? vocabulary[p.language][deck][card][p.locale]
                    : vocabulary[p.language][deck][card].word}
                </h2>
                {flipped && (
                  <p dir="ltr">{vocabulary[p.language][deck][card].example}</p>
                )}
                <small>
                  <RotateCcw size={15} />
                  {t(
                    "اضغط لقلب البطاقة",
                    "Tap to flip",
                    "Cliquez pour retourner",
                  )}
                </small>
              </button>
              <div className="flashcard-actions">
                <button
                  className="btn secondary"
                  onClick={() => void review(false)}
                  disabled={busy}
                >
                  <RotateCcw size={18} />
                  {t("نراجعها مرة أخرى", "Review again", "À revoir")}
                </button>
                <button
                  className="round-audio"
                  onClick={() => speak(vocabulary[p.language][deck][card].word)}
                  aria-label="Listen"
                >
                  <Volume2 />
                </button>
                <button
                  className="btn success"
                  onClick={() => void review(true)}
                  disabled={busy}
                >
                  <Check size={18} />
                  {t("عرفتها", "I know it", "Je sais")}
                </button>
              </div>
            </div>
            {p.reviews[`${p.language}-${deck}-${card}`] && (
              <p className="pronunciation-status">
                {t("المراجعة القادمة:", "Next review:", "Prochaine révision :")}{" "}
                {new Date(
                  p.reviews[`${p.language}-${deck}-${card}`].due,
                ).toLocaleDateString(p.locale)}
              </p>
            )}
            <div className="review-note">
              <Sparkles size={18} />
              {t(
                "التكرار المتباعد: البطاقات اللي عرفتيها كترجع بعد مدة أطول.",
                "Spaced repetition: words you know return after longer intervals.",
                "Répétition espacée : les mots maîtrisés reviennent moins souvent.",
              )}
            </div>
          </section>
        )}
        {view === "games" && (
          <section className="page-container">
            <div className="page-heading">
              <div>
                <span className="overline">
                  {t(
                    "العب. تعلم. كرر.",
                    "PLAY. LEARN. REPEAT.",
                    "JOUEZ. APPRENEZ. RECOMMENCEZ.",
                  )}
                </span>
                <h1>
                  {t(
                    "تحديات كتقوي لغتك",
                    "Make practice your playground",
                    "Faites de la pratique un jeu",
                  )}
                </h1>
                <p>
                  {t(
                    "كل جولة فرصة جديدة باش تثبت الكلمات.",
                    "Every round is a chance to make words stick.",
                    "Chaque partie aide à retenir les mots.",
                  )}
                </p>
              </div>
              <Gamepad2 className="cyan" size={36} />
            </div>
            <div className="three-grid game-grid">
              {[
                [
                  "matching",
                  "🔗",
                  t("مطابقة الكلمات", "Word matching", "Association de mots"),
                  t(
                    "جمع الكلمة مع المعنى ديالها",
                    "Connect each word to its meaning",
                    "Associez chaque mot à son sens",
                  ),
                ],
                [
                  "speed",
                  "⚡",
                  t("تحدي السرعة", "Speed challenge", "Défi de rapidité"),
                  t(
                    "60 ثانية. شحال تقدر تجاوب؟",
                    "60 seconds. How many can you get?",
                    "60 secondes. Combien de réponses ?",
                  ),
                ],
                [
                  "memory",
                  "🧠",
                  t("لعبة الذاكرة", "Memory cards", "Jeu de mémoire"),
                  t(
                    "قلب البطاقات ولقى الأزواج",
                    "Flip cards and find pairs",
                    "Retournez les cartes et trouvez les paires",
                  ),
                ],
              ].map(([v, , title, desc]) => (
                <button
                  key={v}
                  className="game-card panel"
                  onClick={() => navigate(v as View)}
                >
                  <span className="game-emoji">
                    {v === "matching" ? (
                      <Link2 size={28} strokeWidth={1.5} />
                    ) : v === "speed" ? (
                      <Zap size={28} strokeWidth={1.5} />
                    ) : (
                      <Brain size={28} strokeWidth={1.5} />
                    )}
                  </span>
                  <span className="chip violet">
                    {t("تدريب", "PRACTICE", "EXERCICE")}
                  </span>
                  <h2>{title}</h2>
                  <p>{desc}</p>
                  <span className="text-btn">
                    {t("ابدأ الجولة", "Play a round", "Jouer")}{" "}
                    <Arrow size={18} />
                  </span>
                </button>
              ))}
            </div>
            <div className="two-grid section">
              <Leaderboard t={t} signed={signed} />
              <article className="panel">
                <h2>
                  <Trophy size={22} />
                  {t("شاراتك", "Your badges", "Vos badges")}
                </h2>
                <div className="badges">
                  {[
                    [
                      "🌱",
                      t("أول خطوة", "First step", "Premier pas"),
                      p.completed.length > 0,
                    ],
                    [
                      "🔥",
                      t("3 أيام متتالية", "3 day streak", "3 jours de suite"),
                      streak(p.activity) >= 3,
                    ],
                    [
                      "🌍",
                      t("ثلاث لغات", "Three languages", "Trois langues"),
                      languages.every((l) =>
                        p.completed.some((id) => id.startsWith(l.id)),
                      ),
                    ],
                    ["💎", t("100 نقطة", "100 XP", "100 XP"), p.xp >= 100],
                  ].map(([emoji, title, done], i) => (
                    <div key={i} className={done ? "badge unlocked" : "badge"}>
                      <span>{emoji}</span>
                      <b>{title}</b>
                      {!done && <Lock size={13} />}
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        )}
        {(["matching", "speed", "memory"] as View[]).includes(view) && (
          <Game
            key={`${view}-${p.language}-${p.locale}`}
            kind={view}
            language={p.language}
            locale={p.locale}
            t={t}
            onBack={() => navigate("games")}
            onSpeak={speak}
            onFinish={async (pairs) => {
              if (signed)
                await api("game", { language: p.language, kind: view, pairs });
            }}
          />
        )}
        {view === "pronunciation" && (
          <Pronunciation
            language={p.language}
            locale={p.locale}
            signed={signed}
            t={t}
            onListen={speak}
            onListening={() => navigate("listening")}
          />
        )}
        {view === "listening" && (
          <Listening
            language={p.language}
            locale={p.locale}
            t={t}
            onBack={() => navigate("pronunciation")}
          />
        )}
        {view === "profile" && (
          <section className="page-container profile">
            <div className="profile-hero panel">
              <span className="profile-avatar">
                {p.name.slice(0, 1) || "ل"}
              </span>
              <div>
                <span className="overline">
                  {t("خطوة بخطوة", "ONE STEP AT A TIME", "PAS À PAS")}
                </span>
                <h1>{p.name || t("متعلم", "Learner", "Apprenant")}</h1>
                <span className="chip violet">
                  {t("المستوى", "Level", "Niveau")} {Math.floor(p.xp / 100) + 1}
                </span>
              </div>
              <div className="profile-numbers">
                <div>
                  <strong>{p.xp}</strong>
                  <small>XP</small>
                </div>
                <div>
                  <strong>{streak(p.activity)}</strong>
                  <small>
                    {t("يوم متتالي", "day streak", "jours de suite")}
                  </small>
                </div>
                <div>
                  <strong>{p.completed.length * 4}</strong>
                  <small>
                    {t(
                      "عبارة تعلمتها",
                      "phrases learned",
                      "expressions apprises",
                    )}
                  </small>
                </div>
              </div>
            </div>
            <div className="two-grid">
              <div>
                <article className="panel">
                  <h2>
                    {t(
                      "نشاطك الأخير",
                      "Your recent activity",
                      "Votre activité récente",
                    )}
                  </h2>
                  <div className="heatmap">
                    {Array.from({ length: 84 }, (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - 83 + i);
                      const key = d.toLocaleDateString("en-CA", {
                        timeZone: "Africa/Casablanca",
                      });
                      return (
                        <span
                          key={key}
                          className={p.activity[key] ? "filled" : ""}
                          title={`${key}: ${p.activity[key] || 0} XP`}
                        />
                      );
                    })}
                  </div>
                  <small className="muted">
                    {t(
                      "آخر 12 أسبوعاً · لون أكثر = ممارسة أكثر",
                      "Last 12 weeks · more colour = more practice",
                      "12 dernières semaines · plus de couleur = plus de pratique",
                    )}
                  </small>
                </article>
                <article className="panel">
                  <h2>
                    {t(
                      "التقدم حسب اللغة",
                      "Progress by language",
                      "Progression par langue",
                    )}
                  </h2>
                  {languages.map((l) => {
                    const n = p.completed.filter((id) =>
                      id.startsWith(l.id),
                    ).length;
                    return (
                      <div className="language-progress" key={l.id}>
                        <div>
                          <span>
                            {l.flag} {p.locale === "ar" ? l.name : l[p.locale]}
                          </span>
                          <small>{n} / 3</small>
                        </div>
                        <div className="progress">
                          <i
                            style={{
                              width: `${(n / 3) * 100}%`,
                              background: l.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </article>
              </div>
              <article className="panel settings-panel">
                <h2>
                  <Settings size={22} />
                  {t("الإعدادات", "Settings", "Paramètres")}
                </h2>
                <label className="field">
                  {t("الاسم", "Name", "Nom")}
                  <input
                    value={p.name}
                    maxLength={60}
                    onChange={(e) => setP({ ...p, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  {t(
                    "لغة الواجهة",
                    "Interface language",
                    "Langue de l’interface",
                  )}
                  <select
                    value={p.locale}
                    onChange={(e) =>
                      setP({ ...p, locale: e.target.value as Locale })
                    }
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </label>
                <label className="field">
                  {t(
                    "اللغة اللي كتتعلم",
                    "Learning language",
                    "Langue étudiée",
                  )}
                  <select
                    value={p.language}
                    onChange={(e) =>
                      setP({ ...p, language: e.target.value as Language })
                    }
                  >
                    {languages.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.flag} {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  {t("الهدف اليومي", "Daily goal", "Objectif quotidien")}
                  <select
                    value={p.goal}
                    onChange={(e) =>
                      setP({ ...p, goal: Number(e.target.value) })
                    }
                  >
                    {[5, 10, 20].map((n) => (
                      <option key={n} value={n}>
                        {n} {t("دقائق", "minutes", "minutes")}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="setting-row">
                  <span>{t("المظهر", "Appearance", "Apparence")}</span>
                  <span className="chip">{t("داكن", "Dark", "Sombre")}</span>
                </div>
                {primary(
                  t("حفظ الإعدادات", "Save settings", "Enregistrer"),
                  () => void saveSettings(),
                )}
                <div className="setting-row">
                  <span>{t("الاشتراك", "Subscription", "Abonnement")}</span>
                  <button
                    className="text-btn"
                    onClick={() => navigate("pricing")}
                  >
                    {t(
                      "مجاني · شوف الخطط",
                      "Free · view plans",
                      "Gratuit · voir les offres",
                    )}
                  </button>
                </div>
                {signed ? (
                  <button
                    className="btn danger"
                    onClick={async () => {
                      const r = await fetch("/api/auth", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "logout" }),
                      });
                      if (r.ok) {
                        setSigned(false);
                        setP(initial);
                        navigate("landing");
                      } else
                        setNotice(
                          t(
                            "تعذر تسجيل الخروج",
                            "Could not sign out",
                            "Déconnexion impossible",
                          ),
                        );
                    }}
                  >
                    <LogOut size={18} />
                    {t("تسجيل الخروج", "Sign out", "Déconnexion")}
                  </button>
                ) : (
                  configured && (
                    <button
                      className="btn secondary"
                      onClick={() => setAuth(true)}
                    >
                      {t(
                        "سجل الدخول لحفظ تقدمك",
                        "Sign in to save your progress",
                        "Connectez-vous pour sauvegarder",
                      )}
                    </button>
                  )
                )}
              </article>
            </div>
          </section>
        )}
        {view === "pricing" && (
          <section className="page-container pricing">
            <div className="section-heading">
              <span className="overline">
                {t("تعلم على قدك", "LEARN YOUR WAY", "APPRENEZ À VOTRE RYTHME")}
              </span>
              <h1>
                {t(
                  "بدا مجاناً. خلي الطموح يكبر.",
                  "Start free. Let your ambition grow.",
                  "Commencez gratuitement. Voyez plus loin.",
                )}
              </h1>
              <p>
                {t(
                  "المحتوى الأساسي مفتوح. Premium قيد التحضير.",
                  "Core learning is free. Premium is in development.",
                  "L’apprentissage de base est gratuit. Premium est en préparation.",
                )}
              </p>
              <div className="billing-toggle">
                <button
                  className={!yearly ? "active" : ""}
                  onClick={() => setYearly(false)}
                >
                  {t("شهري", "Monthly", "Mensuel")}
                </button>
                <button
                  className={yearly ? "active" : ""}
                  onClick={() => setYearly(true)}
                >
                  {t("سنوي", "Yearly", "Annuel")}
                </button>
              </div>
            </div>
            <div className="pricing-grid">
              <article className="panel price-card">
                <span className="overline">FREE</span>
                <h2>
                  {t("الخطوة الأولى", "Your first step", "Le premier pas")}
                </h2>
                <div className="price">
                  0 <span>{t("درهم", "MAD", "MAD")}</span>
                </div>
                <p>
                  {t(
                    "كل ما تحتاج للبداية",
                    "Everything to get started",
                    "Tout pour bien commencer",
                  )}
                </p>
                <ul>
                  {[
                    t(
                      "3 لغات · 9 دروس A1",
                      "3 languages · 9 A1 lessons",
                      "3 langues · 9 leçons A1",
                    ),
                    t(
                      "بطاقات كلمات وتكرار متباعد",
                      "Flashcards & spaced repetition",
                      "Cartes et répétition espacée",
                    ),
                    t(
                      "ألعاب وتدريب استماع",
                      "Games & listening practice",
                      "Jeux et compréhension orale",
                    ),
                    t(
                      "حفظ التقدم والشارات",
                      "Progress & achievements",
                      "Progression et badges",
                    ),
                  ].map((s) => (
                    <li key={s}>
                      <Check size={18} />
                      {s}
                    </li>
                  ))}
                </ul>
                {primary(
                  t("ابدأ مجاناً", "Start free", "Commencer gratuitement"),
                  () => (signed ? navigate("home") : authEntry()),
                )}
              </article>
              <article className="panel price-card premium">
                <span className="chip violet">
                  {t("قريباً", "COMING SOON", "BIENTÔT")}
                </span>
                <h2>Lissan Premium</h2>
                <div className="price">{t("قريباً", "Soon", "Bientôt")}</div>
                <p>
                  {yearly
                    ? t(
                        "خطة سنوية قيد التحضير",
                        "Annual plan in development",
                        "Offre annuelle en préparation",
                      )
                    : t(
                        "خطة شهرية قيد التحضير",
                        "Monthly plan in development",
                        "Offre mensuelle en préparation",
                      )}
                </p>
                <ul>
                  {[
                    t(
                      "محتوى مستويات أعلى",
                      "Higher-level content",
                      "Contenu de niveaux supérieurs",
                    ),
                    t(
                      "تقييم احترافي للنطق",
                      "Professional pronunciation assessment",
                      "Évaluation professionnelle de la prononciation",
                    ),
                    t(
                      "مسارات متخصصة للعمل والسفر",
                      "Specialised work & travel paths",
                      "Parcours travail et voyage",
                    ),
                  ].map((s) => (
                    <li key={s}>
                      <Sparkles size={18} />
                      {s}
                    </li>
                  ))}
                </ul>
                <button className="btn secondary" disabled>
                  {t(
                    "الاشتراك لم يفتح بعد",
                    "Subscriptions are not open yet",
                    "Abonnements bientôt disponibles",
                  )}
                </button>
              </article>
            </div>
          </section>
        )}
      </main>
      <footer>
        <button className="brand" onClick={() => navigate("landing")}>
          <span className="brand-mark small">
            <img src="/icon.svg" alt="" width={32} height={32} />
          </span>
          <b>Lissan</b>
        </button>
        <p>
          {t(
            "كل كلمة كتفتح باباً جديداً.",
            "Every word opens a new door.",
            "Chaque mot ouvre une nouvelle porte.",
          )}
        </p>
        <span>© {new Date().getFullYear()} Lissan</span>
      </footer>
      {view !== "landing" && (
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {[
            ["home", Home, t("الرئيسية", "Home", "Accueil")],
            ["flashcards", Layers, t("تعلم", "Learn", "Apprendre")],
            ["games", Gamepad2, t("تدرب", "Practice", "Pratiquer")],
            ["profile", User, t("حسابي", "Profile", "Profil")],
          ].map(([v, I, label]) => {
            const Icon = I as typeof Home;
            return (
              <button
                key={v as string}
                className={activeNav === v ? "active" : ""}
                onClick={() => navigate(v as View)}
              >
                <Icon size={21} />
                <span>{label as string}</span>
              </button>
            );
          })}
        </nav>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            className="icon-btn"
            onClick={() => setNotice("")}
            aria-label="Dismiss"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {auth && (
        <AuthPanel
          locale={p.locale}
          onClose={() => setAuth(false)}
          onSuccess={() => {
            setAuth(false);
            void sync();
          }}
        />
      )}
    </div>
  );
}
