/* setup-data: fetch the proprietary data assets this repo depends on from the
 * private Samriddhi-AI-Data-Snapshots repo into the local working tree.
 *
 * The public repo does not track snapshot / curated data (ADR-0027). This
 * script reads the pinned release tag from data-version.txt, downloads that
 * release's assets via `gh`, verifies each file against the release manifest's
 * SHA256, and copies each asset to its target path. Run once after cloning
 * (and again whenever data-version.txt changes):
 *
 *   npm run setup-data
 *
 * Requires the GitHub CLI (`gh`) installed and authenticated with an account
 * that has read access to ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots.
 *
 * Safe to re-run: it verifies every asset before placing any, and overwrites
 * the target files in place. No network calls beyond `gh`; no Anthropic API.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_REPO = "ArthaSamriddhiAI/Samriddhi-AI-Data-Snapshots";
const ROOT = process.cwd();
const VERSION_FILE = path.resolve(ROOT, "data-version.txt");

type ManifestAsset = {
  filename: string;
  sha256: string;
  size_bytes: number;
  target_path: string;
};

type Manifest = {
  version: string;
  assets: ManifestAsset[];
};

function fail(message: string): never {
  console.error("\nsetup-data FAILED: " + message + "\n");
  process.exit(1);
}

function ghInstalled(): boolean {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}

function isSymlink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/* Refuse to place assets through symlinks (data repo ADR-0003, ADR-0027
 * amendment). A symlink at any path component of a target redirects the copy
 * outside this working tree; on 2026-06-09 exactly that overwrote the data
 * repo clone's real t0 with the synthetic release blob. The sibling-clone
 * symlink remains a documented read-only dev override; setup-data refuses to
 * write through it rather than silently following it. */
function symlinkInTargetPath(targetAbs: string): string | null {
  const rel = path.relative(ROOT, targetAbs);
  if (rel.startsWith("..")) return null;
  let cur = ROOT;
  for (const seg of rel.split(path.sep)) {
    cur = path.join(cur, seg);
    if (isSymlink(cur)) return cur;
  }
  return null;
}

function main(): void {
  // 1. gh installed
  if (!ghInstalled()) {
    fail(
      "GitHub CLI (`gh`) is not installed or not on PATH. Install it from " +
        "https://cli.github.com/, run `gh auth login`, then retry.",
    );
  }

  // 2. gh authenticated
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
  } catch {
    fail("`gh` is not authenticated. Run `gh auth login` and retry.");
  }

  // 3. access to the private data repo
  try {
    execFileSync("gh", ["repo", "view", DATA_REPO], { stdio: "ignore" });
  } catch {
    fail(
      "You need GitHub access to " +
        DATA_REPO +
        ". Contact Shubham to request access (and run `gh auth login` if you " +
        "recently switched accounts).",
    );
  }

  // 4. pinned version
  if (!existsSync(VERSION_FILE)) {
    fail("data-version.txt not found at repo root. Run this from the repo root.");
  }
  const version = readFileSync(VERSION_FILE, "utf-8").trim();
  if (!version) fail("data-version.txt is empty; expected a release tag.");

  console.log(
    "setup-data: fetching " + DATA_REPO + " release " + version + " ...",
  );

  // 5. download into a temp dir (one retry on transient network failure)
  const tmp = mkdtempSync(path.join(tmpdir(), "sads-"));
  let downloaded = false;
  for (let attempt = 1; attempt <= 2 && !downloaded; attempt++) {
    try {
      execFileSync(
        "gh",
        [
          "release",
          "download",
          version,
          "--repo",
          DATA_REPO,
          "--dir",
          tmp,
          "--clobber",
        ],
        { stdio: "inherit" },
      );
      downloaded = true;
    } catch {
      if (attempt === 2) {
        rmSync(tmp, { recursive: true, force: true });
        fail(
          "release download failed for tag " +
            version +
            ". Check your network and that the tag exists in " +
            DATA_REPO +
            ".",
        );
      }
      console.warn("  download attempt " + attempt + " failed; retrying ...");
    }
  }

  // 6. manifest
  const manifestPath = path.join(tmp, "manifest.json");
  if (!existsSync(manifestPath)) {
    rmSync(tmp, { recursive: true, force: true });
    fail("manifest.json is missing from the release; cannot verify or place data.");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;

  // 7. verify EVERY asset before placing any (fail-safe: no partial population)
  for (const asset of manifest.assets) {
    const src = path.join(tmp, asset.filename);
    if (!existsSync(src)) {
      rmSync(tmp, { recursive: true, force: true });
      fail("expected asset missing from the download: " + asset.filename);
    }
    const hash = createHash("sha256").update(readFileSync(src)).digest("hex");
    if (hash !== asset.sha256) {
      rmSync(tmp, { recursive: true, force: true });
      fail(
        "SHA256 mismatch for " +
          asset.filename +
          " (expected " +
          asset.sha256 +
          ", got " +
          hash +
          "). Aborting without placing files.",
      );
    }
  }

  // 7.5 refuse to write through symlinks, before placing anything (ADR-0003)
  for (const asset of manifest.assets) {
    const dest = path.resolve(ROOT, asset.target_path);
    const link = symlinkInTargetPath(dest);
    if (link) {
      rmSync(tmp, { recursive: true, force: true });
      fail(
        "refusing to place " +
          asset.target_path +
          " because " +
          path.relative(ROOT, link) +
          " is a symbolic link. Writing through it would modify whatever the " +
          "link points at (on 2026-06-09 this overwrote the data repo clone's " +
          "real t0 with the synthetic release blob; see the data repo's " +
          "ADR-0003 and this repo's ADR-0027 amendment). Either keep the link " +
          "as your dev override and do NOT run setup-data (the linked clone " +
          "serves the data), or remove the link and re-run setup-data to " +
          "fetch real copies.",
      );
    }
  }

  // 8. place each asset at its target path (relative to repo root)
  let totalBytes = 0;
  for (const asset of manifest.assets) {
    const src = path.join(tmp, asset.filename);
    const dest = path.resolve(ROOT, asset.target_path);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    totalBytes += statSync(dest).size;
  }

  // 9. cleanup + report
  rmSync(tmp, { recursive: true, force: true });
  console.log(
    "\nsetup-data OK: placed " +
      manifest.assets.length +
      " files (" +
      humanSize(totalBytes) +
      ") for data version " +
      manifest.version +
      ".",
  );
  console.log(
    "Next: run `npm run db:push` (first time) then `npm run db:seed`.",
  );

  if (manifest.version === "v1.0.0-frozen") {
    console.warn(
      "\nWARNING: v1.0.0-frozen's snapshot_t0_q2_2026.json is the synthetic " +
        "ADR-0014-era series, superseded by the real t0 (ADR-0042). No " +
        "v2.0.0 release has been published yet, so this is the only fetchable " +
        "version; the real t0 exists on the data repo's main branch. See the " +
        "ADR-0027 amendment and the data repo's ADR-0003 before doing any " +
        "data-sensitive work against this t0.",
    );
  }
}

main();
