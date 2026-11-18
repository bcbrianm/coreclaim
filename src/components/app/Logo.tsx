export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded bg-primary font-display text-xl text-primary-foreground">CC</div>
      {!compact && <span className="font-display text-2xl tracking-wider">CORECLAIM</span>}
    </div>
  );
}
