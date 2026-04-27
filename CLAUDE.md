# Delta Support Audit

Production system that audits delta.exchange's Freshdesk support center against `guides.delta.exchange` and `docs.delta.exchange` daily.

## Stack

- Next.js 15 App Router · TypeScript strict · Node 20+
- **LLM:** OpenRouter → `anthropic/claude-sonnet-4.6` (NOT direct Anthropic SDK)
- **Embeddings:** Upstash Vector built-in embedding model (no separate provider)
- **State:** Upstash Redis (KV: hashes, run history, dedup) · Upstash Vector (chunks)
- **Output:** Slack incoming webhook (P0 only) · Notion API (full rolling page)
- **HTML parsing:** cheerio + per-source rules in `src/lib/crawl/normalize.ts`
- **Testing:** vitest

## Sources (3, locked at M0)

| Source | Strategy | Stable ID | URL format |
|---|---|---|---|
| `guides` | GitBook sitemap iter (30 URLs) | slug path | `https://guides.delta.exchange/delta-exchange-user-guide/<slug>` |
| `docs` | Single-page Slate, H2/H3 chunker | heading id | `https://docs.delta.exchange/#<id>` |
| `support_freshdesk` | Freshdesk Solutions API (344 published) | numeric article id | `https://deltaexchange.freshdesk.com/support/solutions/articles/<id>` |

`delta.exchange/support` is a thin wrapper around the Freshdesk API — no separate content, not a source. See `docs/M0-discovery.md` for why.

## Scope decisions (locked)

- **Region:** India-only (Delta India). Don't flag false-positives where docs covers a non-India regime.
- **Locale:** English-only for v1.
- **Severity:** LLM assigns P0/P1/P2 per `src/prompts/compare.md` rubric. Drop confidence < 0.6 (P0/P1), < 0.7 (P2).
- **Triage:** Mixed — Charandeep triages, then routes via `suggestedOwner: 'Support' | 'Docs' | 'Engineering' | 'Product'` field on each issue.
- **Tier handling:** Treat number mismatches strictly (fees mostly flat at Delta).
- **Cron:** `30 22 * * *` UTC = 04:00 IST daily.
- **Confidence floors:** see `.env.local.example`.

## Commands

```bash
pnpm dev                                       # local Next.js
pnpm test                                      # vitest
pnpm typecheck                                 # tsc --noEmit
pnpm lint                                      # next lint
pnpm crawl                                     # all sources dry-run
pnpm crawl --source=docs                       # one source
pnpm crawl --write                             # persist hashes to Redis
pnpm crawl --source=guides --limit=5           # debugging
```

## Conventions

- All LLM prompts live in `src/prompts/*.md` — edit those, not inline strings.
- All env vars listed in `.env.local.example`. Never commit `.env.local`.
- Crawlers respect `robots.txt`. If a domain blocks us, escalate — do not bypass.
- Severity rubric is in `src/prompts/compare.md`. Don't duplicate it.
- Hash key format: `hash:<source>:<stableId>`. Don't change without a migration plan.
- Stable IDs are source-specific:
  - `guides`: slug path (e.g. `trading-guide/leverage`)
  - `docs`: heading anchor id (e.g. `api-key-permissions`)
  - `support_freshdesk`: numeric article id (e.g. `80001014604`)
- Issue dedup key: SHA-256 of `(supportUrl + summary)`.
- One LLM provider for completions: OpenRouter. The wrapper lives at `src/lib/llm/openrouter.ts`. If swapping back to direct Anthropic SDK, that's the only file to touch.

## Don'ts

- Don't dump all guides + docs into the LLM context per call. Use RAG.
- Don't put prompts in `.ts` files as multi-line strings. Use `.md` files.
- Don't fire individual Slack messages per issue. One grouped message per run.
- Don't write an issue to Notion without dedup against last run.
- Don't trust raw HTML — always normalize before hashing.
- Don't use `@latest` in `package.json`. Pin tilde-minor versions.
- Don't bypass `robots.txt`. If blocked, surface to user.
- Don't run real audits during prompt development. Use a `?dryRun=true` flag (M4) and locally cached fixtures.
- Don't commit secrets. Don't push to main without approval. Don't deploy from a feature branch.

## Pointers

- M0 discovery findings: `docs/M0-discovery.md`
- Prompts (M3): `src/prompts/*.md`
- Project conventions for future Claude sessions: this file.
