/* Stub-mode infrastructure.
 *
 * STUB_MODE is a permanent first-class feature of the lean MVP: pre-recorded
 * agent responses replace live Anthropic SDK calls when the flag is active.
 * Use cases: local development without API keys, debugging without spend,
 * CI, demo-mode reliability when the live API is degraded.
 *
 * Resolution precedence:
 *   Setting.stubMode (DB row, non-null) > env STUB_MODE > false.
 * The Settings UI toggle (commit 8) writes Setting.stubMode; absent that
 * row override, the env value wins. Same pattern for STUB_RECORD except
 * there is no DB override; env is the only knob.
 *
 * Storage: fixtures/stub-responses/<case-fixture-id>/<agent-id>.json. The
 * file holds the raw SDK response text plus usage stats, NOT the parsed/
 * validated agent output. This keeps stub replay symmetric with live: the
 * harness's JSON-extract-then-validate pipeline runs identically in both
 * modes, so a stub-loaded response exercises the same parsing surface as
 * a live response and can fail in the same ways.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const STUB_DIR = path.resolve(process.cwd(), "fixtures", "stub-responses");

export type StubKey = {
  /** The persistent case-fixture id, e.g. "c-2026-05-14-sharma-01". */
  caseFixtureId: string;
  /** The agent id, e.g. "e1_listed_fundamental_equity" (matches skill file name). */
  agentId: string;
};

export type StubResponse = {
  /** ISO timestamp of when this stub was recorded. */
  recorded_at: string;
  /** The model that produced the response, e.g. "claude-sonnet-4-6". */
  model: string;
  /** Echoed for human readability. */
  skill_id: string;
  /** Echoed for human readability. */
  case_fixture_id: string;
  /** The assistant's text response, verbatim, as the live SDK returned it. */
  text: string;
  /** "end_turn", "max_tokens", "stop_sequence", "tool_use". Stub-loader fails
   * fast on "max_tokens" to mirror the harness's live-mode behaviour. */
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

/* Settings-row override wins when explicit; otherwise the env knob applies. */
export async function resolveStubMode(): Promise<boolean> {
  try {
    const setting = await prisma.setting.findUnique({ where: { id: 1 } });
    if (setting?.stubMode !== null && setting?.stubMode !== undefined) {
      return setting.stubMode;
    }
  } catch {
    /* DB unavailable (e.g., scripts run without a DB connection). Fall
     * through to env. */
  }
  return process.env.STUB_MODE === "true";
}

export function resolveStubRecord(): boolean {
  return process.env.STUB_RECORD === "true";
}

function stubPath(key: StubKey): string {
  return path.join(STUB_DIR, key.caseFixtureId, `${key.agentId}.json`);
}

/* Decide whether the caller should short-circuit to a sentinel state.
 *
 * Added in Slice 4 for IC1 sentinel-on-missing-stub handling per
 * orientation §2 and §7: when STUB_MODE is active and the stub fixture
 * for a given role is missing, the IC1 orchestrator returns a
 * structured "infrastructure ready, awaiting live generation" payload
 * rather than throwing. Evidence-agent calls retain the throw-on-
 * missing-stub behaviour and do not use this helper; the IC1 layer is
 * the only consumer because Slice 4 ships code-complete-without-content
 * for IC1 per the Option A funding-aware posture.
 *
 * Returns true ONLY if both: STUB_MODE is active AND the stub file is
 * missing. In live mode or with the stub present, returns false (the
 * caller proceeds to the runner). */
export async function shouldUseSentinel(key: StubKey): Promise<boolean> {
  if (!(await resolveStubMode())) return false;
  const filePath = stubPath(key);
  try {
    await fs.access(filePath);
    return false;
  } catch {
    return true;
  }
}

/* Read a stub fixture from disk. Throws a clear, developer-facing error if
 * the fixture is missing, instructing the operator to disable STUB_MODE
 * and re-run live, or to record stubs first. */
export async function loadStub(key: StubKey): Promise<StubResponse> {
  const filePath = stubPath(key);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as StubResponse;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `Stub fixture missing for ${key.caseFixtureId}/${key.agentId}. ` +
          `Expected at ${filePath}. ` +
          `Options: (a) disable STUB_MODE in .env or Settings and re-run live to record, ` +
          `or (b) run the Slice 3 commit-9 stub-generation gate to seed the fixture set.`,
      );
    }
    throw err;
  }
}

/* Write a stub fixture if STUB_RECORD is active and no fixture exists yet
 * at the target path. Idempotent: subsequent runs of the same agent on the
 * same case-fixture-id are no-ops, so re-running live mode does not
 * overwrite an existing recorded stub. */
export async function recordStubIfMissing(opts: {
  key: StubKey;
  model: string;
  text: string;
  stopReason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}): Promise<void> {
  if (!resolveStubRecord()) return;
  const filePath = stubPath(opts.key);
  try {
    await fs.access(filePath);
    return;
  } catch {
    /* file does not exist; proceed to write */
  }
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const payload: StubResponse = {
    recorded_at: new Date().toISOString(),
    model: opts.model,
    skill_id: opts.key.agentId,
    case_fixture_id: opts.key.caseFixtureId,
    text: opts.text,
    stop_reason: opts.stopReason,
    usage: opts.usage,
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}
