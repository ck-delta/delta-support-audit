# Delta Support Audit

Production system that audits Delta Exchange's Freshdesk support center against `guides.delta.exchange` and `docs.delta.exchange` (sources of truth) for factual contradictions and missing coverage. Runs daily on Vercel Cron, writes the full graded report to Notion, fires P0 issues to Slack.

**Status:** M1 complete (crawl + content-hash). M2–M5 in progress.

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
pnpm crawl --write                            # persist hashes to Redis
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
