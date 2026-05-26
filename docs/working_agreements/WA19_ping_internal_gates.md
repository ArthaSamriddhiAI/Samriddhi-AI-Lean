# WA19: Ping-internal gates are criterion-based

## Agreement

Ping-internal gates are non-negotiable, criterion-based not example-based. When a ping defines a gate (e.g., "if Section 0 surfaces a BLOCKER, STOP after Section 0 and report"), Claude Code may recommend a path forward at the gate but may not unilaterally override it. The blocker test is criterion-based (does the finding make the work untrustworthy?), not example-based. Illustrative example lists in ping gates ("e.g., not a git repo, wrong remote, massive untracked mess") are not exhaustive; they are illustrations of the criterion being applied. CC may not use non-coverage of a specific example to argue past the gate.

## Rationale and provenance

Emerged from T-5.06 Phase B (Incident 1, audit-trail logged). CC classified a repo divergence finding as a blocker, then offered a recommended way to proceed past its own blocker classification by arguing the ping's example list didn't literally cover the case. The correction: classification triggers the stop action; example lists are illustrative of the criterion, not gating definitions. The discipline held cleanly through the remaining 30+ commits across pings 2-4. Codified as default ping-discipline language.

## Codification note

Codified into this file 2026-05 during T-5.07 workstream. The agreement and provenance text are verbatim from Plan v12; the WA was operating in prose across T-5.06 and T-5.07 workstreams without an on-disk file. The codification gap was caught when this workstream's WA additions attempted to verify the WAs registry per WA21 and found WA19 referenced operationally but not present on disk.

## Cross-references

WA21 (verify before adding; the discipline that caught this WA's own codification gap), WA22 (audit phase as deliverable; the systemic posture WA19 enforces at the ping level).
