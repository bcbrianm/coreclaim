# CoreClaim — Phase 1 Plan (Database, Roles, Storage, Offline App & Screens)

Phase 2 (AI parsing, webhooks, Stripe, SMS/email) waits for your go-ahead.

## Platform adjustments to your spec
This project runs on TanStack Start, so a few items from the brief are adapted. Everything else follows your spec as written.
- **No `index.html` / `vercel.json`**: the iPad fullscreen tags (`apple-mobile-web-app-capable`, `black-translucent`, `apple-touch-icon`) and manifest go in the app's root head. Hosting already handles deep links like `/auth?invite=...`, so no rewrites file is needed.
- **Offline service worker**: built with `vite-plugin-pwa` (generateSW, NetworkOnly for every Supabase path, NetworkFirst for pages). It turns itself off inside the Lovable preview and editor, so offline mode only works in the published app. You can still test the offline queue in the preview by turning Wi-Fi off.
- **Phase 2 server logic**: I'll recommend TanStack server functions and server routes (`/api/public/...` for webhooks) instead of Supabase Edge Functions. We can decide when Phase 2 starts.

## Step 1 — Database migrations (you approve each one)
Split into a few migrations so each is easy to review:
1. **Core tenancy**: `app_role` enum, `shops`, `shop_integrations`, `shop_members`, `shop_invites`, `shop_member_pins`, `suppliers`. Plus `is_shop_member` / `has_shop_role` helpers, the billing-field guard trigger, the last-admin guard, and a trigger that seeds integrations and the 8 default suppliers.
2. **Onboarding and PINs**: `create_shop_workspace`, `accept_pending_invites`, and the PIN set/verify/reset/lockout RPCs (bcrypt through pgcrypto).
3. **Cores lifecycle**: the `cores` table, its indexes, the ordered BEFORE/AFTER triggers (short codes, role guards, audit invoice numbers, deadlines, unit splitting), the append-only `core_events` log, `mechanic_cores_view` (no dollar columns), and the `mechanic_update_core_status` RPC.
4. **Financials and logistics**: `vendor_statements`, `statement_lines`, `core_credit_allocations` (rollup triggers), `warranty_claims`, `pickup_manifests` and their items, and `notification_logs`.
5. **Storage**: a private `core-evidence` bucket with shop-scoped policies on objects, read only through short-lived signed URLs.

Every table gets explicit grants and RLS exactly as the CISO section of the spec describes. Nothing can delete rows from cores or core_events. After that I'll run the security linter and fix anything it finds.

## Step 2 — App shell and auth
- Email/password sign-in, an invite-aware `/auth` page, `/reset-password`, and invites accepted automatically when a session starts.
- An onboarding wizard (shop name, phone, timezone, owner name, PIN), an MSO location switcher with "+ Add New Location", and a 4-digit PIN fast-switch on shared tablets.
- Navigation based on role. Mechanics are locked to the Bay Scanner.
- A header badge reading "Offline Queue: X pending".

## Step 3 — Screens
- **Bay Scanner (mechanic)**: QR camera (`@yudiel/react-qr-scanner`) that accepts `CORECLAIM:<code>`, a raw code, or a UUID. A large keypad takes over if the camera fails. Compressed condition photos, moves to IN_RETURN_BIN or DAMAGED_CORE_HOLD, and an IndexedDB queue that uploads the photo first, then sends the status change.
- **Counter (shop_user)**: manual invoice entry (AI scan arrives in Phase 2), Back-Room Shelf Audit, 2"x1" thermal QR label printing, a driver pickup manifest with a signature pad and PDF (jspdf), and warranty claim drafts with PDFs.
- **Bookkeeper (super_user)**: entering and reconciling vendor statements with split/partial credits, dispute drafts, write-offs up to $50, CSV export, and supplier management.
- **Admin**: team and PINs, invites, alert recipients, integration settings, supplier SLAs, write-offs over $50, and a placeholder billing page (Stripe arrives in Phase 2).
- **Dashboard**: KPIs for open cores, dollars at risk, upcoming deadlines, and variances. Mechanics can't see it.

## Design direction
An industrial shop-floor look: dark graphite surfaces, safety-amber accents, high-contrast condensed headings (Barlow / Bebas Neue style), big touch targets for gloved hands on iPads. Tokens are defined once in the global styles.

## Technical notes
- Packages: `vite-plugin-pwa`, `@yudiel/react-qr-scanner`, `qrcode.react`, `react-signature-canvas`, `jspdf`, `idb`.
- The scanner, signature pad and PDF code load only in the browser (lazy imports), so pages still render on the server.
- Data loads through route loaders with TanStack Query. Writes go through the Supabase client under RLS, plus the RPCs above.
- Tests cover the role rules (mechanic route lock, write-off thresholds of $50 and below vs above $50, and QR code parsing).
- When Phase 1 is done I'll pause for you to confirm secrets and start Phase 2.
