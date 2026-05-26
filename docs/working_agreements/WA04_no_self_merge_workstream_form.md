# WA04: Consolidated into WA01

## Status

Stubbed out, 2026-05, during T-5.07 workstream.

## What this slot used to hold

This file previously contained a workstream-template duplicate of WA01
(no-self-merge / merge-discipline). It was self-described as awaiting
consolidation into WA01. The consolidation happens here: the duplicate
content is removed from this slot and WA01 is the canonical merge-discipline
agreement.

## Why the slot is preserved

The WA04 slot is preserved rather than the file deleted because in-repo
references to WA numbering (in code comments, ADRs, debt logs, and skill
files) follow the on-disk numbering. Removing the slot would cause cascading
renumbering. Leaving the slot stubbed lets the registry stay aligned with
those references while honestly recording that the original content was a
duplicate.

## Canonical merge-discipline agreement

See `WA01_no_self_merge.md` for the canonical agreement on merge discipline,
including the refined confirmation-gated squash-merge protocol and the
T-5.07 clarification on repository-level protection rule respect.

## Provenance

Surfaced during T-5.07 workstream's WA registry audit. The audit also
revealed a broader misalignment between on-disk numbering and Plan v12
canonical numbering for the WA04-WA09 band. The directional decision
(hybrid: Plan v12 reconciles to on-disk numbering, codified at planner-chat
handoff; repo-side change is only this WA04 consolidation) is recorded as
a planner-chat handoff item rather than executed in this workstream. The
broader reconciliation is deferred to a future workstream chat with
sufficient context to deliberate properly.

## Cross-references

WA01 (canonical merge-discipline agreement); WA21 (verify-before-adding,
the discipline that surfaced this consolidation gap during T-5.07).
