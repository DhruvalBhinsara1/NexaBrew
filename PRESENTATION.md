# NexaBrew — Jury Presentation Cheat-Sheet

Quick map of "where is the code for X?" → exact file:line. `Cmd/Ctrl+Click` paths in most editors to jump.

> Stack: Next.js 14 (App Router) · Supabase (Postgres + Auth + RLS + Realtime) · Zustand · Razorpay · Tailwind/shadcn · Zod · Resend/Gmail SMTP.

---

## 🎯 The "classics" they always ask

### Pagination
- Reusable UI component (5/10/20/50 page-size selector, prev/next) — `components/ui/pagination.tsx:19`
- Server-side query-param parsing — `lib/utils/pagination.ts:40`
- True DB-level paginated query (count + range) — `services/OrderService.ts:46` (`listPaginated`)
- Server-paginated usage — `app/dashboard/orders/page.tsx`
- Client-paginated usage — `app/pos/customers/page.tsx`

### Discount / Coupon
- **The discount engine (the actual math)** — `services/OrderPricing.ts:116` (`buildDiscountState`) + `totalsForDiscount` at `services/OrderPricing.ts:41`
- Apply-coupon service — `services/OrderService.ts:298` (`applyCoupon`)
- Endpoint — `app/api/orders/[id]/apply-coupon/route.ts`
- Validation — `schemas/coupon.schema.ts`
- UI — `components/pos/CouponDialog.tsx`

### Table assignment
- `assignTable` — validates active + not occupied, then occupies — `services/OrderService.ts:377`
- Why a *draft* doesn't occupy but *sent-to-kitchen* does — `services/OrderService.ts:245`
- Endpoint — `app/api/orders/[id]/assign-table/route.ts`
- POS handler — `components/pos/PosTerminal.tsx:141` (`handleTableSelect`)
- Picker UI — `components/pos/TableSelectorDialog.tsx`

---

## 💳 Payments & Security (high-impact)

### Payments
- Payment processing (cash validation + Razorpay branch + change-due) — `services/PaymentService.ts:271` (`process`)
- **Razorpay signature verification (HMAC-SHA256)** — `lib/razorpay.ts:20` — *"we never trust the client; we re-verify the signature server-side"*
- Razorpay order creation — `app/api/orders/[id]/razorpay/route.ts`
- Record payment endpoint — `app/api/orders/[id]/payment/route.ts`
- UI — `components/pos/PaymentPanel.tsx`, `components/pos/PaymentDialog.tsx`

### Auth & RLS (the security story)
- Role-based route guard — `lib/auth/withAuth.ts:28` (e.g. `{ roles: ["admin"] }`)
- Edge middleware / session refresh + route protection — `middleware.ts:22`
- Three Supabase clients: anon, server (respects RLS), admin (bypasses RLS, server-only) — `lib/supabase/{client,server,admin}.ts`
- **The actual RLS policies** — `supabase/migrations/001_initial_schema.sql`
  (+ `003_customer_role.sql`, `004_kitchen_role.sql`, `005_cashier_sessions.sql`)

---

## ⚡ Real-time ("how is it live?")
- **Supabase Realtime is a WebSocket under the hood** (Phoenix Channels) — we subscribe to Postgres change events, no custom socket code.
- Hooks — `hooks/useRealtimeOrders.ts`, `hooks/useRealtimeTables.ts`, `hooks/useRealtimeKitchenTickets.ts`
- Per-order live status (POS) — `components/pos/PosTerminal.tsx:105`
- Customer's live order status — `app/menu/page.tsx:152`

---

## 🔄 Order lifecycle, Kitchen, Self-order
- Order create (snapshot item prices + apply discount) — `services/OrderService.ts:214` region
- Send to kitchen (creates kitchen ticket) — `services/KitchenService.ts:47`
- Kitchen Display System — `app/kds/page.tsx`
- **Customer self-ordering from the website** — `services/OrderService.ts:127` (`createForCustomerUser`: resolves the customer's CRM row + open session so RLS is satisfied) → `app/api/orders/mine/route.ts` → `app/menu/page.tsx`

---

## 📧 Receipt Email & 📊 Reports
- Receipt email with transport switch (**Gmail SMTP** preferred → **Resend** fallback) — `services/PaymentService.ts:378` (`sendReceipt`; `useGmail` at `:387`)
- Email endpoint — `app/api/orders/[id]/receipt/email/route.ts`
- Reports: reusable scoped-query helper (honors employee/session/product filters) — `services/ReportService.ts:94` (`scopedPaidOrderIds`)
  then `dailySummary` / `topProducts` / `topCategories` / `salesByEmployee` / `paymentBreakdown` / `topOrders`
- **IST timezone correctness** (server runs UTC on Vercel; everything pinned to Asia/Kolkata) — `lib/utils/datetime.ts`
- Reports UI (filters, charts, CSV/PDF export) — `app/dashboard/reports/page.tsx`

---

## 🧱 Architecture talking points
- **Validation** — Zod on every API input — `schemas/` (13 schemas)
- **Service layer** — thin route handlers, fat services — `services/*Service.ts`
- **State management** — Zustand POS store — `store/usePosStore.ts`
- **Receipt rendering** — thermal-style HTML — `lib/receipt/renderReceiptHtml.ts`; store identity — `lib/receipt/storeConfig.ts`

---

## 30-second architecture pitch
> "Next.js App Router front-to-back. Every API route validates input with Zod, then delegates to a **service layer** that talks to Supabase. Security is enforced at the database with **Row-Level Security**, with a role guard (`withAuth`) on top. Live updates — orders, tables, kitchen — ride **Supabase Realtime** (WebSockets). Payments verify the **Razorpay HMAC signature server-side**, and receipts go out over **Gmail SMTP**. Customers can self-order from the public menu, which the kitchen sees instantly."
