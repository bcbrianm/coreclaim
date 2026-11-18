import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function useSuppliers(shopId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: ["suppliers", shopId, includeInactive],
    enabled: !!shopId,
    queryFn: async () => {
      let q = supabase.from("suppliers").select("*").eq("shop_id", shopId!).order("name");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q; if (error) throw error; return data;
    },
  });
}
