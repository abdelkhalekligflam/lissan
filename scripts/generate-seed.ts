import { writeFileSync } from "node:fs";
import {
  languages,
  units,
  vocabulary,
  getExercises,
  lessonId,
} from "../lib/learning/content";
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
let sql =
  "-- Generated from lib/learning/content.ts by npm run seed:generate\nbegin;\n";
for (const language of languages) {
  sql += `insert into public.languages(id,name) values(${quote(language.id)},${quote(language.name)}) on conflict(id) do update set name=excluded.name;\n`;
  for (let i = 0; i < units.length; i++) {
    const id = lessonId(language.id, i),
      unit = `${language.id}-unit-${i + 1}`;
    sql += `insert into public.units(id,language_id,title,position) values(${quote(unit)},${quote(language.id)},${quote(units[i].ar)},${i + 1}) on conflict(id) do update set title=excluded.title;\n`;
    sql += `insert into public.lessons(id,unit_id,title,words,position) values(${quote(id)},${quote(unit)},${quote(units[i].ar)},${quote(JSON.stringify(vocabulary[language.id][i]))}::jsonb,1) on conflict(id) do update set words=excluded.words,title=excluded.title;\n`;
    for (const [j, w] of vocabulary[language.id][i].entries())
      sql += `insert into public.flashcards(id,lesson_id,word,translation,example) values(${quote(`${language.id}-${i}-${j}`)},${quote(id)},${quote(w.word)},${quote(w.ar)},${quote(w.example)}) on conflict(id) do update set word=excluded.word,translation=excluded.translation,example=excluded.example;\n`;
    for (const [j, e] of getExercises(language.id, i).entries())
      sql += `insert into public.exercises(id,lesson_id,type,prompt,options,position) values(${quote(e.id)},${quote(id)},${quote(e.type)},${quote(e.prompt)},${quote(JSON.stringify(e.options))}::jsonb,${j + 1}) on conflict(id) do update set prompt=excluded.prompt,options=excluded.options;\n`;
  }
}
sql += `insert into public.achievements(id,name,description) values ('first-step','أول خطوة','أكمل أول درس'),('100-xp','100 نقطة','اجمع 100 XP'),('three-languages','ثلاث لغات','أكمل درساً في كل لغة'),('three-days','3 أيام متتالية','تعلم 3 أيام متتالية') on conflict(id) do nothing;\ncommit;\n`;
writeFileSync("supabase/seed.sql", sql);
