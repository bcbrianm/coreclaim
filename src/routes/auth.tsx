import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/Logo";

type Search = { redirect?: string; invite?: string; email?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    invite: typeof s.invite === "string" ? s.invite : undefined,
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — CoreClaim" },
      { name: "description", content: "Sign in to CoreClaim to track cores, RMAs and warranty credits." },
      { property: "og:title", content: "Sign in — CoreClaim" },
      { property: "og:description", content: "Sign in to CoreClaim to track cores, RMAs and warranty credits." },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/app";
  try { const u = new URL(p, window.location.origin); return u.origin === window.location.origin ? u.pathname + u.search : "/app"; } catch { return "/app"; }
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">(search.invite ? "up" : "in");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: safePath(search.redirect) as "/app", replace: true }); });
  }, [navigate, search.redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: safePath(search.redirect) as "/app", replace: true });
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/app` } });
        if (error) throw error;
        if (data.session) navigate({ to: "/app", replace: true });
        else toast.success("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Password reset link sent.");
      }
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-lg border bg-card p-8">
        <Logo />
        <h1 className="text-3xl">{mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Reset password"}</h1>
        {search.invite && <p className="text-sm text-muted-foreground">You've been invited to a shop. Create your account with this email to join.</p>}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" /></div>
        {mode !== "forgot" && <div className="space-y-2"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" /></div>}
        <Button type="submit" className="h-12 w-full text-base" disabled={busy}>{busy ? "Working…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}</Button>
        <div className="flex justify-between text-sm text-muted-foreground">
          {mode !== "in" ? <button type="button" onClick={() => setMode("in")}>Have an account? Sign in</button> : <button type="button" onClick={() => setMode("up")}>New shop? Create account</button>}
          {mode === "in" && <button type="button" onClick={() => setMode("forgot")}>Forgot password</button>}
        </div>
      </form>
    </div>
  );
}
