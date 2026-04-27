# Delta Support Audit

Production system that audits Delta Exchange's Freshdesk support center against `guides.delta.exchange` and `docs.delta.exchange` (sources of truth) for factual contradictions and missing coverage. Runs daily on Vercel Cron, writes the full graded report to Notion, fires P0 issues to Slack.

**Status:** M0–M3 complete. M4–M5 in progress.

- M0 — discovery
- M1 — crawl + content-hash (765 hashes in Upstash Redis)
- M2 — embed + retrieve (613 SoT chunks in Upstash Vector, BGE-large-en-v1.5)
- M3 — compare + grade (Sonnet 4.6 via OpenRouter; compare/conflict/coverage detectors; ~$0.02/article)
- M4 — output + deploy (Slack + Notion + Vercel cron)
- M5 — first sweep + tune

## Quick start

```bash
# 1. Install
pnpm install

# 2. Provision env (see Setup below)
cp .env.local.example .env.local
# fill in real values

# 3. Run the crawler against all sources (dry run, no writes)
pnpm crawl

# 4. Persist hashes to Upstash for change tracking
pnpm crawl --write

# 5. Run again — should report all unchanged
pnpm crawl --write
```

## Setup

Required env vars in `.env.local` (see `.env.local.example` for the full list):

| Var | Source | Required for |
|---|---|---|
| `OPENROUTER_API_KEY` | openrouter.ai/keys | M3+ (LLM comparison) |
| `OPENROUTER_MODEL` | default `anthropic/claude-sonnet-4.6` | M3+ |
| `FRESHDESK_DOMAIN` | `deltaexchange.freshdesk.com` | M1+ |
| `FRESHDESK_API_KEY` | Freshdesk → Profile Settings → API Key | M1+ |
| `UPSTASH_REDIS_REST_URL` | console.upstash.com → Redis DB → REST API | M1+ |
| `UPSTASH_REDIS_REST_TOKEN` | same | M1+ |
| `UPSTASH_VECTOR_REST_URL` | console.upstash.com → Vector → REST API | M2+ |
| `UPSTASH_VECTOR_REST_TOKEN` | same | M2+ |
| `NOTION_API_KEY` | notion.so/my-integrations | M4+ |
| `NOTION_AUDIT_PAGE_ID` | the rolling page ID (32-hex from URL) | M4+ |
| `SLACK_WEBHOOK_URL` | Slack admin / Incoming Webhooks | M4+ |
| `CRON_SECRET` | random 32+ chars; protects `/api/audit` | M4+ |

## Sources audited

| Source | Strategy | Article count |
|---|---|---|
| `guides.delta.exchange` | Sitemap iteration (GitBook) | 30 |
| `docs.delta.exchange` | Single-page Slate doc, chunked by H2/H3 | ~250 sections |
| `deltaexchange.freshdesk.com` | Freshdesk Solutions API | 344 published |

`delta.exchange/support` is a thin Next.js wrapper around the Freshdesk API and contains no original content; it's not a separate source. See `docs/M0-discovery.md`.

## CLI commands

```bash
pnpm crawl                                    # all sources, dry run
pnpm crawl --source=guides                    # one source
pnpm crawl --source=docs --limit=10           # cap article count
pnpm crawl --write                            # persist hashes to Redis (M1)
pnpm tsx src/scripts/embed-sot.ts             # embed corpus → Upstash Vector (M2; now includes support_freshdesk)
pnpm tsx src/scripts/embed-sot.ts --sample-query="how is liquidation price calculated"
pnpm tsx src/scripts/audit-one.ts <article-id>            # M3: audit one article
pnpm tsx src/scripts/audit-batch.ts --limit=20            # M3: audit a batch (dry-run)
pnpm tsx src/scripts/audit-batch.ts --limit=20 --write    # M3: persist + dedup against last run
pnpm tsx src/scripts/audit-batch.ts --coverage            # M3: also run coverage gap detector
pnpm test                                     # vitest
pnpm typecheck                                # tsc --noEmit
pnpm lint                                     # next lint
```

## Architecture

See `docs/M0-discovery.md` for the full discovery write-up and `CLAUDE.md` for project conventions.

## Ops runbook

### Crawler stops working

1. Check the offending source's site for a markup change (open one URL in a browser, view source, compare to `tests/fixtures/`).
2. Update the per-source profile in `src/lib/crawl/normalize.ts`.
3. Add a fixture for the new pattern in `tests/fixtures/` so we don't regress.

### Freshdesk API returns 401

The API key was rotated or the agent role changed. Regenerate the key in Freshdesk → Profile Settings → API Key, paste into `.env.local`.

### Upstash quota exceeded

Free tier: 10K commands/day. A full sweep does ~460 hash reads + writes. Upgrade to pay-as-you-go if running multiple times per day.

### Hash mismatches on every run (every article shows changed:true)

Indicates the normalizer is producing non-deterministic output. Likely cause: time-varying content (timestamps in HTML, randomized ad slots) leaking through. Add the offending selector to `stripSelectors` in `normalize.ts`.

### Audit shows new issues every run for the same article

Sonnet phrases issue summaries slightly differently across calls, so the dedup ID `sha256(sotUrl + canonicalSummary)` doesn't always match. This produces a `new` count that should be `still-open` and a `resolved` count that should be 0. Mitigations:

1. Set `temperature: 0.0` (already default — but Sonnet still varies).
2. Tune `compare.md` to enforce more constrained summary phrasing (e.g. "use this exact format: 'X says Y, Z says W'").
3. Switch dedup to a coarser key like `sha256(sotUrl + supportUrl + severity)` — fewer false positives but loses precision when one article has multiple issues at the same severity.

To be addressed in M5 prompt-tuning. Daily noise is mostly fine; this only matters for the still-open / resolved counts in the Notion summary.

### Audit cost is higher than expected

Default settings: top-K=5 per source, 2 sources, ~2000 chars per chunk → ~10K input tokens per article × 313 articles = ~3M input tokens per full sweep. At $3/MTok input + $15/MTok output, ~$10–12 per full sweep. Daily incremental runs only audit changed articles (M4 wires this), so post-first-sweep daily cost should be $0.30–0.60.

To reduce cost during prompt-tuning: use `--limit=N` on audit-batch.

## Layout

```
src/
├── app/                   # Next.js App Router (M4: /api/audit)
├── lib/
│   ├── crawl/             # source-specific scrapers + normalize + sitemap
│   ├── store/             # Upstash Redis + hashing
│   ├── llm/               # M3: OpenRouter wrapper
│   └── types.ts
└── scripts/               # CLI entrypoints (crawl-once)
tests/
├── crawl/                 # offline tests against fixtures
├── store/                 # hash + KV tests
└── fixtures/              # committed HTML samples
docs/                      # discovery + design notes
```
