"use server";

/* Server actions for the onboarding workbench (Package 07, B4). Thin
 * wrappers: parse uploads through the B3 adapters, rebuild the workbench
 * state through the pure core, and commit only after re-running the gate
 * server-side (the client's green tiles are presentation; the server
 * recomputes before any write). Local-only effects: tmp files for adapter
 * parsing, the local SQLite row at commit. Zero model calls anywhere.
 */

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { parseEcasPdf } from "@/lib/ingestion/ecas-pdf";
import { parseText, parseXlsx } from "@/lib/ingestion/table-adapters";
import type { ParsedDocument } from "@/lib/ingestion/types";
import {
  buildCanonicalRecord,
  buildWorkbench,
  type AdvisorInputs,
  type WorkbenchState,
} from "@/lib/onboarding/build-record";
import { loadOnboardingContext } from "@/lib/onboarding/load-context";

export type ParsedBundle = {
  docs: ParsedDocument[];
  fileSummaries: Array<{ name: string; summary: string }>;
};

const SPECIMENS: Record<string, string[]> = {
  /* Tier-1 synthetic demo specimens from the committed corpus, so the flow
   * is reviewable end to end without hunting for files. */
  krishnan: [
    "fixtures/ingestion-corpus/a6_a14/ecas_06_sandeep_krishnan.pdf",
    "fixtures/ingestion-corpus/a6_a14/altformat_06_sandeep_krishnan.xlsx",
    "fixtures/ingestion-corpus/a6_a14/meeting_notes_06_sandeep_krishnan.md",
  ],
  iyengar_email: ["fixtures/ingestion-corpus/a1_a5/altformat_02_lalitha_iyengar.txt"],
};

async function parseOne(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return parseEcasPdf(filePath);
  if (ext === ".xlsx") return parseXlsx(filePath);
  return parseText(filePath);
}

function summarise(d: ParsedDocument): string {
  if (d.format === "ecas_pdf") return d.folios.length + " folios";
  const n = d.holdings.length;
  return n + " row" + (n === 1 ? "" : "s") + (d.warnings.length ? "; " + d.warnings.length + " warning(s)" : "");
}

export async function parseSpecimen(name: string): Promise<ParsedBundle> {
  const files = SPECIMENS[name];
  if (!files) throw new Error("unknown specimen: " + name);
  const docs: ParsedDocument[] = [];
  for (const f of files) docs.push(await parseOne(path.join(process.cwd(), f)));
  return { docs, fileSummaries: docs.map((d) => ({ name: d.sourceFile, summary: summarise(d) })) };
}

export async function parseUploads(formData: FormData): Promise<ParsedBundle> {
  const files = formData.getAll("documents") as File[];
  if (files.length === 0) throw new Error("no documents supplied");
  const tmp = mkdtempSync(path.join(tmpdir(), "samriddhi-onboard-"));
  try {
    const docs: ParsedDocument[] = [];
    for (const file of files) {
      const target = path.join(tmp, path.basename(file.name));
      writeFileSync(target, Buffer.from(await file.arrayBuffer()));
      docs.push(await parseOne(target));
    }
    return { docs, fileSummaries: docs.map((d) => ({ name: d.sourceFile, summary: summarise(d) })) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export async function computeWorkbench(
  docs: ParsedDocument[],
  inputs: AdvisorInputs,
): Promise<WorkbenchState> {
  const ctx = await loadOnboardingContext();
  return buildWorkbench(docs, ctx.universe, ctx.aliases, ctx.anchorMonth, inputs);
}

export type CommitResult =
  | { ok: true; investorId: string; holdings: number; totalCr: number }
  | { ok: false; error: string };

export async function commitInvestor(
  docs: ParsedDocument[],
  inputs: AdvisorInputs,
): Promise<CommitResult> {
  const ctx = await loadOnboardingContext();
  const state = buildWorkbench(docs, ctx.universe, ctx.aliases, ctx.anchorMonth, inputs);
  if (!state.clears) {
    return { ok: false, error: "the gate is not green: " + state.blockers.join("; ") };
  }
  const statements = docs.filter((d) => d.format === "ecas_pdf");
  const { record, derived } = buildCanonicalRecord(state, inputs, ctx.universe, statements);

  const existing = await prisma.investor.findUnique({ where: { id: inputs.investorId } });
  if (existing) return { ok: false, error: "investor id '" + inputs.investorId + "' already exists" };

  const initials = inputs.investorName
    .replace(/^(Dr|Mrs|Mr|Smt)\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  await prisma.investor.create({
    data: {
      id: inputs.investorId,
      name: inputs.investorName,
      displayInitials: initials || "??",
      metaLine: "Onboarded via the reconciliation workbench",
      structureLine: "Mandate capture pending (follows the lock)",
      riskAppetite: "pending mandate",
      timeHorizon: "pending mandate",
      modelCell: "pending_mandate",
      liquidAumCr: record.totalLiquidAumCr,
      liquidityTier: "pending mandate",
      location: "",
      profileMd:
        "## " + inputs.investorName + "\n\nOnboarded " + state.anchorMonth +
        " via the reconciliation workbench (gate green: " +
        state.tiles.map((t) => t.label).join(", ") +
        "). Holdings derive from the canonical transaction-bearing record (ADR-0052); mandate capture follows the lock.",
      holdingsJson: JSON.stringify(derived),
      mandateJson: null,
      onboardingTranscript: inputs.notes || null,
      dataTier: inputs.tier,
      canonicalJson: JSON.stringify({
        record,
        provenance: {
          anchorMonth: state.anchorMonth,
          snapshotId: ctx.snapshotId,
          gate: state.tiles,
          identityStrings: state.identityStrings,
          acceptedMismatches: Object.entries(inputs.resolutions)
            .filter(([, v]) => "acceptMismatch" in v)
            .map(([label, v]) => ({ label, note: (v as { acceptMismatch: string }).acceptMismatch })),
          parkedRows: state.parked.map((p) => ({ label: p.rawLabel, provenance: p.provenance })),
        },
      }),
    },
  });
  return {
    ok: true,
    investorId: inputs.investorId,
    holdings: record.holdings.length,
    totalCr: record.totalLiquidAumCr,
  };
}
