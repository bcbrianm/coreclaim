import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PinPad({ length = 4, onComplete, busy, label }: { length?: number; onComplete: (pin: string) => void | Promise<void>; busy?: boolean; label?: string }) {
  const [pin, setPin] = useState("");
  useEffect(() => {
    if (pin.length === length) { const p = pin; setPin(""); void onComplete(p); }
  }, [pin, length, onComplete]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < length ? p + e.key : p));
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [length]);
  return (
    <div className="mx-auto w-full max-w-xs">
      {label && <p className="mb-3 text-center text-sm text-muted-foreground">{label}</p>}
      <div className="mb-5 flex justify-center gap-3">
        {Array.from({ length }).map((_, i) => (
          <div key={i} className={`h-4 w-4 rounded-full border-2 border-primary ${i < pin.length ? "bg-primary" : ""}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9","","0","del"].map((k) => k === "" ? <div key="sp" /> : (
          <Button key={k} type="button" variant="secondary" disabled={busy} className="h-16 text-2xl font-display"
            onClick={() => k === "del" ? setPin((p) => p.slice(0, -1)) : setPin((p) => (p.length < length ? p + k : p))}>
            {k === "del" ? <Delete className="h-6 w-6" /> : k}
          </Button>
        ))}
      </div>
    </div>
  );
}
