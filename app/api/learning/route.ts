import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminClient, serverClient } from "@/lib/supabase/server";
import {
  getExercises,
  languages,
  normalize,
  vocabulary,
  type Language,
} from "@/lib/learning/content";
import { genericError, rateLimit, sameOrigin } from "@/lib/security";
const language = z.enum(["es", "en", "fr"]);
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("profile"),
      name: z
        .string()
        .trim()
        .min(1)
        .max(60)
        .regex(/^[\p{L}\p{N}\s.'’\-]+$/u),
      language,
      locale: z.enum(["ar", "en", "fr"]),
      goal: z.union([z.literal(5), z.literal(10), z.literal(20)]),
      level: z.enum(["beginner", "intermediate", "advanced"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("quiz"),
      lesson_id: z.string().regex(/^(es|en|fr)-[1-3]$/),
      answers: z.array(z.string().max(300)).length(4),
    })
    .strict(),
  z
    .object({
      action: z.literal("review"),
      card_id: z.string().regex(/^(es|en|fr)-[0-2]-[0-3]$/),
      known: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("game"),
      language,
      kind: z.enum(["matching", "speed", "memory"]),
      pairs: z
        .array(
          z
            .object({ left: z.string().max(100), right: z.string().max(100) })
            .strict(),
        )
        .max(4),
    })
    .strict(),
]);
export async function GET(req: NextRequest) {
  try {
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "سجل الدخول أولاً" }, { status: 401 });
    const limited = await rateLimit("general", user.id);
    if (limited) return limited;
    if (req.nextUrl.searchParams.get("leaderboard") === "1") {
      const { data, error } = await adminClient()
        .from("weekly_leaderboard")
        .select("display_name,weekly_xp")
        .limit(10);
      if (error) return genericError();
      return NextResponse.json({ rows: data });
    }
    const queries = await Promise.all([
      client
        .from("profiles")
        .select("name,language,locale,goal,level,xp")
        .eq("id", user.id)
        .single(),
      client.from("user_progress").select("lesson_id").eq("user_id", user.id),
      client.from("streaks").select("day,xp").eq("user_id", user.id),
      client
        .from("flashcard_reviews")
        .select("card_id,interval,due")
        .eq("user_id", user.id),
    ]);
    if (queries.some((q) => q.error)) return genericError();
    const [profile, progress, activity, reviews] = queries;
    return NextResponse.json({
      profile: {
        ...profile.data,
        completed: progress.data?.map((r) => r.lesson_id) || [],
        activity: Object.fromEntries(
          activity.data?.map((r) => [r.day, r.xp]) || [],
        ),
        reviews: Object.fromEntries(
          reviews.data?.map((r) => [
            r.card_id,
            { interval: r.interval, due: r.due },
          ]) || [],
        ),
      },
    });
  } catch {
    return genericError();
  }
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403 });
  try {
    if (Number(req.headers.get("content-length")) > 16000)
      return genericError();
    const data = input.parse(await req.json());
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "سجل الدخول أولاً" }, { status: 401 });
    const limited = await rateLimit(
      data.action === "quiz" ? "quiz" : "general",
      user.id,
    );
    if (limited) return limited;
    if (data.action === "profile") {
      const { action, ...profile } = data;
      void action;
      const { error } = await client
        .from("profiles")
        .update(profile)
        .eq("id", user.id);
      if (error) return genericError();
      return NextResponse.json({ ok: true });
    }
    const admin = adminClient();
    if (data.action === "quiz") {
      const [l, n] = data.lesson_id.split("-");
      const exercises = getExercises(l as Language, Number(n) - 1);
      const correct = exercises.filter(
        (e, i) => normalize(e.answer) === normalize(data.answers[i]),
      ).length;
      const { data: result, error } = await admin.rpc("award_lesson", {
        p_user_id: user.id,
        p_lesson_id: data.lesson_id,
        p_score: Math.round((correct / 4) * 100),
        p_xp: correct * 10,
      });
      if (error) return genericError();
      return NextResponse.json(result);
    }
    if (data.action === "review") {
      const { data: result, error } = await admin.rpc("review_card", {
        p_user_id: user.id,
        p_card_id: data.card_id,
        p_known: data.known,
      });
      if (error) return genericError();
      return NextResponse.json(result);
    }
    if (data.action === "game") {
      if (!languages.some((l) => l.id === data.language)) return genericError();
      const matched = new Set(
        data.pairs
          .filter((pair) =>
            vocabulary[data.language][0].some(
              (w) => w.word === pair.left && w.ar === pair.right,
            ),
          )
          .map((pair) => pair.left),
      );
      const score = matched.size * 10;
      const { error } = await admin
        .from("game_scores")
        .insert({ user_id: user.id, kind: data.kind, score });
      if (error) return genericError();
      return NextResponse.json({ score });
    }
    return genericError();
  } catch {
    return genericError();
  }
}
