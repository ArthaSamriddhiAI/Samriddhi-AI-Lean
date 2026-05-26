# WA23: Conventions inherited by reference, not by re-listing

## Agreement

Kickoff documents and task-chat prompts name the canonical conventions location (the WAs directory in `docs/working_agreements/`) and the task chat reads from source. Kickoffs do not re-list WAs from the planner's working memory, because the re-listing introduces drift: the lister works from memory; the canonical files are the truth. Specific WAs relevant to a task can be cited by number (`WA10`, `WA19`) without restating their content.

## Provenance

The T-5.07 kickoff listed several WAs (WA10, WA12, WA13, WA15, WA16, WA18, WA19, WA20) by content rather than by reference. Some of the listings were precise; some were imprecise enough that the task chat operated against a slightly drifted version of the convention. Specifically: the kickoff's quote of WA1 ("No self-merge by Claude Code. PR goes to Shubham for review and squash-merge.") had been superseded by the refined WA1 (confirmation-gated squash-merge); operating against the older listing for several turns introduced silent drift. The discipline of "name the file, don't re-list the content" prevents this.

## Cross-references

WA21 (verify before adding; WA23 is the kickoff-author-side complement to WA21's executor-side discipline).
