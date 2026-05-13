/* Fixture content for new cases.
 *
 * Per the approved scaffolding spec (orientation Q5 option a), every case
 * created via the New Case flow renders the Shailesh Bhatt diagnostic in
 * the Case Detail screen regardless of which investor or snapshot was
 * picked. The DB row carries only metadata (severity, headline, status,
 * a stringified content blob); the full rendering content lives in the
 * Case Detail component as static fixture content (commit 11).
 *
 * This module is the single source of truth for the headline copy and
 * severity that show in the case list immediately after creation.
 */

export const NEW_CASE_FIXTURE = {
  workflow: "s2" as const,
  severity: "escalate" as const,
  headline:
    "Wrapper over-accumulation: four PMS strategies, aggregate 39.4% of liquid AUM",
  status: "ready" as const,
  contentTag: "shailesh-bhatt-diagnostic-fixture-v1",
};

export type NewCaseFixture = typeof NEW_CASE_FIXTURE;
