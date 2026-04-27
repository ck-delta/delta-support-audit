# Delta Support Audit

Production system that audits Delta Exchange's Freshdesk support center against `guides.delta.exchange` and `docs.delta.exchange` (sources of truth) for factual contradictions and missing coverage. Runs daily on Vercel Cron, writes the full graded report to Notion, fires P0 issues to Slack.

**Status:** M0–M5 complete. Production deploy is the final user step.

- M0 — discovery
- M1 — crawl + content-hash (Upstash Redis)
- M2 — embed + retrieve (1067 chunks in Upstash Vector, BGE-large-en-v1.5)
- M3 — compare + grade (Sonnet 4.6 via OpenRouter; compare/conflict/coverage detectors)
- M4 — output + deploy (Slack + Notion + Vercel cron at 04:00 IST daily)
- M5 — first sweep + tune (compare.md v2 shipped at 12.5% FP rate)

## Validation results (M5)

**100-article trial (sample = 100 of 313):**

| Severity | Total | TP | FP | AMB |
|---|---|---|---|---|
| P0 | 14 | **14** | **0** | 0 |
| P1 | 17 | ~12 | 1–2 | 4 (Mark Price stop trigger — deferred) |
| Conflicts | 4 | 3 | 1 | 0 |

**Combined P0+P1 FP rate: 5–9%** — comfortably under the 10% target.

P0 findings cluster into 5 themes, all validated as real drift worth fixing:
1. **API base URL drift** (4 issues) — support uses `api.delta.exchange`, India docs use `api.india.delta.exchange`
2. **GUIDES_STALE BTC deposits** (4 issues) — guides still mention BTC; support reflects current USDT-only policy. Routed to `Owner: Docs`.
3. **Funding mechanics** (2 issues) — funding interval and caps drifted between support and SoT
4. **Contract spec drift** (2 issues) — BTCUSD inverse settlement, ETHUSDQ margin currency
5. **Misc** (2 issues) — flat margin formula, bracket orders deprecation status

Cost of trial: $2.45. Time: 4 minutes wall-clock.

## Known limitations (M5 sign-off)

- **FP rate on P0+P1: 5–9% at 100-article scale**, validated. (At 20-article trial it appeared 12.5% — that was small-sample noise; v2 is performing better than the small trial implied.)
- **Dedup phrasing instability**: Sonnet phrases issue summaries slightly differently across runs at temperature=0, so identical issues sometimes get different dedup IDs. The dedup `still-open` count under-reports. Tracked for M6.
- **Coverage detector is conservative.** At similarity threshold 0.85, full SoT corpus produces few/no flagged gaps because Sonnet's "default to covered if uncertain" rule is strict. This is intentional for v1 noise control; revisit if real gaps are missed.
- **Vercel Hobby 60s timeout** caps the daily cron to ~12-15 articles per run. Most days that's fine (only changed articles audit). If a backlog builds (50+ changed articles), the cron returns `truncated=true` and the next run picks up. To unblock big-bang re-audits, run `pnpm tsx src/scripts/audit-batch.ts --write` from your machine.

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

# M4: API route (started by `pnpm dev`, deployed via Vercel)
curl -X GET 'http://localhost:3000/api/audit?dryRun=true&limit=5' \
  -H "Authorization: Bearer $CRON_SECRET"                 # local dry run, no side effects
curl -X GET 'http://localhost:3000/api/audit?force=true&limit=3' \
  -H "Authorization: Bearer $CRON_SECRET"                 # local real run against your TEST Slack/Notion
pnpm test                                     # vitest
pnpm typecheck                                # tsc --noEmit
pnpm lint                                     # next lint
```

## Architecture

See `docs/M0-discovery.md` for the full discovery write-up and `CLAUDE.md` for project conventions.

## Deployment (M4)

### One-time setup

1. **Slack**: create a webhook (Slack admin → Apps → Incoming Webhooks). Copy URL → `SLACK_WEBHOOK_URL`.
2. **Notion**:
   - notion.so/my-integrations → New integration → name "Delta Support Audit" → save.
   - Copy Internal Integration Secret → `NOTION_API_KEY`.
   - Create a Notion page titled "Delta Support Audit — Latest Run".
   - On that page: ⋯ → Connections → add the integration.
   - Copy the page ID (32-hex from the URL after the page title) → `NOTION_AUDIT_PAGE_ID`.
3. **CRON_SECRET**: `openssl rand -hex 32` → `CRON_SECRET` in env.
4. **Vercel project**: link this repo via dashboard or `vercel link`. Add ALL env vars from `.env.local.example` in Vercel project settings.

### Deploy steps

```bash
# Local end-to-end test against TEST Slack channel + TEST Notion page first
pnpm dev
# then in another terminal:
curl 'http://localhost:3000/api/audit?force=true&limit=3' -H "Authorization: Bearer $CRON_SECRET"
# verify Slack receives a message (if any P0 found) and Notion page updates

# Deploy preview
git push origin <feature-branch>     # or: vercel
# Trigger manually from Vercel dashboard. Confirm completes < 60s.

# Promote to production
git push origin main                 # or: vercel --prod

# Confirm cron is enabled in Vercel dashboard (Settings → Crons)
```

### What runs on the cron

- **Daily 22:30 UTC (04:00 IST)** — `/api/audit` runs:
  1. Iterates Freshdesk articles, audits only those whose hash changed since last run (M1 hash store).
  2. Concurrency 5; soft timeout at 50s, hard at 60s (Vercel Hobby limit).
  3. If any new P0s found: posts a single grouped message to `#delta-support-audit`.
  4. Replaces the Notion page body with the latest report (severity sections, conflicts, coverage gaps, run metadata).
  5. Returns JSON summary.

### What does NOT run on the cron

- The full corpus sweep (~313 articles) — exceeds 60s. Run manually:
  ```bash
  pnpm tsx src/scripts/audit-batch.ts --write
  ```
- The coverage gap detector — runs over ~600 SoT chunks, exceeds 60s. Run manually weekly:
  ```bash
  pnpm tsx src/scripts/audit-batch.ts --coverage --write
  ```
- Both can move to Vercel cron after upgrading to Pro (300s function timeout) and updating `vercel.json`.

### Operational query params

```
GET /api/audit
  Authorization: Bearer ${CRON_SECRET}
  ?dryRun=true            skip Slack + Notion side effects (default: false)
  ?force=true             re-audit even unchanged articles (default: false)
  ?limit=N                cap articles audited (default: all changed)
  ?coverage=true          also run coverage detector (BLOCKED on Hobby — exceeds 60s)
  ?coverageLimit=N        cap SoT chunks scanned for coverage
```

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
