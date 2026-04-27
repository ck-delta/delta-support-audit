// Reads src/prompts/*.md and writes src/prompts/embedded.ts with each as a string export.
// Run this whenever you edit a prompt: `pnpm tsx src/scripts/embed-prompts.ts`.
// Tip: hook into prebuild to never forget — see package.json "build" script.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '..', 'prompts');

const NAMES = ['compare', 'conflict', 'coverage'] as const;

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const lines: string[] = [
  '// AUTO-GENERATED from src/prompts/*.md by `pnpm tsx src/scripts/embed-prompts.ts`.',
  '// Do NOT edit by hand — edit the .md files and re-run.',
  '',
];

for (const name of NAMES) {
  const body = readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf8');
  lines.push(`export const ${name.toUpperCase()}_PROMPT = \`${escape(body)}\`;`);
  lines.push('');
}

const out = lines.join('\n');
const target = join(PROMPTS_DIR, 'embedded.ts');
writeFileSync(target, out, 'utf8');
console.log(`Wrote ${target} (${out.length} chars)`);
for (const name of NAMES) {
  const body = readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf8');
  console.log(`  ${name.toUpperCase()}_PROMPT: ${body.length} chars`);
}
