# Delta Support Audit — Product team explainer

A 4-view Whimsical board for the product team. Each block below is Mermaid code — paste each one onto a fresh Whimsical canvas section and Whimsical auto-converts it into a native flowchart.

**Audience:** non-technical PMs.
**Key takeaway:** cost (~$15/month at typical churn) and how it scales.

---

## How to build this board in Whimsical

1. Create a new Whimsical board titled **"Delta Support Audit — How it works"**.
2. Type a section header on the canvas: **"1. What it does"**.
3. Copy block 1 below, click on the canvas under the header, paste. Whimsical converts to a flowchart.
4. Repeat for blocks 2, 3, 4 with their respective headers.
5. Drop the "PM talking points" text (at the bottom of this file) as a sticky/text card to the right of the board.

---

## Block 1 — What it does (architecture overview)

```mermaid
flowchart LR
    Guides[📘 Guides<br>guides.delta.exchange<br>30 articles] --> Robot
    Docs[📗 Developer Docs<br>docs.delta.exchange<br>~250 sections] --> Robot
    Support[📞 Support Center<br>delta.exchange/support<br>313 published articles] --> Robot

    Robot{{🤖 Daily AI Reviewer<br>Runs at 04:00 IST<br>Reads only what changed<br>~$0.30 per day}}

    Robot --> Slack[💬 Slack alert<br>#delta-support-audit<br>Only when a P0 is found]
    Robot --> Notion[📝 Notion page<br>Full report<br>Updated every day]

    Slack --> You[👤 You triage<br>Route to the right team]
    Notion --> You

    Cost[💰 Cost summary<br>First sweep: ~$10<br>Daily run: ~$0.30<br>Monthly: ~$15<br>Even at 10x churn: ~$45/mo]

    classDef src fill:#e1f5ff,stroke:#0277bd,color:#000
    classDef bot fill:#fff3cd,stroke:#f57c00,color:#000
    classDef out fill:#d4edda,stroke:#28a745,color:#000
    classDef person fill:#f3e5f5,stroke:#7b1fa2,color:#000
    classDef cost fill:#fff5e6,stroke:#ff6f00,color:#000

    class Guides,Docs,Support src
    class Robot bot
    class Slack,Notion out
    class You person
    class Cost cost
```

Paste instruction: *Copy this block, click on the Whimsical canvas, paste.*

---

## Block 2 — What happens at 4am every day (sequence)

```mermaid
sequenceDiagram
    actor Cron as ⏰ Vercel<br>4:00 IST
    participant Robot as 🤖 Audit Robot
    participant FD as 📞 Freshdesk
    participant Memory as 🧠 Memory<br>(yesterday)
    participant AI as 🎯 Claude Sonnet
    participant Truth as 📚 Guides + Docs
    participant Slack as 💬 Slack
    participant Notion as 📝 Notion

    Cron->>Robot: Wake up, time to audit
    Robot->>FD: Hand me all 313 support articles
    FD-->>Robot: Here you go
    Robot->>Memory: Which ones changed since yesterday?
    Memory-->>Robot: Usually only 0 to 5

    loop For each changed article only
        Robot->>Truth: Find relevant guide/doc passages
        Truth-->>Robot: Top 10 matches
        Robot->>AI: Compare. Are these consistent?
        AI-->>Robot: List of contradictions with severity
        Robot->>Memory: Was this issue here yesterday?
        Memory-->>Robot: New / still-open / resolved
    end

    Robot->>Slack: Post grouped P0 alert if new P0 found
    Robot->>Notion: Replace page with full report
    Note over Robot: Total runtime ~60 seconds<br>Total cost ~$0.30
```

Paste instruction: *Copy this block, paste under the "2. Daily run" header.*

---

## Block 3 — How the AI judges one article

```mermaid
flowchart TD
    Start([📄 One support article<br>e.g. 'How can I cancel my withdrawal?']) --> Hash{Did the article<br>change since<br>yesterday?}
    Hash -->|No| Skip([✓ Skip — no work to do])
    Hash -->|Yes| Embed[🔍 Find the most<br>relevant guide and<br>doc passages]
    Embed --> Prompt[🎯 Ask Claude:<br>'Compare these passages.<br>Are there contradictions?']
    Prompt --> Parse{Did Claude<br>return a valid<br>response?}
    Parse -->|No| LogErr[📋 Log error<br>continue with next article]
    Parse -->|Yes| Filter[🔧 Drop findings<br>below 60% confidence]
    Filter --> Dedup{Did we already<br>see this exact<br>issue yesterday?}
    Dedup -->|First time| New[🆕 NEW: P0 -> Slack alert]
    Dedup -->|Same as yesterday| Open[🔄 Still open<br>not re-alerted]
    Dedup -->|Was open yesterday<br>not today| Resolved[✅ Auto-resolved<br>fix shipped]

    classDef good fill:#d4edda,stroke:#28a745,color:#000
    classDef warn fill:#fff3cd,stroke:#ffc107,color:#000
    classDef new fill:#f8d7da,stroke:#dc3545,color:#000
    classDef step fill:#e1f5ff,stroke:#0277bd,color:#000

    class Skip,Resolved,Open good
    class LogErr warn
    class New new
    class Embed,Prompt,Filter step
```

Paste instruction: *Copy this block, paste under the "3. Per-article pipeline" header.*

---

## Block 4 — What you do when something is found

```mermaid
flowchart LR
    Found[🆕 New P0<br>flagged this morning] --> Slack[💬 Slack message<br>shows summary,<br>support quote,<br>SoT quote]
    Slack --> Open[👀 You open Notion<br>for full context]
    Open --> Decide{What kind<br>of issue is it?}

    Decide -->|Support article<br>has wrong info| S[👨‍💼 Support team<br>Update Freshdesk article]
    Decide -->|Guides or docs<br>are stale| D[📝 Docs team<br>Update<br>guides.delta.exchange]
    Decide -->|System actually<br>behaves wrong| E[⚙️ Engineering<br>Fix the<br>underlying behavior]
    Decide -->|Policy is undecided| P[💼 Product<br>Decide policy<br>then update docs]

    S --> Done([✅ Fix ships<br>Audit auto-marks<br>resolved tomorrow])
    D --> Done
    E --> Done
    P --> Done

    classDef alert fill:#f8d7da,stroke:#dc3545,color:#000
    classDef route fill:#e1f5ff,stroke:#0277bd,color:#000
    classDef done fill:#d4edda,stroke:#28a745,color:#000

    class Found,Slack alert
    class S,D,E,P route
    class Done,Open done
```

Paste instruction: *Copy this block, paste under the "4. Triage routing" header.*

---

## PM talking points (drop as a sticky note next to the board)

**The pitch in one sentence:** A daily robot reads our support center, compares each article to the official guides and developer docs, flags real contradictions, and tells us which team should fix it.

**What makes it cheap:** it only re-reads what changed (about 0-5 articles per day on average). The AI cost is dominated by the *first sweep* of all 313 articles, which is a one-time ~$10. After that, the daily run is ~30¢.

**What it catches well:**
- Numbers that disagree (fee %, leverage cap, withdrawal limit)
- Procedures that disagree (what happens during maintenance, how KYC works)
- Topics our docs say exist but support hasn't covered yet (coverage gaps, run weekly)

**What it does NOT catch:**
- UI screenshots that drifted from the actual app
- Tone or wording style differences
- Region-specific edge cases (we explicitly skip Delta-Global-only content because we audit the India support center)

**Real example from the trial run** (use this when you demo): Our trial flagged that one support article said "users can only deposit USDT", while the user guide still said "BTC and USDT". The robot correctly identified that the *guide* was outdated (BTC deposits were discontinued) and routed the fix to the docs team — not the support team. That's the kind of routing accuracy that comes "free" with the prompt logic.

**Cost scaling table** (paste as a small table sticky):

| Scenario | Daily cost | Monthly |
|---|---|---|
| Quiet day (0 articles changed) | $0 | — |
| Typical (1-5 changed) | $0.05 - $0.25 | ~$5 |
| Busy week (10-15 changed/day) | $0.50 - $0.75 | ~$18 |
| Major rewrite (30+/day for a week) | $1 - $1.50 | ~$45 (one week only) |
| Plus weekly coverage sweep | +$3/week | +$12 |

**Where it runs:** Vercel (Hobby plan, free tier — well within free function-minute limits).

**Who built it:** internal tool, no external vendors except Anthropic (the AI) and Upstash (the memory store). Both pay-per-use, no commitments.
