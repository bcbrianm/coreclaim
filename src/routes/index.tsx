import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/Logo";
import { ScanLine, Truck, FileCheck2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoreClaim — Recover every core deposit" },
      { name: "description", content: "Track core deposits, RMAs and warranty claims from invoice to vendor credit for auto and diesel repair shops." },
      { property: "og:title", content: "CoreClaim — Recover every core deposit" },
      { property: "og:description", content: "Track core deposits, RMAs and warranty claims from invoice to vendor credit." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ScanLine, t: "Bay scanner", d: "QR labels and 4-digit codes. Techs tag cores in seconds, even offline." },
  { icon: Truck, t: "Signed pickups", d: "Driver signatures and PDF manifests for every core that leaves." },
  { icon: FileCheck2, t: "Statement reconciliation", d: "Match vendor credits, including split and partial ones, to every core." },
  { icon: ShieldCheck, t: "Role lockdown", d: "Mechanics never see dollars. Owners see everything." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Button asChild variant="secondary"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">For independent auto & heavy-duty diesel shops</p>
        <h1 className="max-w-3xl text-6xl leading-none md:text-8xl">Stop leaving core money on the shelf.</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">CoreClaim tracks every returnable part from invoice to bay teardown, driver pickup and vendor credit. 14-day free trial.</p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg" className="h-14 px-8 text-lg"><Link to="/auth">Start free trial</Link></Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-4">
        {features.map((f) => (
          <div key={f.t} className="rounded-lg border bg-card p-6">
            <f.icon className="mb-4 h-8 w-8 text-primary" />
            <h3 className="text-2xl">{f.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
