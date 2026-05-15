# PDF polish micro-slice build notes

A focused micro-slice that landed between Slice 3 and Slice 4. Visual implementation of the Claude Design redesign of the briefing PDF against `11 - Slice-By-Slice Implementation/03 - Briefing Doc PDF Design/`. Zero API spend; one file rewritten plus seven TTF assets added.

## Scope

Replace the Slice 2 generic React PDF visual (Times-Roman / Helvetica / Courier defaults; static footer right-line) with the institutional-paper redesign produced by Claude Design. One file touched: `components/pdf/BriefingPDF.tsx`. Font assets added under `lib/pdf/fonts/`. The Slice 3 pipeline work is untouched.

Resolves two DEFERRED items from Slice 2:
- Item 4 (PDF font upgrade)
- Item 5 (dynamic page numbering)

Both deferrals were known issues with the Slice 2 quick-and-dirty PDF shipping path. This micro-slice cleans them up together because the dynamic page numbering depends on the page-level style cascade behaving correctly, and the font registration is the precondition for replacing the page-level style.

## What landed

**Font registration.** Source Serif 4 (Regular, Semibold), Geist (Regular, Medium, SemiBold), Geist Mono (Regular, Medium). All seven TTFs sourced from upstream vendor repos (adobe-fonts/source-serif and vercel/geist-font), committed to `lib/pdf/fonts/`. Registered via `Font.register` at the top of `BriefingPDF.tsx` with `path.join(process.cwd(), "lib/pdf/fonts", ...)` paths. Total font payload roughly 1.2 MB across the seven files.

**Visual treatment.** Full replication of the redesign HTML's design system. Token names mirror the CSS variables: paper, ink scale 1-5, rule stroke, accent (Ledger Blue), severity colours (neg red, warn gold, info Ledger Blue, pos green) with their tinted backgrounds and borders. The token reference is the comment block at the top of `BriefingPDF.tsx`.

Section-by-section landed elements:
- Top header strip on every page (fixed), small-caps tracked-out left + case/investor/advisor right
- Document header (page 1 only): eyebrow + large Source Serif 4 title + Geist Mono meta row + right-aligned metadata column with the dynamic "Page X of N" line
- KPI strip with five cells: Severity, Also flagged, Liquid AUM, Blended fee est., Largest breach. Bordered grid, severity colour applied to the value text per cell.
- §01 Headline observations: prose paragraphs with severity-coloured bolded vocab + Source Pill at the end of each
- §02 Portfolio overview table with vs.Band and Status columns; severity colour on out-of-band rows
- §03 Concentration analysis: three-column row layout (severity badge + source pill on left, body in middle, large mono figure on right)
- §04 Risk flags: severity-coloured left border on each card; category + severity + source pill on left, body on right
- §05 Comparison versus model portfolio: framing line + table with sleeve / model / actual / note columns
- §06 Talking points: numbered items with fine-rule separators
- §07 Evidence appendix: four-column table (holding, sub-category in mono, value, weight) with a totals row "Holdings shown (N of T) · sum · sum%"
- Coverage Note: small-caps tracked-out label + bordered box of prose
- Bottom footer strip on every page (fixed): "Prepared, not generated." left + dynamic "Page X of N · Lean Samriddhi MVP · Frozen artefact" right

**Dynamic page numbering.** Resolved. Works in both the doc-meta column (page 1) and the fixed bottom-right footer (every page). Required removing the Page-level `lineHeight` to unblock the underlying library issue; see notable detours below.

**Source tag widening.** `SourceTag` in `lib/agents/s1-diagnostic.ts` widened from `"metric" | "interpretation" | "hybrid"` to also include `"evidence_agent"`. The bhatt-01 fixture (and presumably any other diagnostic case) emits `evidence_agent` as a source value; the prior type was lying. The PDF code already handled all four values via its pill-style switch with EVIDENCE as the default fallback; widening the type makes the values explicit and removes the implicit-fallback assumption.

## Notable detours

### The `lineHeight` cascade silently no-ops `<Text render>` content

This was the largest detour of the micro-slice. Symptoms: the `render` prop on `<Text>` fired correctly (verified via console.log inside the render function: `Page 1 of undefined`, then `Page 1 of 5` on the final pagination pass), the rendered string was correct, but the dynamic content never appeared in the PDF. Static `<Text fixed>` content worked; `<Text fixed render>` did not.

The reproduction is small and reliable. A `<Page>` element with any `lineHeight` in its style (or in any ancestor of the dynamic Text) causes every descendant `<Text render>` to silently produce no visible output. The render function is called, the result is passed through `createInstances` and added as a TextInstance child of the Text node, but the laid-out lines never make it to the renderer's draw pass. Tested four variants in scripts/_test-lh.tsx (later removed): no lineHeight on inner Text, lineHeight: 1 explicit on inner, lineHeight: 1.5 explicit on inner (matching parent), no override (inherits parent's 1.5). All four broken when the Page has `lineHeight: 1.5`.

Resolution: do not set `lineHeight` on the Page-level style. Apply `lineHeight` per-component where prose density needs control (obsBody, brBod, flBod, tpB, tblTd, covBox, tblNote, etc.). For Texts that use the `render` prop, use a style with no `lineHeight` field at all (`docMetaPageLine` is a deliberate no-lineHeight variant of `docMetaLine` for exactly this reason; the bottom-right footer style `pgFtRight` also omits `lineHeight`).

The bug is genuine and reproducible in `@react-pdf/renderer 4.5.1` (the current latest as of this writing). Future contributors who set a Page-level `lineHeight` will silently lose dynamic page numbering and any other render-prop content. The two render-prop styles in `BriefingPDF.tsx` carry an inline comment pointing back to this note.

If the library issue is fixed upstream in a future version, the Page-level `lineHeight: 1.5` can be restored and the per-component overrides can be simplified to inherit. Not urgent; the per-component approach is also more institutional-feeling because each component's spacing is locally explicit.

### Text inside a flex row needs a View wrapper to wrap

A second smaller detour. The §03 concentration row uses a three-column flex layout: severity badge (fixed width 78) on the left, body in the middle, figure (fixed width) on the right. The body needs to wrap when its content exceeds the available middle-column width. Initial implementation put `<Text style={{flexGrow: 1, flexShrink: 1, ...}}>` directly as a flex child; rendered output showed the body text running off the column boundary and visually overlapping the figure text.

Fix: wrap the body Text in a `<View style={{flex: 1, paddingRight: 8}}>` (note `flex: 1`, not `flexGrow: 1, flexShrink: 1`; the shorthand expands to `flexGrow: 1, flexShrink: 1, flexBasis: 0` and the `flexBasis: 0` is what forces correct width allocation under the row's flex layout). The same pattern applies to §04 risk flag cards (`flBodWrap`) and §06 talking points (`tpBWrap`). The §01 observation body did not need the wrapper because there is no right-anchored sibling; the prose plus the inline source pill flows naturally.

Conventions in `BriefingPDF.tsx`: any time text needs to wrap inside a flex row with a sibling that has a fixed width, the text goes inside a `View` wrapper with `flex: 1`. This is a React PDF / yoga quirk; it is not how CSS flex works in the browser, but it is the reliable pattern under `@react-pdf/renderer`.

### Heuristic-parsed Blended Fee Est. on the KPI strip

The KPI strip's fourth cell ("Blended fee est.") needs a percent-of-AUM number. The redesign mockup shows `~2.1%`. The actual Bhatt content does not have this as a structured field on `BriefingContent`; the figure lives inside the prose body of the Fee-category risk flags. Current implementation in `extractBlendedFee()` regex-scans Fee risk flags looking for a percent figure in the 0.5-5% range.

The heuristic is wrong on the bhatt-01 fixture. It returns `~0.72%`, which is a since-inception alpha figure ("-0.72% net of fees vs BSE 500 TRI") parsed from the first Fee risk flag's body. The actual blended fee load identified by another Fee flag is ~340-350 bps, roughly ~2.1% as the redesign anticipates.

Proper fix is a structured `fee_estimate_blended_pct` field on `BriefingContent`, populated by S1 synthesis. Tracked as a new DEFERRED item with an explicit trigger prompt; non-blocking for shipping the micro-slice.

## Architectural notes

**One-file scope held.** The micro-slice intentionally stayed within `components/pdf/BriefingPDF.tsx` plus the font assets and the small `SourceTag` type widen. The pipeline, the agents, the case schema, the seed: all untouched. The Slice 3 work is independent and was not affected.

**Component decomposition inside the file.** The 700-line component is decomposed into smaller per-section components (`Section1HeadlineObservations`, `Section2PortfolioOverview`, `Section3ConcentrationAnalysis`, etc.) defined below the main `BriefingPDF` export. This is purely a readability move; React PDF treats the whole tree as one logical document. No extra rendering passes.

**KPI strip data sources.** Three of the five KPI cells read directly from `BriefingHeader` (severity_counts, liquid_aum_label, holdings_label). The fourth (blended fee) uses the heuristic noted above. The fifth (largest breach) iterates `section_3_concentration_analysis` and picks the highest percent figure. All derivations live inside the PDF component; no schema changes required.

**Font path resolution.** Uses `path.join(process.cwd(), "lib/pdf/fonts", ...)`. Works for both the Next.js API route at `/api/cases/[id]/briefing.pdf` (process.cwd = project root) and the local rendering script `scripts/render-briefing-pdf.ts` (same; the script must be run from the project root). If the working directory ever drifts, the font resolution will fail at registration time; this is the trade-off vs an absolute path baked at build time.

## Token / cost summary

Zero API spend. No agent calls. Pure visual implementation work.

## What is functional, what is not

| Surface | State |
|---|---|
| BriefingPDF visual treatment matches redesign | Functional |
| Source Serif 4 / Geist / Geist Mono registered and rendering | Functional |
| Dynamic "Page X of N" in doc header and fixed footer | Functional |
| Rupee glyph (₹) | Functional |
| Four-page output for bhatt-01 | Functional |
| KPI strip "Blended fee est." cell | **Functional but heuristic-wrong** (new DEFERRED item) |
| Case-mode briefing PDF (Slice 3) | Still deferred (separate DEFERRED item 10; this micro-slice was diagnostic-only) |

## Cross-references

- [DEFERRED.md](../../DEFERRED.md): items 4 and 5 removed; new item added for the blended fee structured field
- [BUILD_NOTES_SLICE_2.md](../02/BUILD_NOTES_SLICE_2.md): origin of DEFERRED items 4 and 5
- `components/pdf/BriefingPDF.tsx`: the implementation; inline comments at the lineHeight-sensitive styles point back to this document
- `lib/pdf/fonts/`: the seven TTF assets
- `11 - Slice-By-Slice Implementation/03 - Briefing Doc PDF Design/`: the design folder containing the redesign HTML, its print export, the original Slice 2 PDF for comparison, the trigger prompt, and the RESHIPPED PDF rendered at gate time
