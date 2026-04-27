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
