"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

/* Generating screen.
 *
 * Polls /api/cases/[id]/status every 1.5s. While the pipeline is running,
 * an animated progress list signals the rough stage so the wait feels
 * deliberate. The stages are approximate (the actual pipeline runs E1-E7
 * in parallel, not sequentially); the screen is operational copy, not a
 * literal progress indicator. The real-time accurate state lives on the
 * server.
 *
 * Success: redirect to /cases/[id].
 * Failure: surface errorMessage with a Retry button (POST to retry
 * endpoint, then return to generating state).
 */

type Props = {
  caseId: string;
  investorName: string;
  snapshotLabel: string;
  initialStatus: string;
  initialError: string | null;
};

const STAGES = [
  "Loading investor profile and portfolio snapshot",
  "Computing concentration, liquidity, and deployment metrics",
  "Activating evidence agents in parallel",
  "Synthesising the briefing per foundation section 6",
];

export function GeneratingScreen({ caseId, investorName, snapshotLabel, initialStatus, initialError }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [stageIdx, setStageIdx] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const startedAt = useRef<number>(Date.now());

  /* Bump the active stage every ~12s so the list animates through. The
   * stages are not literal; the pipeline runs agents in parallel. */
  useEffect(() => {
    if (status !== "generating") return;
    const t = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
    }, 12000);
    return () => clearInterval(t);
  }, [status]);

  /* Poll status every 1.5s while generating. */
  useEffect(() => {
    if (status !== "generating") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status: string; errorMessage: string | null };
        if (cancelled) return;
        setStatus(data.status);
        setErrorMessage(data.errorMessage);
        if (data.status === "ready") {
          router.push(`/cases/${caseId}`);
        }
      } catch {
        /* Network blip; retry on next tick. */
      }
    };
    const t = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [caseId, status, router]);

  const handleRetry = async () => {
    setRetrying(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/retry`, { method: "POST" });
      if (!res.ok) throw new Error(`Retry failed: ${res.status}`);
      startedAt.current = Date.now();
      setStageIdx(0);
      setStatus("generating");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  };

  const elapsedSec = Math.round((Date.now() - startedAt.current) / 1000);

  if (status === "failed") {
    return (
      <div className="max-w-[720px] mx-auto p-12">
        <div className="eyebrow mb-2">Diagnostic pipeline</div>
        <h2 className="text-2xl font-semibold mb-3">Generation failed</h2>
        <p className="text-ink-3 mb-2">{investorName} · Snapshot {snapshotLabel}</p>
        <p className="text-ink-3 mb-4">The pipeline could not complete. Most failures are transient API issues; a retry usually resolves them.</p>
        <pre className="bg-ink-7 p-3 rounded text-[12.5px] whitespace-pre-wrap mb-4">{errorMessage ?? "Unknown error"}</pre>
        <button type="button" className="btn btn-primary" onClick={handleRetry} disabled={retrying}>
          {retrying ? "Retrying…" : "Retry pipeline"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[640px] mx-auto p-12">
      <div className="eyebrow mb-2">Diagnostic pipeline</div>
      <h2 className="text-2xl font-semibold mb-3">Generating briefing</h2>
      <p className="text-ink-3 mb-1">{investorName}</p>
      <p className="text-ink-4 text-small mb-8">Snapshot {snapshotLabel} · The briefing renders in about thirty seconds.</p>

      <ol className="space-y-3 mb-8">
        {STAGES.map((label, i) => {
          const done = i < stageIdx;
          const active = i === stageIdx;
          return (
            <li key={i} className="flex items-start gap-3">
              <span
                className="mt-[2px] inline-block w-[14px] h-[14px] rounded-full"
                style={{
                  background: done ? "var(--color-accent)" : active ? "var(--color-warn)" : "var(--color-ink-6)",
                  outline: active ? "2px solid var(--color-warn)" : undefined,
                  outlineOffset: active ? "2px" : undefined,
                }}
              />
              <span
                className="text-[13.5px]"
                style={{ color: done ? "var(--color-ink-2)" : active ? "var(--color-ink-1)" : "var(--color-ink-4)" }}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="text-small text-ink-4 font-mono">
        Elapsed {elapsedSec}s · Case frozen at completion · Live updates by polling
      </div>
    </div>
  );
}
