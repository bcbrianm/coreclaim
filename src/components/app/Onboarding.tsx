import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const TIMEZONES = ["America/New_York","America/Chicago","America/Denver","America/Phoenix","America/Los_Angeles","America/Anchorage","Pacific/Honolulu"];

export function OnboardingForm({ onCreated, title = "Set up your shop" }: { onCreated?: (id: string) => void; title?: string }) {
  const { refresh, setShopId } = useShop();
  const [f, setF] = useState({ name: "", phone: "", tz: "America/Denver", owner: "", pin: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { data, error } = await supabase.rpc("create_shop_workspace", { shop_name: f.name, shop_phone: f.phone, shop_timezone: f.tz, owner_full_name: f.owner, owner_pin: f.pin });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await refresh(); setShopId(data as string); onCreated?.(data as string);
    toast.success("Shop created. Your 14-day free trial has started.");
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-4xl">{title}</h2>
      <div className="space-y-2"><Label>Shop name</Label><Input required value={f.name} onChange={set("name")} className="h-12" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Phone</Label><Input value={f.phone} onChange={set("phone")} className="h-12" /></div>
        <div className="space-y-2"><Label>Timezone</Label>
          <select value={f.tz} onChange={set("tz")} className="h-12 w-full rounded-md border bg-input/30 px-3">{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Your name</Label><Input required value={f.owner} onChange={set("owner")} className="h-12" /></div>
        <div className="space-y-2"><Label>Your 4-digit PIN</Label><Input required inputMode="numeric" pattern="\d{4}" maxLength={4} value={f.pin} onChange={set("pin")} className="h-12 tracking-[0.5em]" /></div>
      </div>
      <Button className="h-12 w-full text-base" disabled={busy}>{busy ? "Creating…" : "Create shop"}</Button>
    </form>
  );
}
