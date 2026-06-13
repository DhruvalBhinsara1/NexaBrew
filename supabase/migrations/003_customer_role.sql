-- Add a third user role: 'customer'.
-- Customers are login accounts that browse the menu and track their own orders.
-- Public signup now defaults to 'customer'; admins still create employees/admins.

-- 1. Allow 'customer' in the users.role CHECK constraint --------------------
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('admin', 'employee', 'customer'));

-- 2. Link a CRM customer row to its auth user (nullable: not every CRM
--    contact has a login, and not every employee/admin is a customer) -------
alter table public.customers
  add column if not exists user_id uuid references public.users (id) on delete set null;

create index if not exists customers_user_id_idx on public.customers (user_id);

-- 3. Signup default -> customer, and auto-create/link a CRM row for customers.
--    Employees/admins (role passed explicitly by the Admin API) get no CRM row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'customer');
  v_name text := coalesce(new.raw_user_meta_data->>'name', 'New User');
begin
  insert into public.users (id, email, name, role)
  values (new.id, new.email, v_name, v_role);

  -- Give customers a CRM row so their orders can be linked to them.
  -- If a CRM contact with this email already exists, link it instead.
  if v_role = 'customer' then
    insert into public.customers (name, email, user_id)
    values (v_name, new.email, new.id)
    on conflict (email) do update set user_id = excluded.user_id;
  end if;

  return new;
end;
$$;

-- 4. Let customers read their own CRM row + orders.
--    (customers_all_auth + orders_select_auth already allow authenticated
--     reads; the app scopes "my orders" by customers.user_id = auth.uid().)
