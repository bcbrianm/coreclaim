<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## CoreClaim architecture
- Role/permission rules live in `src/lib/coreclaim.ts` and are mirrored by DB RLS and triggers; the database is the source of truth, the UI only hides controls.
- Mechanics read only `mechanic_cores_view` and write only through `mechanic_update_core_status`, because the raw `cores` table exposes dollar columns.
- The PIN operator (`active_member`) is an app-level session per shop kept in sessionStorage (`src/hooks/use-shop.tsx`); stamp its id as actor on every write, never the device user's member.
- Evidence files are stored as relative paths in the private `core-evidence` bucket (`{shop_id}/{category}/...`) and shown through signed URLs (`EvidencePreview`), never public URLs.
- Bay updates go through `src/lib/offline-queue.ts` (IndexedDB) so they survive Wi-Fi dead zones; photos upload before the RPC is flushed.
- Browser-only libraries (QR scanner, signature pad, jspdf, image compression) are imported lazily so SSR never loads them.
- The service worker registers only through `src/lib/pwa.ts`, which refuses dev/preview/iframe hosts.
- Phase 2 server logic (AI parsing, Stripe, Resend, Twilio, shop-system webhooks) uses Supabase Edge Functions by the user's choice, so webhooks keep permanent Supabase URLs.
