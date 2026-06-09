"use client";

/* v7.2 section 07 risk-reward hero cards with the 3Y/5Y horizon toggle.
 * The one client-interactive surface (see the ADR-0045 annotation). Beta,
 * R-squared, Information Ratio, and Jensen's alpha are 3Y-only in the data, so
 * on the 5Y view those cards show an honest "3Y only" rather than a blank or a
 * fabricated 5Y value (data debt: the partial-5Y limitation). */
import { useState } from "react";

type Stats = Record<string, number>;

const CARDS: Array<{ label: string; k3: string; k5: string | null; fmt: (n: number) => string }> = [
  { label: "Sharpe", k3: "sharpe_3y", k5: "sharpe_5y", fmt: (n) => n.toFixed(2) },
  { label: "Beta", k3: "beta_3y", k5: null, fmt: (n) => n.toFixed(2) },
  { label: "R-squared", k3: "r_squared_3y", k5: null, fmt: (n) => n.toFixed(2) },
  { label: "Info ratio", k3: "information_ratio_3y", k5: null, fmt: (n) => n.toFixed(2) },
  { label: "Jensen alpha", k3: "jensens_alpha_3y", k5: null, fmt: (n) => `${(n * 100).toFixed(1)}%` },
];

export function RrHero({ stats }: { stats: Stats }) {
  const [horizon, setHorizon] = useState<"3Y" | "5Y">("3Y");
  return (
    <div>
      <div className="rr-horizon-tabs" role="tablist" aria-label="Statistics horizon">
        {(["3Y", "5Y"] as const).map((h) => (
          <button key={h} type="button" className={horizon === h ? "is-active" : ""} onClick={() => setHorizon(h)} aria-selected={horizon === h}>
            {h}
          </button>
        ))}
      </div>
      <div className="rr-hero">
        {CARDS.map((c) => {
          const key = horizon === "3Y" ? c.k3 : c.k5;
          const has = key != null && typeof stats[key] === "number";
          return (
            <article className="rr-card" key={c.label}>
              <div className="rrc-label">{c.label}</div>
              <div className="rrc-val">{has ? c.fmt(stats[key as string]) : "3Y only"}</div>
              <div className="rrc-h">{has ? horizon : "no 5Y"}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
