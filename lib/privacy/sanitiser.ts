/* The PII sanitisation layer (Package 07, B2).
 *
 * Design, per the ruling: minimise first (identity never enters prompt
 * context at all), then deterministic tokenisation at one prompt-assembly
 * choke point for whatever residue legitimately remains in free text. Runs
 * locally in code; no model call exists anywhere in this path; the only
 * legitimate producer of the SanitisedText brand the LLM-facing surfaces
 * require is sanitiseForPrompt below.
 *
 * The vault maps stable opaque tokens to original values and lives only in
 * local storage (in memory here; persistence, when real client data exists,
 * goes to the local-only private tier per the three-tier storage ruling,
 * never to any repository). Detokenisation is for local render surfaces
 * only; nothing that leaves the machine ever sees vault values.
 *
 * What this strips: known identities supplied by the caller (names with
 * their word variants, emails, mobiles, PANs, folio numbers, addresses) and
 * pattern-detectable residue (PAN format, 10-digit Indian mobiles, email
 * addresses, 12-digit Aadhaar-like numbers, folio-number phrases). What this
 * deliberately keeps: instrument and fund names, amounts, dates, portfolio
 * structure; those are the reasoning substrate and are not personal.
 * Known limit, recorded honestly: free-prose location and relationship
 * references (a city, "my sister in Canada") are not pattern-detectable and
 * are stripped only when supplied as known identities.
 *
 * Offline-tested on the synthetic corpus (scripts/_verify-pii-sanitiser.ts);
 * live-prompt validation is deliberately deferred, WA12-gated debt.
 */

import { _mintSanitised, type SanitisedText } from "./sanitised";

export type IdentityKind =
  | "person"
  | "email"
  | "mobile"
  | "pan"
  | "folio"
  | "address";

export type KnownIdentity = {
  kind: IdentityKind;
  /* All surface forms of one identity (a full name plus its distinctive
   * word variants); they share one token. */
  values: string[];
};

export type VaultEntry = {
  token: string;
  kind: IdentityKind;
  values: string[];
};

export class PiiVault {
  private entries: VaultEntry[] = [];
  private counters = new Map<IdentityKind, number>();

  tokenFor(kind: IdentityKind, values: string[]): string {
    const canon = values[0];
    const existing = this.entries.find(
      (e) => e.kind === kind && e.values.includes(canon),
    );
    if (existing) {
      for (const v of values) {
        if (!existing.values.includes(v)) existing.values.push(v);
      }
      return existing.token;
    }
    const n = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, n);
    const token = `[PII-${kind.toUpperCase()}-${n}]`;
    this.entries.push({ token, kind, values: [...values] });
    return token;
  }

  detokenise(text: string): string {
    let out = text;
    for (const e of this.entries) {
      out = out.split(e.token).join(e.values[0]);
    }
    return out;
  }

  list(): readonly VaultEntry[] {
    return this.entries;
  }
}

const PATTERNS: Array<{ kind: IdentityKind; re: RegExp }> = [
  { kind: "pan", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { kind: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: "mobile", re: /\b[6-9]\d{9}\b/g },
  /* Aadhaar-like 12-digit runs, with or without spacing. */
  { kind: "pan", re: /\b\d{4}\s?\d{4}\s?\d{4}\b/g },
  { kind: "folio", re: /\bFolio No:?\s*\d{5,}\b/g },
];

export type SanitisationReport = {
  replacements: number;
  byKind: Partial<Record<IdentityKind, number>>;
  /* Pattern hits surviving after sanitisation; must be empty. */
  residual: string[];
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* THE choke point. Every model-facing string passes through here exactly
 * once; the SanitisedText brand this returns is what the LLM-facing
 * surfaces require. */
export function sanitiseForPrompt(
  text: string,
  vault: PiiVault,
  knownIdentities: KnownIdentity[] = [],
): { sanitised: SanitisedText; report: SanitisationReport } {
  let out = text;
  const byKind: Partial<Record<IdentityKind, number>> = {};
  let replacements = 0;

  /* Known identities first, longest surface form first so full names win
   * over their word variants. */
  const expanded = knownIdentities
    .map((id) => ({
      id,
      forms: [...id.values].filter((v) => v.trim().length >= 3),
    }))
    .filter((e) => e.forms.length > 0);
  const allForms = expanded
    .flatMap((e) => e.forms.map((f) => ({ form: f, e })))
    .sort((a, b) => b.form.length - a.form.length);
  for (const { form, e } of allForms) {
    const token = vault.tokenFor(e.id.kind, e.id.values);
    const re = new RegExp(escapeRe(form), "gi");
    out = out.replace(re, () => {
      replacements += 1;
      byKind[e.id.kind] = (byKind[e.id.kind] ?? 0) + 1;
      return token;
    });
  }

  /* Pattern residue second. */
  for (const { kind, re } of PATTERNS) {
    out = out.replace(re, (m) => {
      replacements += 1;
      byKind[kind] = (byKind[kind] ?? 0) + 1;
      return vault.tokenFor(kind, [m]);
    });
  }

  /* Residual scan: nothing pattern-detectable may survive. */
  const residual: string[] = [];
  for (const { re } of PATTERNS) {
    const fresh = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = fresh.exec(out)) !== null) {
      if (!m[0].startsWith("[PII-")) residual.push(m[0]);
    }
  }

  return {
    sanitised: _mintSanitised(out),
    report: { replacements, byKind, residual },
  };
}

/* Minimisation: the agent-facing investor context carries no identity at
 * all. Holdings, mandates, and metrics pass through under a pseudonymous
 * id; name, contact, and document identity strings are simply absent, so
 * for structured context there is nothing to tokenise. */
const IDENTITY_KEYS = [
  "name", "investorName", "investor_name", "displayInitials", "email",
  "mobile", "pan", "address", "addressLines", "address_lines",
  "onboardingTranscript", "identityStrings",
] as const;

type IdentityKey = (typeof IDENTITY_KEYS)[number];

export function minimiseInvestorContext<T extends Record<string, unknown>>(
  pseudonymousId: string,
  structuredContext: T,
): Omit<T, IdentityKey> & { investorRef: string } {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(structuredContext)) {
    if ((IDENTITY_KEYS as readonly string[]).includes(k)) continue;
    cleaned[k] = v;
  }
  return { ...(cleaned as Omit<T, IdentityKey>), investorRef: pseudonymousId };
}
