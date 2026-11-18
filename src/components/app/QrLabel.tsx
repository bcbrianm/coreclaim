import { QRCodeSVG } from "qrcode.react";
import { createPortal } from "react-dom";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { qrValue } from "@/lib/coreclaim";

export type LabelCore = { short_code: string; part_number: string; supplier_name?: string | null; return_deadline: string | null };

export function PrintLabelButton({ core, size = "sm" }: { core: LabelCore; size?: "sm" | "default" | "lg" }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button size={size} variant="secondary" onClick={() => { setShow(true); setTimeout(() => { window.print(); setShow(false); }, 150); }}><Printer className="mr-2 h-4 w-4" />Print label</Button>
      {show && createPortal(<ThermalLabel core={core} />, document.body)}
    </>
  );
}

export function ThermalLabel({ core }: { core: LabelCore }) {
  return (
    <div className="print-label">
      <QRCodeSVG value={qrValue(core.short_code)} marginSize={2} />
      <div style={{ lineHeight: 1.1, overflow: "hidden" }}>
        <div style={{ fontSize: "18pt", fontWeight: 800 }}>#{core.short_code}</div>
        <div style={{ fontSize: "7pt" }}>{core.part_number}</div>
        <div style={{ fontSize: "7pt" }}>{core.supplier_name}</div>
        <div style={{ fontSize: "7pt", fontWeight: 700 }}>Due {core.return_deadline ?? "—"}</div>
      </div>
    </div>
  );
}
