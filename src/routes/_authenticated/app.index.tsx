import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { CORE_SELECT, type Core } from "@/lib/core-actions";
import { daysUntil, money, returnBinValue, STATUS_LABEL, toCsv } from "@/lib/coreclaim";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/StatusBadge";
import { CoreDrawer } from "@/components/app/CoreDrawer";

export const Route = createFileRoute("/_authenticated/app/")({ component: Dashboard });

const OPEN = ["NEEDS_REVIEW", "AWAITING_TEARDOWN", "IN_RETURN_BIN", "DAMAGED_CORE_HOLD", "PENDING_NEXT_CYCLE"];

function Dashboard() {
  const { shop } = useShop();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const cores = useQuery({
    queryKey: ["cores", shop?.id],
    enabled: !!shop,
    queryFn: async () => {
      const { data, error } = await supabase.from("cores").select(CORE_SELECT).eq("shop_id", shop!.id).neq("current_status", "DELETED_IN_ERROR").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error; return data as Core[];
    },
  });
  const all = cores.data ?? [];

  const kpi = useMemo(() => ({
    bin: all.filter((c) => c.current_status === "IN_RETURN_BIN").reduce((a, c) => a + returnBinValue(c), 0),
    transit: all.filter((c) => c.current_status === "PICKED_UP_BY_DRIVER").reduce((a, c) => a + Number(c.expected_core_amount) - Number(c.credited_amount), 0),
    expiring: all.filter((c) => OPEN.includes(c.current_status) && daysUntil(c.return_deadline) <= 7).length,
    recovered: all.reduce((a, c) => a + Number(c.credited_amount), 0),
    disputes: all.filter((c) => c.current_status === "DISPUTED").length,
  }), [all]);

  const suppliers = useMemo(() => Array.from(new Map(all.map((c) => [c.supplier_id, c.suppliers?.name ?? ""])).entries()), [all]);
  const statuses = useMemo(() => Array.from(new Set(all.map((c) => c.current_status))), [all]);

  const rows = all.filter((c) => {
    if (status && c.current_status !== status) return false;
    if (supplier && c.supplier_id !== supplier) return false;
    if (!q) return true;
    const t = q.toLowerCase().replace(/^#/, "");
    return [c.short_code, c.ro_number, c.supplier_invoice_number, c.part_number, c.vin].some((v) => v?.toLowerCase().includes(t));
  });

  function exportCsv() {
    const head = ["Short Code", "Supplier", "Invoice #", "Invoice Date", "RO #", "Part #", "Part Description", "Return Type", "Status", "Part Cost", "Expected Core", "Credited Amount", "Variance", "Return Deadline"];
    const body = rows.map((c) => [c.short_code, c.suppliers?.name, c.supplier_invoice_number, c.invoice_date, c.ro_number, c.part_number, c.part_description, c.return_type, c.current_status, c.part_cost, c.expected_core_amount, c.credited_amount, c.variance_amount, c.return_deadline]);
    const blob = new Blob([toCsv([head, ...body])], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `coreclaim-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Return Bin Cash" value={money(kpi.bin)} accent />
        <Kpi label="In-Transit w/ Driver" value={money(kpi.transit)} />
        <Kpi label="Expiring ≤ 7 Days" value={String(kpi.expiring)} warn={kpi.expiring > 0} />
        <Kpi label="Verified Recovered" value={money(kpi.recovered)} />
        <Kpi label="Open Disputes" value={String(kpi.disputes)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search #code, RO, invoice, part, VIN" className="h-11 pl-9" /></div>
        <Button variant="secondary" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill on={!status} onClick={() => setStatus(null)}>All statuses</Pill>
        {statuses.map((s) => <Pill key={s} on={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</Pill>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill on={!supplier} onClick={() => setSupplier(null)}>All suppliers</Pill>
        {suppliers.map(([id, n]) => <Pill key={id} on={supplier === id} onClick={() => setSupplier(id)}>{n}</Pill>)}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{["Code", "Supplier", "Invoice", "Part", "RO", "Status", "Expected", "Credited", "Due"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((c) => {
              const d = daysUntil(c.return_deadline);
              return (
                <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer border-t hover:bg-accent/50">
                  <td className="px-3 py-2 font-display text-lg">#{c.short_code}</td>
                  <td className="px-3 py-2">{c.suppliers?.name}</td>
                  <td className="px-3 py-2">{c.supplier_invoice_number}</td>
                  <td className="px-3 py-2">{c.part_number}</td>
                  <td className="px-3 py-2">{c.ro_number ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={c.current_status} /></td>
                  <td className="px-3 py-2">{money(c.expected_core_amount)}</td>
                  <td className="px-3 py-2">{money(c.credited_amount)}</td>
                  <td className={`px-3 py-2 ${OPEN.includes(c.current_status) && d <= 7 ? "font-semibold text-destructive" : ""}`}>{c.return_deadline}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">{cores.isLoading ? "Loading…" : "No cores yet. Add some from Intake."}</td></tr>}
          </tbody>
        </table>
      </div>
      <CoreDrawer coreId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Kpi({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return <div className={`rounded-lg border p-4 ${accent ? "border-primary bg-primary/10" : "bg-card"}`}><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className={`mt-1 font-display text-3xl ${warn ? "text-destructive" : accent ? "text-primary" : ""}`}>{value}</div></div>;
}
export function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary"}`}>{children}</button>;
}
