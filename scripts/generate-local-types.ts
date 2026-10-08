import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fixtureSql } from "./schema-fixtures";
async function main() {
  const db = new PGlite();
  await db.exec(fixtureSql);
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  const result = await db.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
  );
  const views = new Set(
    (
      await db.query<{ table_name: string }>(
        `select table_name from information_schema.views where table_schema='public'`,
      )
    ).rows.map((r) => r.table_name),
  );
  const tables = new Map<string, typeof result.rows>();
  for (const row of result.rows) {
    if (!tables.has(row.table_name)) tables.set(row.table_name, []);
    tables.get(row.table_name)!.push(row);
  }
  const type = (row: (typeof result.rows)[number]) =>
    (({
      integer: "number",
      bigint: "number",
      "double precision": "number",
      numeric: "number",
      boolean: "boolean",
      jsonb: "Json",
      json: "Json",
    })[row.data_type] || "string") +
    (row.is_nullable === "YES" ? " | null" : "");
  let out =
    "// Generated from the migration schema using PGlite. Regenerate from the live project with npm run types:generate after setup.\nexport type Json = string | number | boolean | null | { [key:string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n";
  function table(name: string, cols: typeof result.rows, isView = false) {
    const row = cols
      .map((c) => `${JSON.stringify(c.column_name)}: ${type(c)};`)
      .join("\n");
    if (isView)
      return `${JSON.stringify(name)}: {Row:{${row}};Relationships:[]};\n`;
    const insert = cols
      .map(
        (c) =>
          `${JSON.stringify(c.column_name)}${c.column_default !== null || c.is_nullable === "YES" ? "?" : ""}: ${type(c)};`,
      )
      .join("\n");
    const update = cols
      .map((c) => `${JSON.stringify(c.column_name)}?: ${type(c)};`)
      .join("\n");
    return `${JSON.stringify(name)}: { Row:{${row}};Insert:{${insert}};Update:{${update}};Relationships:[]};\n`;
  }
  for (const [name, cols] of tables)
    if (!views.has(name)) out += table(name, cols);
  out += "}; Views:{\n";
  for (const [name, cols] of tables)
    if (views.has(name)) out += table(name, cols, true);
  out +=
    "};Functions:{award_lesson:{Args:{p_user_id:string;p_lesson_id:string;p_score:number;p_xp:number};Returns:Json};review_card:{Args:{p_user_id:string;p_card_id:string;p_known:boolean};Returns:Json}};Enums:Record<never,never>;CompositeTypes:Record<never,never>}};\n";
  writeFileSync("lib/supabase/database.types.ts", out);
  await db.close();
  console.log("Generated database types from validated migration schema.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
