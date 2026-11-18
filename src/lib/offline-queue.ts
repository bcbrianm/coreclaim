import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";
import { uploadEvidence } from "./evidence";

export type QueuedBayUpdate = {
  id?: number;
  shopId: string;
  payload: { p_core_id: string; p_new_status: string; p_original_box_intact?: boolean | null; p_actor_member_id?: string | null; p_condition_photo_url?: string | null };
  photo?: Blob | null;
  createdAt: number;
};

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) dbp = openDB("coreclaim-offline", 1, { upgrade(d) { d.createObjectStore("bay", { keyPath: "id", autoIncrement: true }); } });
  return dbp;
}

const listeners = new Set<(n: number) => void>();
export function onQueueChange(fn: (n: number) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
async function notify() { const n = await queueCount(); listeners.forEach((f) => f(n)); }

export async function queueCount() { return (await db()).count("bay"); }
export async function enqueue(item: QueuedBayUpdate) { await (await db()).add("bay", item); await notify(); }

async function send(item: QueuedBayUpdate) {
  const payload = { ...item.payload };
  if (item.photo) payload.p_condition_photo_url = await uploadEvidence(item.shopId, "conditions", item.photo);
  const { error } = await supabase.rpc("mechanic_update_core_status", payload as never);
  if (error) throw error;
}

/** Sends now if online, otherwise queues. Returns true when sent immediately. */
export async function submitBayUpdate(item: Omit<QueuedBayUpdate, "createdAt">) {
  const full = { ...item, createdAt: Date.now() };
  if (typeof navigator !== "undefined" && !navigator.onLine) { await enqueue(full); return false; }
  try { await send(full); return true; }
  catch (e) {
    if (e instanceof TypeError || (e as { message?: string })?.message?.includes("fetch")) { await enqueue(full); return false; }
    throw e;
  }
}

let flushing = false;
export async function flushQueue() {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  flushing = true;
  try {
    const d = await db();
    const items = (await d.getAll("bay")) as QueuedBayUpdate[];
    for (const it of items.sort((a, b) => a.createdAt - b.createdAt)) {
      try { await send(it); await d.delete("bay", it.id!); }
      catch (e) {
        if (e instanceof TypeError) break; // still offline
        await d.delete("bay", it.id!); // server rejected (e.g. stale) — drop it
        console.warn("Dropped stale offline update", e);
      }
    }
  } finally { flushing = false; await notify(); }
}
