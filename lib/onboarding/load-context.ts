/* Onboarding context: the snapshot fund universe, the shared alias map, and
 * the anchor month (Package 07, B4). One load path for the server actions
 * and the offline verify so both reconcile against exactly the same world.
 * Refuses a snapshot without the real_data_build stamp (the D14 failure
 * mode); the alias source is the committed corpus run manifest, the same
 * artifact the generator wrote.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { loadSnapshot } from "../agents/snapshot-loader";
import type { AliasMap } from "../ingestion/reconcile";
import type { UniverseRow } from "./build-record";

export type OnboardingContext = {
  universe: UniverseRow[];
  aliases: AliasMap;
  anchorMonth: string;
  snapshotId: string;
};

let cached: OnboardingContext | null = null;

export async function loadOnboardingContext(): Promise<OnboardingContext> {
  if (cached) return cached;
  const snapshotId = "t0_q2_2026";
  const snap = await loadSnapshot(snapshotId);
  const meta = (snap.snapshot_metadata ?? {}) as Record<string, unknown>;
  if (!meta["real_data_build"]) {
    throw new Error(
      "onboarding refuses a snapshot without the real_data_build stamp; " +
        "restore the real t0 before onboarding (data repo ADR-0003).",
    );
  }
  const sd = String(meta["snapshot_date"] ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) throw new Error("snapshot_date missing");
  const mk = sd.slice(0, 7);
  const anchorMonth =
    mk.slice(5) === "01"
      ? String(Number(mk.slice(0, 4)) - 1) + "-12"
      : mk.slice(0, 5) + String(Number(mk.slice(5)) - 1).padStart(2, "0");

  const universe: UniverseRow[] = snap.mf_funds.map((f) => ({
    fundName: f.fund_name,
    monthlyNav: (f.monthly_nav ?? {}) as Record<string, number>,
    amfiCode: f.amfi_code,
    sebiCategory: f.sebi_category,
  }));

  const aliases = (
    JSON.parse(
      readFileSync(
        path.join(process.cwd(), "fixtures", "ingestion-corpus", "a1_a5", "ecas_run_manifest.json"),
        "utf-8",
      ),
    ) as { aliases: AliasMap }
  ).aliases;

  cached = { universe, aliases, anchorMonth, snapshotId };
  return cached;
}
