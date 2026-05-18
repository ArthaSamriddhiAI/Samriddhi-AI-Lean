"use client";

/* Concept C accordion primitive (locked design).
 *
 * Severity pill leads each row; elevated severity carries a coloured left
 * rule; the headline takeaway sits in Source Serif so the row reads at a
 * glance. Only Escalate (esc) rows open by default; the open set is
 * derived from severity, never a per-case id list. Flag rows stay closed
 * with their pill visible. Bulk Expand all / Collapse all.
 *
 * The DOM and class names are the locked mockup's contract; the matching
 * styles live in app/globals.css (.ar-c-*, .ar-controls, .ar-bulk).
 */

import { useMemo, useState, type ReactNode } from "react";
import type { Severity } from "@/lib/format/case-accordion";

export type AccordionItem = {
  id: string;
  num?: string;
  title: ReactNode;
  headline?: ReactNode;
  severity: Severity;
  /** Pill text override; defaults to the severity's label. */
  status?: string;
  figure?: ReactNode;
  body: ReactNode;
};

const SEVERITY_LABEL: Record<Severity, string> = {
  esc: "Escalate",
  flg: "Flag",
  inf: "Info",
  ok: "Pass",
  muted: "Note",
};

function pillClass(sev: Severity): string {
  return sev === "muted" ? "mut" : sev;
}

function ChevR({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function useOpenSet(items: AccordionItem[]) {
  /* Default-open is derived: any row at Escalate severity. The mockup
   * hardcoded ids for the prototype; production reads it off the data. */
  const initial = useMemo(
    () => new Set(items.filter((it) => it.severity === "esc").map((it) => it.id)),
    [items],
  );
  const [open, setOpen] = useState<Set<string>>(initial);
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const expandAll = () => setOpen(new Set(items.map((it) => it.id)));
  const collapseAll = () => setOpen(new Set<string>());
  return { open, toggle, expandAll, collapseAll };
}

type Props = {
  items: AccordionItem[];
  eyebrow: string;
  count?: string;
};

export function Accordion({ items, eyebrow, count }: Props) {
  const { open, toggle, expandAll, collapseAll } = useOpenSet(items);
  return (
    <div>
      <div className="ar-controls">
        <div className="eye">
          {eyebrow}
          {count != null && <span className="ct">{count}</span>}
        </div>
        <div className="ar-bulk">
          <button onClick={expandAll} type="button">
            Expand all
          </button>
          <span className="sep">·</span>
          <button onClick={collapseAll} type="button">
            Collapse all
          </button>
        </div>
      </div>
      <div className="ar-c">
        {items.map((it) => {
          const isOpen = open.has(it.id);
          return (
            <div
              key={it.id}
              className={`ar-c-item sev-${it.severity} ${isOpen ? "is-open" : ""}`}
            >
              <button
                className="ar-c-head"
                onClick={() => toggle(it.id)}
                type="button"
                aria-expanded={isOpen}
              >
                <span className={`ar-c-pill ${pillClass(it.severity)}`}>
                  {it.status || SEVERITY_LABEL[it.severity]}
                </span>
                <span className="ar-c-titleblock">
                  <span className="ar-c-title-row">
                    {it.num && <span className="ar-c-num">{it.num}</span>}
                    <span className="ar-c-title">{it.title}</span>
                  </span>
                  {it.headline && <span className="ar-c-headline">{it.headline}</span>}
                </span>
                <span className="ar-c-aside">
                  {it.figure && <span>{it.figure}</span>}
                  <span className="chev">
                    <ChevR />
                  </span>
                </span>
              </button>
              {isOpen && <div className="ar-c-body">{it.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
