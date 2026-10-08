import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const project = process.argv[2];
if (!project || !/^[a-z0-9]+$/.test(project))
  throw Error("Usage: npm run types:generate -- YOUR_SUPABASE_PROJECT_REF");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "supabase",
    "gen",
    "types",
    "typescript",
    "--project-id",
    project,
    "--schema",
    "public",
  ],
  { encoding: "utf8", shell: false },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(1);
}
writeFileSync("lib/supabase/database.types.ts", result.stdout);
console.log(
  "Generated lib/supabase/database.types.ts from the configured Supabase schema.",
);
