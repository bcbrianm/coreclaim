import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Mail, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { canWriteOff, isReadOnly, money, STATUS_LABEL } from "@/lib/coreclaim";
import { CORE_SELECT, updateCore, type Core } from "@/lib/core-actions";
import { uploadEvidence } from "@/lib/evidence";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EvidencePreview } from "./EvidencePreview";
import { StatusBadge } from "./StatusBadge";
import { PrintLabelButton } from "./QrLabel";

export function CoreDrawer({ coreId, onClose }: { coreId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!coreId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">{coreId && <Body coreId={coreId} />}</SheetContent>
    </Sheet>
  );
}

function Body({ coreId }: { coreId: string }) {
  const { activeMember, role, shop, team } = useShop();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadField, setUploadField] = useState<"invoice_image_url" | "condition_photo_url">("condition_photo_url");
  const ro = isReadOnly(shop);

  const core = useQuery({
    queryKey: ["core", coreId],
    queryFn: async () => { const { data, error } = await supabase.from("cores").select(CORE_SELECT).eq("id", coreId).single(); if (error) throw error; return data as Core; },
  });
  const events = useQuery({
    queryKey: ["core-events", coreId],
    queryFn: async () => (await supabase.from("core_events").select("*").eq("core_id", coreId).order("created_at", { ascending: false })).data ?? [],
  });

  const c = core.data;
  if (!c) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const variance = Number(c.expected_core_amount) - Number(c.credited_amount);
  const closed = ["CREDIT_VERIFIED", "WRITTEN_OFF", "DELETED_IN_ERROR"].includes(c.current_status);

  async function act(patch: Parameters<typeof updateCore>[1], ev: string, meta?: Record<string, unknown>) {
    setBusy(true);
    try { await updateCore(c!, patch, ev, activeMember?.id ?? null, meta); toast.success("Updated"); qc.invalidateQueries(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const path = await uploadEvidence(c!.shop_id, uploadField === "invoice_image_url" ? "invoices" : "conditions", f);
      await updateCore(c!, { [uploadField]: path }, uploadField === "invoice_image_url" ? "INVOICE_ATTACHED" : "CONDITION_PHOTO_ADDED", activeMember?.id ?? null);
      qc.invalidateQueries(); toast.success("Uploaded");
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); e.target.value = ""; }
  }

  function disputeMail() {
    const to = c!.suppliers?.ar_dispute_email ?? "";
    const subject = `Core credit dispute — Invoice ${c!.supplier_invoice_number} / Part ${c!.part_number}`;
    const body = `Account: ${c!.suppliers?.account_number ?? ""}\nInvoice: ${c!.supplier_invoice_number}\nPart: ${c!.part_number} (${c!.part_description ?? ""})\nCore ref: #${c!.short_code}\nExpected core credit: ${money(c!.expected_core_amount)}\nCredited: ${money(c!.credited_amount)}\nOutstanding: ${money(variance)}\n\nPlease credit the outstanding amount. Signed pickup manifest available on request.`;
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    void act({ current_status: "DISPUTED" }, "DISPUTE_SENT", { to });
  }

  const actorName = (id: string | null) => team.find((t) => t.id === id)?.full_name ?? (id ? "Team member" : "System");

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="font-display text-4xl">#{c.short_code}</SheetTitle>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={c.current_status} /><span className="text-sm text-muted-foreground">{c.suppliers?.name} · {c.part_number}{c.unit_sequence > 1 ? ` (unit ${c.unit_sequence})` : ""}</span></div>
      </SheetHeader>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field k="Invoice #" v={c.supplier_invoice_number} /><Field k="Invoice date" v={c.invoice_date} />
        <Field k="RO #" v={c.ro_number} /><Field k="Return deadline" v={c.return_deadline} />
        <Field k="Description" v={c.part_description} /><Field k="Type" v={c.return_type === "UNUSED_PART_RMA" ? "Unused part RMA" : "Core exchange"} />
        <Field k="Part cost" v={money(c.part_cost)} /><Field k="Expected core" v={money(c.expected_core_amount)} />
        <Field k="Credited" v={money(c.credited_amount)} /><Field k="Variance" v={money(variance)} />
        <Field k="Box intact" v={c.original_box_intact ? "Yes" : "No (override)"} /><Field k="VIN" v={c.vin} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><p className="mb-1 text-xs uppercase text-muted-foreground">Invoice</p><EvidencePreview path={c.invoice_image_url} label="invoice" /></div>
        <div><p className="mb-1 text-xs uppercase text-muted-foreground">Condition</p><EvidencePreview path={c.condition_photo_url} label="photo" /></div>
      </div>

      <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onFile} />
      {!ro && (
        <div className="flex flex-wrap gap-2">
          <PrintLabelButton core={{ ...c, supplier_name: c.suppliers?.name }} />
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setUploadField("invoice_image_url"); fileRef.current?.click(); }}><Camera className="mr-2 h-4 w-4" />Invoice</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setUploadField("condition_photo_url"); fileRef.current?.click(); }}><Camera className="mr-2 h-4 w-4" />Condition</Button>
        </div>
      )}

      {!ro && !closed && (
        <div className="space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Actions</p>
          <div className="flex flex-wrap gap-2">
            {["NEEDS_REVIEW", "AWAITING_TEARDOWN", "DAMAGED_CORE_HOLD"].includes(c.current_status) && <Button size="sm" disabled={busy} onClick={() => act({ current_status: "IN_RETURN_BIN" }, "TORN_DOWN")}>Mark torn down</Button>}
            {c.current_status !== "DAMAGED_CORE_HOLD" && <Button size="sm" variant="destructive" disabled={busy} onClick={() => act({ current_status: "DAMAGED_CORE_HOLD" }, "DAMAGED_HOLD")}>Damaged core hold</Button>}
            {c.original_box_intact && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ original_box_intact: false }, "BOX_DESTROYED_OVERRIDE")}>Destroyed box override</Button>}
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ return_type: c.return_type === "UNUSED_PART_RMA" ? "CORE_EXCHANGE" : "UNUSED_PART_RMA" }, "RETURN_TYPE_CHANGED")}>{c.return_type === "UNUSED_PART_RMA" ? "Set core exchange" : "Unused part RMA"}</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ current_status: "PENDING_NEXT_CYCLE" }, "PENDING_NEXT_CYCLE")}>Pending next cycle</Button>
            {["PICKED_UP_BY_DRIVER", "PARTIAL_CREDIT", "DISPUTE_ELIGIBLE", "EXPIRED", "REJECTED_BY_VENDOR"].includes(c.current_status) && <Button size="sm" variant="secondary" disabled={busy} onClick={disputeMail}><Mail className="mr-2 h-4 w-4" />Send dispute email</Button>}
            {canWriteOff(role, variance) ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ current_status: "WRITTEN_OFF" }, "WRITTEN_OFF", { amount: variance })}>Write off {money(variance)}</Button>
              : role === "super_user" && <span className="self-center text-xs text-muted-foreground">Write-offs over $50 need an admin</span>}
            <Button size="sm" variant="secondary" asChild><Link to="/app/warranty" search={{ core: c.id }}>Build warranty claim</Link></Button>
          </div>
        </div>
      )}
      {!ro && role === "admin" && (
        <div className="flex flex-wrap gap-2">
          {closed && c.current_status !== "DELETED_IN_ERROR" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ current_status: "PICKED_UP_BY_DRIVER" }, "REOPENED")}>Reopen</Button>}
          {c.current_status === "DELETED_IN_ERROR" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ current_status: "AWAITING_TEARDOWN" }, "RESTORED")}>Restore</Button>
            : <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => confirm("Mark this core as deleted in error?") && act({ current_status: "DELETED_IN_ERROR" }, "SOFT_DELETED")}><Trash2 className="mr-2 h-4 w-4" />Delete (soft)</Button>}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs uppercase text-muted-foreground">Timeline</p>
        <ol className="space-y-2 border-l pl-4">
          {(events.data ?? []).map((e) => (
            <li key={e.id} className="text-sm">
              <div className="font-semibold">{e.event_type.replace(/_/g, " ")}{e.new_status && e.new_status !== e.previous_status ? ` → ${STATUS_LABEL[e.new_status] ?? e.new_status}` : ""}</div>
              <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()} · {e.actor_type === "USER" ? actorName(e.actor_member_id) : e.actor_type}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string | number | null | undefined }) {
  return <div><div className="text-xs uppercase text-muted-foreground">{k}</div><div className="font-medium">{v ?? "—"}</div></div>;
}
