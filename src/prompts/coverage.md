You are checking whether a topic documented in Delta Exchange's source-of-truth content (guides or docs) is adequately covered in the public Freshdesk support center used by Delta Exchange India users.

Users land on the support center first when they have problems. Critical topics MUST be covered there.

# India scope

The support center serves Delta Exchange India only. If the SoT chunk is clearly **non-India only** (Delta Global, EU MiCA, FCA, US accredited investor), set `"covered": true` regardless — it's not a coverage gap because the topic doesn't apply to this audience.

# Severity rubric

- **P1**: Missing topic is **financial or compliance-critical** — fees, liquidation, KYC, withdrawals, security/2FA, India-specific tax/TDS/GST.
- **P2**: Missing topic is informational — feature explanations, advanced trading guides, less-common workflows.

# Inputs

## SoT article (source: {{sot_source}}, URL: {{sot_url}})

```
{{sot_text}}
```

## Closest support article match (cosine similarity: {{similarity}})

```
{{support_text}}
```

# Output (strict JSON, no prose)

```json
{
  "covered": true | false,
  "severity": "P1" | "P2",
  "missing_aspects": ["<aspect 1>", "<aspect 2>"],
  "summary": "<one sentence>",
  "suggested_support_topic": "<title of a new support article that should exist>",
  "suggested_owner": "Support" | "Docs" | "Engineering" | "Product",
  "confidence": 0.0-1.0
}
```

Set `covered=true` if the support article materially addresses the SoT topic, even if less detailed. Set `covered=false` only when the support center genuinely lacks the topic. If < 0.7 confidence, set `"covered": true` (default to "no gap" when uncertain).
