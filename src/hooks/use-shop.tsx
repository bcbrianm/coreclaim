import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/coreclaim";

export type Shop = Tables<"shops">;
export type Member = Tables<"shop_members">;

type Ctx = {
  userId: string;
  email: string | null;
  shops: Shop[];
  myMemberships: Member[];
  shop: Shop | null;
  setShopId: (id: string) => void;
  activeMember: Member | null;
  role: AppRole | undefined;
  setActiveMember: (m: Member | null) => void;
  team: Member[];
  refresh: () => Promise<void>;
  loading: boolean;
};

const ShopCtx = createContext<Ctx | null>(null);
const SHOP_KEY = "cc_active_shop";
const memberKey = (shopId: string) => `cc_active_member_${shopId}`;

export function ShopProvider({ userId, email, children }: { userId: string; email: string | null; children: ReactNode }) {
  const qc = useQueryClient();
  const [shopId, setShopIdState] = useState<string | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

  const memberships = useQuery({
    queryKey: ["my-memberships", userId],
    queryFn: async () => {
      await supabase.rpc("accept_pending_invites");
      const { data: mem, error } = await supabase.from("shop_members").select("*").eq("user_id", userId).eq("is_active", true);
      if (error) throw error;
      const ids = (mem ?? []).map((m) => m.shop_id);
      const { data: shops } = ids.length ? await supabase.from("shops").select("*").in("id", ids).order("name") : { data: [] as Shop[] };
      return { mem: mem ?? [], shops: shops ?? [] };
    },
  });

  const shops = memberships.data?.shops ?? [];
  useEffect(() => {
    if (!shops.length) return;
    const stored = sessionStorage.getItem(SHOP_KEY) ?? localStorage.getItem(SHOP_KEY);
    const pick = shops.find((s) => s.id === (shopId ?? stored)) ?? shops[0];
    if (pick.id !== shopId) setShopIdState(pick.id);
  }, [shops, shopId]);

  const shop = shops.find((s) => s.id === shopId) ?? null;

  const teamQ = useQuery({
    queryKey: ["team", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_members").select("*").eq("shop_id", shopId!).order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const team = teamQ.data ?? [];

  // Restore PIN operator per shop from sessionStorage, re-validating it is still active.
  useEffect(() => {
    if (!shopId || !teamQ.data) return;
    const stored = sessionStorage.getItem(memberKey(shopId));
    const m = teamQ.data.find((t) => t.id === stored && t.is_active);
    if (m) setActiveMemberId(m.id);
    else {
      if (stored) sessionStorage.removeItem(memberKey(shopId));
      setActiveMemberId(null);
    }
  }, [shopId, teamQ.data]);

  const setShopId = useCallback((id: string) => {
    sessionStorage.setItem(SHOP_KEY, id); localStorage.setItem(SHOP_KEY, id);
    setActiveMemberId(null); setShopIdState(id);
  }, []);

  const setActiveMember = useCallback((m: Member | null) => {
    if (!shopId) return;
    if (m) sessionStorage.setItem(memberKey(shopId), m.id); else sessionStorage.removeItem(memberKey(shopId));
    setActiveMemberId(m?.id ?? null);
  }, [shopId]);

  const activeMember = team.find((t) => t.id === activeMemberId) ?? null;

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["my-memberships"] });
    await qc.invalidateQueries({ queryKey: ["team"] });
  }, [qc]);

  const value = useMemo<Ctx>(() => ({
    userId, email, shops, myMemberships: memberships.data?.mem ?? [], shop, setShopId,
    activeMember, role: activeMember?.role as AppRole | undefined, setActiveMember, team, refresh,
    loading: memberships.isLoading || (!!shopId && teamQ.isLoading),
  }), [userId, email, shops, memberships.data, memberships.isLoading, shop, setShopId, activeMember, setActiveMember, team, refresh, shopId, teamQ.isLoading]);

  return <ShopCtx.Provider value={value}>{children}</ShopCtx.Provider>;
}

export function useShop() {
  const c = useContext(ShopCtx);
  if (!c) throw new Error("useShop must be used inside ShopProvider");
  return c;
}
