import { writeFileSync, readFileSync } from "node:fs";
import { proLessons, proExercises } from "../lib/pro/curriculum";
const q = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const path = "supabase/migrations/20261009202524_pro_learning.sql";
let sql =
  readFileSync(path, "utf8").split("-- Pro curriculum seed")[0] +
  "-- Pro curriculum seed\n";
sql +=
  "insert into public.languages(id,name) values('es','الإسبانية'),('en','الإنجليزية'),('fr','الفرنسية') on conflict(id) do nothing;\n";
for (const l of proLessons) {
  const pos = Number(l.id.split("-")[1]),
    unit = `${l.language}-unit-${pos}`;
  sql += `insert into public.units(id,language_id,title,position) values(${q(unit)},${q(l.language)},${q(l.title.ar)},${pos});\n`;
  sql += `insert into public.lessons(id,unit_id,title,words,position) values(${q(l.id)},${q(unit)},${q(l.title.ar)},${q(JSON.stringify(l.words))}::jsonb,1);\n`;
  l.words.forEach((w, i) => {
    sql += `insert into public.flashcards(id,lesson_id,word,translation,example) values(${q(`${l.language}-${pos - 1}-${i}`)},${q(l.id)},${q(w.word)},${q(w.ar)},${q(w.example)});\n`;
  });
  proExercises(l.id).forEach((e, i) => {
    sql += `insert into public.exercises(id,lesson_id,type,prompt,options,position) values(${q(e.id)},${q(l.id)},${q(e.type)},${q(e.prompt)},${q(JSON.stringify(e.options))}::jsonb,${i + 1});\n`;
  });
}
writeFileSync(path, sql + "commit;\n");
