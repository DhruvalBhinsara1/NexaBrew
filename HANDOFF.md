# NexaBrew — Build Handoff

> Status snapshot for continuing the 24h hackathon build in a new tool/session.
> Read the 10 spec docs in `/Users/dhruvalbhinsara/Downloads/files 2/` first
> (CLAUDE.md, CONSTRAINTS.md, DECISIONS.md, ARCHITECTURE.md, DATA_MODEL.md,
> PRD.md, DESIGN.md, TASKS.md, AGENTS.md, NexaBrew_Backend_Blueprint_v2.md).
> Those are the source of truth. This file records what's BUILT and DECIDED.

Project root: `/Users/dhruvalbhinsara/NexaBrew`

---

## Progress: full app COMPLETE (backend + all UI + 4 roles). Phase 17 (P3 export) optional.

Core phases 0–16 done. Since then, several feature rounds shipped on top
(roles, Razorpay, Preline UI overhaul, order-flow fixes). All verified with
`tsc` + `next build` green and live service tests against the hosted DB.

| Area | Status |
|---|---|
| 0–7 Setup / DB / Auth / Config APIs / Sessions / Orders / Discounts / Kitchen | ✅ |
| 8 Payments → **Razorpay gateway** (create order + HMAC signature verify) | ✅ live test-mode order verified |
| 9 Realtime hooks · 10 Users · 11 Reports · 12 Customers | ✅ |
| 13 Dashboard (sidebar + overview + Dashboard nav link) | ✅ |
| 13b 8 dashboard CRUD pages | ✅ products/categories/floors/payment-methods/coupons/users/sessions/reports |
| 14 POS Terminal + 14b /pos/orders (+detail sheet, cancel, **process payment**) + /pos/customers | ✅ |
| 15 KDS (light coffee theme, search + category filter) | ✅ |
| 16 Polish (EmptyState/ErrorState) | ✅ |
| UI overhaul — **Preline 2.7.0** wired app-wide; gradient brand chrome everywhere | ✅ visual layer (Radix kept) |
| 17 — P3 Optional (PDF/XLS export) | not started (only if time) |

### Roles (4) — all working, demo accounts seeded

| Role | Demo login (pw `Password@123`) | Home | Notes |
|---|---|---|---|
| admin | admin@nexabrew.com | /dashboard | full dashboard |
| employee | alice@nexabrew.com / bob@nexabrew.com | /pos/terminal | POS |
| customer | customer@nexabrew.com | /menu | read-only menu + live "My Orders" tracking; CRM-linked via `customers.user_id` |
| kitchen | kitchen@nexabrew.com | /kds | locked to KDS; KDS still public too |

### Feature rounds shipped after core (all live-verified)

1. **Razorpay** (migration 002 adds `razorpay` payment type) — `lib/razorpay.ts`, `POST /api/orders/[id]/razorpay`, signature verify in `PaymentService.process`. Test keys in `.env.local`.
2. **Customer role** (migration 003): public signup → customer; `customers.user_id` link; `GET /api/orders/mine`; `/menu` surface.
3. **Kitchen role** (migration 004): dedicated login locked to `/kds`; KDS logout button (only when a session exists).
4. **Process Payment dialog** (`components/pos/PaymentDialog.tsx`) — pay any payment_pending order from `/pos/orders`, not just the live POS session.
5. **Interactive Table Occupancy** on dashboard — click table → confirm → toggle occupied/available.
6. **Table occupies on send-to-kitchen** (not on draft) — `OrderService.create` no longer occupies; `KitchenService.sendToKitchen` does; freed on pay/cancel.
7. **Order cancel route** `POST /api/orders/[id]/cancel`.
8. **Customer order tracking**: POS "Assign Customer" (`CustomerDialog`) sets `customer_id`; `/menu` My Orders is realtime; status reflects the **kitchen ticket** (queued → preparing → ready), not just order status.
9. **Cart shows real server totals** (incl. coupon discount) once an order exists — fixed the POS/My-Orders bill mismatch.
10. **Add items to an existing unpaid bill** — `OrderService.addItems` + `POST /api/orders/[id]/add-items`; POS cart becomes a staging area ("Add to Bill & Send to Kitchen"); appends items (upsert, never deletes), recomputes bill, sends additions as a new kitchen ticket, returns order to sent_to_kitchen.

### Migrations applied to live DB

- `001_initial_schema.sql` — base schema/RLS/triggers
- `002_razorpay_payment_type.sql` — `payments.payment_method_type` allows `razorpay`
- `003_customer_role.sql` — `customer` role + `customers.user_id` + signup-default trigger
- `004_kitchen_role.sql` — `kitchen` role

### Known remaining gaps

- **Reports**: period presets (Today/Week/Month) only — no custom date-range picker or employee/session filter.
- **Coupons/promotions**: create + active-toggle + delete; no full value-edit dialog.
- **Promotion re-eval on add-items**: adding items recomputes the coupon over the new total but does not re-run product promotions on existing rows (acceptable for demo).
- **UI overhaul is a visual layer**: Preline wired + brand chrome applied; the interactive Radix dialogs/selects were intentionally kept (not rip-and-replaced) so verified flows stay intact.
- **Razorpay payment recording** (signature callback → paid) not driven through a real browser checkout; order-creation half + cash path verified live.
- `.next` dev/build collision: never run `npm run build` while `npm run dev` is live (shared `.next`). If you see `Cannot find module './XXXX.js'` or `PageNotFoundError`, kill all `next` procs → `rm -rf .next` → rebuild.

### Device-switch handoff — 2026-06-13

- Repo: `https://github.com/DhruvalBhinsara1/NexaBrew`
- Branch: `main`
- Pull latest `main` on the new device before continuing.
- Local-only files are intentionally not committed and must be recreated on the new device: `.env.local`, `.supabase-db-password.local`, `supabase/.temp`.
- Keep real Supabase keys and DB password out of git. Use `.env.example` as the template.
- After restoring env files, run `npm install`, then `npx tsc --noEmit` and `npm run build`.

### Last health-check — 2026-06-13

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ zero errors |
| `npm run build` | ✅ clean — 27 routes compiled |
| `npm run lint` | ✅ no ESLint warnings or errors |
| `npm run dev` startup | ✅ ready in ~1 s, no runtime warnings |
| API spot-checks (`/api/products`, `/api/sessions`) | ✅ correct 401 for unauthenticated callers |
| Login page render | ✅ full SSR output, no hydration errors |

> **Note — two `next dev` processes were running simultaneously** (stale background process on port 3000 + new one on 3001). Kill all before starting fresh:
> ```bash
> pkill -f "next dev"
> npm run dev
> ```

---

## Environment / Infra (already provisioned)

- **Supabase project**: name `NexaBrew`, region Mumbai (ap-south-1), Vercel org. CLI is **linked** locally (ref in gitignored `supabase/.temp`).
- **`.env.local`** (gitignored) has REAL keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus **Razorpay test keys** `NEXT_PUBLIC_RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`. `RESEND_API_KEY` still a placeholder (receipt email only). DB password in `.supabase-db-password.local` (gitignored). `.env.example` documents all of them.
- **Migrations applied** (004 latest): apply more via `SUPABASE_DB_PASSWORD="$(cat .supabase-db-password.local)" supabase db push`.
- **Seeded** (`npm run seed`, pass `SEED_DEMO_PASSWORD=Password@123`): 6 categories, 12 products, 3 payment methods, 3 floors + 18 tables, 3 coupons (SAVE10/FLAT50/WELCOME20), 2 promotions, **4 users (admin/employee/customer/kitchen)**.
- **Demo accounts** (all pw `Password@123`): admin@ / alice@ / bob@ / customer@ / kitchen@ nexabrew.com.
- Regenerate types after any schema change: `supabase gen types typescript --linked > types/database.types.ts`
- **Verification scripts** (live, self-cleaning): `node --env-file=.env.local --import tsx scripts/demo-flow.mts` (full POS flow) and `scripts/roles-check.mts` (4 roles + customer order visibility).

---

## Locked toolchain choices (DO NOT "upgrade" — they fight the stack)

- **Next.js 14.2.35**, React 18, **Tailwind v3**, strict TS, root `app/` (no `src/`).
- **shadcn CLI pinned to `2.3.0`** (`npx shadcn@2.3.0 add ...`). `shadcn@latest` ships the Tailwind-v4 / Base-UI "base-nova" style which is INCOMPATIBLE — do not use it. Style is `new-york`, baseColor zinc.
- **`globals.css` uses HSL channel values** (not oklch) to match the `hsl(var(--x))` config. Don't let a tool rewrite it to oklch.
- **`react-day-picker` pinned `9.8.0`** + `date-fns@3.6.0` (calendar component needs v9). P1 only.
- **`toast`/`useToast`** is the real shadcn toast (`hooks/use-toast.ts` + `components/ui/toaster.tsx`, mounted in `app/layout.tsx`). NOT sonner.
- `tsx` is installed; **it resolves the `@/` alias**, so services can be unit-tested directly: `node --env-file=.env.local --import tsx -e "import {X} from '@/services/...'"`.
- DESIGN tokens (`brand`/`surface`/`kds`) are in `tailwind.config.ts`.

---

## Architecture conventions (enforce these)

- Layer: **Route Handler → withAuth → Zod parse → Service → Supabase**. NO repository layer. NO Server Actions. NO `/api/auth/*` routes (Supabase Auth direct).
- Route handlers are THIN (auth, parse, call service, wrap in envelope). Business logic ONLY in `services/*`.
- Services: `export const XService = { async method(supabase: SupabaseClient<Database>, ...args) {...} }`. First arg ALWAYS the supabase client (never instantiate inside). NO `NextResponse`/`req`/`res` in services.
- Errors: throw `AppError(message, code, status, details?)` from `@/lib/utils/app-error` (HTTP-free module). Routes are wrapped by `withAuth` which routes thrown errors through `handleError` (`@/lib/utils/handleError`). `withAuth` re-throws Next control-flow errors (digest `DYNAMIC_SERVER_USAGE` / `NEXT_*`) — keep that.
- Response envelope: success `{ data: T }` (201 on create), error `{ error, code, details? }`. Types in `types/api.types.ts`.
- Supabase: `.maybeSingle()` (not `.single()`) when a row may be absent; `.select()` on every insert/update; map PG error `23505`→409 duplicate, `23503`→404 FK.
- `[id]` route files: `type Ctx = { params: { id: string } }; export const PATCH = withAuth<Ctx>(async (req,_user,{params})=>..., { roles:["admin"] })`.
- Roles: GET/read = all authenticated (no `roles`); writes/config = `{ roles: ["admin"] }`. Orders/payments/kitchen/customers = all roles.
- Monetary: `numeric(10,2)`, display via `formatCurrency()` (₹, 2dp). Round money with `Math.round((n+Number.EPSILON)*100)/100`.

---

## Decisions made during the build (beyond DECISIONS.md)

1. **URL routing**: Blueprint's `(dashboard)` route-group notation was interpreted as **real `/dashboard/*` and `/pos/*` path segments** (matches ARCHITECTURE/DESIGN URLs + middleware). Auth pages use the `(auth)` group (→ `/login`, `/signup`).
2. **KDS public-read RLS**: `kitchen_tickets` + `kitchen_ticket_items` have `SELECT USING (true)` (anon KDS realtime read, DECISION-009); writes are `authenticated`. The Phase-7 ticket-status route must use the **service-role admin client** (public route, no withAuth) so the order→payment_pending transition (DECISION-005) still runs server-side.
3. **Signup → employee** (trigger default). "First user becomes admin" is satisfied by the seeded admin; signup has no role picker. Handles email-confirmation-on gracefully (toast → /login).
4. **`closing_balance` = `opening_balance` + cash_collected** (cash-drawer reconciliation). Close also returns `summary {total_orders,total_revenue,cash_collected,card_collected}`.
5. **`GET /api/sessions` is all-roles** (Blueprint said admin) so POS startup can fetch the open session; RLS limits employees to open sessions.
6. **"Buy 3 Coffee Deal" promotion** mapped to the **Espresso** product (schema has no category-level promotions — only single-product or order).
7. **Total calculation**: DATA_MODEL.md §"Total Calculation Logic" is the authority (NOT Blueprint §6.1). The two docs conflict on the taxable basis. See the implemented formula in the Phase-5 plan below.
8. `SlideTextButton` (`components/kokonutui/`) authored from the DESIGN spec (can't fetch real Kokonutui at runtime; CDN forbidden by DECISION-010).
9. Placeholder pages exist and MUST be replaced: `app/dashboard/page.tsx` (Phase 13), `app/pos/terminal/page.tsx` (Phase 14), `app/kds/page.tsx` (Phase 15). `components/shared/LogoutButton.tsx` is real (Module 1 logout).

---

## What exists on disk (key files)

```
lib/supabase/{client,server,admin}.ts      # browser / server(cookie) / service-role
lib/auth/{getServerUser,withAuth}.ts        # role-gated wrapper
lib/utils/{app-error,handleError,formatCurrency,calculateTotals}.ts
middleware.ts                               # role redirects; /kds public; /api excluded
types/{database.types,domain.types,api.types}.ts
schemas/{auth,product,category,floor,payment-method,session,order,coupon,kitchen}.schema.ts
services/{ProductService,CategoryService,FloorService,PaymentMethodService,SessionService,OrderService,KitchenService,DiscountService}.ts
app/(auth)/{login,signup}/page.tsx, app/(auth)/layout.tsx
app/api/products|categories|floors|tables|payment-methods|sessions|orders|coupons|promotions|kitchen/...  # all built
app/{dashboard,pos/terminal,kds}/page.tsx  # PLACEHOLDERS
components/ui/*                              # shadcn new-york set + card
components/kokonutui/slide-text-button.tsx (+ index.ts barrel)
supabase/{migrations/001_initial_schema.sql, seed.ts}
```

Verify anytime: `npx tsc --noEmit` and `npm run build` (both currently green). Dev: `npm run dev` (kill with `pkill -f "next dev"`).

---

## Phase 5 — Orders (completed)

Implemented:
- `lib/utils/calculateTotals.ts`
- `schemas/order.schema.ts`
- `services/OrderService.ts`
- `services/KitchenService.ts`
- `app/api/orders/route.ts`
- `app/api/orders/[id]/route.ts`
- `app/api/orders/[id]/send-to-kitchen/route.ts`

Verified:
- `npx tsc --noEmit`
- `npm run build`
- live Supabase service flow: open session → create order on table → same table returns same draft → update items/totals → send to kitchen → ticket `to_cook` → advance to `preparing` → advance to `completed` → order `payment_pending`; cleanup returned test table/order/ticket/session to clean state.

## Phase 6 — Discounts (completed)

Implemented:
- `schemas/coupon.schema.ts`
- `services/DiscountService.ts`
- `app/api/coupons/route.ts`
- `app/api/coupons/[id]/route.ts`
- `app/api/promotions/route.ts`
- `app/api/promotions/[id]/route.ts`
- `app/api/orders/[id]/apply-coupon/route.ts`
- `OrderService` integration for product promotions, order promotions, and coupon override/recalculation.

Verified:
- `npx tsc --noEmit`
- `npm run build`
- live Supabase service flow: product promotion (`Espresso` x3) → line discount and total verified; order promotion (`Pasta` x3) → fixed order discount verified; `SAVE10` coupon → overrides order promotion and clears `promotion_id`; coupon/promotion create+update verified; cleanup removed test orders/coupon/promotion/session.

## Phase 7 — Kitchen APIs (completed)

Implemented:
- `schemas/kitchen.schema.ts`
- `KitchenService.listTickets(...)`
- `app/api/kitchen/tickets/route.ts`
- `app/api/kitchen/tickets/[id]/route.ts`
- `app/api/kitchen/tickets/[id]/items/[itemId]/route.ts`
- Public KDS mutation routes use `supabaseAdmin` by design so the no-login KDS can advance tickets and complete items.

Notes:
- `GET /api/kitchen/tickets` is authenticated and supports `status` + `order_id` filters.
- `PATCH /api/kitchen/tickets/[id]` advances `to_cook -> preparing -> completed`; on `completed`, `KitchenService.advanceTicketStatus` moves the linked order to `payment_pending`.
- `PATCH /api/kitchen/tickets/[id]/items/[itemId]` marks a kitchen ticket item completed.
- The route path differs slightly from TASKS.md wording (`items/[itemId]` instead of `items/[itemId]/complete`) but implements the same mutation.

Verified before this handoff update:
- Phase 7 is present in local commit `da6c9ea`.
- Run fresh checks after pulling on the next device because env files are local-only.

## NEXT: Phase 8 — Payments

Payments (`PaymentService.process`, cash/card/UPI validation, order -> paid, table -> available, coupon `used_count`, receipt route/email, UPI QR).

2026-06-13 Windows continuation update:
- Backend Phase 8 is implemented in `schemas/payment.schema.ts`, `services/PaymentService.ts`, `app/api/orders/[id]/payment/route.ts`, `app/api/orders/[id]/payment/upi-qr/route.ts`, `app/api/orders/[id]/receipt/route.ts`, and `app/api/orders/[id]/receipt/email/route.ts`.
- `POST /api/orders/:id/payment` validates cash/card/UPI, creates a completed payment row, moves `payment_pending -> paid`, frees the table, increments coupon `used_count`, and returns `{ payment, order, receipt }`.
- `GET /api/orders/:id/payment/upi-qr` returns a UPI intent URI plus QR data URL.
- `GET /api/orders/:id/receipt` returns the paid-order receipt payload.
- `POST /api/orders/:id/receipt/email` sends via Resend using the customer email or request email. It requires a real `RESEND_API_KEY`.
- Local checks: `npx tsc --noEmit` passed, `npm run lint` passed, and `npm run build` passed when placeholder build-time Supabase env vars were supplied.
- Live verification is still pending because `.env.local` is absent and this PowerShell session currently reports `supabase` and `gh` as not found on PATH.
- NEXT: restore env/PATH, run the live payment service flow, then continue to Phase 9 Realtime hooks.

## Phase 9 - Realtime hooks (implemented)

Implemented:
- `hooks/useRealtimeOrders.ts`
- `hooks/useRealtimeKitchenTickets.ts`
- `hooks/useRealtimeTables.ts`
- `hooks/index.ts`

Behavior:
- `useRealtimeOrders(filters)` fetches joined order data and refetches when `public.orders` changes.
- `useRealtimeKitchenTickets(filters)` fetches tickets with items and refetches when `public.kitchen_tickets` or `public.kitchen_ticket_items` changes. It can be used by the public KDS because the RLS policy permits anonymous reads for these two tables.
- `useRealtimeTables()` fetches floors with tables and refetches when `public.tables` changes.
- All hooks return `{ data, loading, error, lastSyncedAt, refetch }`.

Verified:
- `npx tsc --noEmit` passed.

NEXT: Phase 10 Users (Admin API), unless live Phase 8 verification is prioritized first.

Historical Phase 5 plan:

### 5.0 Replace `lib/utils/calculateTotals.ts` (currently a throwing stub)
Implement per DATA_MODEL.md (authoritative). Order-level discount distributed proportionally across items by net-of-product-discount share, tax computed per-item respecting each item's `tax_rate`:
```
perItem: base = unitPrice*qty;  net = base - discountAmount(product promo)
subtotal = Σ base;  productDiscounts = Σ discountAmount;  netSum = Σ net
orderDiscount = clamp(input.orderDiscount, 0, netSum)   # coupon OR order-promo
perItem: share = netSum>0 ? orderDiscount*(net/netSum) : 0;  taxable = net - share;  tax = taxable*(taxRate/100)
taxAmount = round2(Σ tax)
discountAmount = round2(productDiscounts + orderDiscount)
totalAmount = round2(subtotal - discountAmount + taxAmount)
```
Return `{ subtotal, productDiscounts, orderDiscount, discountAmount, taxAmount, totalAmount }`.
Per-item `line_total` (for `order_items`) = round2(base - discountAmount). NOTE: in Phase 5 there are NO discounts yet (promotions/coupons are Phase 6), so pass `orderDiscount=0` and per-line `discountAmount=0`. Build the function discount-ready so Phase 6 just feeds values.

### 5.1 `schemas/order.schema.ts`
- `CreateOrderSchema`: `{ session_id: uuid, table_id?: uuid (nullable), customer_id?: uuid (nullable), items: {product_id: uuid, quantity: int>0}[] (default []) }`
- `UpdateOrderSchema`: `{ customer_id?: uuid|null, items?: {product_id,quantity}[] }` (refine ≥1 key)

### 5.1 `services/OrderService.ts`
Define `ORDER_SELECT` (use for list + detail; include items + joins):
`"*, items:order_items(*), table:tables(id, table_number), customer:customers(id, name, email), employee:users!orders_employee_id_fkey(id, name), coupon:coupons(id, code, discount_type, discount_value), promotion:promotions(id, name)"`
Helper `snapshotItems(supabase, items)`: fetch `products` (id, name, price, tax_rate, is_active) for the product_ids; error `PRODUCT_UNAVAILABLE` if missing/inactive; return rows `{product_id, product_name, unit_price, tax_rate, quantity, discount_amount:0, line_total}`.
Helper `freeTable(supabase, tableId)`: set `tables.status='available'`.
Methods:
- `list(supabase, {sessionId?, status?, tableId?, search?})` → `OrderWithItems[]` (ilike on order_number for search; order by created_at desc).
- `getById(supabase, id)` → `OrderWithItems` (404 if absent).
- `create(supabase, payload, employeeId)` → `{ order: OrderWithItems, created: boolean }`:
  1. validate session exists & `status='open'` (else `SESSION_NOT_OPEN` 400).
  2. **Active-order strategy (DECISION-004)**: if `table_id`, find draft order on (table_id, session_id, status='draft'); if found → return `{order: getById(it), created:false}`.
  3. if `table_id` & no draft: load table; 404 if missing; 400 if `!is_active`; `TABLE_OCCUPIED` 409 if `status='occupied'`.
  4. snapshotItems; totals = calculateTotals({items, orderDiscount:0}).
  5. insert order (`status:'draft'`, employee_id, session_id, table_id, customer_id, totals); insert order_items (with order_id).
  6. if table_id → set table `occupied`.
  7. return `{order: getById(newId), created:true}`.
- `update(supabase, id, payload)` → `OrderWithItems`:
  - load order; if `status!=='draft'` → `ORDER_NOT_EDITABLE` 409.
  - if `items` provided: snapshotItems; delete existing order_items; insert new; recompute totals.
  - if `customer_id` provided: set it.
  - bump updated_at; return getById.
- `cancel(supabase, id)`: allowed from draft|sent_to_kitchen → `status='cancelled'` + freeTable; else 409.
- `remove(supabase, id)`: draft only (`ONLY_DRAFT_DELETABLE` 409) → freeTable + delete order (items cascade).

### 5.1 Routes
- `app/api/orders/route.ts`: `GET` (all roles; parse session_id/status/table_id/search) → list. `POST` (all roles) → create; set status **201 if created else 200** (DECISION-004).
- `app/api/orders/[id]/route.ts`: `GET` → getById. `PATCH` → update. `DELETE` → remove. All all-roles.

### 5.2 `services/KitchenService.ts`
- `sendToKitchen(supabase, orderId)`:
  1. getById; require `status='draft'` (else 409) and items non-empty (`EMPTY_ORDER` 400).
  2. fetch `products` (id, is_kitchen_display) for the order's product_ids; qualifying = is_kitchen_display=true.
  3. insert `kitchen_tickets {order_id, ticket_number: order.order_number, status:'to_cook'}`.
  4. insert `kitchen_ticket_items` for qualifying items `{ticket_id, order_item_id, product_name, quantity}`.
  5. update order `status='sent_to_kitchen'`.
  6. return `{ order:{id,status}, ticket:{id,ticket_number,status} }`.
- `advanceTicketStatus(supabase, ticketId, newStatus)` (used by Phase 7 route): forward-only `to_cook→preparing→completed` (else 422); set `completed_at` if completed; **if completed → update orders set status='payment_pending' where id=order_id AND status='sent_to_kitchen'** (DECISION-005 guard); return `{ticket, order?}`.
- `completeTicketItem(supabase, ticketId, itemId)`: set `is_completed=true` where id=itemId AND ticket_id=ticketId; return updated item.

### 5.2 Route
- `app/api/orders/[id]/send-to-kitchen/route.ts`: `POST` (all roles) → KitchenService.sendToKitchen → `{ data: { order, ticket } }`.
(Kitchen ticket status/complete routes + GET /api/kitchen/tickets are **Phase 7**.)

### Phase 5 verification
`tsc` + `build`, then a `tsx` service test with a signed-in employee client:
open a session (admin) → create order on a table (snapshot + totals + table→occupied) → re-create same table returns SAME order (created:false) → update items (totals recalc) → send-to-kitchen (order sent_to_kitchen, ticket to_cook with items) → advanceTicketStatus to completed → order becomes payment_pending. Clean up (cancel/close).

---

## Roadmap after Phase 7 (TASKS.md)
8 Payments (+ Resend receipt, generateQR) · 9 Realtime hooks · 10 Users (Admin API) · 11 Reports · 12 Customers · 13 Dashboard UI · 14 POS UI · 15 KDS UI · 16 polish · 17 (P3) export.

P0 remaining: Payments(8). Do P0 before P1.

---

## Phase 10 -- Users Admin API (completed 2026-06-13)

Implemented:
- schemas/user.schema.ts
- services/UserService.ts
- app/api/users/route.ts (GET list + POST create -- admin only)
- app/api/users/[id]/route.ts (GET + PATCH + DELETE/archive -- admin only)

Notes:
- All mutations use supabaseAdmin (service-role) so Auth Admin API is available.
- Archive sets is_archived=true in profile + ban_duration=876000h in Auth.
- Self-archive and self-demotion are guarded by comparing actorId to target id.

## Phase 11 -- Reports (completed 2026-06-13)

Implemented:
- schemas/report.schema.ts (DateRangeSchema, TopProductsQuerySchema)
- services/ReportService.ts (all aggregation done in-app over raw Supabase rows)
- app/api/reports/daily/route.ts -- revenue per calendar day
- app/api/reports/top-products/route.ts -- ranked by qty_sold, optional limit (max 50)
- app/api/reports/employees/route.ts -- revenue + order count per employee
- app/api/reports/payments/route.ts -- totals per payment_method_type (all 3 always returned)
- app/api/reports/sessions/[id]/route.ts -- full aggregate for a single session

All routes: admin-only, use supabaseAdmin.
Verified: npx tsc --noEmit + npm run lint + npm run build all green.

## Phase 12 -- Customers (completed 2026-06-13)

Implemented:
- schemas/customer.schema.ts (CreateCustomerSchema, UpdateCustomerSchema)
- services/CustomerService.ts (list/getById/create/update/remove)
- app/api/customers/route.ts (GET + POST -- all authenticated)
- app/api/customers/[id]/route.ts (GET + PATCH + DELETE -- all authenticated)

Notes:
- Uses createServerClient() (anon key + cookies) so RLS customers_all_auth applies.
- Duplicate email -> 409 CUSTOMER_DUPLICATE_EMAIL.
- Delete blocked if customer has orders -> 409 CUSTOMER_HAS_ORDERS.
Verified: npx tsc --noEmit + npm run lint + npm run build all green.

## Phase 13 — Dashboard UI (completed)

Implemented:
- `components/dashboard/DashboardSidebar.tsx` — client sidebar with Lucide icons, `usePathname` active state, all nav items per DESIGN.md, LogoutButton
- `app/dashboard/layout.tsx` — sticky sidebar + scrollable main area
- `app/dashboard/page.tsx` — server component; parallel-fetches session, today's report, floors, recent orders

Features:
- Session status banner (green = open, amber = no session) with link to Sessions page
- 4 KPI cards: Orders Today, Revenue Today, Avg Order Value, Tables Occupied
- Table occupancy grid (floor-by-floor, brand-500 = occupied, muted = available)
- Recent orders table (last 10, all statuses, color-coded badges)
- Quick-links row: Reports, Products, Sessions, Users

Verified: `npx tsc --noEmit` zero errors + `npm run build` clean (29 routes).

## Phase 14 — POS Terminal UI (completed)

Implemented:
- `store/usePosStore.ts` — Zustand store: cart items, table, session, order state
- `app/pos/layout.tsx` — thin layout (no sidebar) for POS pages
- `components/pos/TableSelectorDialog.tsx` — floor/table picker dialog (shadcn Tabs + grid)
- `components/pos/CouponDialog.tsx` — coupon code entry (applied at send-to-kitchen time)
- `components/pos/ProductsPanel.tsx` — category tab filter + product grid (flex 2)
- `components/pos/CartPanel.tsx` — cart items, qty +/−, running total, action buttons (flex 1.2)
- `components/pos/PaymentPanel.tsx` — cash/card/UPI payment form; QR fetched from API; realtime-aware (flex 1)
- `components/pos/PosTerminal.tsx` — main client component; fetches session+products+categories+floors; sets up Supabase realtime channel on orderId for payment_pending transition
- `app/pos/terminal/page.tsx` — thin server page rendering `<PosTerminal />`

Flow: add items → select table → send to kitchen → wait for KDS (realtime updates panel) → process payment → reset.

## Phase 15 — KDS UI (completed)

Implemented:
- `app/kds/page.tsx` — full-screen dark 3-column kanban
  - Realtime via `useRealtimeKitchenTickets` (anon key, public RLS)
  - Columns: To Cook (amber) | Preparing (blue) | Completed (green, clears after 5 min)
  - Tap ticket card → advance status (PATCH /api/kitchen/tickets/[id] — public route)
  - Tap item within card → mark complete (PATCH /api/kitchen/tickets/[id]/items/[itemId] — public route)
  - Live clock in header

## Phase 16 — Polish (completed)

Implemented:
- `components/shared/EmptyState.tsx` — icon + title + subtitle + optional CTA
- `components/shared/ErrorState.tsx` — error icon + message + retry button

Verified: `npx tsc --noEmit` zero errors + `npm run build` clean (29 routes, all green).

## NEXT: Remaining work

All P0 + P1 features are complete. Suggested next steps:
1. Live end-to-end demo run (open session → POS order → KDS → payment)
2. Live payment verification (Resend API key for receipt email)
3. Phase 17 — P3 PDF/XLS export (only if time permits)
