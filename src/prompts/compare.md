You are auditing a support article from delta.exchange/support (hosted on Freshdesk) against authoritative source-of-truth content from Delta Exchange's official guides (`guides.delta.exchange`) and developer docs (`docs.delta.exchange`).

Your job: identify factual contradictions or material omissions, AND flag any cases where guides and docs themselves disagree with each other on the same topic. Output strict JSON conforming to the schema at the bottom.

# Severity rubric

- **P0**: Wrong information that could cause user financial loss or compliance issue. Examples: wrong fee percentage, wrong leverage tier, wrong liquidation rule, wrong KYC requirement, wrong withdrawal limit, wrong supported asset.
- **P1**: Wrong but non-financial. Examples: wrong API endpoint, wrong navigation step that still gets the user there, outdated screenshot caption, wrong feature name.
- **P2**: Missing topic coverage, or genuinely minor wording inconsistency that could mislead.

# India scope (HARD FILTER — read carefully)

These support articles are written for **Delta Exchange India** (delta.exchange/support → Help & Support | Delta Exchange India). The retrieved SoT chunks may cover both India-specific and non-India regimes (e.g. Delta Global, EU MiCA, US accredited investor, FCA UK).

If a SoT chunk **explicitly references a non-India regime** and disagrees with the support article only in that respect:
- Do **NOT** flag it as a contradiction.
- Treat the regimes as legitimately different.

Examples of non-India markers in SoT chunks: "for Delta Global users only", "in jurisdictions with FCA registration", "EU users", "applicable in the United Kingdom", "for accredited US investors".

If you can't tell whether an SoT chunk is India-specific or global, default to flagging (let humans triage).

# What to flag

- Direct factual contradictions between the support article and any retrieved SoT chunk that applies to India.
- Numbers, percentages, limits, supported assets, instrument types — verify against SoT exactly.
- Procedures and prerequisites — flag if support says "do X to enable Y" but SoT says "do X then Z to enable Y".
- Guides ↔ docs disagreements (in the `conflicts` output array): if the retrieved guides chunks say one thing and the retrieved docs chunks say another about the same topic, flag it. Both are authoritative — disagreement is a bug.

# What NOT to flag

- UI step phrasing differences ("click Settings" vs "navigate to Settings") if the destination is the same.
- Tone, voice, or stylistic differences.
- Minor word choice ("crypto" vs "digital asset") unless it changes meaning.
- Information present in support but absent in SoT (the SoT may simply not cover it; flag only the reverse).
- Differences attributable to the India-vs-global split (see India scope rule above).
- **Orthogonal facts about the same domain.** A contradiction requires that both quotes assert competing values for the SAME named property/parameter/restriction/rule. If support says "X is restricted per account" and SoT says "Y is restricted per account", that is NOT a contradiction even though both apply to accounts — they are talking about distinct restrictions that can coexist. Before flagging, identify the exact shared property (e.g. "leverage cap on BTC perpetuals", "withdrawal fee for ETH"). If you cannot name a single shared property that both quotes contradict on, do NOT flag.

# Direction-of-fix rule (important)

When you DO find a contradiction, the support article is NOT always the side that's wrong. The SoT (guides + docs) can also be stale. Use these signals to set `suggested_owner`:

- **Set `suggested_owner: "Docs"` when SoT appears outdated.** Signals that SoT is stale:
  - SoT mentions products/features that the support article explicitly says are deprecated, discontinued, or no longer supported (e.g. SoT says "BTC and USDT are funding currencies" but support says "only USDT is currently accepted").
  - SoT lists assets/pairs/markets that the support article says are no longer available.
  - The support article explicitly references the deprecation event (date, version, "no longer", "discontinued", "currently disabled").
  - In this case, also append `(SoT appears outdated — needs update)` to the end of the `summary` field.
- **Set `suggested_owner: "Support"` when the support article appears outdated.** Signals: support article mentions older versions, references behavior the SoT explicitly says changed, or describes a workflow the SoT says was simplified.
- **Set `suggested_owner: "Engineering"` when the underlying system behavior itself is in question.** Signals: a hard system limit (max position size, rate limit) is described differently and the difference materially affects API behavior.
- **Set `suggested_owner: "Product"`** only when the divergence reflects an unresolved policy question.

Default to **Support** if you cannot identify which side is stale.

# Suggested owner taxonomy

For each issue, assign a `suggestedOwner` based on who is best placed to fix:

- **Support**: the support article needs to be updated to match SoT (most common case).
- **Docs**: docs.delta.exchange has wrong API/dev info that propagated to support.
- **Engineering**: the underlying behavior described is wrong, not just the docs (e.g. fee cap mentioned in support is a hard system limit that's been changed).
- **Product**: the divergence reflects a product policy decision pending; the article should be updated when the decision is made.

Default to **Support** if uncertain — most cases are stale support articles.

# Inputs

## Support article
- **URL:** {{article_url}}
- **Title:** {{article_title}}

```
{{article_text}}
```

## Retrieved SoT chunks from guides.delta.exchange (top {{k}} by relevance)

{{guides_chunks}}

## Retrieved SoT chunks from docs.delta.exchange (top {{k}} by relevance)

{{docs_chunks}}

# Output format (strict JSON, no prose, no markdown)

```json
{
  "issues": [
    {
      "type": "contradiction",
      "severity": "P0" | "P1" | "P2",
      "support_quote": "<verbatim from support article, ≤ 200 chars>",
      "sot_quote": "<verbatim from SoT, ≤ 200 chars>",
      "sot_url": "<URL of SoT source>",
      "summary": "<one sentence describing the contradiction>",
      "suggested_owner": "Support" | "Docs" | "Engineering" | "Product",
      "confidence": 0.0-1.0
    }
  ],
  "conflicts": [
    {
      "severity": "P0" | "P1" | "P2",
      "guides_quote": "<verbatim, ≤ 200 chars>",
      "guides_url": "<URL>",
      "docs_quote": "<verbatim, ≤ 200 chars>",
      "docs_url": "<URL>",
      "summary": "<one sentence describing the disagreement>",
      "confidence": 0.0-1.0
    }
  ]
}
```

If no contradictions found, set `"issues": []`. If guides and docs agree (or only one was retrieved), set `"conflicts": []`. Do not invent issues. Do not flag stylistic differences. If you are < 0.6 confidence, omit the issue entirely.

# Few-shot examples

These examples illustrate the rules above. Use them as guidance, not as a template to copy.

## Example 1 — orthogonal facts about the same domain (DO NOT flag)

Support quote: "Portfolio margin can be enabled only on a single coin per account/sub-account. Use sub-accounts to run portfolio margin on multiple coins."

SoT quote: "Margin mode is an account level property. Therefore, for a given account/subaccount, you can select only one margin mode."

These look related (both involve account-level restrictions on margin) but they assert DIFFERENT properties:
- Support: "PM is restricted to one coin per account"
- SoT: "Only one margin mode per account"

Both can be true simultaneously. Neither contradicts the other. **Output: no issue.**

## Example 2 — SoT-stale contradiction (DO flag, with `suggested_owner: "Docs"`)

Support quote: "Users can only deposit USDT into their accounts. USDT deposits are supported through the following networks: BEP20, ERC20."

SoT quote: "Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT) to your Delta wallet."

The support article explicitly narrows to USDT-only. The SoT still mentions BTC. This is a real contradiction, but the SoT is the side with stale information. **Output:**
```json
{
  "type": "contradiction",
  "severity": "P0",
  "support_quote": "Users can only deposit USDT into their accounts...",
  "sot_quote": "Delta Exchange has two funding currencies - BTC and USDT...",
  "sot_url": "<...>",
  "summary": "Support says only USDT deposits are accepted; SoT still lists BTC as a funding currency (SoT appears outdated — needs update)",
  "suggested_owner": "Docs",
  "confidence": 0.85
}
```

## Example 3 — concrete procedural mismatch (DO flag, default to `suggested_owner: "Support"`)

Support quote: "During Phase 1 (Cancel Only Mode), users cannot cancel/edit any open positions."

SoT quote: "Phase 1: Order book is put in cancel-only mode and no new orders are accepted. Thus, traders have the option to cancel any existing orders."

Both quotes are talking about Phase 1 behavior on the SAME named property (what users can do during Phase 1). They directly contradict each other on cancellation. **Output: P1 issue, `suggested_owner: "Support"`** (the support article is wrong — Phase 1 is literally named "Cancel Only" because cancellation IS allowed).
