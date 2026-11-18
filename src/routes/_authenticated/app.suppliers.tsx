import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { useSuppliers } from "@/lib/use-suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/suppliers")({ component: Suppliers });

function Suppliers() {
  const { shop, role } = useShop();
  const sup = useSuppliers(shop?.id, true);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const isAdmin = role === "admin";
  const refresh = () => qc.invalidateQueries({ queryKey: ["suppliers"] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("suppliers").insert({ shop_id: shop!.id, name });
    if (error) { toast.error(error.message); return; } setName(""); refresh();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2"><Input required placeholder="New supplier name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 max-w-sm" /><Button className="h-11">Add supplier</Button></form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{["Name", "Return days", "Grace days", "A/R dispute email", "Account #", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>{sup.data?.map((s) => <Row key={s.id} s={s} isAdmin={isAdmin} onSaved={refresh} />)}</tbody>
        </table>
      </div>
      {!isAdmin && <p className="text-xs text-muted-foreground">Only admins can change return windows (SLAs).</p>}
    </div>
  );
}

function Row({ s, isAdmin, onSaved }: { s: Tables<"suppliers">; isAdmin: boolean; onSaved: () => void }) {
  const [f, setF] = useState(s);
  async function save(patch: Partial<Tables<"suppliers">>) {
    const { error } = await supabase.from("suppliers").update(patch).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Saved"); onSaved(); }
  }
  return (
    <tr className={`border-t ${s.is_active ? "" : "opacity-50"}`}>
      <td className="px-3 py-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></td>
      <td className="px-3 py-2"><Input type="number" disabled={!isAdmin} value={f.default_return_window_days} onChange={(e) => setF({ ...f, default_return_window_days: Number(e.target.value) })} className="w-20" /></td>
      <td className="px-3 py-2"><Input type="number" disabled={!isAdmin} value={f.grace_period_days} onChange={(e) => setF({ ...f, grace_period_days: Number(e.target.value) })} className="w-20" /></td>
      <td className="px-3 py-2"><Input value={f.ar_dispute_email ?? ""} onChange={(e) => setF({ ...f, ar_dispute_email: e.target.value })} /></td>
      <td className="px-3 py-2"><Input value={f.account_number ?? ""} onChange={(e) => setF({ ...f, account_number: e.target.value })} /></td>
      <td className="flex gap-1 px-3 py-2">
        <Button size="sm" onClick={() => save({ name: f.name, ar_dispute_email: f.ar_dispute_email || null, account_number: f.account_number || null, ...(isAdmin ? { default_return_window_days: f.default_return_window_days, grace_period_days: f.grace_period_days } : {}) })}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => save({ is_active: !s.is_active })}>{s.is_active ? "Deactivate" : "Reactivate"}</Button>
      </td>
    </tr>
  );
}
