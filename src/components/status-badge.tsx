import type { ApplicationStatus } from "@/lib/types";

const styles: Record<ApplicationStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  shortlisted: "border-sky-200 bg-sky-50 text-sky-800",
  rejected: "border-red-200 bg-red-50 text-red-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}
