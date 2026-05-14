import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GeneratingScreen } from "@/components/case-detail/GeneratingScreen";

/* Generating screen.
 *
 * Server component looks up the case; if it has already finished (status
 * "ready"), redirect to detail. Otherwise hand off to the client
 * component which polls /api/cases/[id]/status until it sees "ready"
 * (then navigates) or "failed" (then shows the retry affordance).
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function GeneratingPage({ params }: PageProps) {
  const { id } = await params;
  const c = await prisma.case.findUnique({
    where: { id },
    include: { investor: true, snapshot: true },
  });
  if (!c) notFound();

  if (c.status === "ready") {
    redirect(`/cases/${id}`);
  }

  return (
    <GeneratingScreen
      caseId={id}
      investorName={c.investor.name}
      snapshotLabel={c.snapshot.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      initialStatus={c.status ?? "generating"}
      initialError={c.errorMessage ?? null}
    />
  );
}
