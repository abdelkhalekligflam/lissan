import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { fixtureSql } from "./schema-fixtures";
async function main() {
  const db = new PGlite();
  // Minimal Supabase auth/storage fixtures; production has these schemas already.
  await db.exec(fixtureSql);
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  await db.query("insert into auth.users(id) values($1),($2)", [a, b]);
  assert.equal(
    (await db.query("select * from public.profiles")).rows.length,
    2,
    "signup trigger creates profiles",
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.lessons",
      )
    ).rows[0].n,
    18,
  );
  const rls = await db.query<{ relname: string; relrowsecurity: boolean }>(
    "select relname,relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relkind='r'",
  );
  assert(rls.rows.every((r) => r.relrowsecurity));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
  assert.equal(
    (await db.query("select * from public.profiles")).rows.length,
    1,
    "A cannot see B's profile",
  );
  assert.equal(
    (await db.query("select * from public.profiles where id=$1", [b])).rows
      .length,
    0,
  );
  await assert.rejects(
    () => db.query("update public.profiles set xp=999 where id=$1", [a]),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      db.query(
        "insert into public.user_progress(user_id,lesson_id,score,xp) values($1,'es-1',100,40)",
        [a],
      ),
    /permission denied/,
  );
  await assert.rejects(
    () => db.query("select public.award_lesson($1,'es-1',100,40)", [a]),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      db.query(
        "insert into storage.objects(bucket_id,name) values('user-recordings',$1)",
        [`${a}/test.webm`],
      ),
    /row-level security/,
  );
  await db.query("update public.profiles set name='Sara' where id=$1", [a]);
  await db.exec("reset role;set role service_role;");
  await assert.rejects(
    () => db.query("select public.award_lesson($1,'es-2',100,40)", [a]),
    /locked/,
  );
  const award = await db.query<{ result: { xp: number; score: number } }>(
    "select public.award_lesson($1,'es-1',100,40) as result",
    [a],
  );
  assert.equal(award.rows[0].result.xp, 40);
  const repeat = await db.query<{ result: { xp: number } }>(
    "select public.award_lesson($1,'es-1',100,40) as result",
    [a],
  );
  assert.equal(repeat.rows[0].result.xp, 0, "replay awards no XP");
  await db.query("select public.award_lesson($1,'es-2',50,20)", [a]);
  assert.equal(
    (
      await db.query<{ xp: number }>(
        "select xp from public.profiles where id=$1",
        [a],
      )
    ).rows[0].xp,
    40,
    "failed quiz awards no XP",
  );
  await db.query("select public.award_lesson($1,'es-2',100,40)", [a]);
  assert.equal(
    (await db.query("select * from public.user_progress where user_id=$1", [a]))
      .rows.length,
    2,
  );
  const review = await db.query<{ r: { interval: number } }>(
    "select public.review_card($1,'es-0-0',true) r",
    [a],
  );
  assert.equal(review.rows[0].r.interval, 1);
  const review2 = await db.query<{ r: { interval: number } }>(
    "select public.review_card($1,'es-0-0',true) r",
    [a],
  );
  assert.equal(review2.rows[0].r.interval, 3);
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${b}';`,
  );
  assert.equal(
    (await db.query("select * from public.user_progress")).rows.length,
    0,
    "B cannot read A's progress",
  );
  assert.equal(
    (await db.query("select * from public.flashcard_reviews")).rows.length,
    0,
    "B cannot read A's reviews",
  );
  assert.equal(
    (await db.query("select * from public.streaks")).rows.length,
    0,
    "B cannot read A's streaks",
  );
  await db.exec("reset role;set role service_role;");
  await assert.rejects(
    () => db.query("select public.award_lesson($1,'es-4',100,40)", [b]),
    /Pro required/,
  );
  await assert.rejects(
    () => db.query("select public.review_card($1,'es-3-0',true)", [b]),
    /Pro required/,
  );
  await db.query(
    "insert into public.subscriptions(user_id,plan,status) values($1,'pro','active')",
    [a],
  );
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${a}';`,
  );
  assert.equal(
    (await db.query("select * from public.lessons")).rows.length,
    18,
    "Pro reads all lessons",
  );
  assert.equal(
    (await db.query("select * from public.subscriptions")).rows.length,
    1,
  );
  await assert.rejects(
    () => db.query("update public.subscriptions set plan='pro'"),
    /permission denied/,
  );
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${b}';`,
  );
  assert.equal(
    (await db.query("select * from public.lessons")).rows.length,
    9,
    "Free cannot read paid content",
  );
  assert.equal(
    (await db.query("select * from public.flashcards")).rows.length,
    36,
    "Free cannot read paid cards",
  );
  assert.equal(
    (await db.query("select * from public.subscriptions")).rows.length,
    0,
    "Free cannot read Pro owner's subscription",
  );
  await assert.rejects(
    () =>
      db.query(
        "insert into public.subscriptions(user_id,plan,status) values($1,'pro','active')",
        [b],
      ),
    /permission denied/,
  );
  await db.exec("reset role;set role service_role;");
  const proAward = await db.query<{ r: { xp: number } }>(
    "select public.award_lesson($1,'es-4',100,40) r",
    [a],
  );
  assert.equal(proAward.rows[0].r.xp, 40);
  const proRepeat = await db.query<{ r: { xp: number } }>(
    "select public.award_lesson($1,'es-4',100,40) r",
    [a],
  );
  assert.equal(proRepeat.rows[0].r.xp, 0);
  await db.query("select public.review_card($1,'es-3-0',true)", [a]);
  await db.query(
    "update public.subscriptions set expires_at=now()-interval '1 day' where user_id=$1",
    [a],
  );
  await assert.rejects(
    () => db.query("select public.award_lesson($1,'es-5',100,40)", [a]),
    /Pro required/,
  );
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${a}';`,
  );
  assert.equal(
    (await db.query("select * from public.lessons")).rows.length,
    9,
    "Expired Pro loses access",
  );
  await db.exec("reset role;");
  await db.query(
    "insert into storage.objects(bucket_id,name) values('user-recordings',$1),('user-recordings',$2)",
    [`${a}/a.webm`, `${b}/b.webm`],
  );
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${b}';`);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    1,
    "B cannot read A's recording",
  );
  await db.exec("reset role;set role anon;");
  await assert.rejects(
    () => db.query("select * from public.profiles"),
    /permission denied/,
  );
  await db.exec("reset role;");
  await db.close();
  console.log(
    "PASS: SQL migrations + seed, RLS isolation, XP permissions/idempotency, lesson locks, spaced repetition, private recordings.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
