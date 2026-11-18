import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { isReadOnly, money } from "@/lib/coreclaim";
import { CORE_SELECT, type Core } from "@/lib/core-actions";
import { uploadAtPath } from "@/lib/evidence";
import { buildClaimPdf } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProGate } from "@/components/app/ProGate";
import { EvidencePreview } from "@/components/app/EvidencePreview";

export const Route = createFileRoute("/_authenticated/app/warranty")({
  validateSearch: (s: Record<string, unknown>): { core?: string } => (typeof s["core"] === "string" ? { core: s["core"] } : {}),
  component: () => <ProGate feature="Warranty Claims"><Warranty /></ProGate>,
});

const NEXT: Record<string, string> = { DRAFT: "SUBMITTED", SUBMITTED: "PAID" };

function Warranty() {
  const { core: preset } = Route.useSearch();
  const { shop, activeMember } = useShop();
  const qc = useQueryClient();
  const cores = useQuery({ queryKey: ["cores-lite", shop?.id], enabled: !!shop, queryFn: async () => ((await supabase.from("cores").select(CORE_SELECT).eq("shop_id", shop!.id).neq("current_status", "DELETED_IN_ERROR").order("created_at", { ascending: false }).limit(1000)).data ?? []) as Core[] });
  const claims = useQuery({ queryKey: ["claims", shop?.id], enabled: !!shop, queryFn: async () => (await supabase.from("warranty_claims").select("*, cores(short_code, part_number)").eq("shop_id", shop!.id).order("created_at", { ascending: false })).data ?? [] });
  const [coreId, setCoreId] = useState(preset ?? "");
  const [parentQ, setParentQ] = useState(""); const [parentId, setParentId] = useState<string | null>(null);
  const [f, setF] = useState({ failure_date: new Date().toISOString().slice(0, 10), failure_reason: "", hours: "0" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (preset) setCoreId(preset); }, [preset]);

  const core = cores.data?.find((c) => c.id === coreId);
  const rate = Number(shop?.labor_rate_hourly ?? 0);
  const hours = Number(f.hours || 0);
  const total = Number(core?.part_cost ?? 0) + (core?.warranty_covers_labor !== false ? hours * rate : 0);
  const parentMatches = useMemo(() => !parentQ ? [] : (cores.data ?? []).filter((c) => c.id !== coreId && [c.short_code, c.part_number, c.ro_number, c.vin].some((v) => v?.toLowerCase().includes(parentQ.toLowerCase()))).slice(0, 6), [parentQ, cores.data, coreId]);
  const parent = cores.data?.find((c) => c.id === parentId);

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!shop || !core) { toast.error("Pick a core"); return; }
    setBusy(true);
    try {
      if (parentId) await supabase.from("cores").update({ parent_core_id: parentId }).eq("id", core.id);
      const { data: claim, error } = await supabase.from("warranty_claims").insert({ shop_id: shop.id, core_id: core.id, created_by_member_id: activeMember?.id ?? null, failure_date: f.failure_date, failure_reason: f.failure_reason, labor_hours_claimed: hours, labor_rate_snapshot: rate, total_claim_amount: total }).select().single();
      if (error) throw error;
      const pdf = await buildClaimPdf({ shopName: shop.name, supplierName: core.suppliers?.name ?? "", core, parentCode: parent?.short_code ?? null, failureDate: f.failure_date, reason: f.failure_reason, hours, rate, total });
      const path = await uploadAtPath(`${shop.id}/claims/${claim.id}.pdf`, pdf);
      await supabase.from("warranty_claims").update({ claim_pdf_url: path }).eq("id", claim.id);
      await supabase.from("core_events").insert({ core_id: core.id, shop_id: shop.id, actor_member_id: activeMember?.id ?? null, event_type: "WARRANTY_CLAIM_CREATED", metadata_json: { claim_id: claim.id, total } });
      toast.success("Claim drafted"); setF({ ...f, failure_reason: "", hours: "0" }); setParentId(null); setParentQ("");
      qc.invalidateQueries({ queryKey: ["claims"] });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  async function advance(c: { id: string; core_id: string; status: string }) {
    const next = NEXT[c.status]; if (!next || !shop) return;
    const { error } = await supabase.from("warranty_claims").update({ status: next }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("core_events").insert({ core_id: c.core_id, shop_id: shop.id, actor_member_id: activeMember?.id ?? null, event_type: "WARRANTY_CLAIM_STATUS_UPDATED", metadata_json: { claim_id: c.id, from: c.status, to: next } });
    qc.invalidateQueries({ queryKey: ["claims"] });
  }

  const ro = isReadOnly(shop);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {!ro && (
        <form onSubmit={save} className="space-y-3 rounded-lg border bg-card p-5">
          <h2 className="text-3xl">Build warranty claim</h2>
          <div className="space-y-1"><Label>Replacement part (core)</Label><select required value={coreId} onChange={(e) => setCoreId(e.target.value)} className="h-11 w-full rounded-md border bg-input/30 px-3"><option value="">Select…</option>{cores.data?.map((c) => <option key={c.id} value={c.id}>#{c.short_code} · {c.part_number} · {c.suppliers?.name}</option>)}</select></div>
          <div className="space-y-1"><Label>Prior Failed Core (Warranty-on-a-Warranty)</Label>
            {parent ? <div className="flex items-center justify-between rounded border p-2 text-sm">#{parent.short_code} · {parent.part_number}<Button type="button" size="sm" variant="ghost" onClick={() => setParentId(null)}>Clear</Button></div> : <>
              <Input placeholder="Search code, part, RO, VIN" value={parentQ} onChange={(e) => setParentQ(e.target.value)} />
              {parentMatches.map((c) => <button type="button" key={c.id} onClick={() => { setParentId(c.id); setParentQ(""); }} className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent">#{c.short_code} · {c.part_number} · {c.ro_number ?? ""}</button>)}
            </>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Failure date</Label><Input type="date" value={f.failure_date} onChange={(e) => setF({ ...f, failure_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Labor hours</Label><Input type="number" step="0.1" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Failure reason</Label><Textarea required value={f.failure_reason} onChange={(e) => setF({ ...f, failure_reason: e.target.value })} /></div>
          <p className="text-sm">Labor rate {money(rate)}/h · <b>Total {money(total)}</b></p>
          <Button className="h-12 w-full" disabled={busy}>{busy ? "Saving…" : "Save claim + PDF"}</Button>
        </form>
      )}
      <div className="space-y-2">
        <h2 className="text-3xl">Claims archive</h2>
        {(claims.data ?? []).map((c) => (
          <details key={c.id} className="rounded-lg border bg-card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="font-display text-xl">#{c.cores?.short_code}</span><span className="text-sm">{c.cores?.part_number}</span><span className="text-sm">{money(c.total_claim_amount)}</span>
              <span className="ml-auto rounded bg-secondary px-2 py-0.5 text-xs font-bold">{c.status}</span>
              {NEXT[c.status] && !ro && <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); void advance(c); }}>Mark {(NEXT[c.status] ?? "").toLowerCase()}</Button>}
            </summary>
            <div className="mt-3"><EvidencePreview path={c.claim_pdf_url} label="claim PDF" /></div>
          </details>
        ))}
        {!claims.data?.length && <p className="text-muted-foreground">No claims yet.</p>}
      </div>
    </div>
  );
}
