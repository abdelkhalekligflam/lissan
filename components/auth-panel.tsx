"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { z } from "zod";
import type { Locale } from "@/lib/learning/content";
type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export function Captcha({ onToken }: { onToken: (s: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const tokenRef = useRef(onToken);
  tokenRef.current = onToken;
  useEffect(() => {
    if (!loaded || !ref.current || !window.turnstile) return;
    const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!key) return;
    id.current = window.turnstile.render(ref.current, {
      sitekey: key,
      theme: "dark",
      callback: (token: string) => tokenRef.current(token),
      "expired-callback": () => tokenRef.current(""),
      "error-callback": () => tokenRef.current(""),
    });
    return () => {
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
    };
  }, [loaded]);
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
      />
      <div ref={ref} />
      {!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <p className="form-error">
          TODO (manual): configure Cloudflare Turnstile before using
          authentication.
        </p>
      )}
    </>
  );
}
export function AuthPanel({
  locale,
  onClose,
  onSuccess,
}: {
  locale: Locale;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const t = (ar: string, en: string, fr: string) =>
    locale === "ar" ? ar : locale === "fr" ? fr : en;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLInputElement>("input")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elems = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input,select,a[href],[tabindex="0"]',
          ) || [],
        );
        const first = elems[0],
          last = elems[elems.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  useEffect(() => {
    if (!retry) return;
    const timer = setInterval(() => setRetry((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [retry]);
  async function submit(
    action: "login" | "signup" | "reset" | "google" = mode,
  ) {
    setError("");
    setMessage("");
    const schema = z.object({
      email: z.string().trim().email().max(254),
      password: z
        .string()
        .min(mode === "signup" ? 8 : 1)
        .max(128),
    });
    if (
      action !== "google" &&
      action !== "reset" &&
      !schema.safeParse({ email, password }).success
    ) {
      setError(
        t(
          "راجع البريد وكلمة المرور (8 أحرف على الأقل للتسجيل)",
          "Check your email and password (at least 8 characters for signup)",
          "Vérifiez l’e-mail et le mot de passe (8 caractères pour l’inscription)",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          email: email.trim(),
          password,
          captchaToken: token,
        }),
      });
      const body = await r.json();
      if (r.status === 429)
        setRetry(Number(r.headers.get("Retry-After")) || 60);
      if (!r.ok) throw Error(body.error);
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      if (body.message) {
        setMessage(
          t(
            "إلا كان البريد صالح، غادي يوصلك رابط. راجع البريد ديالك.",
            "If your email is eligible, a link will arrive. Check your inbox.",
            "Si l’adresse est éligible, un lien vous sera envoyé.",
          ),
        );
      } else onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setToken("");
    }
  }
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="auth-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        ref={ref}
      >
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X />
        </button>
        <div className="brand">
          <span className="brand-mark">ل</span>
          <b>Lissan</b>
        </div>
        <h2 id="auth-title">
          {mode === "login"
            ? t("مرحبا بعودتك", "Welcome back", "Bon retour")
            : mode === "signup"
              ? t(
                  "بدا رحلتك الجديدة",
                  "Start a new journey",
                  "Commencez votre parcours",
                )
              : t(
                  "رجع لحسابك",
                  "Get back to learning",
                  "Retrouvez votre compte",
                )}
        </h2>
        <p>
          {t(
            "كل كلمة كتقربك من هدفك.",
            "Every word takes you closer.",
            "Chaque mot vous rapproche de votre objectif.",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            {t("البريد الإلكتروني", "Email address", "Adresse e-mail")}
            <input
              dir="ltr"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== "reset" && (
            <label className="field">
              {t("كلمة المرور", "Password", "Mot de passe")}
              <input
                dir="ltr"
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={mode === "signup" ? 8 : 1}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <Captcha key={`${mode}-${busy}`} onToken={setToken} />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          {retry > 0 && (
            <p className="form-error" role="status">
              {t(
                "محاولات كثيرة. حاول بعد",
                "Too many attempts. Retry in",
                "Trop de tentatives. Réessayez dans",
              )}{" "}
              {retry}s
            </p>
          )}
          <button
            className="btn primary"
            disabled={busy || !token || retry > 0}
            style={{ marginTop: 16 }}
          >
            {busy
              ? t("لحظة…", "One moment…", "Un instant…")
              : mode === "login"
                ? t("دخول", "Sign in", "Connexion")
                : mode === "signup"
                  ? t("إنشاء حساب", "Create account", "Créer un compte")
                  : t(
                      "أرسل رابط الاسترجاع",
                      "Send reset link",
                      "Envoyer le lien",
                    )}
            <ArrowLeft size={17} />
          </button>
        </form>
        {mode === "login" && (
          <button
            className="text-btn"
            onClick={() => {
              setMode("reset");
              setError("");
              setMessage("");
            }}
          >
            {t(
              "نسيت كلمة المرور؟",
              "Forgot your password?",
              "Mot de passe oublié ?",
            )}
          </button>
        )}
        {mode !== "reset" && (
          <>
            <div className="divider">{t("أو", "or", "ou")}</div>
            <button
              className="btn secondary"
              disabled={busy || !token || retry > 0}
              onClick={() => void submit("google")}
            >
              {t(
                "المتابعة مع Google",
                "Continue with Google",
                "Continuer avec Google",
              )}
            </button>
          </>
        )}
        <button
          className="text-btn"
          onClick={() => {
            setMode(mode === "signup" || mode === "reset" ? "login" : "signup");
            setError("");
            setMessage("");
          }}
        >
          {mode === "login"
            ? t(
                "ما عندكش حساب؟ سجل مجاناً",
                "New here? Create a free account",
                "Nouveau ? Créez un compte gratuit",
              )
            : t(
                "عندك حساب؟ سجل الدخول",
                "Already a member? Sign in",
                "Déjà inscrit ? Connectez-vous",
              )}
        </button>
      </div>
    </div>
  );
}
