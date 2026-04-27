import { COMPARE_PROMPT, CONFLICT_PROMPT, COVERAGE_PROMPT } from '@/prompts/embedded';

export type PromptName = 'compare' | 'conflict' | 'coverage';

// Prompts are baked into the bundle via src/prompts/embedded.ts so they ship
// in serverless deployments (Next.js's outputFileTracing doesn't pick up .md
// files reliably). Edit the .md files and re-run `pnpm tsx src/scripts/embed-prompts.ts`.
const PROMPTS: Record<PromptName, string> = {
  compare: COMPARE_PROMPT,
  conflict: CONFLICT_PROMPT,
  coverage: COVERAGE_PROMPT,
};

export function loadPrompt(name: PromptName): string {
  return PROMPTS[name];
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
