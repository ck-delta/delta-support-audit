import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '..', '..', 'prompts');

export type PromptName = 'compare' | 'conflict' | 'coverage';

const cache = new Map<PromptName, string>();

export function loadPrompt(name: PromptName): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const path = join(PROMPTS_DIR, `${name}.md`);
  const text = readFileSync(path, 'utf8');
  cache.set(name, text);
  return text;
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined) {
      throw new Error(`renderPrompt: missing variable {{${key}}}`);
    }
    return v;
  });
}
