import { STATUS_LABEL } from "@/lib/coreclaim";

const TONE: Record<string, string> = {
  IN_RETURN_BIN: "bg-primary text-primary-foreground",
  CREDIT_VERIFIED: "bg-success text-success-foreground",
  PARTIAL_CREDIT: "bg-warning text-primary-foreground",
  DAMAGED_CORE_HOLD: "bg-destructive text-destructive-foreground",
  DISPUTED: "bg-destructive text-destructive-foreground",
  DISPUTE_ELIGIBLE: "bg-destructive/70 text-destructive-foreground",
  EXPIRED: "bg-destructive/70 text-destructive-foreground",
  PICKED_UP_BY_DRIVER: "bg-chart-3 text-foreground",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TONE[status] ?? "bg-secondary text-secondary-foreground"}`}>{STATUS_LABEL[status] ?? status}</span>;
}
