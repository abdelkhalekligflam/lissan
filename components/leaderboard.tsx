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
export function Leaderboard({ t, signed }: { t: T; signed: boolean }) {
  const [rows, setRows] = useState<
    { display_name: string; weekly_xp: number }[]
  >([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!signed) return;
    fetch("/api/learning?leaderboard=1")
      .then(async (r) => {
        if (!r.ok) throw Error();
        setRows((await r.json()).rows);
      })
      .catch(() =>
        setStatus(
          t(
            "تعذر تحميل الترتيب",
            "Could not load leaderboard",
            "Classement indisponible",
          ),
        ),
      );
  }, [signed]);
  return (
    <article className="panel leaderboard">
      <div className="panel-title">
        <h2>
          <Trophy size={22} />
          {t("ترتيب الأسبوع", "Weekly leaderboard", "Classement de la semaine")}
        </h2>
        <span className="chip cyan">TOP 10</span>
      </div>
      {rows.length ? (
        rows.map((r, i) => (
          <div className="leaderboard-row" key={i}>
            <b>{i + 1}</b>
            <span className="avatar">{r.display_name?.slice(0, 1) || "ل"}</span>
            <span>{r.display_name}</span>
            <strong>{r.weekly_xp} XP</strong>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Trophy size={36} />
          <h3>
            {status ||
              t(
                "أول خطوة كتبدأ بيك",
                "The first step starts with you",
                "Le premier pas commence avec vous",
              )}
          </h3>
          <p>
            {signed
              ? t(
                  "كمل درساً باش تبان في ترتيب الأسبوع",
                  "Complete a lesson to join the weekly board",
                  "Terminez une leçon pour entrer au classement",
                )
              : t(
                  "سجل الدخول باش تشوف الترتيب الحقيقي",
                  "Sign in to see the real leaderboard",
                  "Connectez-vous pour voir le classement",
                )}
          </p>
        </div>
      )}
    </article>
  );
}
