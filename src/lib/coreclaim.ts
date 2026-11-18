export type AppRole = "mechanic" | "shop_user" | "super_user" | "admin";

export const ROLE_LABEL: Record<AppRole, string> = {
  mechanic: "Bay Mechanic",
  shop_user: "Counter",
  super_user: "Bookkeeper",
  admin: "Owner / GM",
};

export const STATUS_LABEL: Record<string, string> = {
  NEEDS_REVIEW: "Needs Review",
  AWAITING_TEARDOWN: "Awaiting Teardown",
  IN_RETURN_BIN: "In Return Bin",
  DAMAGED_CORE_HOLD: "Damaged Hold",
  PICKED_UP_BY_DRIVER: "With Driver",
  PENDING_NEXT_CYCLE: "Next Cycle",
  CREDIT_VERIFIED: "Credit Verified",
  PARTIAL_CREDIT: "Partial Credit",
  DISPUTE_ELIGIBLE: "Dispute Eligible",
  DISPUTED: "Disputed",
  REJECTED_BY_VENDOR: "Rejected",
  EXPIRED: "Expired",
  WRITTEN_OFF: "Written Off",
  DELETED_IN_ERROR: "Deleted",
};

export const ALL_STATUSES = Object.keys(STATUS_LABEL);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts `CORECLAIM:<code>`, a raw 4/5-digit code, or a core UUID. */
export function parseCoreQr(raw: string | null | undefined): { kind: "code" | "id"; value: string } | null {
  if (!raw) return null;
  let v = raw.trim();
  if (/^coreclaim:/i.test(v)) v = v.slice("coreclaim:".length).trim();
  v = v.replace(/^#/, "");
  if (/^\d{4,5}$/.test(v)) return { kind: "code", value: v };
  if (UUID_RE.test(v)) return { kind: "id", value: v.toLowerCase() };
  return null;
}

export const qrValue = (shortCode: string) => `CORECLAIM:${shortCode}`;

export const WRITE_OFF_SUPER_USER_LIMIT = 50;

/** Admins can write off any amount; bookkeepers only up to $50 of remaining variance. */
export function canWriteOff(role: AppRole | undefined, variance: number): boolean {
  if (role === "admin") return true;
  if (role === "super_user") return variance <= WRITE_OFF_SUPER_USER_LIMIT;
  return false;
}

export const STAFF_ROLES: AppRole[] = ["shop_user", "super_user", "admin"];
export const MANAGER_ROLES: AppRole[] = ["super_user", "admin"];

/** Pages each role may open. Mechanics are locked to the bay scanner. */
export function allowedSection(role: AppRole | undefined, section: string): boolean {
  if (!role) return false;
  if (role === "mechanic") return section === "scan";
  if (["statements", "suppliers"].includes(section)) return MANAGER_ROLES.includes(role);
  if (section === "admin") return role === "admin";
  return true;
}

export function money(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function isReadOnly(shop: { subscription_status: string; trial_ends_at: string | null } | null | undefined) {
  if (!shop) return false;
  if (shop.subscription_status === "canceled") return true;
  if (shop.subscription_status === "trialing" && shop.trial_ends_at && new Date(shop.trial_ends_at) < new Date()) return true;
  return false;
}

export function isPro(shop: { subscription_tier: string; subscription_status: string } | null | undefined) {
  if (!shop) return false;
  return shop.subscription_tier === "pro" || shop.subscription_status === "trialing";
}

export function returnBinValue(c: { expected_core_amount: number; part_cost: number; return_type: string }) {
  return Number(c.expected_core_amount) + (c.return_type === "UNUSED_PART_RMA" ? Number(c.part_cost) : 0);
}

export function daysUntil(date: string | null) {
  if (!date) return Infinity;
  const d = new Date(date + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((c) => {
    const s = c == null ? "" : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}
