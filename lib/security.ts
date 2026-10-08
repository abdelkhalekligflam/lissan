import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";
const budgets = {
  auth: { requests: 5, duration: "15 m" },
  quiz: { requests: 60, duration: "1 m" },
  upload: { requests: 10, duration: "1 m" },
  general: { requests: 100, duration: "1 m" },
} as const;
const limiters = new Map<string, Ratelimit>();
export function ip(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
export async function rateLimit(kind: keyof typeof budgets, key: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL,
    token = process.env.UPSTASH_REDIS_REST_TOKEN;
  // TODO (manual): supply Redis credentials. Auth/API access deliberately fails closed without them.
  if (!url || !token)
    return NextResponse.json(
      { error: "الخدمة ما زالت قيد الإعداد. حاول لاحقاً." },
      { status: 503 },
    );
  try {
    let limiter = limiters.get(kind);
    if (!limiter) {
      const b = budgets[kind];
      limiter = new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(b.requests, b.duration),
        prefix: `lissan:${kind}`,
        analytics: false,
      });
      limiters.set(kind, limiter);
    }
    const result = await limiter.limit(key);
    if (!result.success) {
      const retry = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: `محاولات كثيرة. حاول بعد ${retry} ثانية.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(retry),
            "Cache-Control": "no-store",
          },
        },
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      { error: "الخدمة غير متاحة حالياً. حاول لاحقاً." },
      { status: 503 },
    );
  }
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return Boolean(origin && site && origin === new URL(site).origin);
}
export const genericError = () =>
  NextResponse.json(
    { error: "تعذر إتمام الطلب. حاول مرة أخرى." },
    { status: 400 },
  );
export async function verifyCaptcha(token: string, request: NextRequest) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip(request) }),
      signal: AbortSignal.timeout(8000),
    },
  );
  const result = await response.json();
  return (
    result.success === true &&
    result.hostname === new URL(process.env.NEXT_PUBLIC_SITE_URL!).hostname
  );
}
