import { money } from "./coreclaim";

type ManifestCore = { short_code: string; part_number: string; part_description: string | null; supplier_invoice_number: string; expected_core_amount: number };

export async function buildManifestPdf(o: { shopName: string; supplierName: string; driverName: string; truck: string | null; manifestId: string; cores: ManifestCore[]; signature: string | null }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text("Driver Pickup Manifest", 14, 18);
  doc.setFontSize(10);
  doc.text(`${o.shopName} → ${o.supplierName}`, 14, 26);
  doc.text(`Manifest ${o.manifestId.slice(0, 8)} · ${new Date().toLocaleString()}`, 14, 32);
  doc.text(`Driver: ${o.driverName}${o.truck ? ` · Truck ${o.truck}` : ""}`, 14, 38);
  let y = 50; doc.setFont("helvetica", "bold"); doc.text("Code", 14, y); doc.text("Part #", 34, y); doc.text("Description", 74, y); doc.text("Invoice", 140, y); doc.text("Core $", 180, y);
  doc.setFont("helvetica", "normal");
  for (const c of o.cores) {
    y += 7; if (y > 260) { doc.addPage(); y = 20; }
    doc.text(`#${c.short_code}`, 14, y); doc.text(c.part_number.slice(0, 18), 34, y); doc.text((c.part_description ?? "").slice(0, 32), 74, y); doc.text(c.supplier_invoice_number.slice(0, 18), 140, y); doc.text(money(c.expected_core_amount), 180, y);
  }
  y += 10; doc.text(`Total items: ${o.cores.length} · Total core value: ${money(o.cores.reduce((a, c) => a + Number(c.expected_core_amount), 0))}`, 14, y);
  y += 14; doc.text("Driver signature:", 14, y);
  if (o.signature) doc.addImage(o.signature, "PNG", 14, y + 3, 80, 30); else doc.text("Driver Refused Signature", 14, y + 10);
  return doc.output("blob");
}

export async function buildClaimPdf(o: { shopName: string; supplierName: string; core: { short_code: string; part_number: string; part_description: string | null; supplier_invoice_number: string; invoice_date: string | null; ro_number: string | null; vin: string | null; part_cost: number }; parentCode: string | null; failureDate: string; reason: string; hours: number; rate: number; total: number }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text("Warranty Claim", 14, 18);
  doc.setFontSize(10);
  const lines = [
    `Shop: ${o.shopName}`, `Supplier: ${o.supplierName}`, `Core ref: #${o.core.short_code}`, `Part: ${o.core.part_number} ${o.core.part_description ?? ""}`,
    `Original invoice: ${o.core.supplier_invoice_number} (${o.core.invoice_date ?? "—"})`, `RO: ${o.core.ro_number ?? "—"} · VIN: ${o.core.vin ?? "—"}`,
    o.parentCode ? `Prior failed core (warranty-on-warranty): #${o.parentCode}` : "", `Failure date: ${o.failureDate}`, `Reason: ${o.reason}`,
    `Part cost: ${money(o.core.part_cost)}`, `Labor: ${o.hours} h × ${money(o.rate)} = ${money(o.hours * o.rate)}`, `Total claim: ${money(o.total)}`,
  ].filter(Boolean);
  lines.forEach((l, i) => doc.text(doc.splitTextToSize(l, 180), 14, 30 + i * 8));
  return doc.output("blob");
}
