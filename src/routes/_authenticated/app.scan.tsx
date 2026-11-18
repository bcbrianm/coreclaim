import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { isReadOnly, parseCoreQr } from "@/lib/coreclaim";
import { submitBayUpdate } from "@/lib/offline-queue";
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/app/PinPad";
import { StatusBadge } from "@/components/app/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";

const QrScanner = lazy(() => import("@/components/app/QrScanner"));
export const Route = createFileRoute("/_authenticated/app/scan")({ component: BayScanner });

type MCore = Tables<"mechanic_cores_view">;
const BAY = ["NEEDS_REVIEW", "AWAITING_TEARDOWN", "IN_RETURN_BIN", "DAMAGED_CORE_HOLD"];

function BayScanner() {
  const { shop, activeMember } = useShop();
  const [cameraOff, setCameraOff] = useState(false);
  const [core, setCore] = useState<MCore | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [boxIntact, setBoxIntact] = useState(true);
  const [busy, setBusy] = useState(false);
  const lastScan = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);
  const ro = isReadOnly(shop);

  async function lookup(raw: string | undefined) {
    const p = parseCoreQr(raw);
    if (!p || !shop) { if (raw) toast.error("Not a CoreClaim code"); return; }
    if (lastScan.current === p.value && core) return;
    lastScan.current = p.value;
    let qb = supabase.from("mechanic_cores_view").select("*").eq("shop_id", shop.id);
    qb = p.kind === "id" ? qb.eq("id", p.value) : qb.eq("short_code", p.value);
    const { data } = await qb.order("created_at", { ascending: false }).limit(5);
    const hit = (data ?? []).find((c) => BAY.includes(c.current_status ?? "")) ?? data?.[0];
    if (!hit) { toast.error(`No core #${p.value}`); lastScan.current = ""; return; }
    setCore(hit); setPhoto(null); setBoxIntact(hit.original_box_intact ?? true);
  }

  async function submit(status: "IN_RETURN_BIN" | "DAMAGED_CORE_HOLD") {
    if (!core || !shop) return;
    setBusy(true);
    try {
      const sent = await submitBayUpdate({ shopId: shop.id, photo, payload: { p_core_id: core.id!, p_new_status: status, p_original_box_intact: boxIntact, p_actor_member_id: activeMember?.id ?? null } });
      toast.success(sent ? `#${core.short_code} → ${status === "IN_RETURN_BIN" ? "Return bin" : "Damaged hold"}` : "Saved offline — will sync when Wi-Fi returns");
      setCore(null); setPhoto(null); lastScan.current = "";
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (ro) return <p className="py-20 text-center text-muted-foreground">Scanning is paused until the shop's plan is activated.</p>;

  if (core) return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-start justify-between">
        <div><div className="font-display text-6xl">#{core.short_code}</div><div className="text-lg">{core.part_number} · {core.supplier_name}</div><div className="text-sm text-muted-foreground">{core.part_description} {core.ro_number ? `· RO ${core.ro_number}` : ""} {core.vehicle_description ?? ""}</div></div>
        <Button variant="ghost" size="icon" onClick={() => { setCore(null); lastScan.current = ""; }}><X /></Button>
      </div>
      <StatusBadge status={core.current_status ?? ""} />
      {!BAY.includes(core.current_status ?? "") ? <p className="rounded bg-muted p-4">This core has already left the bay.</p> : (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" className="h-16 w-full text-lg" onClick={() => fileRef.current?.click()}><Camera className="mr-2 h-6 w-6" />{photo ? "Photo attached ✓ (retake)" : "Take condition photo"}</Button>
          <label className="flex items-center gap-3 rounded border p-4 text-lg"><input type="checkbox" className="h-6 w-6" checked={boxIntact} onChange={(e) => setBoxIntact(e.target.checked)} />Original box intact</label>
          <div className="grid grid-cols-2 gap-3">
            <Button className="h-24 text-xl" disabled={busy} onClick={() => submit("IN_RETURN_BIN")}><CheckCircle2 className="mr-2 h-7 w-7" />Return bin</Button>
            <Button variant="destructive" className="h-24 text-xl" disabled={busy} onClick={() => submit("DAMAGED_CORE_HOLD")}><AlertTriangle className="mr-2 h-7 w-7" />Damaged</Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
      <div>
        <h1 className="mb-3 text-4xl">Scan core</h1>
        {cameraOff ? <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">Camera unavailable — use the keypad.</div> : (
          <ClientOnly fallback={<div className="aspect-square animate-pulse rounded-lg bg-muted" />}>
            <Suspense fallback={<div className="aspect-square animate-pulse rounded-lg bg-muted" />}>
              <QrScanner onScan={lookup} onError={() => setCameraOff(true)} />
            </Suspense>
          </ClientOnly>
        )}
      </div>
      <div>
        <h2 className="mb-3 text-3xl">Or enter #code</h2>
        <PinPad length={4} label="4-digit code on the label" onComplete={(c) => lookup(c)} />
      </div>
    </div>
  );
}
