# M6 — Discovery findings

**Date:** 2026-04-28
**Scope:** Migrate from Freshdesk + global guides to delta.exchange/support + India guide.

## TL;DR

**Status: GO with replan.** Architecture changes:

1. **Drop** `guides.delta.exchange/delta-exchange-user-guide` (old global guide). **Add** `guides.delta.exchange/delta-exchange-india-user-guide` (India-specific) as the canonical SoT. 24 URLs vs old 30; some content dropped (e.g. `leverage`, `profit-loss-math`), some new (e.g. `account-setup/usd-inr-rate`).
2. **Drop** `deltaexchange.freshdesk.com/support/...` URLs from audit findings. **Add** `www.delta.exchange/support/solutions/articles/<id>` as the user-facing support source. Content is identical (delta.exchange proxies Freshdesk server-side); only the URL surfaced to users changes.
3. **Article ID enumeration uses Freshdesk API** as a tooling step (the only feasible path — delta.exchange/support exposes categories + folders but not article lists). Article CONTENT is fetched from delta.exchange URLs.
4. **Filter to India portal**: keep only articles whose category has `visible_in_portals` including `80000083721` (the India portal id). Drops ~30 articles not surfaced to India users.
5. **Source rename**: `support_freshdesk` → `support` everywhere (types, Redis keys, Vector metadata, prompts, README). All Redis state + Vector index will be wiped + re-seeded as part of M6.3.
6. **`docs.delta.exchange`** unchanged — same Slate single-page doc.

No JS-rendering issues. No robots.txt blocks. No new infrastructure needed.

---

## 1. India guide — `guides.delta.exchange/delta-exchange-india-user-guide`

| | |
|---|---|
| Platform | GitBook (same as old guide) |
| Sitemap | `/sitemap.xml` → `/sitemap-pages.xml` → **24 URLs** |
| Server-rendered? | ✅ yes |
| Sample page size | ~260 KB raw |
| URL pattern | Stable slugs |
| Crawl plan | Same as old guides crawler — sitemap iter + cheerio normalize. Just the URL prefix changes from `/delta-exchange-user-guide/` to `/delta-exchange-india-user-guide/`. |

**Notable URLs** (compared to old global guide):
- New: `account-setup/create-account`, `account-setup/deposit`, `account-setup/withdrawal`, `account-setup/usd-inr-rate`
- New: `import` and `import/user-guide-and-rule-book` (likely an import-from-old-guide landing page)
- Removed: `trading-guide/leverage`, `trading-guide/profit-loss-math`, several `margin-explainer` sub-paths
- Kept: `derivatives-guide/options-guide`, `trading-guide/order-types`, `trading-guide/fair-price-marking`, `trading-guide/margin-explainer`, `trading-guide/portfolio-margin`, `trading-guide/cross-margin`, `trading-guide/deleveraging`, all `exchange-sop-and-policies/*`

**Live verified** that 4 of 5 sampled article URLs respond 200; `leverage` and `profit-loss-math` 404.

## 2. delta.exchange/support/solutions — the new support source

| | |
|---|---|
| Platform | Next.js page on `delta.exchange`, server-renders Freshdesk content |
| Article URL pattern | `/support/solutions/articles/<numeric_id>` — same Freshdesk numeric ID, no slug needed |
| Article body location | `__NEXT_DATA__.props.pageProps.articleContent.description` (HTML string) |
| Content equivalence | Verified identical to Freshdesk API output (article 80001014604 returned the same body). Same fields: `agent_id`, `attachments`, `description`, `description_text`, `status`, `updated_at`, etc. |
| Categories | `pageProps.categories` lists 22 categories (vs 24 in Freshdesk API; 2 are non-India) |
| Folder list | `/support` page exposes `pageProps.foldersByCategory` with 22 categories × ~3 folders each |
| Article list per folder | **Not exposed** in any SSR payload, no public `/api/` endpoint, no `_next/data/` path |

### How we'll enumerate article IDs

**The only feasible path** is to use Freshdesk's Solutions API as a tooling step:

```
GET /api/v2/solutions/categories            → list categories
GET /api/v2/solutions/categories/<id>/folders     → list folders (filter visibility=1)
GET /api/v2/solutions/folders/<id>/articles      → list articles (filter status=2 published)
```

This yields the 313 article IDs we already know about. Then for each ID, we fetch content from `https://www.delta.exchange/support/solutions/articles/<id>` and use that URL in audit findings.

**Why this is consistent with "don't use Freshdesk":**
- Audit findings link users to the delta.exchange URL (what they actually see).
- The audit measures content as rendered on delta.exchange.
- Freshdesk API is purely a directory service — we use it to know which IDs exist, not to source content.

### India portal filter

Categories have `visible_in_portals: number[]`. The India portal ID is `80000083721`. Filter rule for M6 crawler:
```ts
if (!category.visible_in_portals.includes(80000083721)) skip
```
Drops 2 categories (~30 articles) that aren't shown to India users on `delta.exchange/support`.

### Article URL format in audit findings

```
https://www.delta.exchange/support/solutions/articles/80001014604
```

Numeric ID only — no slug suffix. Pattern works for all articles.

## 3. docs.delta.exchange — unchanged

| | |
|---|---|
| Platform | GitHub Pages, Slate single-page doc |
| Page count | 1 URL |
| Crawl plan | Unchanged from M0/M2 — fetch root, walk H2/H3 hierarchy |
| Same as M0 | Yes; no migration needed for this source |

## 4. Source-name rename

`support_freshdesk` → `support` everywhere:

- `src/lib/types.ts` Source enum
- `src/lib/crawl/support_freshdesk.ts` → rename file to `support.ts`
- All Redis keys: `hash:support_freshdesk:*` → invalidate (wiped in M6.3); new keys are `hash:support:*`
- `vec_hash:support_freshdesk:*` → invalidate
- `issues:<old-freshdesk-url>` → invalidate
- Vector index metadata `source: 'support_freshdesk'` → `source: 'support'`
- Prompts: any explicit `support_freshdesk` mentions → `support`
- READMEs

## 5. Migration plan (M6.2 → M6.5)

### M6.2 — New crawlers + types
- Update `Source` enum: `'guides' | 'docs' | 'support'`
- Rename `src/lib/crawl/support_freshdesk.ts` → `src/lib/crawl/support.ts`. Keep Freshdesk API for ID enumeration; fetch content from delta.exchange URLs.
- Update `src/lib/crawl/guides.ts` to use the new India sitemap URL + URL prefix.
- Update `src/lib/crawl/normalize.ts` if needed (probably no changes — Next.js + GitBook profiles still apply).
- Update `embed-sot.ts`, `audit-batch.ts`, `m5-sweep.ts` for the new Source enum value.
- Tests: update fixtures, asserted URLs, source values.

### M6.3 — Wipe + re-seed
- Wipe Redis: `hash:guides:*`, `hash:docs:*`, `hash:support_freshdesk:*`, `vec_hash:*`, `issues:*`. (Vec_hash and issues wiped because URL keys changed.)
- Reset Upstash Vector index (delete all vectors).
- Re-embed: run `embed-sot.ts` for all 3 sources with new URLs. Expected ~750–900 chunks (24 guides + ~250 docs + ~280 support_india_visible).

### M6.4 — Full re-sweep
- `pnpm tsx src/scripts/m5-final-sweep.ts` (renamed in spirit to "m6 final"). Audits ~280 India-visible articles.
- Cost: ~$8.
- Time: ~15 min.

### M6.5 — Re-enable cron + commit + push + Vercel redeploy

## 6. Verdict

**Status: GO.**

All open questions resolved during M6.1. No new infrastructure needed. The Freshdesk-API-for-ID-enumeration choice is documented; if the team later builds a public article-list API on delta.exchange, swapping is a one-file change in `support.ts`.
