"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Headphones,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import {
  languages,
  normalize,
  vocabulary,
  type Language,
  type Locale,
} from "@/lib/learning/content";
import type { T } from "./ui-types";
export function Game({
  kind,
  language,
  locale,
  t,
  onBack,
  onSpeak,
  onFinish,
}: {
  kind: string;
  language: Language;
  locale: Locale;
  t: T;
  onBack: () => void;
  onSpeak: (s: string) => void;
  onFinish: (pairs: { left: string; right: string }[]) => Promise<void>;
}) {
  const words = vocabulary[language][0];
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [left, setLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState("");
  const [flips, setFlips] = useState<number[]>([]);
  const [speedQuestion, setSpeedQuestion] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const sent = useRef(false);
  const done =
    started && (seconds === 0 || (kind !== "speed" && matched.length === 4));
  useEffect(() => {
    if (!started || done) return;
    const timer = setInterval(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [started, done]);
  useEffect(() => {
    if (done && !sent.current) {
      sent.current = true;
      void onFinish(
        matched.map((i) => ({ left: words[i].word, right: words[i].ar })),
      ).catch(() =>
        setMessage(
          t(
            "نتيجتك لم تُحفظ. حاول مرة أخرى.",
            "Your result could not be saved.",
            "Résultat non sauvegardé.",
          ),
        ),
      );
    }
  }, [done]);
  function pair(i: number) {
    if (left === null || matched.includes(i)) return;
    setAttempts((a) => a + 1);
    if (left === i) {
      setMatched([...matched, i]);
      setCombo((c) => c + 1);
      setMessage(t("مطابقة صحيحة!", "A perfect match!", "Bonne association !"));
    } else {
      setCombo(0);
      setMessage(t("حاول مرة أخرى", "Try again", "Réessayez"));
    }
    setLeft(null);
  }
  function flip(i: number) {
    if (flips.length === 2 || flips.includes(i) || matched.includes(i % 4))
      return;
    const f = [...flips, i];
    setFlips(f);
    if (f.length === 2) {
      setAttempts((a) => a + 1);
      if (f[0] % 4 === f[1] % 4) {
        setMatched([...matched, i % 4]);
        setCombo((c) => c + 1);
      } else setCombo(0);
      setTimeout(() => setFlips([]), 800);
    }
  }
  return (
    <section className="focus game-focus">
      <div className="focus-top">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <X />
        </button>
        <span className="chip orange">⏱ {seconds}s</span>
        <span className="chip violet">
          {kind === "speed" ? correct * 10 : matched.length * 10}{" "}
          {t("نقطة", "points", "points")}
        </span>
      </div>
      <div className="focus-title">
        <span className="big-emoji">
          {kind === "speed" ? "⚡" : kind === "memory" ? "🧠" : "🔗"}
        </span>
        <h1>
          {kind === "matching"
            ? t(
                "جمع الكلمة ومعناها",
                "Match words to meanings",
                "Associez les mots et leur sens",
              )
            : kind === "memory"
              ? t(
                  "قلب، تذكر، جمع",
                  "Flip, remember, match",
                  "Retournez, mémorisez, associez",
                )
              : t(
                  "جاوب قبل ما يسالي الوقت",
                  "Beat the clock",
                  "Battez le chrono",
                )}
        </h1>
        <p>
          {t(
            "هاد النقاط خاصة بالتدريب وما كتزيدش XP",
            "Practice points do not award XP",
            "Les points d’exercice ne donnent pas d’XP",
          )}
        </p>
      </div>
      {!started ? (
        <button className="btn primary" onClick={() => setStarted(true)}>
          {t("ابدأ الجولة", "Start the round", "Commencer la partie")}
          <Play size={18} />
        </button>
      ) : done ? (
        <div className="panel empty-state">
          <Trophy size={48} />
          <h2>{t("جولة زوينة!", "Good round!", "Belle partie !")}</h2>
          <p>
            {kind === "speed"
              ? `${correct} ${t("أجوبة صحيحة", "correct answers", "bonnes réponses")}`
              : `${matched.length}/4 · ${attempts} ${t("محاولات", "attempts", "essais")}`}
          </p>
          <button
            className="btn primary"
            onClick={() => {
              sent.current = false;
              setStarted(false);
              setSeconds(60);
              setMatched([]);
              setAttempts(0);
              setCombo(0);
              setFlips([]);
              setCorrect(0);
              setSpeedQuestion(0);
              setMessage("");
            }}
          >
            <RotateCcw size={18} />
            {t("جولة جديدة", "Play again", "Rejouer")}
          </button>
        </div>
      ) : (
        <>
          {kind === "matching" && (
            <div className="matching-grid">
              <div>
                {words.map((w, i) => (
                  <button
                    key={i}
                    className={`match-tile ${left === i ? "chosen" : ""} ${matched.includes(i) ? "matched" : ""}`}
                    disabled={matched.includes(i)}
                    onClick={() => {
                      setLeft(i);
                      onSpeak(w.word);
                    }}
                    dir="ltr"
                  >
                    {w.word}
                    {matched.includes(i) && <Check size={17} />}
                  </button>
                ))}
              </div>
              <div>
                {[2, 0, 3, 1].map((i) => (
                  <button
                    key={i}
                    disabled={matched.includes(i)}
                    className={`match-tile ${matched.includes(i) ? "matched" : ""}`}
                    onClick={() => pair(i)}
                  >
                    {words[i][locale]}
                    {matched.includes(i) && <Check size={17} />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {kind === "memory" && (
            <div className="memory-grid">
              {[0, 5, 2, 7, 4, 1, 6, 3].map((i) => (
                <button
                  key={i}
                  className={`memory-tile ${matched.includes(i % 4) ? "matched" : ""}`}
                  onClick={() => flip(i)}
                  disabled={matched.includes(i % 4)}
                >
                  {flips.includes(i) || matched.includes(i % 4)
                    ? i < 4
                      ? words[i].word
                      : words[i % 4][locale]
                    : "✦"}
                </button>
              ))}
            </div>
          )}
          {kind === "speed" && (
            <div className="speed-card panel">
              <h2>{words[speedQuestion % 4][locale]}</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const ok =
                    normalize(answer) ===
                    normalize(words[speedQuestion % 4].word);
                  if (ok) {
                    setCorrect((c) => c + 1);
                    setMatched((prev) =>
                      Array.from(new Set([...prev, speedQuestion % 4])),
                    );
                  }
                  setCombo(ok ? combo + 1 : 0);
                  setMessage(
                    ok
                      ? t("صحيح!", "Correct!", "Correct !")
                      : words[speedQuestion % 4].word,
                  );
                  setSpeedQuestion(speedQuestion + 1);
                  setAnswer("");
                }}
              >
                <label className="field">
                  {t("الترجمة", "Translation", "Traduction")}
                  <input
                    dir="ltr"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    autoFocus
                    maxLength={200}
                  />
                </label>
                <button className="btn primary" disabled={!answer.trim()}>
                  {t("تحقق", "Check", "Vérifier")}
                </button>
              </form>
            </div>
          )}
          <div className="game-message" role="status">
            {message}
            {combo > 1 && (
              <span className="combo" key={combo}>
                🔥 {combo} COMBO
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
