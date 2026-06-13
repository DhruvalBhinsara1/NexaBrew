# NexaBrew — Build Handoff

> Status snapshot for continuing the 24h hackathon build in a new tool/session.
> Read the 10 spec docs in `/Users/dhruvalbhinsara/Downloads/files 2/` first
> (CLAUDE.md, CONSTRAINTS.md, DECISIONS.md, ARCHITECTURE.md, DATA_MODEL.md,
> PRD.md, DESIGN.md, TASKS.md, AGENTS.md, NexaBrew_Backend_Blueprint_v2.md).
> Those are the source of truth. This file records what's BUILT and DECIDED.

Project root: `/Users/dhruvalbhinsara/NexaBrew`

---

## Progress: Phases 0–7 COMPLETE. Phase 8 NOT STARTED (next).

| Phase | Status |
|---|---|
| 0 — Project Setup | ✅ done, `tsc` + `next build` green |
| 1 — Database (schema/RLS/seed/types) | ✅ done, applied to live project, seeded |
| 2 — Auth & Middleware (login/signup) | ✅ done, redirects verified live |
| 3 — Core Config APIs (products/categories/floors/tables/payment-methods) | ✅ done, RLS verified |
| 4 — Sessions | ✅ done, lifecycle verified |
| 5 — Orders | ✅ done, `tsc` + `next build` + live service flow verified |
| 6 — Discounts | ✅ done, `tsc` + `next build` + live discount service flow verified |
| 7 — Kitchen APIs | ✅ done, routes + service methods implemented |
| 8–17 | not started |

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
- **`.env.local`** (gitignored) has REAL keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT keys). `RESEND_API_KEY` is still a placeholder (P1, Phase 8). DB password saved in `.supabase-db-password.local` (gitignored).
- **Migration applied**: `supabase/migrations/001_initial_schema.sql` (15 tables + trigger + sequence + RLS + indexes + realtime). Apply more via `SUPABASE_DB_PASSWORD="$(cat .supabase-db-password.local)" supabase db push`.
- **Seeded** (`npm run seed`): 6 categories, 12 products, 3 payment methods, 3 floors + 18 tables, 3 coupons (SAVE10/FLAT50/WELCOME20), 2 promotions, 3 users.
- **Demo accounts**: `admin@nexabrew.com` (admin), `alice@nexabrew.com` + `bob@nexabrew.com` (employee). Password is configured locally and is not stored in git.
- Regenerate types after any schema change: `supabase gen types typescript --linked > types/database.types.ts`

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
