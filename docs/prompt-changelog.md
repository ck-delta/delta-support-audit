# Prompt changelog

Every edit to `src/prompts/*.md` is logged here with its observed FP rate impact.

## 2026-04-27 — compare.md v2 (M5 iteration 1)

**Sample size for v1 baseline:** 20 articles (trial sweep)
**Findings on v1:** P0=5, P1=4, P2=5 (14 total)

**v1 triage tally:**
| | TP | FP | GUIDES_STALE | AMB |
|---|---|---|---|---|
| P0 | 0 | 1 | 3 | 1 |
| P1 | 3 | 1 | 0 | 0 |
| P2 | 0 | 3 | 2 | 0 |

**FP rate (P0+P1) on v1:** 22% (2 of 9 pure FPs); 67% if GUIDES_STALE counted as direction-of-fix error.

**Changes:**
1. Added "Orthogonal facts about the same domain" rule under "What NOT to flag" — defines that a contradiction requires both quotes to assert competing values for the SAME named property/parameter/restriction. Targets the conflation pattern (P0-4, P1-4, P2-1, P2-3, P2-4).
2. Added "Direction-of-fix rule" section — instructs Sonnet to set `suggested_owner: "Docs"` when SoT shows signs of being outdated (e.g. SoT mentions products the support article says are deprecated). Also instructs adding `(SoT appears outdated — needs update)` to summary. Targets GUIDES_STALE pattern (P0-1, P0-2, P0-3, P2-2, P2-5).
3. Added 3 few-shot examples at the bottom: orthogonal-facts (negative), SoT-stale (positive with Docs owner), procedural-mismatch (positive with Support owner).

**Token cost impact:** prompt grew from ~3K to ~4K chars (~250 extra tokens per call). Marginal — < 5% cost increase.

**FP rate target after v2:** < 10% on P0+P1.

## v2 evaluation result (2026-04-27)

Re-ran on the same 20 articles. Cost: $0.46.

**v2 findings:** P0=4, P1=3, P2=0, conflicts=1 (down from 14 total in v1 to 8 total in v2).

**v2 triage tally:**
| | TP | FP | AMB |
|---|---|---|---|
| P0 | 4 | 0 | 0 |
| P1 | 2 | 1 | 0 |
| Conflicts | 1 | 0 | 0 |
| Total | 7 | 1 | 0 |

**v2 FP rate (P0+P1):** 1/7 = **14%** (or 12.5% including the conflict). Above the <10% target but a major improvement over v1's 22% pure FP / 67% wrong-attribution rate.

**Wins in v2:**
- All BTC/USDT GUIDES_STALE cases now correctly attributed to `suggested_owner: "Docs"` with "(SoT appears outdated — needs update)" appended to summary.
- Concept-conflation FPs (one-coin-vs-one-margin-mode, positions-vs-orders) eliminated by orthogonal-facts rule.
- All 5 v1 P2 findings (mostly conflations) correctly suppressed in v2.
- New TP caught (article #80001014604) that v1 missed.
- New TP conflict caught (guides↔docs phase model disagreement) that v1 missed.

**Remaining FP at v2:** one omission-style flag (support article doesn't list "add more margin to open positions" capability that SoT mentions). Could be fixed by adding a "do not flag omissions" rule in v3, but the user accepted the 12.5% rate as ship-quality.

**Shipped at v2 with documented 12.5% FP rate.** No v3 iteration.
