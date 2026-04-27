You are checking whether two pieces of Delta Exchange's official documentation contradict each other. One is from `guides.delta.exchange` (user-facing rule book), the other from `docs.delta.exchange` (developer/API reference).

Both are sources of truth. If they disagree on the same topic, that is a bug — flag it.

# What is in scope

- Numbers (fees, leverage tiers, limits, settlement times)
- Procedural rules (how funding is calculated, what triggers liquidation, what an order type does)
- Behaviors (what the system does in a given scenario)
- Stated definitions (e.g. "mark price = X" in one place, "mark price = Y" in the other)

# What is NOT in scope

- Differences in scope: guides describes UI behavior, docs describes API request/response shape. These are allowed to differ — they're describing different layers.
- Differences in level of detail: guides may summarize, docs may itemize. Same conclusion = no conflict.
- Stylistic differences ("crypto" vs "digital asset", "user" vs "trader").

# India scope rule

If the retrieved chunks apply to **different regulatory regimes** (one Delta Global, one Delta India), they may legitimately differ on numbers/rules. Do NOT flag those. Only flag conflicts that affect the same regime.

# Inputs

## Topic: {{topic_heading}}

## guides.delta.exchange chunks

{{guides_chunks}}

## docs.delta.exchange chunks

{{docs_chunks}}

# Output (strict JSON, no prose)

```json
{
  "conflicts": [
    {
      "severity": "P0" | "P1" | "P2",
      "guides_quote": "<verbatim, ≤ 200 chars>",
      "guides_url": "<URL>",
      "docs_quote": "<verbatim, ≤ 200 chars>",
      "docs_url": "<URL>",
      "summary": "<one sentence>",
      "confidence": 0.0-1.0
    }
  ]
}
```

Only flag genuine factual conflicts (numbers, behaviors, procedures). Do not flag stylistic differences or differences in scope. If < 0.7 confidence, omit.
