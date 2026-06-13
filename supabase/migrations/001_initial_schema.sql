-- ============================================================================
-- NexaBrew — Initial schema (Phase 1)
-- Source of truth: DATA_MODEL.md. Tables, sequences, functions, triggers,
-- RLS policies, indexes, and realtime publication.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Order number sequence + generator (used as default on orders.order_number)
-- ----------------------------------------------------------------------------
create sequence if not exists order_number_seq start 1;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
begin
  return 'ORD-' || lpad(nextval('order_number_seq')::text, 4, '0');
end;
$$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- users (mirrors auth.users.id) ----------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  name        text not null,
  role        text not null default 'employee' check (role in ('admin', 'employee')),
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- categories -----------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- products -------------------------------------------------------------------
create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  category_id        uuid references public.categories (id) on delete set null,
  price              numeric(10, 2) not null check (price > 0),
  unit_of_measure    text not null,
  tax_rate           numeric(5, 2) not null default 0 check (tax_rate >= 0),
  description        text,
  is_kitchen_display boolean not null default true,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- payment_methods (fixed 3 rows) ---------------------------------------------
create table if not exists public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  type       text not null unique check (type in ('cash', 'card', 'upi')),
  is_enabled boolean not null default false,
  upi_id     text,
  updated_at timestamptz not null default now()
);

-- floors ---------------------------------------------------------------------
create table if not exists public.floors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- tables ---------------------------------------------------------------------
create table if not exists public.tables (
  id           uuid primary key default gen_random_uuid(),
  floor_id     uuid not null references public.floors (id) on delete cascade,
  table_number integer not null,
  seats        integer not null check (seats > 0),
  is_active    boolean not null default true,
  status       text not null default 'available' check (status in ('available', 'occupied')),
  created_at   timestamptz not null default now(),
  unique (floor_id, table_number)
);

-- customers ------------------------------------------------------------------
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text unique,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- sessions -------------------------------------------------------------------
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  opened_by       uuid not null references public.users (id),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  status          text not null default 'open' check (status in ('open', 'closed')),
  opening_balance numeric(10, 2) not null default 0,
  closing_balance numeric(10, 2),
  notes           text
);

-- coupons --------------------------------------------------------------------
create table if not exists public.coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  discount_type  text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  is_active      boolean not null default true,
  max_uses       integer,
  used_count     integer not null default 0,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- promotions -----------------------------------------------------------------
create table if not exists public.promotions (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  applies_to       text not null check (applies_to in ('product', 'order')),
  product_id       uuid references public.products (id) on delete cascade,
  min_quantity     integer,
  min_order_amount numeric(10, 2),
  discount_type    text not null check (discount_type in ('percentage', 'fixed')),
  discount_value   numeric(10, 2) not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- orders ---------------------------------------------------------------------
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique default public.generate_order_number(),
  session_id      uuid not null references public.sessions (id),
  table_id        uuid references public.tables (id) on delete set null,
  customer_id     uuid references public.customers (id) on delete set null,
  employee_id     uuid not null references public.users (id),
  status          text not null default 'draft'
                    check (status in ('draft', 'sent_to_kitchen', 'payment_pending', 'paid', 'cancelled')),
  subtotal        numeric(10, 2) not null default 0,
  tax_amount      numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  total_amount    numeric(10, 2) not null default 0,
  coupon_id       uuid references public.coupons (id),
  promotion_id    uuid references public.promotions (id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- order_items ----------------------------------------------------------------
create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_id      uuid not null references public.products (id),
  product_name    text not null,
  unit_price      numeric(10, 2) not null,
  quantity        integer not null check (quantity > 0),
  tax_rate        numeric(5, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  line_total      numeric(10, 2) not null,
  promotion_id    uuid references public.promotions (id)
);

-- payments -------------------------------------------------------------------
create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null unique references public.orders (id),
  payment_method_type   text not null check (payment_method_type in ('cash', 'card', 'upi')),
  amount_paid           numeric(10, 2) not null,
  amount_tendered       numeric(10, 2),
  change_due            numeric(10, 2),
  transaction_reference text,
  status                text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  paid_at               timestamptz,
  created_at            timestamptz not null default now()
);

-- kitchen_tickets ------------------------------------------------------------
create table if not exists public.kitchen_tickets (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id),
  ticket_number text not null,
  status        text not null default 'to_cook' check (status in ('to_cook', 'preparing', 'completed')),
  sent_at       timestamptz not null default now(),
  completed_at  timestamptz
);

-- kitchen_ticket_items -------------------------------------------------------
create table if not exists public.kitchen_ticket_items (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.kitchen_tickets (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id),
  product_name  text not null,
  quantity      integer not null,
  is_completed  boolean not null default false
);

-- ============================================================================
-- AUTH TRIGGER — auto-create public.users row on signup
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- INDEXES
-- ============================================================================
create index if not exists idx_users_email             on public.users (email);
create index if not exists idx_users_role              on public.users (role);

create index if not exists idx_products_category_id    on public.products (category_id);
create index if not exists idx_products_is_active      on public.products (is_active);
create index if not exists idx_products_name_trgm      on public.products using gin (to_tsvector('simple', name));

create index if not exists idx_tables_floor_id         on public.tables (floor_id);
create index if not exists idx_tables_status           on public.tables (status);

create index if not exists idx_customers_email         on public.customers (email);
create index if not exists idx_customers_phone         on public.customers (phone);
create index if not exists idx_customers_name_trgm     on public.customers using gin (to_tsvector('simple', name));

create index if not exists idx_sessions_status         on public.sessions (status);
create index if not exists idx_sessions_opened_by      on public.sessions (opened_by);

create index if not exists idx_coupons_code            on public.coupons (code);
create index if not exists idx_coupons_is_active       on public.coupons (is_active);

create index if not exists idx_orders_session_id       on public.orders (session_id);
create index if not exists idx_orders_table_id         on public.orders (table_id);
create index if not exists idx_orders_status           on public.orders (status);
create index if not exists idx_orders_order_number     on public.orders (order_number);
create index if not exists idx_orders_employee_id      on public.orders (employee_id);

create index if not exists idx_order_items_order_id    on public.order_items (order_id);
create index if not exists idx_order_items_product_id  on public.order_items (product_id);

create index if not exists idx_kitchen_tickets_order_id on public.kitchen_tickets (order_id);
create index if not exists idx_kitchen_tickets_status   on public.kitchen_tickets (status);

create index if not exists idx_payments_order_id       on public.payments (order_id);
create index if not exists idx_payments_status         on public.payments (status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users                enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.floors               enable row level security;
alter table public.tables               enable row level security;
alter table public.customers            enable row level security;
alter table public.sessions             enable row level security;
alter table public.coupons              enable row level security;
alter table public.promotions           enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.payments             enable row level security;
alter table public.kitchen_tickets      enable row level security;
alter table public.kitchen_ticket_items enable row level security;

-- Helper: current user's role (SECURITY DEFINER avoids RLS recursion on users)
create or replace function public.get_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- users ----------------------------------------------------------------------
drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin" on public.users
  for select using (auth.uid() = id or public.get_user_role() = 'admin');

drop policy if exists "users_update_admin" on public.users;
create policy "users_update_admin" on public.users
  for update using (public.get_user_role() = 'admin');

-- categories -----------------------------------------------------------------
drop policy if exists "categories_select_auth" on public.categories;
create policy "categories_select_auth" on public.categories
  for select using (auth.role() = 'authenticated');

drop policy if exists "categories_write_admin" on public.categories;
create policy "categories_write_admin" on public.categories
  for all using (public.get_user_role() = 'admin') with check (public.get_user_role() = 'admin');

-- products -------------------------------------------------------------------
drop policy if exists "products_select_auth" on public.products;
create policy "products_select_auth" on public.products
  for select using (auth.role() = 'authenticated');

drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin" on public.products
  for all using (public.get_user_role() = 'admin') with check (public.get_user_role() = 'admin');

-- payment_methods ------------------------------------------------------------
drop policy if exists "payment_methods_select_auth" on public.payment_methods;
create policy "payment_methods_select_auth" on public.payment_methods
  for select using (auth.role() = 'authenticated');

drop policy if exists "payment_methods_write_admin" on public.payment_methods;
create policy "payment_methods_write_admin" on public.payment_methods
  for all using (public.get_user_role() = 'admin') with check (public.get_user_role() = 'admin');

-- floors ---------------------------------------------------------------------
drop policy if exists "floors_select_auth" on public.floors;
create policy "floors_select_auth" on public.floors
  for select using (auth.role() = 'authenticated');

drop policy if exists "floors_write_admin" on public.floors;
create policy "floors_write_admin" on public.floors
  for all using (public.get_user_role() = 'admin') with check (public.get_user_role() = 'admin');

-- tables (read: auth; status update: auth; insert/delete: admin) --------------
drop policy if exists "tables_select_auth" on public.tables;
create policy "tables_select_auth" on public.tables
  for select using (auth.role() = 'authenticated');

drop policy if exists "tables_update_auth" on public.tables;
create policy "tables_update_auth" on public.tables
  for update using (auth.role() = 'authenticated');

drop policy if exists "tables_insert_admin" on public.tables;
create policy "tables_insert_admin" on public.tables
  for insert with check (public.get_user_role() = 'admin');

drop policy if exists "tables_delete_admin" on public.tables;
create policy "tables_delete_admin" on public.tables
  for delete using (public.get_user_role() = 'admin');

-- customers (all authenticated read/write) -----------------------------------
drop policy if exists "customers_all_auth" on public.customers;
create policy "customers_all_auth" on public.customers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- sessions (admin all; employee reads open) ----------------------------------
drop policy if exists "sessions_select" on public.sessions;
create policy "sessions_select" on public.sessions
  for select using (public.get_user_role() = 'admin' or status = 'open');

drop policy if exists "sessions_write_admin" on public.sessions;
create policy "sessions_write_admin" on public.sessions
  for all using (public.get_user_role() = 'admin') with check (public.get_user_role() = 'admin');

-- coupons (read auth; write admin) -------------------------------------------
drop policy if exists "coupons_select_auth" on public.coupons;
create policy "coupons_select_auth" on public.coupons
  for select using (auth.role() = 'authenticated');

drop policy if exists "coupons_write_admin" on public.coupons;
create policy "coupons_write_admin" on public.coupons
  for all using (public.get_user_role() = 'admin') with check (public.get_user_role() = 'admin');

-- promotions (read auth; write admin) ----------------------------------------
drop policy if exists "promotions_select_auth" on public.promotions;
create policy "promotions_select_auth" on public.promotions
  for select using (auth.role() = 'authenticated');

drop policy if exists "promotions_write_admin" on public.promotions;
create policy "promotions_write_admin" on public.promotions
  for all using (public.get_user_role() = 'admin') with check (public.get_user_role() = 'admin');

-- orders (read auth; insert own; update auth; delete auth) --------------------
drop policy if exists "orders_select_auth" on public.orders;
create policy "orders_select_auth" on public.orders
  for select using (auth.role() = 'authenticated');

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert with check (employee_id = auth.uid());

drop policy if exists "orders_update_auth" on public.orders;
create policy "orders_update_auth" on public.orders
  for update using (auth.role() = 'authenticated');

drop policy if exists "orders_delete_auth" on public.orders;
create policy "orders_delete_auth" on public.orders
  for delete using (auth.role() = 'authenticated');

-- order_items (all authenticated) --------------------------------------------
drop policy if exists "order_items_all_auth" on public.order_items;
create policy "order_items_all_auth" on public.order_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- payments (all authenticated read/insert/update) ----------------------------
drop policy if exists "payments_all_auth" on public.payments;
create policy "payments_all_auth" on public.payments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- kitchen_tickets (PUBLIC read for KDS — DECISION-009; writes authenticated) -
drop policy if exists "kitchen_tickets_select_public" on public.kitchen_tickets;
create policy "kitchen_tickets_select_public" on public.kitchen_tickets
  for select using (true);

drop policy if exists "kitchen_tickets_write_auth" on public.kitchen_tickets;
create policy "kitchen_tickets_write_auth" on public.kitchen_tickets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- kitchen_ticket_items (PUBLIC read for KDS; writes authenticated) -----------
drop policy if exists "kitchen_ticket_items_select_public" on public.kitchen_ticket_items;
create policy "kitchen_ticket_items_select_public" on public.kitchen_ticket_items
  for select using (true);

drop policy if exists "kitchen_ticket_items_write_auth" on public.kitchen_ticket_items;
create policy "kitchen_ticket_items_write_auth" on public.kitchen_ticket_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================================
-- REALTIME — add tables to the supabase_realtime publication
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kitchen_tickets'
  ) then
    alter publication supabase_realtime add table public.kitchen_tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kitchen_ticket_items'
  ) then
    alter publication supabase_realtime add table public.kitchen_ticket_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tables'
  ) then
    alter publication supabase_realtime add table public.tables;
  end if;
end
$$;
