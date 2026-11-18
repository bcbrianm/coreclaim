import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop, type Member } from "@/hooks/use-shop";
import { ROLE_LABEL, type AppRole } from "@/lib/coreclaim";
import { PinPad } from "./PinPad";
import { Button } from "@/components/ui/button";

export function OperatorSwitch({ onDone }: { onDone?: () => void }) {
  const { team, setActiveMember, shop } = useShop();
  const [sel, setSel] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const active = team.filter((t) => t.is_active);

  async function verify(pin: string) {
    if (!sel) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("verify_shop_pin", { target_member_id: sel.id, raw_pin: pin });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("Wrong PIN"); return; }
    setActiveMember(sel); setSel(null); onDone?.();
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="mb-1 text-center text-4xl">{sel ? sel.full_name : "Who's working?"}</h2>
      <p className="mb-6 text-center text-muted-foreground">{shop?.name} · {sel ? "Enter your 4-digit PIN" : "Tap your name"}</p>
      {sel ? (
        <>
          <PinPad onComplete={verify} busy={busy} />
          <div className="mt-4 text-center"><Button variant="ghost" onClick={() => setSel(null)}>Back</Button></div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {active.map((m) => (
            <button key={m.id} onClick={() => setSel(m)} className="rounded-lg border bg-card p-5 text-left transition hover:border-primary">
              <div className="font-display text-2xl">{m.full_name}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[m.role as AppRole]}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
