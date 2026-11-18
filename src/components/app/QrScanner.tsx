import { Scanner } from "@yudiel/react-qr-scanner";

export default function QrScanner({ onScan, onError }: { onScan: (v: string | undefined) => void; onError: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Scanner onScan={(codes) => onScan(codes[0]?.rawValue)} onError={() => onError()} constraints={{ facingMode: "environment" }} />
    </div>
  );
}
