// Regenerates DECLARATION_PROMPT and UNIVERSITY_DIRECTORY in src/lib/ai/prompts.ts from docs/ai/declaration.md.
// Run: node scripts/gen-prompts.mjs
import { readFileSync, writeFileSync } from "node:fs";
const md = readFileSync("docs/ai/declaration.md", "utf8");
const between = (s, a, b) => {
  const i = s.indexOf(a);
  const j = s.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error(`marker not found: ${a} / ${b}`);
  return s.slice(i, j).trim();
};
const decl = between(md, "Ты — декларационный отдел", "\n---\n\n## Как упростить анкету");
const dir = between(md, "### Справочник вузов", "\n## Как превратить JSON");
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
let ts = readFileSync("src/lib/ai/prompts.ts", "utf8");
const swap = (name, text) => {
  const re = new RegExp(`export const ${name} = \`[\\s\\S]*?(?<!\\\\)\`;`);
  if (!re.test(ts)) throw new Error(`${name} not found`);
  ts = ts.replace(re, () => `export const ${name} = \`${esc(text)}\`;`);
};
swap("DECLARATION_PROMPT", decl);
swap("UNIVERSITY_DIRECTORY", dir);
writeFileSync("src/lib/ai/prompts.ts", ts);
console.log("ok", decl.length, dir.length);
