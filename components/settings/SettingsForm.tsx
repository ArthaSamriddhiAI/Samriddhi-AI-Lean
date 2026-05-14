"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Setting = {
  apiKey: string | null;
  modelChoice: string;
  advisorName: string;
  firmName: string;
  tokenBudgetPerCase: number;
};

type Counts = { investors: number; snapshots: number; cases: number };

type Props = {
  initialSetting: Setting;
  initialCounts: Counts;
};

type TestState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; latencyMs: number; model: string }
  | { kind: "err"; message: string };

const MODEL_OPTIONS = [
  { value: "claude-opus-4-7", label: "claude-opus-4-7" },
  { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6" },
  { value: "claude-haiku-4-5-20251001", label: "claude-haiku-4-5" },
];

export function SettingsForm({ initialSetting, initialCounts }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState(initialSetting.apiKey ?? "");
  const [modelChoice, setModelChoice] = useState(initialSetting.modelChoice);
  const [advisorName, setAdvisorName] = useState(initialSetting.advisorName);
  const [firmName, setFirmName] = useState(initialSetting.firmName);
  const [tokenBudget, setTokenBudget] = useState(initialSetting.tokenBudgetPerCase);
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [busy, setBusy] = useState<"none" | "load" | "clear">("none");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const saveField = async (patch: Partial<Setting>) => {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavedAt(
      new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) + " IST"
    );
  };

  const testConnection = async () => {
    setTest({ kind: "pending" });
    try {
      const res = await fetch("/api/anthropic-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const json = (await res.json()) as
        | { ok: true; latencyMs: number; model: string }
        | { ok: false; error: string };
      if (json.ok) {
        setTest({ kind: "ok", latencyMs: json.latencyMs, model: json.model });
      } else {
        setTest({ kind: "err", message: json.error });
      }
    } catch (e) {
      setTest({ kind: "err", message: e instanceof Error ? e.message : "Network error" });
    }
  };

  const loadDemoData = async () => {
    setBusy("load");
    const res = await fetch("/api/demo-data", { method: "POST" });
    const json = (await res.json()) as { snapshots: number; investors: number };
    setCounts({ snapshots: json.snapshots, investors: json.investors, cases: counts.cases });
    setBusy("none");
    router.refresh();
  };

  const clearDemoData = async () => {
    if (!confirm("Clear all cases, investors, and snapshots? Settings will be preserved. This cannot be undone in slice 1.")) {
      return;
    }
    setBusy("clear");
    const res = await fetch("/api/demo-data", { method: "DELETE" });
    const json = (await res.json()) as { cases: number; investors: number; snapshots: number };
    setCounts({ snapshots: 0, investors: 0, cases: 0 });
    setBusy("none");
    router.refresh();
  };

  return (
    <>
      <section className="settings-section">
        <h2>Model provider</h2>
        <p className="section-sub">
          The API key the diagnostic uses for case generation. Stored as plaintext in the local demo
          database per the approved single-user threat model.
        </p>

        <div className="kv-row">
          <div className="k">
            API key
            <span className="helper">Anthropic-compatible. Used for the read-only chat and case synthesis.</span>
          </div>
          <div className="v">
            <div className="row-actions">
              <input
                type="password"
                className="text-input mono"
                value={apiKey}
                placeholder="sk-ant-…"
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={() => saveField({ apiKey: apiKey || null })}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={testConnection}
                disabled={!apiKey || test.kind === "pending"}
              >
                {test.kind === "pending" ? "Testing…" : "Test connection"}
              </button>
            </div>
            {test.kind === "ok" && (
              <div className="test-result ok">
                <span className="dot" />
                Connected · {test.latencyMs} ms · model {test.model}
              </div>
            )}
            {test.kind === "err" && (
              <div className="test-result err">
                <span className="dot" />
                Failed: {test.message}
              </div>
            )}
          </div>
        </div>

        <div className="kv-row">
          <div className="k">
            Model
            <span className="helper">Default model for case synthesis. Read-only chat uses the same.</span>
          </div>
          <div className="v">
            <select
              className="select-native"
              value={modelChoice}
              onChange={(e) => {
                setModelChoice(e.target.value);
                saveField({ modelChoice: e.target.value });
              }}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="kv-row">
          <div className="k">
            Token budget per case
            <span className="helper">
              Combined input + output across all agents. Circuit breaker against runaway
              loops, not a budget target; routine cases run at 90-120k tokens.
            </span>
          </div>
          <div className="v">
            <input
              type="number"
              className="text-input mono"
              value={tokenBudget}
              min={10000}
              step={10000}
              onChange={(e) => setTokenBudget(Number(e.target.value))}
              onBlur={() => saveField({ tokenBudgetPerCase: tokenBudget })}
            />
            <span className="text-[11.5px] text-ink-4 font-mono ml-2">tokens</span>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Demo data</h2>
        <p className="section-sub">
          Six pre-seeded investor profiles and nine snapshot metadata rows. Reload to reset the demo
          to first-launch state.
        </p>

        <div className="kv-row">
          <div className="k">
            Investor profiles
            <span className="helper">
              Malhotra, Iyengar, Bhatt, Menon, Surana, Sharma. Holdings markdown and two onboarding
              transcripts included.
            </span>
          </div>
          <div className="v">
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadDemoData}
                disabled={busy !== "none"}
              >
                {busy === "load" ? "Loading…" : "Load demo data"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={clearDemoData}
                disabled={busy !== "none"}
              >
                {busy === "clear" ? "Clearing…" : "Clear demo data"}
              </button>
            </div>
            <div className="demo-status">
              <span className="dot" />
              {counts.investors > 0
                ? `Loaded · ${counts.investors} investors · ${counts.snapshots} snapshots · ${counts.cases} cases`
                : "Empty"}
            </div>
          </div>
        </div>

        <div className="kv-row">
          <div className="k">
            Model portfolio
            <span className="helper">Indicative aggressive long-term reference (foundation §2).</span>
          </div>
          <div className="v">
            <div className="row-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled>
                View
              </button>
              <span className="text-[11.5px] text-ink-4 font-mono">65 / 25 / 7 / 3 split · slice 5</span>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Workspace</h2>
        <p className="section-sub">Identifying details for the briefing footer and PDF metadata.</p>

        <div className="kv-row">
          <div className="k">Advisor name</div>
          <div className="v">
            <input
              type="text"
              className="text-input"
              value={advisorName}
              onChange={(e) => setAdvisorName(e.target.value)}
              onBlur={() => saveField({ advisorName })}
            />
          </div>
        </div>

        <div className="kv-row">
          <div className="k">Firm</div>
          <div className="v">
            <input
              type="text"
              className="text-input"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              onBlur={() => saveField({ firmName })}
            />
          </div>
        </div>

        <div className="kv-row">
          <div className="k">
            PDF letterhead
            <span className="helper">Header band on every generated briefing.</span>
          </div>
          <div className="v">
            <div className="row-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled>
                Upload
              </button>
              <span className="text-[11.5px] text-ink-4">Slice 7 polish</span>
            </div>
          </div>
        </div>
      </section>

      <div className="save-bar">
        <span>{savedAt ? `All changes saved · ${savedAt}` : "No changes yet"}</span>
      </div>
    </>
  );
}
