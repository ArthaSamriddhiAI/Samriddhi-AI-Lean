#!/usr/bin/env node
/* check-sdk-reach: structural no-spend proof for the WA12 gate hook.
 *
 * Walks the static import chain of the given entry script(s) and decides
 * whether the Anthropic SDK is reachable at runtime. The WA12 hook
 * (gate-sensitive-bash.sh) auto-allows a gated invocation ONLY when this
 * checker proves every invoked script has no SDK reach; the proof is the
 * import graph itself, not an agent's assertion. Anything the checker cannot
 * resolve fails CLOSED (treated as reach), so the human-in-the-loop marker
 * protocol remains the path for everything unproven.
 *
 * Rules:
 *  - import/require/dynamic-import/export-from specifiers are followed;
 *    `import type` and `export type ... from` are erased at runtime and are
 *    skipped (they cannot load code, so they cannot spend).
 *  - A specifier matching /anthropic/i is SDK reach.
 *  - Relative and tsconfig-alias ("@/") specifiers resolve within the repo
 *    and are descended into; unresolvable ones are reach (fail closed).
 *  - Bare package ids (node:*, npm deps) are not descended; only an
 *    anthropic-matching id is reach. The SDK enters this codebase solely via
 *    its own package id (lib/claude.ts, lib/agents/harness.ts), so package
 *    transitivity is not a spend vector here.
 *
 * Usage: node scripts/hooks/check-sdk-reach.mjs <projectRoot> <entry> [...entries]
 * Exit 0: every entry proven no-reach (prints the file count per entry).
 * Exit 1: reach or unresolvable (prints the offending chain).
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const [, , projectRoot, ...entries] = process.argv;
if (!projectRoot || entries.length === 0) {
  console.error("usage: check-sdk-reach.mjs <projectRoot> <entry> [...entries]");
  process.exit(1);
}

const EXTS = [".ts", ".tsx", ".mts", ".mjs", ".js", ".cjs"];

function resolveFile(spec, fromDir) {
  const base = path.resolve(fromDir, spec);
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, "index" + e))];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/* Value-loading specifiers only; type-only forms are erased at runtime. */
function specifiersOf(source) {
  const out = [];
  const push = (spec) => spec && out.push(spec);
  const importRe = /(^|\n)\s*import\s+(type\s+)?([^'"]*?from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(source)) !== null) {
    if (m[2]) continue; // import type ... : erased
    push(m[4]);
  }
  const exportRe = /(^|\n)\s*export\s+(type\s+)?(?:\*|\{[^}]*\})\s*from\s+['"]([^'"]+)['"]/g;
  while ((m = exportRe.exec(source)) !== null) {
    if (m[2]) continue; // export type ... from : erased
    push(m[3]);
  }
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = requireRe.exec(source)) !== null) push(m[1]);
  const dynRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(source)) !== null) push(m[1]);
  return out;
}

function analyse(entryRel) {
  const entryAbs = path.resolve(projectRoot, entryRel);
  if (!existsSync(entryAbs) || !statSync(entryAbs).isFile()) {
    return { ok: false, reason: "entry not found: " + entryRel };
  }
  const seen = new Set();
  const queue = [{ file: entryAbs, chain: [entryRel] }];
  while (queue.length > 0) {
    const { file, chain } = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    let source;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      return { ok: false, reason: "unreadable: " + chain.join(" -> ") };
    }
    for (const spec of specifiersOf(source)) {
      if (/anthropic/i.test(spec)) {
        return { ok: false, reason: "SDK reach: " + chain.join(" -> ") + " -> " + spec };
      }
      let resolved = null;
      if (spec.startsWith(".") ) {
        resolved = resolveFile(spec, path.dirname(file));
        if (!resolved) return { ok: false, reason: "unresolvable import (fail closed): " + chain.join(" -> ") + " -> " + spec };
      } else if (spec.startsWith("@/")) {
        resolved = resolveFile("./" + spec.slice(2), projectRoot);
        if (!resolved) return { ok: false, reason: "unresolvable alias import (fail closed): " + chain.join(" -> ") + " -> " + spec };
      } else {
        continue; // bare package or node builtin: not descended, not reach
      }
      if (!seen.has(resolved)) {
        queue.push({ file: resolved, chain: [...chain, path.relative(projectRoot, resolved)] });
      }
    }
  }
  return { ok: true, count: seen.size };
}

let allOk = true;
for (const entry of entries) {
  const res = analyse(entry);
  if (res.ok) {
    console.log("NO-REACH " + entry + " (" + res.count + " files walked)");
  } else {
    console.error("REACH-OR-UNPROVEN " + entry + ": " + res.reason);
    allOk = false;
  }
}
process.exit(allOk ? 0 : 1);
