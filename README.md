# NexaBrew — Café Point-of-Sale & Management Platform

**Live at → [nxbrew.vercel.app](https://nxbrew.vercel.app)**

NexaBrew is a full-stack café management platform built for modern coffee shops. It handles everything from customer self-ordering and online payment to kitchen display, POS terminal, session management, and detailed sales analytics — all in one place.

---

## What is NexaBrew?

NexaBrew gives a café three things in a single web app:

| Surface | Who uses it | URL |
|---|---|---|
| **Customer Menu** | Walk-in guests | `/menu` |
| **POS Terminal** | Counter staff | `/pos/terminal` |
| **Kitchen Display (KDS)** | Kitchen team | `/kds` |
| **Management Dashboard** | Admin / owner | `/dashboard` |

### Customer flow
Customers scan a QR code (or visit the URL directly), browse the menu, add items to their cart, choose a table or counter pickup, apply a coupon, and pay online via Razorpay (UPI, card, netbanking) — or pay at the counter. Their cart is saved in the browser so closing the payment screen never wipes their order.

### Staff flow
The POS terminal lets staff take walk-in orders, assign tables, apply discounts, send to kitchen, and collect payment (cash, card, UPI). The Kitchen Display refreshes in real time — staff tap a ticket to advance it from *To Cook → Preparing → Completed*, and individual items can be marked done independently.

### Admin flow
The dashboard gives the owner full control: manage products, categories, floors & tables, payment methods, coupons, users, and sessions. The Reports page shows revenue, order counts, average order value, top products, and per-session breakdowns with live charts.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Database | [Supabase](https://supabase.com) (PostgreSQL + Realtime) |
| Auth | Supabase Auth (email/password, role-based) |
| Payments | [Razorpay](https://razorpay.com) |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | [Vercel](https://vercel.com) |
| ORM | Supabase client (row-level security) |

---

## Roles

| Role | Access |
|---|---|
| `admin` | Full dashboard, all management pages |
| `employee` | POS terminal, orders, KDS |
| `kitchen` | Kitchen Display only |
| `customer` | Menu & self-ordering only |

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables (see .env.example)
cp .env.example .env.local

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

---

## Deployment

The app is deployed on **Vercel** with automatic deployments on every push to `main`.

**Production URL:** [https://nxbrew.vercel.app](https://nxbrew.vercel.app)  
**Alternate URL:** [https://nexabrew.vercel.app](https://nexabrew.vercel.app)

To redeploy manually:
```bash
npx -y vercel --prod
```

---

## Project Structure

```
app/
  dashboard/     # Admin management pages
  pos/           # POS terminal & order management
  kds/           # Kitchen Display System
  menu/          # Customer self-ordering menu
  api/           # REST API route handlers
components/
  ui/            # shadcn/ui base components
  dashboard/     # Dashboard-specific components
  pos/           # POS-specific components
  shared/        # Shared components (EmptyState, LogoutButton, etc.)
services/        # Business logic (OrderService, PaymentService, etc.)
hooks/           # React hooks (realtime, toast, etc.)
lib/             # Utilities, Supabase clients, auth helpers
supabase/        # Database migrations and seed data
types/           # TypeScript domain types
```

---

## SEO & Meta

Every page in NexaBrew includes:

- Descriptive `<title>` tags per page (e.g. *"Menu & Orders — NexaBrew Café"*)
- `<meta name="description">` with page-specific copy
- Semantic HTML5 elements (`<header>`, `<main>`, `<nav>`, `<footer>`)
- Single `<h1>` per page with proper heading hierarchy
- `robots` meta set to `noindex` on protected staff pages (POS, KDS, Dashboard)
- `viewport` and `charset` meta on all pages
- Open Graph tags on public-facing pages (menu, login)

The root `layout.tsx` sets the global site metadata via Next.js `generateMetadata`.

---

## Database

Supabase (PostgreSQL) with row-level security on every table. Migrations live in `supabase/migrations/`. The schema covers:

- `users`, `customers` — authentication & profiles
- `categories`, `products` — menu management
- `floors`, `tables` — floor plan & seating
- `sessions` — cash drawer / shift tracking
- `orders`, `order_items` — order lifecycle
- `kitchen_tickets`, `kitchen_ticket_items` — KDS data
- `payments` — payment records
- `coupons` / `promotions` — discount engine
- `payment_methods` — configurable payment options
