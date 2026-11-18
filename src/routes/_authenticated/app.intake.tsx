import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { isReadOnly } from "@/lib/coreclaim";
import { uploadEvidence } from "@/lib/evidence";
import { useSuppliers } from "@/lib/use-suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrintLabelButton } from "@/components/app/QrLabel";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/intake")({
  validateSearch: (s: Record<string, unknown>): { mode?: "invoice" | "audit" } => (s["mode"] === "audit" || s["mode"] === "invoice" ? { mode: s["mode"] } : {}),
  component: Intake,
});

type Line = { part_number: string; part_description: string; qty: number; part_cost: string; expected_core_amount: string; return_type: "CORE_EXCHANGE" | "UNUSED_PART_RMA" };
const blank = (): Line => ({ part_number: "", part_description: "", qty: 1, part_cost: "", expected_core_amount: "", return_type: "CORE_EXCHANGE" });
type Created = Tables<"cores"> & { supplier_name?: string | undefined };

function Intake() {
  const { mode } = Route.useSearch();
  const { shop } = useShop();
  if (isReadOnly(shop)) return <p className="py-20 text-center text-muted-foreground">Intake is paused until the plan is activated.</p>;
  return (
    <Tabs defaultValue={mode ?? "invoice"}>
      <TabsList><TabsTrigger value="invoice">Invoice entry</TabsTrigger><TabsTrigger value="audit">Back-room shelf audit</TabsTrigger></TabsList>
      <TabsContent value="invoice"><InvoiceForm /></TabsContent>
      <TabsContent value="audit"><AuditForm /></TabsContent>
    </Tabs>
  );
}

function InvoiceForm() {
  const { shop, activeMember } = useShop();
  const sup = useSuppliers(shop?.id);
  const qc = useQueryClient();
  const [h, setH] = useState({ supplier_id: "", supplier_invoice_number: "", invoice_date: new Date().toISOString().slice(0, 10), ro_number: "", vin: "", vehicle_description: "", customer_name: "" });
  const [file, setFile] = useState<File | null>(null);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created[]>([]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!shop || !h.supplier_id) { toast.error("Pick a supplier"); return; }
    setBusy(true);
    try {
      const path = file ? await uploadEvidence(shop.id, "invoices", file) : null;
      const rows = lines.flatMap((l) => Array.from({ length: Math.max(1, l.qty) }, () => ({
        shop_id: shop.id, supplier_id: h.supplier_id, created_by_member_id: activeMember?.id ?? null,
        supplier_invoice_number: h.supplier_invoice_number.trim(), invoice_date: h.invoice_date || null,
        ro_number: h.ro_number || null, vin: h.vin || null, vehicle_description: h.vehicle_description || null, customer_name: h.customer_name || null,
        invoice_image_url: path, part_number: l.part_number, part_description: l.part_description || null,
        part_cost: Number(l.part_cost || 0), expected_core_amount: Number(l.expected_core_amount || 0), return_type: l.return_type,
        current_status: "AWAITING_TEARDOWN",
      })));
      const out: Created[] = [];
      for (const r of rows) { // sequential so unit_sequence assigns cleanly
        const { data, error } = await supabase.from("cores").insert(r).select().single();
        if (error) throw error; out.push({ ...data, supplier_name: sup.data?.find((s) => s.id === h.supplier_id)?.name });
      }
      setCreated(out); setLines([blank()]); setFile(null); qc.invalidateQueries({ queryKey: ["cores"] });
      toast.success(`${out.length} core${out.length > 1 ? "s" : ""} created`);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  const setL = (i: number, k: keyof Line, v: string | number) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={save} className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between"><h2 className="text-3xl">Manual invoice entry</h2><span className="flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="h-3 w-3" />AI invoice scan arrives in Phase 2</span></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Supplier</Label><select required value={h.supplier_id} onChange={(e) => setH({ ...h, supplier_id: e.target.value })} className="h-11 w-full rounded-md border bg-input/30 px-3"><option value="">Select…</option>{sup.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="space-y-1"><Label>Invoice #</Label><Input required value={h.supplier_invoice_number} onChange={(e) => setH({ ...h, supplier_invoice_number: e.target.value })} className="h-11" /></div>
          <div className="space-y-1"><Label>Invoice date</Label><Input type="date" value={h.invoice_date} onChange={(e) => setH({ ...h, invoice_date: e.target.value })} className="h-11" /></div>
          <div className="space-y-1"><Label>RO #</Label><Input value={h.ro_number} onChange={(e) => setH({ ...h, ro_number: e.target.value })} className="h-11" /></div>
          <div className="space-y-1"><Label>VIN</Label><Input value={h.vin} onChange={(e) => setH({ ...h, vin: e.target.value })} className="h-11" /></div>
          <div className="space-y-1"><Label>Vehicle</Label><Input value={h.vehicle_description} onChange={(e) => setH({ ...h, vehicle_description: e.target.value })} className="h-11" /></div>
        </div>
        <div className="space-y-1"><Label>Invoice photo / PDF (optional)</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div className="space-y-2">
          <Label>Lines</Label>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded border p-3 sm:grid-cols-[1.2fr_1.5fr_70px_1fr_1fr_1fr_40px]">
              <Input placeholder="Part #" value={l.part_number} onChange={(e) => setL(i, "part_number", e.target.value)} />
              <Input placeholder="Description" value={l.part_description} onChange={(e) => setL(i, "part_description", e.target.value)} />
              <Input type="number" min={1} max={50} title="Quantity" value={l.qty} onChange={(e) => setL(i, "qty", Number(e.target.value))} />
              <Input type="number" step="0.01" placeholder="Part cost" value={l.part_cost} onChange={(e) => setL(i, "part_cost", e.target.value)} />
              <Input type="number" step="0.01" placeholder="Core $" value={l.expected_core_amount} onChange={(e) => setL(i, "expected_core_amount", e.target.value)} />
              <select value={l.return_type} onChange={(e) => setL(i, "return_type", e.target.value)} className="rounded-md border bg-input/30 px-2 text-sm"><option value="CORE_EXCHANGE">Core</option><option value="UNUSED_PART_RMA">Unused RMA</option></select>
              <Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => setLines([...lines, blank()])}><Plus className="mr-1 h-4 w-4" />Add line</Button>
        </div>
        <Button className="h-12 w-full" disabled={busy}>{busy ? "Saving…" : "Create cores"}</Button>
      </form>
      <CreatedList created={created} />
    </div>
  );
}

function AuditForm() {
  const { shop, activeMember } = useShop();
  const sup = useSuppliers(shop?.id);
  const [f, setF] = useState({ supplier_id: "", part_number: "", part_description: "", expected_core_amount: "" });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created[]>([]);
  const qc = useQueryClient();
  async function add(e: React.FormEvent) {
    e.preventDefault(); if (!shop) return; setBusy(true);
    const { data, error } = await supabase.from("cores").insert({ shop_id: shop.id, supplier_id: f.supplier_id, created_by_member_id: activeMember?.id ?? null, is_backroom_audit: true, part_number: f.part_number, part_description: f.part_description || null, expected_core_amount: Number(f.expected_core_amount || 0), current_status: "IN_RETURN_BIN" }).select().single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCreated([{ ...data, supplier_name: sup.data?.find((s) => s.id === f.supplier_id)?.name }, ...created]);
    setF({ ...f, part_number: "", part_description: "", expected_core_amount: "" }); qc.invalidateQueries({ queryKey: ["cores"] });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={add} className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-3xl">Back-room shelf audit</h2>
        <p className="text-sm text-muted-foreground">Rapid entry for dusty shelf cores. No RO needed. Each one goes straight to the return bin.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Supplier</Label><select required value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })} className="h-12 w-full rounded-md border bg-input/30 px-3"><option value="">Select…</option>{sup.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="space-y-1"><Label>Part #</Label><Input autoFocus value={f.part_number} onChange={(e) => setF({ ...f, part_number: e.target.value })} className="h-12" /></div>
          <div className="space-y-1"><Label>Description</Label><Input value={f.part_description} onChange={(e) => setF({ ...f, part_description: e.target.value })} className="h-12" /></div>
          <div className="space-y-1"><Label>Est. core value $</Label><Input type="number" step="0.01" value={f.expected_core_amount} onChange={(e) => setF({ ...f, expected_core_amount: e.target.value })} className="h-12" /></div>
        </div>
        <Button className="h-12 w-full" disabled={busy}>Add to return bin</Button>
      </form>
      <CreatedList created={created} />
    </div>
  );
}

function CreatedList({ created }: { created: Created[] }) {
  if (!created.length) return <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">New cores appear here with print-ready labels.</div>;
  return (
    <div className="space-y-2">
      {created.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
          <div><div className="font-display text-2xl">#{c.short_code}</div><div className="text-xs text-muted-foreground">{c.part_number} · due {c.return_deadline}</div></div>
          <PrintLabelButton core={c} />
        </div>
      ))}
    </div>
  );
}
