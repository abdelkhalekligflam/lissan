import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import {
  genericError,
  ip,
  rateLimit,
  sameOrigin,
  verifyCaptcha,
} from "@/lib/security";
const input = z
  .object({
    action: z.enum([
      "login",
      "signup",
      "reset",
      "google",
      "logout",
      "password",
    ]),
    email: z.string().trim().email().max(254).optional(),
    password: z.string().min(1).max(128).optional(),
    captchaToken: z.string().max(4096).optional(),
  })
  .strict();
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403 });
  const limited = await rateLimit("auth", ip(req));
  if (limited) return limited;
  try {
    if (Number(req.headers.get("content-length")) > 16000)
      return genericError();
    const data = input.parse(await req.json());
    const supabase = await serverClient();
    if (data.action === "logout") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return NextResponse.json(
          { error: "سجل الدخول أولاً" },
          { status: 401 },
        );
      const { error } = await supabase.auth.signOut();
      if (error) return genericError();
      return NextResponse.json({ ok: true });
    }
    if (data.action === "password") {
      if (!data.password || data.password.length < 8) return genericError();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return NextResponse.json(
          { error: "سجل الدخول أولاً" },
          { status: 401 },
        );
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });
      if (error) return genericError();
      return NextResponse.json({ ok: true });
    }
    // Turnstile tokens are single-use. Supabase validates email-auth tokens;
    // only OAuth initiation needs our own verification.
    if (
      !data.captchaToken ||
      (data.action === "google" && !(await verifyCaptcha(data.captchaToken, req)))
    )
      return NextResponse.json(
        { error: "تحقق من CAPTCHA وحاول مرة أخرى." },
        { status: 400 },
      );
    const site = process.env.NEXT_PUBLIC_SITE_URL!;
    if (data.action === "google") {
      const { data: result, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${site}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error || !result.url) return genericError();
      return NextResponse.json({ url: result.url });
    }
    if (!data.email) return genericError();
    if (data.action === "reset") {
      await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${site}/auth/callback?next=/reset-password`,
        captchaToken: data.captchaToken,
      });
      return NextResponse.json({ message: true });
    }
    if (!data.password) return genericError();
    if (data.action === "signup") {
      if (data.password.length < 8) return genericError();
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          captchaToken: data.captchaToken,
          emailRedirectTo: `${site}/auth/callback`,
        },
      });
      if (error) return genericError();
      return NextResponse.json({ message: true });
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
      options: { captchaToken: data.captchaToken },
    });
    if (error)
      return NextResponse.json(
        { error: "راجع بيانات الدخول وحاول مرة أخرى." },
        { status: 400 },
      );
    return NextResponse.json({ ok: true });
  } catch {
    return genericError();
  }
}
