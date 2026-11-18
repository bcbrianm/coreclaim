import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { ROLE_LABEL, type AppRole } from "@/lib/coreclaim";
import { TIMEZONES } from "@/components/app/Onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/admin")({ component: Admin });
const ROLES: AppRole[] = ["mechanic", "shop_user", "super_user", "admin"];
const copy = (t: string) => { void navigator.clipboard.writeText(t); toast.success("Copied"); };

function Admin() {
  return (
    <Tabs defaultValue="team">
      <TabsList><TabsTrigger value="team">Team</TabsTrigger><TabsTrigger value="shop">Shop</TabsTrigger><TabsTrigger value="alerts">Alerts & integrations</TabsTrigger><TabsTrigger value="billing">Billing</TabsTrigger></TabsList>
      <TabsContent value="team"><Team /></TabsContent>
      <TabsContent value="shop"><ShopSettings /></TabsContent>
      <TabsContent value="alerts"><Integrations /></TabsContent>
      <TabsContent value="billing"><Billing /></TabsContent>
    </Tabs>
  );
}

function Team() {
  const { shop, team, refresh } = useShop();
  const qc = useQueryClient();
  const pins = useQuery({ queryKey: ["pin-status", shop?.id], enabled: !!shop, queryFn: async () => (await supabase.rpc("member_pin_status", { p_shop_id: shop!.id })).data ?? [] });
  const invites = useQuery({ queryKey: ["invites", shop?.id], enabled: !!shop, queryFn: async () => (await supabase.from("shop_invites").select("*").eq("shop_id", shop!.id).eq("status", "pending").order("created_at", { ascending: false })).data ?? [] });
  const [mech, setMech] = useState({ name: "", pin: "", role: "mechanic" as AppRole });
  const [inv, setInv] = useState({ email: "", name: "", role: "shop_user" as AppRole });
  const inviteLink = (i: { id: string; email: string }) => `${window.location.origin}/auth?invite=${i.id}&email=${encodeURIComponent(i.email)}`;

  async function addFloor(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.from("shop_members").insert({ shop_id: shop!.id, full_name: mech.name, role: mech.role, user_id: null }).select().single();
    if (error) { toast.error(error.message); return; }
    const { error: e2 } = await supabase.rpc("set_shop_member_pin", { target_member_id: data.id, new_pin: mech.pin });
    if (e2) { toast.error(e2.message); return; }
    setMech({ name: "", pin: "", role: "mechanic" }); await refresh(); qc.invalidateQueries({ queryKey: ["pin-status"] }); toast.success("Floor profile added");
  }
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.from("shop_invites").insert({ shop_id: shop!.id, email: inv.email.trim().toLowerCase(), full_name: inv.name, role: inv.role }).select().single();
    if (error) { toast.error(error.message); return; }
    copy(inviteLink(data)); setInv({ email: "", name: "", role: "shop_user" }); qc.invalidateQueries({ queryKey: ["invites"] });
    toast.message("Invite link copied — send it to them. Automatic invite emails arrive in Phase 2.");
  }
  async function update(m: Tables<"shop_members">, patch: Partial<Tables<"shop_members">>) {
    const { error } = await supabase.from("shop_members").update(patch).eq("id", m.id);
    if (error) toast.error(error.message); else { await refresh(); toast.success("Saved"); }
  }
  async function setPin(m: Tables<"shop_members">) {
    const p = prompt(`New 4-digit PIN for ${m.full_name}`); if (!p) return;
    const { error } = await supabase.rpc("set_shop_member_pin", { target_member_id: m.id, new_pin: p });
    if (error) toast.error(error.message); else { toast.success("PIN set"); qc.invalidateQueries({ queryKey: ["pin-status"] }); }
  }
  async function unlock(m: Tables<"shop_members">) {
    const { error } = await supabase.rpc("unlock_shop_member_pin", { target_member_id: m.id });
    if (error) toast.error(error.message); else { toast.success("Unlocked"); qc.invalidateQueries({ queryKey: ["pin-status"] }); }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={addFloor} className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-2xl">Add PIN-only floor profile</h3>
          <div className="grid grid-cols-3 gap-2">
            <Input required placeholder="Name" value={mech.name} onChange={(e) => setMech({ ...mech, name: e.target.value })} />
            <Input required placeholder="PIN" inputMode="numeric" pattern="\d{4}" maxLength={4} value={mech.pin} onChange={(e) => setMech({ ...mech, pin: e.target.value })} />
            <select value={mech.role} onChange={(e) => setMech({ ...mech, role: e.target.value as AppRole })} className="rounded-md border bg-input/30 px-2 text-sm">{ROLES.filter((r) => r !== "admin").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          </div>
          <Button>Add profile</Button>
        </form>
        <form onSubmit={invite} className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-2xl">Invite by email</h3>
          <div className="grid grid-cols-3 gap-2">
            <Input required type="email" placeholder="Email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />
            <Input placeholder="Name" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} />
            <select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as AppRole })} className="rounded-md border bg-input/30 px-2 text-sm">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          </div>
          <Button>Create invite & copy link</Button>
          {(invites.data ?? []).map((i) => <div key={i.id} className="flex items-center justify-between text-sm"><span>{i.email} · {ROLE_LABEL[i.role as AppRole]}</span><span className="flex gap-1"><Button type="button" size="sm" variant="ghost" onClick={() => copy(inviteLink(i))}><Copy className="mr-1 h-3 w-3" />Copy Invite Link</Button><Button type="button" size="sm" variant="ghost" onClick={async () => { await supabase.from("shop_invites").delete().eq("id", i.id); qc.invalidateQueries({ queryKey: ["invites"] }); }}>Revoke</Button></span></div>)}
        </form>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{["Name", "Email", "Role", "PIN", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {team.map((m) => {
              const p = pins.data?.find((x) => x.member_id === m.id);
              return (
                <tr key={m.id} className={`border-t ${m.is_active ? "" : "opacity-50"}`}>
                  <td className="px-3 py-2 font-semibold">{m.full_name}</td>
                  <td className="px-3 py-2">{m.email ?? <span className="text-muted-foreground">PIN-only</span>}</td>
                  <td className="px-3 py-2"><select value={m.role} onChange={(e) => update(m, { role: e.target.value as AppRole })} className="rounded-md border bg-input/30 px-2 py-1">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                  <td className="px-3 py-2">{p?.is_locked ? <span className="text-destructive">Locked</span> : p?.has_pin ? "Set" : "None"}</td>
                  <td className="flex gap-1 px-3 py-2">
                    <Button size="sm" variant="secondary" onClick={() => setPin(m)}>Set PIN</Button>
                    {p?.is_locked && <Button size="sm" variant="secondary" onClick={() => unlock(m)}>Unlock</Button>}
                    <Button size="sm" variant="ghost" onClick={() => update(m, { is_active: !m.is_active })}>{m.is_active ? "Deactivate" : "Reactivate"}</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShopSettings() {
  const { shop, refresh } = useShop();
  const [f, setF] = useState({ name: "", phone: "", address: "", timezone: "", labor_rate_hourly: "" });
  useEffect(() => { if (shop) setF({ name: shop.name, phone: shop.phone ?? "", address: shop.address ?? "", timezone: shop.timezone, labor_rate_hourly: String(shop.labor_rate_hourly) }); }, [shop]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("shops").update({ ...f, labor_rate_hourly: Number(f.labor_rate_hourly) }).eq("id", shop!.id);
    if (error) toast.error(error.message); else { toast.success("Saved"); void refresh(); }
  }
  const flags = Object.entries((shop?.feature_flags ?? {}) as Record<string, unknown>).filter(([, v]) => v);
  return (
    <form onSubmit={save} className="max-w-xl space-y-3 rounded-lg border bg-card p-5">
      {(["name", "phone", "address"] as const).map((k) => <div key={k} className="space-y-1"><Label className="capitalize">{k}</Label><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Timezone</Label><select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} className="h-9 w-full rounded-md border bg-input/30 px-2">{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="space-y-1"><Label>Labor rate $/h</Label><Input type="number" step="0.01" value={f.labor_rate_hourly} onChange={(e) => setF({ ...f, labor_rate_hourly: e.target.value })} /></div>
      </div>
      {flags.length > 0 && <p className="text-xs text-muted-foreground">Beta features on: {flags.map(([k]) => k).join(", ")}</p>}
      <Button>Save</Button>
    </form>
  );
}

function Integrations() {
  const { shop } = useShop();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", shop?.id], enabled: !!shop, queryFn: async () => (await supabase.from("shop_integrations").select("*").eq("shop_id", shop!.id).single()).data });
  const [f, setF] = useState<Tables<"shop_integrations"> | null>(null);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  if (!f || !shop) return null;
  const webhookUrl = `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/sms-webhook?shop_id=${shop.id}`;
  const list = (k: "manager_phones" | "manager_emails" | "owner_phones" | "owner_emails") => (
    <div className="space-y-1"><Label>{k.replace("_", " ")}</Label><Input placeholder="Comma separated" value={f[k].join(", ")} onChange={(e) => setF({ ...f, [k]: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></div>
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { id: _id, shop_id: _s, created_at: _c, updated_at: _u, ...patch } = f!;
    const { error } = await supabase.from("shop_integrations").update(patch).eq("id", f!.id);
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["integrations"] }); }
  }
  return (
    <form onSubmit={save} className="grid max-w-3xl gap-4 rounded-lg border bg-card p-5 md:grid-cols-2">
      <div className="space-y-1"><Label>Alert preference</Label><select value={f.alert_preference} onChange={(e) => setF({ ...f, alert_preference: e.target.value })} className="h-9 w-full rounded-md border bg-input/30 px-2"><option value="sms">SMS</option><option value="email">Email</option><option value="both">Both</option></select></div>
      <div className="space-y-1"><Label>Shop management system</Label><select value={f.sms_provider} onChange={(e) => setF({ ...f, sms_provider: e.target.value })} className="h-9 w-full rounded-md border bg-input/30 px-2">{["none", "shopmonkey", "tekmetric", "fullbay"].map((x) => <option key={x}>{x}</option>)}</select></div>
      {list("manager_phones")}{list("manager_emails")}{list("owner_phones")}{list("owner_emails")}
      <div className="space-y-1"><Label>API key</Label><Input type="password" value={f.api_key_encrypted ?? ""} onChange={(e) => setF({ ...f, api_key_encrypted: e.target.value })} /></div>
      <div className="space-y-1"><Label>Webhook secret</Label><Input type="password" value={f.webhook_secret ?? ""} onChange={(e) => setF({ ...f, webhook_secret: e.target.value })} /></div>
      <div className="space-y-1 md:col-span-2"><Label>Outbound webhook URL</Label><Input value={f.outbound_webhook_url ?? ""} onChange={(e) => setF({ ...f, outbound_webhook_url: e.target.value })} /></div>
      <CopyRow label="Incoming webhook URL" value={webhookUrl} />
      <CopyRow label="Inbound invoice email" value={shop.inbound_email_alias} hint={`Routing slug: ${shop.inbound_email_alias.split("@")[0]}`} />
      <Button className="md:col-span-2">Save</Button>
    </form>
  );
}

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="space-y-1 md:col-span-2"><Label>{label}</Label><div className="flex gap-2"><Input readOnly value={value} /><Button type="button" variant="secondary" onClick={() => copy(value)}><Copy className="h-4 w-4" /></Button></div>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function Billing() {
  const { shop } = useShop();
  if (!shop) return null;
  const showUpgrade = !shop.stripe_customer_id || shop.subscription_status === "trialing";
  return (
    <div className="max-w-xl space-y-4 rounded-lg border bg-card p-5">
      <h3 className="text-2xl">Plan</h3>
      <p>Tier <b className="uppercase">{shop.subscription_tier}</b> · Status <b>{shop.subscription_status}</b>{shop.trial_ends_at && shop.subscription_status === "trialing" ? ` · Trial ends ${new Date(shop.trial_ends_at).toLocaleDateString()}` : ""}</p>
      {showUpgrade && <div className="flex gap-2"><Button disabled>Upgrade to Starter ($99/mo)</Button><Button disabled>Upgrade to Pro ($199/mo)</Button></div>}
      {shop.stripe_customer_id && <Button variant="secondary" disabled>Manage Subscription / Invoices</Button>}
      <p className="text-xs text-muted-foreground">Checkout is connected in Phase 2.</p>
    </div>
  );
}
