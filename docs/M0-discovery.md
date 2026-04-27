# M0 — Discovery findings

**Date:** 2026-04-27
**Probed by:** Read-only HTTP requests; raw HTML cached in `.m0-cache/` (gitignored).

## TL;DR

**Status: GO with replan.** All sites are scrapable, no JS rendering needed, no `robots.txt` blocks. Three architectural decisions made during M0:

1. **Audit four sources, not three.** `guides`, `docs`, `support_freshdesk`, `support_legacy` — both support surfaces are live and need to stay in sync.
2. **`docs.delta.exchange` is one URL, not many.** Slate-style single-page doc. Crawl architecture for docs becomes "fetch once, chunk by heading", not "iterate sitemap". One-file change vs. the original plan.
3. **Freshdesk API authenticated.** Resolved during M0 — agent `charandeep.kapoor@delta.exchange`, role `support_agent`. 24 categories, 76 folders, **344 articles** in scope.

### Final corpus size (per source)

| Source | URLs | Notes |
|---|---|---|
| `guides.delta.exchange` | 30 | GitBook, sitemap-driven |
| `docs.delta.exchange` | 1 (→ ~250+ heading-chunks) | Slate single-page |
| `support_freshdesk` (deltaexchange.freshdesk.com) | **344 articles**, 76 folders, 24 categories | API; visibility=1, status=2 (published) |
| `support_legacy` (www.delta.exchange/{support, blog/support, support-categories}) | ~84 URLs | Next.js, sitemap-driven |
| **Total** | **~460 articles + 1 single-page doc** | First-sweep audit footprint |

### Cost ballpark

First full sweep at this footprint, ~5 KB input + ~500 token output per audit call against Sonnet 4.6: **~$10–$15**. Daily incrementals (only changed articles): **~$0.30–$0.60/day** unless content churns hard.

---

## 1. `guides.delta.exchange` — GitBook

| | |
|---|---|
| Platform | GitBook |
| `robots.txt` | ✅ allows AI/search/training; sitemap declared |
| Sitemap | `https://guides.delta.exchange/delta-exchange-user-guide/sitemap.xml` → 1 child sitemap → **30 article URLs** |
| Server-rendered? | ✅ yes; `<title>` and body present in raw HTML |
| Sample page size | 293 KB raw / 170 KB visible text (lots of inline CSS/JS — heavy normalization needed) |
| URL pattern | Stable slug paths (e.g. `.../trading-guide/leverage`) |
| Crawl plan | Iterate sitemap, fetch each URL, normalize to plain text. Strip GitBook nav, sidebar, theme chrome. |

Sample URLs (all 30):
- `delta-exchange-user-guide` (root)
- `derivatives-guide/options-guide`, `option-spreads`, `move`, `turbo-options`
- `derivatives-guide/spread-contracts-guide`, `interest-rate-swaps-guide`, `defi-index`
- `market-makers-guide`, `market-maker-protection`
- `trading-guide/{trade-life-cycle, fair-price-marking, leverage, profit-loss-math, margin-explainer, order-types, deleveraging}`
- `exchange-sop-and-policies/{allowed-trading-bands, market-disruption, trade-annulment, special-events-handling}`

## 2. `docs.delta.exchange` — Slate-style single-page API doc

| | |
|---|---|
| Platform | GitHub Pages (`<title>Page not found · GitHub Pages</title>` on 404), Slate-style API doc |
| `robots.txt` | ❌ 404 — no robots policy. We assume permissive (it's owned by Delta) but flag for confirmation. |
| Sitemap | ❌ 404 — no sitemap exists |
| Server-rendered? | ✅ yes — entire content in the initial HTML payload |
| Page count | **1 URL.** The whole API reference is one HTML document. |
| Page size | 1,023 KB raw / 276 KB visible text |
| Heading inventory | 37 H1, 188 H2, 234 H3, 346 elements with `id` attribute |
| URL pattern | Deep links are `https://docs.delta.exchange/#anchor-id` |
| Crawl plan | **Architecture change:** fetch `https://docs.delta.exchange/` once, parse heading hierarchy, emit each H2/H3 section as a `Chunk` with URL = `https://docs.delta.exchange/#${id}`. No sitemap iteration. |

**Implication for `src/lib/crawl/docs.ts`:** instead of `for url in sitemap` it becomes `fetch / once → walk heading tree → emit chunks`. Implementation is simpler than guides, just structurally different. Update M2 chunker to handle "the whole site is one page" case via the heading-walk path.

**Implication for issue surfacing:** when a P0 cites a docs source, the URL we link in Slack/Notion is `https://docs.delta.exchange/#some-anchor`. Verify the anchor IDs are stable across deploys (Slate generates them from heading text — they're stable as long as headings don't change wording).

## 3. The support center — split landscape ⚠️

This was the M0 discovery I want to escalate. Two distinct support surfaces are live:

### 3a. `deltaexchange.freshdesk.com` (Freshdesk portal)

| | |
|---|---|
| Public portal | ✅ live at `https://deltaexchange.freshdesk.com/support/home` (HTTP 200) |
| API endpoint | `https://deltaexchange.freshdesk.com/api/v2/solutions/...` |
| API key auth | ✅ **resolved** — second key authenticates as `charandeep.kapoor@delta.exchange` (role `support_agent`) |
| Inventory (live) | **24 categories · 76 folders · 344 articles** (sum of `folder.articles_count` across all categories) |
| Top category | "FAQs" (97 articles, 15 folders) |
| Server-rendered? | ✅ yes; one sample article (80001014604) returned 22 KB HTML with body content |
| URL pattern | `.../support/solutions/articles/{numeric-id}-{slug}` — numeric IDs are stable |
| Sample article | "Important update for Delta Exchange Global users in India" (#80001153662) — confirms India-only repositioning is in scope |

### 3b. `www.delta.exchange/support` and `www.delta.exchange/blog/support/...` (custom Next.js section)

| | |
|---|---|
| Platform | Next.js (`data-next-head` attribute), part of the marketing site |
| Listed in sitemap | ✅ yes — index `/support`, 14 `/support-categories/<slug>`, ~70+ `/blog/support/<slug>` articles |
| Server-rendered? | ✅ yes |
| `<title>` | "Help & Support \| Delta Exchange India" — confirms India scope |
| Content character | Mix of FAQ-style articles and dated promo articles (e.g. `bitcoin-halving-offer`, `delta-exchange-first-anniversary-offer`, `usdt-deposit-offer-2020`) |
| URL pattern | Stable slug paths |

### What to do about this

There are three credible interpretations:

| Interpretation | What we audit | Tradeoff |
|---|---|---|
| **Freshdesk is the current source of truth.** `delta.exchange/support` is legacy and slowly being deprecated. | Only Freshdesk articles. | Cleanest scope. But user-facing Google traffic still hits the legacy URLs — drift there is also a problem. |
| **`delta.exchange/support` is the live public face.** Freshdesk is internal/agent-only and may be a CMS. | Only `delta.exchange/blog/support/*` and `/support-categories/*`. | Matches what real users see. But the API is harder than Freshdesk's. |
| **Both are live and need to stay in sync.** | Audit both, plus flag any Freshdesk↔delta.exchange same-topic disagreements as a third bug class. | Most complete. ~2× the cost and noise. |

**Default I'd pick:** option 3 — audit both. The cost is mild and the value is high (we'd catch the legacy URLs drifting silently from Freshdesk). I'd add `support_legacy` as a fourth source alongside `guides`, `docs`, `support`.

But: this is your call. I don't know your team's roadmap for which surface is being deprecated.

## 4. Other findings

### 4a. India scope is confirmed at the URL/content level

- `delta.exchange/blog/support/<...>` page `<title>` = "Help & Support | Delta Exchange India".
- Freshdesk article #80001153662 = "Important update for Delta Exchange Global users in India".
- KYC-related URLs reference Indian tax/regulatory regime.

When auditing, the comparator prompt should de-prioritize false positives where docs.delta.exchange (which is global API spec) diverges from support (India consumer guidance) on jurisdiction-specific topics. I'll bake this into `compare.md` at M3.

### 4b. `robots.txt` posture

- `guides.delta.exchange`: explicitly permissive, including AI training.
- `docs.delta.exchange`: no `robots.txt` (404). Assume permissive (Delta-owned).
- `delta.exchange`: permissive on `/support`, `/blog/support`, `/support-categories`. Disallow paths are app/options/account/signup-flow — none of which we touch.
- `deltaexchange.freshdesk.com`: not probed; Freshdesk's default `robots.txt` permits crawling of public Solutions content.

No blockers. We'll set a polite `User-Agent: DeltaSupportAudit/0.1 (+contact@delta.exchange)` and rate-limit to ~2 RPS per host.

### 4c. URL stability

- Guides: stable slugs.
- Docs: anchor IDs derived from heading text (Slate convention) — stable as long as headings don't get rewritten.
- Freshdesk: numeric article IDs in URL — stable across slug rename.
- delta.exchange/support: slug-based, stable as long as the post slug isn't renamed.

For hash keys: use `{source}:{stable-id}` → guides slug, docs anchor, Freshdesk numeric ID, blog slug. Documented for M1.

### 4d. `support.delta.exchange` returns 403

Tried `https://support.delta.exchange/` — 403, no body. Not in scope; the Freshdesk portal is at `deltaexchange.freshdesk.com`.

---

## Decisions resolved during M0

| Question | Decision |
|---|---|
| Freshdesk API auth | ✅ resolved — second key works |
| Canonical support source | **Both** — audit `support_freshdesk` AND `support_legacy` |
| Docs heading stability | Rare → use anchor-based URLs; hash key for docs chunks = heading_path |

## Architectural deltas to fold into M1+

- **Sources type expands to 4:** `'guides' | 'docs' | 'support_freshdesk' | 'support_legacy'`.
- **`docs.ts` crawler** is a single-fetch, single-URL with heading-walk chunker. Keep `Article` type unchanged but `lastModified` will be unavailable (the page doesn't expose it). For change detection, hash the normalized text of the entire page; if any chunk's heading_path content changes, mark its chunk as dirty for re-embedding.
- **Hash key:** `hash:<source>:<stable-id>` where `stable-id` is source-specific:
  - `guides`: full slug path, e.g. `trading-guide/leverage`
  - `docs`: heading_path within the single page, e.g. `api-reference#authentication`
  - `support_freshdesk`: numeric article id, e.g. `80001014604`
  - `support_legacy`: blog slug or support-category slug, e.g. `blog/support/how-are-trading-fees-calculated`
- **Issue type's `sotUrl`** is source-specific:
  - `guides`: `https://guides.delta.exchange/<slug>`
  - `docs`: `https://docs.delta.exchange/#anchor`
  - `support_freshdesk`: `https://deltaexchange.freshdesk.com/support/solutions/articles/<id>-<slug>`
  - `support_legacy`: `https://www.delta.exchange/<slug>`
- **Freshdesk crawler:** use API. Iterate `/api/v2/solutions/categories` → for each, `/api/v2/solutions/categories/<id>/folders` → for each, `/api/v2/solutions/folders/<id>/articles`. Filter `status === 2` (published) and `visibility === 1` (all users). Throttle to ~2 req/s. The HTML-scraping fallback is documented but not implemented unless the API breaks.
- **Conflict detector (M3) gains a 4-way concern:** guides↔docs (original); plus support_freshdesk↔support_legacy as a fifth issue class. Cost is bounded — only same-topic clusters are compared.

## Verdict

**Status: GO.**

All open questions from M0 resolved during M0. M1 can start immediately.

---

## Addendum (2026-04-27, mid-M1) — `support_legacy` dropped

While preparing test fixtures for M1, deeper inspection of the legacy URLs revealed:

- 4 of 6 sampled `/blog/support/<slug>` URLs return **HTTP 404** (`maker-and-taker-fees`, `how-can-i-cancel-my-withdrawal`, etc.).
- Of the 2 that returned 200, the Next.js `__NEXT_DATA__` payload showed `articleContent: null` and `categoryArticles: []` — i.e., the page handler renders the support landing page when the slug doesn't match.
- `https://www.delta.exchange/support` itself is a thin Next.js wrapper: its `pageProps` contains `categories` and `foldersByCategory` (mirrored from the Freshdesk Solutions API server-side). It has no article content of its own — its only outbound links are to other parts of `delta.exchange/app`, not to articles.

**Conclusion:** `support_legacy` is not a separate content corpus. The ~84 `/blog/support/*` and `/support-categories/*` URLs in the sitemap are stale/broken and serve no original content. The only canonical support source is Freshdesk.

**Architecture revised:** 3 sources, not 4. `Source = 'guides' | 'docs' | 'support_freshdesk'`. The `support_legacy.ts` crawler is removed from the M1 plan. Fixtures dropped: `tests/fixtures/support_legacy-blog.html`, `tests/fixtures/sitemap-delta.xml`.

If the team later builds a separate user-facing support site (outside Freshdesk), we'd add a new source then.
