import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type Core = Tables<"cores"> & { suppliers?: { name: string; ar_dispute_email: string | null; account_number: string | null } | null };

export async function updateCore(core: Pick<Core, "id" | "shop_id" | "current_status">, patch: TablesUpdate<"cores">, eventType: string, actorId: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await supabase.from("cores").update(patch).eq("id", core.id);
  if (error) throw error;
  const { error: e2 } = await supabase.from("core_events").insert({
    core_id: core.id, shop_id: core.shop_id, actor_member_id: actorId, event_type: eventType,
    previous_status: core.current_status, new_status: (patch.current_status as string | undefined) ?? core.current_status,
    metadata_json: metadata as never,
  });
  if (e2) throw e2;
}

export const CORE_SELECT = "*, suppliers(name, ar_dispute_email, account_number)";
