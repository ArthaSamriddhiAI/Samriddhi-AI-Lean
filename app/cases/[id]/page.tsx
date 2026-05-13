import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

/* Minimal case detail placeholder. Commit 11 replaces this with the full
 * Analysis tab, Briefing PDF tab, read-only chat panel UI shell, frozen
 * indicator, and Download PDF button rendering the Shailesh Bhatt fixture. */

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function CaseDetailPlaceholder({ params }: PageProps) {
  const { id } = await params;
  const c = await prisma.case.findUnique({
    where: { id },
    include: { investor: true, snapshot: true },
  });
  if (!c) notFound();

  return (
    <div className="page-inner">
      <div className="eyebrow mb-2">
        <Link href="/cases" className="no-underline text-ink-3 hover:text-ink-1">
          Cases
        </Link>{" "}
        / {c.investor.name}
      </div>
      <h1>Case {c.id}</h1>
      <p className="mt-3 text-ink-3 max-w-prose">
        Case generated against {c.investor.name}, snapshot {c.snapshotId}, with severity {c.severity}.
      </p>
      <p className="mt-2 text-small text-ink-4 font-mono">
        Detail UI lands in the next commit (analysis tab, briefing tab, chat panel UI, frozen indicator, PDF button).
      </p>
    </div>
  );
}
