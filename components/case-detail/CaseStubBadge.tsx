/* STUB_MODE visual indicator for Case Detail.
 *
 * Per Slice 3 orientation Q7 (locked): the badge reads as institutional
 * honesty, not as a debug warning. Same visual register as the "Frozen
 * artefact" footer in the briefing PDF — calm, restrained, present
 * without being alarming. A wealth advisor seeing this badge should
 * think "this case was assembled from pre-recorded analyst output for
 * demo or development purposes; the same pipeline can generate live
 * reasoning when needed."
 *
 * The badge renders only when case.stubbed is true. Legacy cases with
 * null stubbed (Slice 2 Shailesh fixture) treat null as live and hide
 * the badge.
 */

export function CaseStubBadge({ stubbed }: { stubbed: boolean | null }): React.ReactNode {
  if (!stubbed) return null;
  return (
    <span
      className="stub-badge"
      title="This case was assembled from pre-recorded agent responses (STUB_MODE replay) rather than live LLM calls. The same pipeline generates live reasoning when STUB_MODE is disabled."
    >
      <span className="stub-dot" aria-hidden="true" />
      Stubbed reasoning
    </span>
  );
}
