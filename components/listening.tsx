"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
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
export function Listening({
  language,
  locale,
  t,
  onBack,
}: {
  language: Language;
  locale: Locale;
  t: T;
  onBack: () => void;
}) {
  const lang = languages.find((l) => l.id === language)!;
  const w = vocabulary[language][1][0];
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  useEffect(() => () => speechSynthesis.cancel(), []);
  function listen() {
    if (playing) {
      speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(w.example);
    u.lang = lang.speech;
    u.rate = speed;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    setPlaying(true);
    speechSynthesis.speak(u);
  }
  return (
    <section className="focus">
      <div className="focus-top">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <X />
        </button>
        <span className="chip cyan">
          <Headphones size={16} />
          {t("تدريب الاستماع", "LISTENING PRACTICE", "COMPRÉHENSION ORALE")}
        </span>
      </div>
      <div className="focus-title">
        <span className="big-emoji">🎧</span>
        <h1>
          {t("اسمع وفهم", "Listen and understand", "Écoutez et comprenez")}
        </h1>
        <p>
          {t(
            "اسمع الجملة واختار شنو طلب المتحدث",
            "Listen to the phrase. What did the speaker order?",
            "Écoutez la phrase. Qu’a commandé la personne ?",
          )}
        </p>
      </div>
      <article className="panel listening-player">
        <div className={`waveform ${playing ? "live" : ""}`}>
          {Array.from({ length: 35 }, (_, i) => (
            <i
              key={i}
              style={{
                height: `${15 + ((i * 13) % 65)}px`,
                animationDelay: `${i * 0.035}s`,
              }}
            />
          ))}
        </div>
        <button
          className="round-audio"
          onClick={listen}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <div className="deck-tabs">
          {[0.75, 1, 1.25].map((s) => (
            <button
              className={speed === s ? "active" : ""}
              key={s}
              onClick={() => {
                speechSynthesis.cancel();
                setPlaying(false);
                setSpeed(s);
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </article>
      <div className="answer-grid">
        {vocabulary[language][1].slice(0, 3).map((word) => (
          <button
            key={word.word}
            disabled={checked}
            className={`answer-option ${answer === word.word ? "chosen" : ""}`}
            onClick={() => setAnswer(word.word)}
          >
            {word[locale]}
          </button>
        ))}
      </div>
      <button
        className="btn primary"
        disabled={!answer || checked}
        onClick={() => setChecked(true)}
      >
        {t("تحقق", "Check", "Vérifier")}
      </button>
      {checked && (
        <div
          className={`feedback-copy panel ${answer === w.word ? "correct" : "incorrect"}`}
          role="status"
        >
          <CheckCircle2 />
          <div>
            <b>
              {answer === w.word
                ? t("برافو!", "Well done!", "Bravo !")
                : t(
                    "الجواب الصحيح: فنجان قهوة",
                    "The correct answer: a coffee",
                    "La bonne réponse : un café",
                  )}
            </b>
            <p dir="ltr">{w.example}</p>
          </div>
        </div>
      )}
    </section>
  );
}
