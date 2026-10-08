"use client";
import { useEffect, useRef, useState } from "react";
import { Headphones, Mic, Square, Volume2 } from "lucide-react";
import {
  languages,
  normalize,
  type Language,
  type Locale,
} from "@/lib/learning/content";
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        results: { isFinal: boolean; 0: { transcript: string } }[];
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
declare global {
  interface Window {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  }
}
export function Pronunciation({
  language,
  locale,
  signed,
  t,
  onListen,
  onListening,
}: {
  language: Language;
  locale: Locale;
  signed: boolean;
  t: (ar: string, en: string, fr: string) => string;
  onListen: (text: string) => void;
  onListening: () => void;
}) {
  const lang = languages.find((l) => l.id === language)!;
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("");
  const [file, setFile] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<number[]>(Array(30).fill(12));
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const animation = useRef<number>(0);
  const blobUrl = useRef("");
  function cleanup() {
    cancelAnimationFrame(animation.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    recognition.current?.stop();
    if (timer.current) clearTimeout(timer.current);
    void audioContext.current?.close();
    audioContext.current = null;
  }
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanup();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );
  async function start() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      cleanup();
      return;
    }
    setStatus("");
    setTranscript("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setStatus(
          t(
            "التسجيل خاصو متصفح حديث واتصال HTTPS",
            "Recording needs a modern browser and HTTPS",
            "L’enregistrement nécessite un navigateur récent et HTTPS",
          ),
        );
        return;
      }
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const type = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(
        stream.current,
        type ? { mimeType: type } : {},
      );
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        const blob = new Blob(chunks, { type: r.mimeType });
        setFile(blob);
        if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = URL.createObjectURL(blob);
        setUrl(blobUrl.current);
        setRecording(false);
        cleanup();
      };
      recorder.current = r;
      r.start();
      setRecording(true);
      const Recognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (Recognition) {
        const sr = new Recognition();
        sr.lang = lang.speech;
        sr.continuous = true;
        sr.interimResults = false;
        sr.onresult = (e) =>
          setTranscript(
            Array.from(e.results)
              .filter((r) => r.isFinal)
              .map((r) => r[0].transcript)
              .join(" "),
          );
        sr.onerror = () =>
          setStatus(
            t(
              "تعرف الكلام غير متاح. تقدر تسمع التسجيل.",
              "Speech recognition unavailable. Listen to your recording.",
              "Reconnaissance indisponible. Écoutez votre enregistrement.",
            ),
          );
        recognition.current = sr;
        sr.start();
      } else
        setStatus(
          t(
            "تعرف الكلام غير مدعوم هنا. التسجيل ما زال خدام.",
            "Speech recognition is not supported here. Recording still works.",
            "Reconnaissance non prise en charge. L’enregistrement fonctionne.",
          ),
        );
      audioContext.current = new AudioContext();
      const analyser = audioContext.current.createAnalyser();
      analyser.fftSize = 64;
      audioContext.current
        .createMediaStreamSource(stream.current)
        .connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frames = 0;
      function frame() {
        analyser.getByteFrequencyData(data);
        if (++frames % 4 === 0)
          setLevel(
            Array.from(data)
              .slice(0, 30)
              .map((n) => Math.max(8, n / 3)),
          );
        animation.current = requestAnimationFrame(frame);
      }
      frame();
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 30000);
    } catch {
      setRecording(false);
      cleanup();
      setStatus(
        t(
          "ما قدرناش نستعمل الميكروفون. راجع الصلاحيات.",
          "Microphone unavailable. Check browser permissions.",
          "Micro indisponible. Vérifiez les autorisations.",
        ),
      );
    }
  }
  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("audio", file, "practice.webm");
      const r = await fetch("/api/recordings", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setStatus(
        t(
          "تم حفظ التسجيل الخاص في حسابك",
          "Private recording saved to your account",
          "Enregistrement privé sauvegardé",
        ),
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="focus">
      <div className="page-heading">
        <div>
          <span className="overline">
            {t(
              "مختبر النطق",
              "YOUR SPEAKING STUDIO",
              "VOTRE STUDIO DE PRONONCIATION",
            )}
          </span>
          <h1>
            {t(
              "صوتك. لغتك الجديدة.",
              "Your voice. Your new language.",
              "Votre voix. Votre nouvelle langue.",
            )}
          </h1>
          <p>
            {t(
              "اسمع المثال، سجل صوتك، وقارن بنفسك.",
              "Listen, record your voice, and compare.",
              "Écoutez, enregistrez-vous et comparez.",
            )}
          </p>
        </div>
        <Mic className="cyan" size={30} />
      </div>
      <article className="panel pronunciation-card">
        <span className="chip violet">
          {lang.flag}{" "}
          {t("قول هاد العبارة", "SAY THIS PHRASE", "DITES CETTE EXPRESSION")}
        </span>
        <h2 dir="ltr">{lang.hello}</h2>
        <p>{lang.translation}</p>
        <button
          className="btn audio"
          onClick={() => onListen(lang.hello)}
          style={{ marginTop: 20 }}
        >
          <Volume2 size={19} />
          {t("اسمع المثال", "Listen to the example", "Écouter l’exemple")}
        </button>
        <div className="waveform">
          {level.map((height, i) => (
            <i key={i} style={{ height: `${height}px` }} />
          ))}
        </div>
        <button
          className={`mic-btn ${recording ? "recording" : ""}`}
          onClick={() => void start()}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <Square size={27} /> : <Mic size={31} />}
        </button>
        <p className="pronunciation-status" role="status">
          {recording
            ? t(
                "كنسمعك… اضغط باش توقف. 30 ثانية كحد أقصى.",
                "Listening… tap to stop. Maximum 30 seconds.",
                "À l’écoute… appuyez pour arrêter. Maximum 30 secondes.",
              )
            : t(
                "اضغط وسجل · 30 ثانية كحد أقصى",
                "Tap to record · up to 30 seconds",
                "Appuyez pour enregistrer · 30 secondes maximum",
              )}
        </p>
        {url && <audio controls src={url} className="recorded-audio" />}
        {transcript && (
          <div className="example-box">
            <small>
              {t(
                "الكلام اللي تعرف عليه المتصفح",
                "BROWSER-RECOGNISED WORDS",
                "MOTS RECONNUS PAR LE NAVIGATEUR",
              )}
            </small>
            <p dir="ltr">{transcript}</p>
            <div className="word-feedback">
              {lang.hello.split(" ").map((word, i) => (
                <span
                  key={i}
                  className={
                    normalize(transcript).includes(normalize(word))
                      ? "heard"
                      : ""
                  }
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}
        {status && (
          <p className="pronunciation-status" role="status">
            {status}
          </p>
        )}
        {file && signed && (
          <button
            className="btn secondary"
            onClick={() => void upload()}
            disabled={busy}
          >
            {t(
              "حفظ التسجيل الخاص",
              "Save private recording",
              "Sauvegarder l’enregistrement privé",
            )}
          </button>
        )}
      </article>
      <p className="pronunciation-status">
        {t(
          "تعرف الكلمات مجرد مساعدة للمراجعة، ماشي تقييم دقيق للنطق. تقييم النطق الاحترافي قيد التحضير.",
          "Word recognition is a review aid, not an accurate pronunciation assessment. Professional assessment is in development.",
          "La reconnaissance aide à réviser mais n’évalue pas précisément la prononciation. L’évaluation professionnelle est en préparation.",
        )}
      </p>
      <button className="btn secondary listening-link" onClick={onListening}>
        <Headphones size={19} />
        {t(
          "جرب تدريب الاستماع",
          "Try listening practice",
          "Essayer la compréhension orale",
        )}
      </button>
    </section>
  );
}
