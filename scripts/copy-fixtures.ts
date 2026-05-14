/* Copy the 9 quarterly snapshot JSONs from the Factual Foundation Continued
 * folder into fixtures/snapshots/ for local diagnostic-pipeline use.
 *
 * Source location:
 *   ../08 - Factual Foundation Continued/Data Snapshots/snapshots/
 *
 * Destination:
 *   ./fixtures/snapshots/
 *
 * The destination is gitignored; the snapshots are roughly 11 MB each and
 * total roughly 99 MB. Reproducible by re-running this script.
 *
 * Run with: npm run fixtures:copy
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");

const SOURCE_DIR = path.resolve(
  PROJECT_ROOT,
  "..",
  "08 - Factual Foundation Continued",
  "Data Snapshots",
  "snapshots",
);

const DEST_DIR = path.resolve(PROJECT_ROOT, "fixtures", "snapshots");

const EXPECTED = [
  "snapshot_t0_q2_2026.json",
  "snapshot_t1_q3_2026.json",
  "snapshot_t2_q4_2026.json",
  "snapshot_t3_q1_2027.json",
  "snapshot_t4_q2_2027.json",
  "snapshot_t5_q3_2027.json",
  "snapshot_t6_q4_2027.json",
  "snapshot_t7_q1_2028.json",
  "snapshot_t8_q2_2028.json",
];

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

async function main() {
  await fs.mkdir(DEST_DIR, { recursive: true });

  let bytesCopied = 0;
  let copiedCount = 0;
  let skippedCount = 0;

  for (const filename of EXPECTED) {
    const src = path.join(SOURCE_DIR, filename);
    const dest = path.join(DEST_DIR, filename);

    let srcStat;
    try {
      srcStat = await fs.stat(src);
    } catch {
      console.error(`  ! Missing at source: ${filename}`);
      process.exitCode = 1;
      continue;
    }

    let destStat;
    try {
      destStat = await fs.stat(dest);
    } catch {
      destStat = null;
    }

    if (destStat && destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
      console.log(`  · ${filename} already present (${formatBytes(destStat.size)})`);
      skippedCount += 1;
      continue;
    }

    await fs.copyFile(src, dest);
    bytesCopied += srcStat.size;
    copiedCount += 1;
    console.log(`  + ${filename} copied (${formatBytes(srcStat.size)})`);
  }

  console.log(`\n  Source: ${SOURCE_DIR}`);
  console.log(`  Destination: ${DEST_DIR}`);
  console.log(`  Copied: ${copiedCount} files, ${formatBytes(bytesCopied)}`);
  console.log(`  Skipped (up to date): ${skippedCount} files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
