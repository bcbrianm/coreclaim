import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useShop } from "@/hooks/use-shop";
import { isPro } from "@/lib/coreclaim";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ProGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { shop } = useShop();
  const [open, setOpen] = useState(false);
  if (isPro(shop)) return <>{children}</>;
  return (
    <div className="py-16 text-center">
      <span className="mb-3 inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-bold text-primary-foreground"><Lock className="h-3 w-3" />PRO</span>
      <h2 className="text-4xl">{feature}</h2>
      <p className="mt-2 text-muted-foreground">Available on the Pro plan ($199/mo).</p>
      <Button className="mt-6" onClick={() => setOpen(true)}>Upgrade to Pro</Button>
      <UpgradeDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function UpgradeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upgrade to Pro</DialogTitle><DialogDescription>Statement reconciliation, warranty claims and shop-system integrations.</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">Online checkout is being connected. Ask your shop admin to upgrade from Admin → Billing once it's live.</p>
      </DialogContent>
    </Dialog>
  );
}
