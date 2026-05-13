import Link from "next/link";
import { Plus } from "@/components/chrome/Icons";

/* Empty state for the case list. The brand voice is restrained: no animation,
 * no illustration, just a hairline card with a single CTA. */
export function EmptyState() {
  return (
    <div className="empty-card">
      <h2>No cases yet</h2>
      <p>
        Open a new case to begin a portfolio diagnostic or proposal evaluation.
        Cases are frozen once generated and accumulate as the book is reviewed.
      </p>
      <Link href="/cases/new" className="btn btn-primary btn-lg">
        <Plus size={14} />
        New case
      </Link>
    </div>
  );
}
