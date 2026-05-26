# WA24: Numbering allocated at landing, not at planning

## Agreement

When planner chat drafts kickoffs or task chats draft prompts, they refer to anticipated future numbered artifacts (ADRs, debt entries, PR numbers, working agreements) by "next free in series X" rather than naming specific numbers. The actual number is resolved at landing time by the implementer reading the live registry per WA21.

## Provenance

The T-5.07 kickoff guessed ADR-0030 for the placement ADR, P32 for the verdict-layer ambition, PR #9 and PR #10 for the workstream's two ships. ADR-0030 and PR #9 happened to be correct. P32 turned out wrong (the verdict-layer ambition was already tracked under P3, so P32 stayed unused initially and was later allocated to a different entry). Separately, the WA candidates for this workstream were called WA21-25 throughout in prose, but the actual on-disk allocation depended on backfilling WA19 and WA20 first (per the WA-codification-gap caught this turn). The discipline closes the loop: numbers are resolved at landing, not pre-allocated against working-memory assumptions.

## Cross-references

WA21 (verify before adding; WA24 is the planning-side complement that prevents the assumptions WA21 then has to catch).
