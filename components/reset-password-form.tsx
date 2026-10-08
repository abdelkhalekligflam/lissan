"use client";
import { useState } from "react";
import Link from "next/link";
export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="reset-page">
      <section className="panel">
        <h1>كلمة مرور جديدة</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirm) {
              setMessage("كلمتا المرور مختلفتان.");
              return;
            }
            setBusy(true);
            try {
              const r = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "password", password }),
              });
              const data = await r.json();
              setMessage(
                r.ok ? "تم تغيير كلمة المرور. تقدر ترجع للتعلم." : data.error,
              );
            } catch {
              setMessage("تعذر الاتصال. حاول مرة أخرى.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            كلمة المرور الجديدة
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            تأكيد كلمة المرور
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              dir="ltr"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            حفظ كلمة المرور
          </button>
        </form>
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        <Link className="text-btn" href="/">
          الرجوع إلى Lissan
        </Link>
      </section>
    </main>
  );
}
