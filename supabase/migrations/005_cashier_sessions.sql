-- Let cashiers (employees) open and close sessions, not just admins.
-- A cafe shift is opened/closed by whoever is on the POS.

drop policy if exists "sessions_write_admin" on public.sessions;
drop policy if exists "sessions_write_staff" on public.sessions;

create policy "sessions_write_staff" on public.sessions
  for all
  using (public.get_user_role() in ('admin', 'employee'))
  with check (public.get_user_role() in ('admin', 'employee'));
