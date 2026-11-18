import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutDashboard, ScanLine, PackagePlus, Truck, ShieldCheck, FileSpreadsheet, Store, Settings, LogOut, WifiOff, ChevronDown, Plus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ShopProvider, useShop } from "@/hooks/use-shop";
import { allowedSection, isReadOnly, money, ROLE_LABEL, returnBinValue } from "@/lib/coreclaim";
import { flushQueue, onQueueChange, queueCount } from "@/lib/offline-queue";
import { Logo } from "@/components/app/Logo";
import { OperatorSwitch } from "@/components/app/OperatorSwitch";
import { OnboardingForm } from "@/components/app/Onboarding";
import { PinPad } from "@/components/app/PinPad";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "CoreClaim" }, { name: "description", content: "CoreClaim shop workspace." }, { property: "og:title", content: "CoreClaim" }, { property: "og:description", content: "CoreClaim shop workspace." }] }),
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return <ShopProvider userId={user.id} email={user.email ?? null}><Gate /></ShopProvider>;
}

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
  { to: "/app/scan", label: "Bay Scanner", icon: ScanLine, section: "scan" },
  { to: "/app/intake", label: "Intake", icon: PackagePlus, section: "intake" },
  { to: "/app/pickup", label: "Driver Pickup", icon: Truck, section: "pickup" },
  { to: "/app/warranty", label: "Warranty", icon: ShieldCheck, section: "warranty" },
  { to: "/app/statements", label: "Statements", icon: FileSpreadsheet, section: "statements" },
  { to: "/app/suppliers", label: "Suppliers", icon: Store, section: "suppliers" },
  { to: "/app/admin", label: "Admin", icon: Settings, section: "admin" },
] as const;

function sectionOf(path: string) {
  const seg = path.replace(/^\/app\/?/, "").split("/")[0];
  return seg || "dashboard";
}

function Gate() {
  const s = useShop();
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const pinStatus = useQuery({
    queryKey: ["pin-status", s.shop?.id],
    enabled: !!s.shop,
    queryFn: async () => (await supabase.rpc("member_pin_status", { p_shop_id: s.shop!.id })).data ?? [],
  });
  const myMember = s.team.find((t) => t.user_id === s.userId && t.is_active);
  const needsPin = !!myMember && pinStatus.data && !pinStatus.data.find((p) => p.member_id === myMember.id)?.has_pin;

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("billing") === "success") { toast.success("Plan activated. Welcome aboard!"); void s.refresh(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (s.role && !allowedSection(s.role, sectionOf(loc.pathname))) navigate({ to: s.role === "mechanic" ? "/app/scan" : "/app", replace: true });
  }, [s.role, loc.pathname, navigate]);

  if (s.loading) return <Center><p className="text-muted-foreground">Loading shop…</p></Center>;
  if (!s.shops.length) return <Center><div className="w-full max-w-lg rounded-lg border bg-card p-8"><Logo /><div className="mt-6"><OnboardingForm /></div><SignOut className="mt-4 w-full" /></div></Center>;

  if (needsPin && myMember) return (
    <Center><div className="text-center"><h2 className="mb-2 text-4xl">Set your PIN</h2><p className="mb-6 text-muted-foreground">Pick a 4-digit PIN for fast switching on shared tablets.</p>
      <PinPad onComplete={async (pin) => {
        const { error } = await supabase.rpc("set_shop_member_pin", { target_member_id: myMember.id, new_pin: pin });
        if (error) return toast.error(error.message);
        s.setActiveMember(myMember); qc.invalidateQueries({ queryKey: ["pin-status"] }); toast.success("PIN saved");
      }} /></div></Center>
  );
  if (!s.activeMember) return <Center><div className="w-full"><OperatorSwitch /><div className="mt-8 flex justify-center gap-2"><ShopSwitcher /><SignOut /></div></div></Center>;

  return <Shell />;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4 py-10">{children}</div>;
}

function SignOut({ className }: { className?: string }) {
  const qc = useQueryClient(); const navigate = useNavigate();
  return <Button variant="ghost" className={className} onClick={async () => { await qc.cancelQueries(); qc.clear(); sessionStorage.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>;
}

function ShopSwitcher() {
  const { shops, shop, setShopId, myMemberships } = useShop();
  const [adding, setAdding] = useState(false);
  const isAdminSomewhere = myMemberships.some((m) => m.role === "admin");
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="secondary" className="max-w-[220px] justify-between"><span className="truncate">{shop?.name}</span><ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {shops.map((x) => <DropdownMenuItem key={x.id} onClick={() => setShopId(x.id)}>{x.name}</DropdownMenuItem>)}
          {isAdminSomewhere && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Add New Location</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={adding} onOpenChange={setAdding}><DialogContent><OnboardingForm title="New location" onCreated={() => setAdding(false)} /></DialogContent></Dialog>
    </>
  );
}

function OfflineBadge() {
  const [n, setN] = useState(0); const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine); void queueCount().then(setN);
    const off = onQueueChange(setN);
    const up = () => { setOnline(true); void flushQueue(); }; const down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    void flushQueue();
    const t = setInterval(() => void flushQueue(), 30000);
    return () => { off(); window.removeEventListener("online", up); window.removeEventListener("offline", down); clearInterval(t); };
  }, []);
  if (online && n === 0) return null;
  return <span className="inline-flex items-center gap-1 rounded bg-warning px-2 py-1 text-xs font-semibold text-primary-foreground"><WifiOff className="h-3 w-3" />{online ? "" : "Offline · "}Offline Queue: {n} pending</span>;
}

function Shell() {
  const s = useShop();
  const [switching, setSwitching] = useState(false);
  const readOnly = isReadOnly(s.shop);
  const trialing = s.shop?.subscription_status === "trialing" && !readOnly;
  const showMoney = s.role !== "mechanic";
  const nav = NAV.filter((n) => allowedSection(s.role, n.section));

  const cash = useQuery({
    queryKey: ["trial-cash", s.shop?.id],
    enabled: trialing && showMoney,
    queryFn: async () => {
      const { data } = await supabase.from("cores").select("expected_core_amount,part_cost,return_type").eq("shop_id", s.shop!.id).neq("current_status", "DELETED_IN_ERROR");
      return (data ?? []).reduce((a, c) => a + returnBinValue(c), 0);
    },
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Logo compact />
          <ShopSwitcher />
          <div className="ml-auto flex items-center gap-2">
            <OfflineBadge />
            <button onClick={() => setSwitching(true)} className="rounded-md border bg-card px-3 py-1.5 text-left">
              <div className="text-sm font-semibold leading-tight">{s.activeMember?.full_name}</div>
              <div className="text-[10px] uppercase tracking-wider text-primary">{s.role && ROLE_LABEL[s.role]}</div>
            </button>
            <SignOut />
          </div>
        </div>
        {s.role !== "mechanic" && (
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/app" }} className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent [&.active]:bg-primary [&.active]:text-primary-foreground">
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {readOnly && <div className="flex items-center gap-2 bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground"><Lock className="h-4 w-4" />Read-Only Archive Mode — Activate Plan to Resume Scanning{s.role === "admin" && <Link to="/app/admin" className="ml-2 underline">Open billing</Link>}</div>}
      {trialing && showMoney && (
        <div className="flex flex-wrap items-center gap-3 bg-primary/15 px-4 py-2 text-sm">
          <span>14-Day Free Trial — Cash Discovered So Far: <b className="text-primary">{money(cash.data ?? 0)}</b></span>
          <Button asChild size="sm"><Link to="/app/intake" search={{ mode: "audit" }}>+ Run Back-Room Shelf Audit</Link></Button>
        </div>
      )}
      <main className="mx-auto max-w-7xl p-4"><Outlet /></main>
      <Dialog open={switching} onOpenChange={setSwitching}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="sr-only">Switch operator</DialogTitle></DialogHeader><OperatorSwitch onDone={() => setSwitching(false)} /></DialogContent>
      </Dialog>
    </div>
  );
}
