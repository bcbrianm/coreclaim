import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — CoreClaim" }, { name: "description", content: "Set a new CoreClaim password." }, { property: "og:title", content: "Reset password — CoreClaim" }, { property: "og:description", content: "Set a new CoreClaim password." }] }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState(""); const navigate = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Password updated"); navigate({ to: "/app" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={save} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8">
        <h1 className="text-3xl">New password</h1>
        <Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} className="h-12" />
        <Button className="h-12 w-full">Save password</Button>
      </form>
    </div>
  );
}
