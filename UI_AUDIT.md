<!--
═══════════════════════════════════════════════════════════════════════════
  NEXABREW UI OVERHAUL — PHASE 0 AUDIT
  Generated read-only. No app/ or components/ source was modified in Phase 0.
  Design source of truth: DESIGN-wise.md (Wise design language).
  Scope: app/ + components/ ONLY. Frozen: services/ store/ hooks/ lib/
         schemas/ types/ supabase/ middleware.ts next.config.mjs app/api/**.
═══════════════════════════════════════════════════════════════════════════
-->

# NexaBrew — UI Audit (Phase 0)

This audit inventories every UI surface and component, records each
component's **prop / callback contract** (which must survive the overhaul
unchanged), classifies **pure-display vs data-wired**, flags every import from
`services/ · store/ · hooks/`, and catalogs the current color usage that
Phase 1 will replace with Wise tokens.

> **Frozen contract:** nothing in `services/`, `store/`, `hooks/`, `lib/`,
> `schemas/`, `types/`, `supabase/`, `middleware.ts`, `next.config.mjs`, or
> `app/api/**` is touched. Only the presentation layer (JSX + Tailwind classes
> in `app/**/*.tsx`, `app/globals.css`, and `components/**`) moves.

---

## 1. `app/` — Pages & Layouts (UI surfaces)

`C` = `"use client"`, `S` = server component.

### Layouts
| File | Type | Role | Notes |
|---|---|---|---|
| `app/layout.tsx` | S | Root: `<html><body>`, Inter font, Toaster, PrelineScript | Phase 2.1 — add Wise display font; body `font-sans`; keep metadata/providers |
| `app/(auth)/layout.tsx` | S | Split auth shell: `Skiper71Wrapper` brand panel + form panel | Phase 4.6 — brand panel → Wise sage/ink; keep split |
| `app/dashboard/layout.tsx` | S | `flex` shell: `DashboardSidebar` + `<main>` | Phase 2.2 — sidebar restyle; bg `surface-muted`→`wise-canvas-soft` |
| `app/pos/layout.tsx` | S | `min-h-screen bg-surface-muted` wrapper | bg → Wise canvas-soft |
| `app/menu/layout.tsx` | S | `min-h-screen bg-surface-muted` wrapper | bg → Wise canvas-soft |

### Pages
| File | Type | Surface | Phase | Data layer |
|---|---|---|---|---|
| `app/page.tsx` | S | Landing / role entry | 4.6-ish | none (static links) |
| `app/(auth)/login/page.tsx` | C | Login form | 4.6 | `useToast` only |
| `app/(auth)/signup/page.tsx` | C | Signup form | 4.6 | `useToast` only |
| `app/dashboard/page.tsx` | **S** | Dashboard overview (KPIs, occupancy, recent orders) | 4.4 | **imports `SessionService`, `ReportService`, `FloorService`** — server fetch, PRESERVE |
| `app/dashboard/products/page.tsx` | C | Products CRUD table + dialog | 4.x | `useToast`, `apiGet/apiSend` |
| `app/dashboard/categories/page.tsx` | C | Categories CRUD (+ color presets) | 4.x | `useToast` |
| `app/dashboard/floors/page.tsx` | C | Floors & tables CRUD | 4.x | `useToast` |
| `app/dashboard/payment-methods/page.tsx` | C | Payment methods CRUD | 4.5 | `useToast` |
| `app/dashboard/coupons/page.tsx` | C | Coupons & promotions | 4.x | `useToast` |
| `app/dashboard/users/page.tsx` | C | Users table + add dialog (paginated) | 4.x | `useToast` |
| `app/dashboard/sessions/page.tsx` | C | Sessions history + active banner + user filter | 4.3 | `useToast` |
| `app/dashboard/reports/page.tsx` | C | Reports (KPIs, recharts, tables, order history) | 4.4 | `useToast`; recharts |
| `app/dashboard/orders/page.tsx` | C | Dashboard orders view | 4.3 | `useToast` |
| `app/kds/page.tsx` | C | **Kitchen Display (dark theme)** | 4.x | `useRealtimeKitchenTickets` hook |
| `app/menu/page.tsx` | C | Customer menu + live order tracking | 4.1 | `useToast` |
| `app/pos/terminal/page.tsx` | S | POS terminal wrapper → `<PosTerminal/>` | 4.1/4.2 | none (delegates) |
| `app/pos/orders/page.tsx` | C | Orders & payments list + detail sheet | 4.3 | `useToast` |
| `app/pos/customers/page.tsx` | C | Customers list | 4.x | `useToast` |
| `app/globals.css` | — | shadcn CSS-variable theme (zinc base) | **1.2** | remap vars to Wise |

### `app/api/**` — **FROZEN (not UI).**
46 route handlers under `app/api/`. These are server endpoints, **out of
scope** — never edited in this overhaul. (Listed here only so they are not
mistaken for UI surfaces.)

---

## 2. `components/` — Inventory

### `components/ui/` — shadcn primitives (the design-system layer, Phase 3)
`badge` · `button` · `calendar` · `card` · `command` · `dialog` ·
`dropdown-menu` · `form` · `input` · `label` · `pagination` · `popover` ·
`radio-group` · `select` · `separator` · `sheet` · `skeleton` · `switch` ·
`table` · `tabs` · `toast` · `toaster`

All currently theme off shadcn CSS variables (`--primary`, `--ring`,
`--border`, `--muted-foreground`, …) which today resolve to a **zinc /
near-black** ramp (see §6). Re-skinning these in Phase 1 (CSS vars) + Phase 3
(variant classes) cascades to every consumer with zero prop changes.

### `components/dashboard/`
| Component | Props (contract — DO NOT CHANGE) | Display/Wired |
|---|---|---|
| `DashboardSidebar` | _none_ | **wired** (uses `usePathname`, renders `NAV_ITEMS`; `LogoutButton`) |
| `PageHeader` | `title, subtitle?, action?` | pure display |
| `KpiTrendCard` | `title, value, sub?, icon, href, color(hex), chartType, series, format, popoverTitle, popoverHint?` | pure display (inline SVG) |
| `TablesOccupiedCard` | `occupiedCount, totalTables, floors, lockedTableIds, href` | pure display |
| `TableOccupancyGrid` | `floors, lockedTables?` | **wired** (`useToast`, `apiSend` on toggle) |

### `components/pos/`
| Component | Props (contract — DO NOT CHANGE) | Display/Wired |
|---|---|---|
| `PosTerminal` | _none_ | **wired** (`usePosStore`, `useToast`, fetches) — orchestrator |
| `ProductsPanel` | `products, categories` | **wired** (`usePosStore` for add-to-cart) |
| `CartPanel` | `onTableSelect, onApplyCoupon, onAssignCustomer, onSendToKitchen, onNewBill, onOpenBills, openBillCount, sending` | **wired** (`usePosStore`) |
| `PaymentPanel` | `onPaymentComplete, onNewBill?, onOpenBills?, openBillCount?, toast` | **wired** (`usePosStore`) |
| `PaymentDialog` | `orderId, orderNumber, total, open, onClose, onPaid, toast, customerName?` | display + fetch (Razorpay/cash) |
| `ReceiptDialog` | `orderId, open, onClose, toast?` | display + fetch (receipt/QR) |
| `CouponDialog` | `open, onClose` | **wired** (`usePosStore`) |
| `CustomerDialog` | `open, onClose` | **wired** (`usePosStore`, `useToast`) |
| `OpenBillsSheet` | `open, onClose, sessionId, refreshKey, onBillSwitched?, toast` | **wired** (`usePosStore`) |
| `TableSelectorDialog` | `open, onClose, floors, onSelect, selectedTableId?` | pure display |

### `components/shared/`
| Component | Props | Display/Wired |
|---|---|---|
| `EmptyState` | `icon?, title, subtitle?, action?{label,onClick}` | pure display |
| `ErrorState` | `message?, onRetry?` | pure display |
| `LogoutButton` | _none_ | **wired** (auth signout) |
| `PrelineScript` | _none_ | behavior-only (Preline autoInit) — **leave as-is** |

### `components/kokonutui/`
| Component | Props | Display/Wired |
|---|---|---|
| `slide-text-button` (`SlideTextButton`) | extends button HTML attrs + `loading?, tone?('brand'\|'green')` | pure display (animated CTA) |

### `components/skiper/`
| Component | Props | Notes |
|---|---|---|
| `skiper71` / `skiper71-wrapper` | _none_ | auth brand-panel animation; restyle colors to Wise in 4.6 |

---

## 3. Pure-display vs Data-wired — summary

**Pure display** (safe to restyle freely; props in → markup out):
`PageHeader`, `KpiTrendCard`, `TablesOccupiedCard`, `TableSelectorDialog`,
`EmptyState`, `ErrorState`, `SlideTextButton`, all `components/ui/*`
primitives.

**Data-wired** (restyle JSX only — keep every hook call, store selector,
fetch, and prop signature byte-for-byte):
`PosTerminal`, `ProductsPanel`, `CartPanel`, `PaymentPanel`, `PaymentDialog`,
`ReceiptDialog`, `CouponDialog`, `CustomerDialog`, `OpenBillsSheet`,
`TableOccupancyGrid`, `DashboardSidebar`, `LogoutButton`, and the client
dashboard/pos/menu pages (all use `useToast` + `apiGet/apiSend`).

---

## 4. Components/pages importing from `services/ · store/ · hooks/` (FLAGGED)

These keep their **exact** data contract; only visual classes change.

**`store/usePosStore` (Zustand):** `PosTerminal`, `ProductsPanel`, `CartPanel`,
`PaymentPanel`, `CouponDialog`, `CustomerDialog`, `OpenBillsSheet`.

**`hooks/`:** `useToast` → `TableOccupancyGrid`, `CustomerDialog`,
`PosTerminal`, `toaster`, and ~11 client pages. `useRealtimeKitchenTickets` →
`app/kds/page.tsx`.

**`services/` (⚠ special case):** `app/dashboard/page.tsx` is a **server
component** that imports `SessionService`, `ReportService`, `FloorService` for
server-side data fetching. This is the correct Next.js data layer, NOT a
"visual component importing services." **Action:** preserve all fetch logic;
restyle only the returned JSX. (The overhaul prompt's "never import services in
a visual component" rule targets client components — this server fetch stays.)

> No client/visual component imports from `services/`. ✅ contract is clean.

---

## 5. Architecture notes & risks for later phases

1. **`app/dashboard/page.tsx` passes hex color props** (`#d4791f`, `#16a34a`,
   `#7c3aed`) into `KpiTrendCard`. These literals live in a server component
   (UI file, in scope). Phase 1/3 will feed Wise hex values instead.
2. **KDS is a deliberate dark theme** (`kds-bg #0f1117`, `kds-card`,
   `kds-border` tokens). Maps cleanly to Wise's `hero-band-dark` pattern
   (ink surface + lime-green accent). Treat as its own dark sub-theme.
3. **Category colors** (`#F39C12`, `#E74C3C`, `#9B59B6`, `#6F4E37`, …) are a
   **preset swatch palette** for user-chosen category colors (domain data,
   echoes `category.color` in the DB). These are NOT theme tokens — leave the
   picker values, or optionally align presets to Wise accents. Out of the
   tokenization sweep.
4. **shadcn primitives are CSS-var driven** — re-skin once in `globals.css`
   (Phase 1.2) and the whole `components/ui/*` layer follows.
5. **Preline** is loaded (`PrelineScript`, `tailwind.config` content glob).
   Behavior-only; don't remove. Watch for Preline utility classes if any
   surface relies on them.
6. **Radius mismatch:** Wise's canonical card/button radius is **24px**
   (`{rounded.xl}`). Tailwind's `rounded-xl` = 12px. Phase 1 must add explicit
   `rounded-wise`/`rounded-wiseCard` tokens (24px) — do not assume `xl`.
7. **Font gap:** only Inter is loaded. Wise wants a heavy display face
   (weight 900). Phase 1 adds a display font (Inter 900 / Manrope 800–900 as
   the open substitute for Wise Sans) + keeps Inter for body.

---

## 6. Color audit — current usage → Wise token map (Phase 1 plan)

### Current class footprint (app/ + components/, excl. api)
| Family | Count | Meaning today |
|---|---:|---|
| `text-zinc-*` | ~300 | headings / body / muted text |
| `bg-brand-*` | 97 | primary buttons, accents, active states |
| `text-brand-*` | 58 | links, labels, icons |
| `border-brand-*` / `ring-brand-*` | 28 | focus & active borders |
| `text/bg-green-*`, `-emerald-*` | ~46 | success / paid / positive |
| `text/bg-amber-*` | ~44 | warning / pending |
| `text/bg-red-*` | ~30 | error / cancelled / destructive |
| `text/bg-blue-*`, `-violet-*`, `-purple-*`, `-orange-*` | ~30 | misc accents, chart series, avatars |
| `surface-muted` / `surface-border` | many | page bg / dividers |

### Hardcoded hex (27 occurrences)
- **Theme accents (retokenize):** `#d4791f` (brand orange ×8), `#16a34a`
  (green ×3), `#7c3aed` (violet ×3), `#d97706` (amber), `#2563eb` (blue),
  `#a1a1aa`/`#e2e8f0`/`#f8f7f5`/`#eee7dd`/`#f2ce99` (chart axes/grids/neutrals).
- **Domain/category presets (leave):** `#F39C12 #F1C40F #E91E63 #E74C3C
  #9B59B6 #8E44AD #6F4E37 #3498DB #34495E #2ECC71 #1ABC9C #16A085`.

### Proposed Wise token mapping (to apply in Phase 1)
| Current | Wise token (DESIGN-wise.md) | Hex |
|---|---|---|
| `bg-brand-500` (CTA) | `wise-primary` on `wise-ink` text | `#9fe870` / `#0e0f0c` |
| `text-brand-*` (links/labels) | `wise-primary` *(interactive)* or `wise-ink-deep` | `#9fe870` / `#163300` |
| `text-zinc-900/800` (headings) | `wise-ink` | `#0e0f0c` |
| `text-zinc-600/500` (body) | `wise-body` | `#454745` |
| `text-zinc-400/300` (muted) | `wise-mute` | `#868685` |
| `bg-surface-muted` (page bg) | `wise-canvas-soft` | `#e8ebe6` |
| `bg-white` (cards) | `wise-canvas` | `#ffffff` |
| `border-surface-border` | `wise-border` (= canvas-soft / ink-alpha) | `#e8ebe6` |
| green / paid | `wise-positive` / `wise-positive-deep` | `#2ead4b` / `#054d28` |
| amber / pending | `wise-warning` / `wise-warning-content` | `#ffd11a` / `#4a3b1c` |
| red / cancelled | `wise-negative` / `wise-negative-deep` | `#d03238` / `#a72027` |
| chart series (orange/violet/blue) | `wise-primary` + `wise-accent-cyan` + `wise-accent-orange` + `wise-ink` | `#9fe870 #38c8ff #ffc091 #0e0f0c` |
| KDS dark surfaces | `wise-ink` family + `wise-primary` accent | `#0e0f0c` / `#9fe870` |

### Radius / type tokens to add (Phase 1)
- `rounded-wise` = 12px (inputs), `rounded-wiseCard` = 24px (cards/buttons),
  `rounded-pill` = 9999px (status pills).
- `font-display` (Inter 900 / Manrope) + `font-sans` (Inter) ; type scale per
  Phase 5 (display → caption).
- shadcn CSS vars in `globals.css`: `--primary`→Wise green, `--ring`→Wise
  green, `--border`→Wise border, foreground/muted → Wise ink/body/mute.

---

## 7. Recommended phase order & commit checkpoints
0. ✅ **Phase 0 — this audit** (no code touched).
1. Phase 1 — tokens: `tailwind.config.ts` Wise palette/radius/fonts +
   `app/globals.css` CSS-var remap + display font in `app/layout.tsx`.
   → `ui: phase 1 — design token foundation`
2. Phase 2 — shell: root layout, `DashboardSidebar`, headers.
3. Phase 3 — `components/ui/*` variants (button, card, input, badge, table,
   dialog, toast).
4. Phase 4 — screen-by-screen (menu → cart → orders → dashboard → settings →
   auth → KDS), one file at a time, read-before-edit.
5. Phase 5–7 — type scale, motion (`motion-safe:`, reduced-motion), responsive
   + a11y (focus-visible ring `wise-green`, `aria-label`s, label/for).
6. Phase 8 — verify: `tsc --noEmit`, `next lint`, `next build`, no stray hex.

**Status: Phase 0 complete — paused for review before Phase 1.**
