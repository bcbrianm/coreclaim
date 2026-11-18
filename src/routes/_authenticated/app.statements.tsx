import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { isReadOnly, money } from "@/lib/coreclaim";
import { uploadEvidence } from "@/lib/evidence";
import { useSuppliers } from "@/lib/use-suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProGate } from "@/components/app/ProGate";
import { EvidencePreview } from "@/components/app/EvidencePreview";

export const Route = createFileRoute("/_authenticated/app/statements")({ component: () => <ProGate feature="Statement Reconciler"><Statements /></ProGate> });

function Statements() {
  const { shop } = useShop();
  const sup = useSuppliers(shop?.id, true);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [f, setF] = useState({ supplier_id: "", statement_date: new Date().toISOString().slice(0, 10) });
  const [file, setFile] = useState<File | null>(null);
  const ro = isReadOnly(shop);

  const list = useQuery({ queryKey: ["statements", shop?.id], enabled: !!shop, queryFn: async () => (await supabase.from("vendor_statements").select("*, suppliers(name)").eq("shop_id", shop!.id).order("created_at", { ascending: false })).data ?? [] });

  async function create(e: React.FormEvent) {
    e.preventDefault(); if (!shop) return;
    try {
      const path = file ? await uploadEvidence(shop.id, "statements", file) : null;
      const { data, error } = await supabase.from("vendor_statements").insert({ shop_id: shop.id, supplier_id: f.supplier_id, statement_date: f.statement_date, statement_pdf_url: path, status: "DISCREPANCIES_FOUND" }).select().single();
      if (error) throw error;
      setOpenId(data.id); setFile(null); qc.invalidateQueries({ queryKey: ["statements"] });
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-3">
        {!ro && (
          <form onSubmit={create} className="space-y-3 rounded-lg border bg-card p-4">
            <h2 className="text-2xl">New statement</h2>
            <select required value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })} className="h-11 w-full rounded-md border bg-input/30 px-3"><option value="">Supplier…</option>{sup.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <Input type="date" value={f.statement_date} onChange={(e) => setF({ ...f, statement_date: e.target.value })} />
            <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">AI line extraction arrives in Phase 2. For now, enter credit lines by hand.</p>
            <Button className="w-full">Create</Button>
          </form>
        )}
        {(list.data ?? []).map((s) => (
          <button key={s.id} onClick={() => setOpenId(s.id)} className={`block w-full rounded-lg border p-3 text-left ${openId === s.id ? "border-primary" : "bg-card"}`}>
            <div className="font-semibold">{s.suppliers?.name} · {s.statement_date}</div>
            <div className={`text-xs font-bold ${s.status === "RECONCILED" ? "text-success" : "text-warning"}`}>{s.status.replace(/_/g, " ")}</div>
          </button>
        ))}
      </div>
      {openId ? <StatementDetail id={openId} readOnly={ro} /> : <p className="text-muted-foreground">Select a statement.</p>}
    </div>
  );
}

function StatementDetail({ id, readOnly }: { id: string; readOnly: boolean }) {
  const { shop } = useShop();
  const qc = useQueryClient();
  const [nl, setNl] = useState({ invoice_ref: "", part_number: "", credit_amount: "" });
  const [alloc, setAlloc] = useState<{ lineId: string; coreId: string; amount: string } | null>(null);

  const st = useQuery({ queryKey: ["statement", id], queryFn: async () => (await supabase.from("vendor_statements").select("*, suppliers(name)").eq("id", id).single()).data });
  const lines = useQuery({ queryKey: ["lines", id], queryFn: async () => (await supabase.from("statement_lines").select("*, core_credit_allocations(id, allocated_amount, core_id, cores(short_code))").eq("statement_id", id)).data ?? [] });
  const openCores = useQuery({
    queryKey: ["open-cores", st.data?.supplier_id], enabled: !!st.data,
    queryFn: async () => ((await supabase.from("cores").select("id, short_code, part_number, supplier_invoice_number, expected_core_amount, credited_amount").eq("shop_id", shop!.id).eq("supplier_id", st.data!.supplier_id).not("current_status", "in", "(DELETED_IN_ERROR,WRITTEN_OFF)")).data ?? []).filter((c) => Number(c.expected_core_amount) > Number(c.credited_amount)),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["lines", id] }); qc.invalidateQueries({ queryKey: ["statement", id] }); qc.invalidateQueries({ queryKey: ["statements"] }); qc.invalidateQueries({ queryKey: ["open-cores"] }); qc.invalidateQueries({ queryKey: ["cores"] }); };

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("statement_lines").insert({ statement_id: id, shop_id: shop!.id, invoice_ref: nl.invoice_ref, part_number: nl.part_number, credit_amount: Number(nl.credit_amount) });
    if (error) { toast.error(error.message); return; }
    setNl({ invoice_ref: "", part_number: "", credit_amount: "" }); refresh();
  }
  async function doAlloc() {
    if (!alloc) return;
    const { error } = await supabase.from("core_credit_allocations").insert({ shop_id: shop!.id, statement_line_id: alloc.lineId, core_id: alloc.coreId, allocated_amount: Number(alloc.amount) });
    if (error) { toast.error(error.message); return; }
    setAlloc(null); refresh(); toast.success("Credit linked");
  }
  async function unalloc(aid: string) { await supabase.from("core_credit_allocations").delete().eq("id", aid); refresh(); }

  if (!st.data) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-3xl">{st.data.suppliers?.name} — {st.data.statement_date}</h2>
      {st.data.statement_pdf_url && <EvidencePreview path={st.data.statement_pdf_url} label="statement" />}
      <div className="space-y-2">
        {(lines.data ?? []).map((l) => {
          const used = l.core_credit_allocations.reduce((a, x) => a + Number(x.allocated_amount), 0);
          const remaining = Number(l.credit_amount) - used;
          return (
            <div key={l.id} className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${l.matched_status === "MATCHED" ? "bg-success text-success-foreground" : l.matched_status === "PARTIAL" ? "bg-warning text-primary-foreground" : "bg-secondary"}`}>{l.matched_status}</span>
                <span>Inv {l.invoice_ref || "—"}</span><span>Part {l.part_number || "—"}</span><span className="font-semibold">{money(l.credit_amount)}</span>
                <span className="text-muted-foreground">Remaining {money(remaining)}</span>
                {!readOnly && remaining > 0 && <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setAlloc({ lineId: l.id, coreId: "", amount: remaining.toFixed(2) })}>Link to core</Button>}
              </div>
              {l.core_credit_allocations.map((a) => <div key={a.id} className="mt-1 flex items-center gap-2 pl-2 text-xs text-muted-foreground">→ #{a.cores?.short_code} {money(a.allocated_amount)}{!readOnly && <button className="text-destructive" onClick={() => unalloc(a.id)}>remove</button>}</div>)}
              {alloc?.lineId === l.id && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select value={alloc.coreId} onChange={(e) => { const c = openCores.data?.find((x) => x.id === e.target.value); setAlloc({ ...alloc, coreId: e.target.value, amount: c ? Math.min(remaining, Number(c.expected_core_amount) - Number(c.credited_amount)).toFixed(2) : alloc.amount }); }} className="h-9 flex-1 rounded-md border bg-input/30 px-2 text-sm">
                    <option value="">Open core…</option>{openCores.data?.map((c) => <option key={c.id} value={c.id}>#{c.short_code} · {c.part_number} · inv {c.supplier_invoice_number} · owed {money(Number(c.expected_core_amount) - Number(c.credited_amount))}</option>)}
                  </select>
                  <Input type="number" step="0.01" max={remaining} value={alloc.amount} onChange={(e) => setAlloc({ ...alloc, amount: String(Math.min(Number(e.target.value), remaining)) })} className="h-9 w-28" />
                  <Button size="sm" disabled={!alloc.coreId} onClick={doAlloc}>Link</Button><Button size="sm" variant="ghost" onClick={() => setAlloc(null)}>Cancel</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <form onSubmit={addLine} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
          <div className="space-y-1"><Label>Invoice ref</Label><Input value={nl.invoice_ref} onChange={(e) => setNl({ ...nl, invoice_ref: e.target.value })} /></div>
          <div className="space-y-1"><Label>Part #</Label><Input value={nl.part_number} onChange={(e) => setNl({ ...nl, part_number: e.target.value })} /></div>
          <div className="space-y-1"><Label>Credit $</Label><Input required type="number" step="0.01" min="0.01" value={nl.credit_amount} onChange={(e) => setNl({ ...nl, credit_amount: e.target.value })} className="w-28" /></div>
          <Button><Plus className="mr-1 h-4 w-4" />Add line</Button>
        </form>
      )}
    </div>
  );
}
