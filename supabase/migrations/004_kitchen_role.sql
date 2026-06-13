-- Add a fourth user role: 'kitchen'.
-- A kitchen account is a dedicated login for kitchen staff that lands straight
-- on the Kitchen Display (/kds) and is restricted to it. The KDS itself stays
-- public (DECISION-009); this role is a convenience login + access lock.

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'employee', 'customer', 'kitchen'));

-- No trigger change needed: kitchen accounts are provisioned via the Admin API
-- (seed / User Management) with role set explicitly; the public-signup default
-- remains 'customer'. Kitchen role gets no CRM row.
