import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type SignatureCanvas from "react-signature-canvas";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { isReadOnly, money } from "@/lib/coreclaim";
import { uploadAtPath } from "@/lib/evidence";
import { buildManifestPdf } from "@/lib/pdf";
import { useSuppliers } from "@/lib/use-suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvidencePreview } from "@/components/app/EvidencePreview";

const SignaturePad = lazy(() => import("@/components/app/SignaturePad"));
export const Route = createFileRoute("/_authenticated/app/pickup")({ component: Pickup });

function Pickup() {
  return (
    <Tabs defaultValue="new">
      <TabsList><TabsTrigger value="new">New pickup</TabsTrigger><TabsTrigger value="history">Pickup History</TabsTrigger></TabsList>
      <TabsContent value="new"><NewPickup /></TabsContent>
      <TabsContent value="history"><History /></TabsContent>
    </Tabs>
  );
}

function NewPickup() {
  const { shop, activeMember } = useShop();
  const sup = useSuppliers(shop?.id);
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [driver, setDriver] = useState(""); const [truck, setTruck] = useState("");
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const sig = useRef<SignatureCanvas>(null);

  const bin = useQuery({
    queryKey: ["bin", shop?.id, supplierId], enabled: !!shop && !!supplierId,
    queryFn: async () => (await supabase.from("cores").select("*").eq("shop_id", shop!.id).eq("supplier_id", supplierId).eq("current_status", "IN_RETURN_BIN").order("short_code")).data ?? [],
  });
  const items = bin.data ?? [];

  async function complete() {
    if (!shop || !sel.size) { toast.error("Select at least one core"); return; }
    const signature = refused || sig.current?.isEmpty() ? null : sig.current!.getCanvas().toDataURL("image/png");
    if (!signature && !refused) { toast.error("Get the driver's signature or mark refused"); return; }
    setBusy(true);
    try {
      const { data: manifestId, error } = await supabase.rpc("complete_driver_pickup", { p_shop_id: shop.id, p_supplier_id: supplierId, p_core_ids: [...sel], p_driver_name: refused ? "" : driver, p_driver_truck_number: truck, ...(activeMember ? { p_actor_member_id: activeMember.id } : {}) });
      if (error) throw error;
      const cores = items.filter((c) => sel.has(c.id));
      const pdf = await buildManifestPdf({ shopName: shop.name, supplierName: sup.data?.find((s) => s.id === supplierId)?.name ?? "", driverName: refused || !driver ? "Driver Refused Signature" : driver, truck, manifestId: manifestId as string, cores, signature });
      const path = await uploadAtPath(`${shop.id}/manifests/${manifestId}.pdf`, pdf);
      await supabase.from("pickup_manifests").update({ manifest_pdf_url: path }).eq("id", manifestId as string);
      const a = document.createElement("a"); a.href = URL.createObjectURL(pdf); a.download = `manifest-${(manifestId as string).slice(0, 8)}.pdf`; a.click();
      toast.success(`${cores.length} cores picked up`);
      setSel(new Set()); setDriver(""); setTruck(""); setRefused(false); sig.current?.clear();
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (isReadOnly(shop)) return <p className="py-20 text-center text-muted-foreground">Pickups are paused until the plan is activated.</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <Label>Supplier</Label>
        <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setSel(new Set()); }} className="h-12 w-full rounded-md border bg-input/30 px-3"><option value="">Select supplier…</option>{sup.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        {supplierId && (
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b p-3"><span className="text-sm">{items.length} in return bin</span><Button size="sm" variant="secondary" onClick={() => setSel(new Set(items.map((i) => i.id)))}>Select all</Button></div>
            {items.map((c) => (
              <label key={c.id} className="flex items-center gap-3 border-b p-3 last:border-0">
                <input type="checkbox" className="h-5 w-5" checked={sel.has(c.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(c.id); else n.delete(c.id); setSel(n); }} />
                <span className="font-display text-xl">#{c.short_code}</span><span className="text-sm">{c.part_number}</span><span className="ml-auto text-sm text-muted-foreground">{money(c.expected_core_amount)}</span>
              </label>
            ))}
            {!items.length && <p className="p-6 text-center text-sm text-muted-foreground">Nothing in the bin for this supplier.</p>}
          </div>
        )}
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <h2 className="text-3xl">Driver sign-off</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Driver name</Label><Input value={driver} disabled={refused} onChange={(e) => setDriver(e.target.value)} className="h-11" /></div>
          <div className="space-y-1"><Label>Truck #</Label><Input value={truck} onChange={(e) => setTruck(e.target.value)} className="h-11" /></div>
        </div>
        {!refused && <ClientOnly fallback={<div className="h-48 rounded bg-muted" />}><Suspense fallback={<div className="h-48 rounded bg-muted" />}><SignaturePad ref={sig} /></Suspense></ClientOnly>}
        <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => sig.current?.clear()}>Clear</Button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={refused} onChange={(e) => setRefused(e.target.checked)} />Driver refused to sign</label></div>
        <Button className="h-14 w-full text-lg" disabled={busy || !sel.size} onClick={complete}>{busy ? "Saving…" : `Complete pickup (${sel.size})`}</Button>
      </div>
    </div>
  );
}

function History() {
  const { shop } = useShop();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["manifests", shop?.id], enabled: !!shop,
    queryFn: async () => (await supabase.from("pickup_manifests").select("*, suppliers(name), pickup_manifest_items(count)").eq("shop_id", shop!.id).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <div className="space-y-2">
      {(q.data ?? []).map((m) => (
        <div key={m.id} className="rounded-lg border bg-card p-4">
          <button className="flex w-full flex-wrap items-center gap-4 text-left" onClick={() => setOpen(open === m.id ? null : m.id)}>
            <span className="font-semibold">{new Date(m.created_at).toLocaleString()}</span>
            <span>{m.suppliers?.name}</span><span>{m.driver_name}{m.driver_truck_number ? ` · Truck ${m.driver_truck_number}` : ""}</span>
            <span className="ml-auto text-sm text-muted-foreground">{(m.pickup_manifest_items as unknown as { count: number }[])[0]?.count ?? 0} items</span>
          </button>
          {open === m.id && <div className="mt-3"><EvidencePreview path={m.manifest_pdf_url} label="manifest PDF" /></div>}
        </div>
      ))}
      {!q.data?.length && <p className="py-10 text-center text-muted-foreground">No pickups yet.</p>}
    </div>
  );
}
