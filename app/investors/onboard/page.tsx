/* Add-investor onboarding flow (Package 07, B4). Server shell: optionally
 * pre-parses a committed demo specimen (?specimen=krishnan or
 * ?specimen=iyengar_email) so the workbench is reviewable without manual
 * uploads, then hands to the client flow. The reconciliation gate runs
 * server-side on every recompute and again at commit. */

import { prisma } from "@/lib/prisma";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { parseSpecimen, type ParsedBundle } from "./actions";

export const dynamic = "force-dynamic";

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ specimen?: string }>;
}) {
  const { specimen } = await searchParams;
  let initialBundle: ParsedBundle | null = null;
  if (specimen) {
    initialBundle = await parseSpecimen(specimen);
  }
  /* The attesting advisor's identity for advisor_attested provenance. */
  const advisorName = (await prisma.setting.findFirst())?.advisorName ?? "Priya Nair";
  return (
    <div className="page-inner">
      <OnboardingFlow
        initialBundle={initialBundle}
        initialSpecimen={specimen ?? null}
        advisorName={advisorName}
      />
    </div>
  );
}
