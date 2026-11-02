-- =====================================================================
-- Norte Drones — nível OPERADOR (quem voa e aplica no campo)
--   Vê e cria ordens de serviço (OS), usa as calculadoras do Campo e cadastra cliente novo.
--   NÃO vê financeiro (lançamentos, contas, saldos, rateio, relatórios) e NÃO conclui/cobra OS.
--   Em OS aberta só edita dados da aplicação: não altera valor por hectare, status nem cobrança.
-- Depende de 0005, 0007, 0010 e 0011.
-- =====================================================================
alter table public.user_access drop constraint if exists user_access_role_check;
alter table public.user_access add constraint user_access_role_check
  check (role in ('admin', 'socio', 'financeiro', 'operador', 'consulta'));

create or replace function public.can_operate() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'socio', 'financeiro', 'operador'), false)
$$;
revoke execute on function public.can_operate() from public, anon;
grant execute on function public.can_operate() to authenticated;

-- OS: operador cria e edita (só enquanto aberta); o restante do time segue como antes.
drop policy if exists os_insert on public.service_orders;
drop policy if exists os_update on public.service_orders;
create policy os_insert on public.service_orders for insert to authenticated with check (public.can_operate());
create policy os_update on public.service_orders for update to authenticated
  using (public.can_write_finance() or (public.my_role() = 'operador' and status = 'aberta'))
  with check (public.can_write_finance() or public.my_role() = 'operador');

-- Cliente novo no campo (só cadastrar; editar valor/dados continua com o financeiro).
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (public.can_operate());

-- Receitas de calda salvas.
drop policy if exists recipes_insert on public.spray_recipes;
drop policy if exists recipes_update on public.spray_recipes;
create policy recipes_insert on public.spray_recipes for insert to authenticated with check (public.can_operate());
create policy recipes_update on public.spray_recipes for update to authenticated
  using (public.can_operate()) with check (public.can_operate());

-- O operador não mexe em valor, status, cobrança nem no OK do cliente (a tela esconde, o banco garante).
create or replace function public.trg_os_operator_guard() returns trigger
language plpgsql as $$
begin
  if public.my_role() = 'operador' and (
       new.price_per_ha is distinct from old.price_per_ha
    or new.status is distinct from old.status
    or new.transaction_id is distinct from old.transaction_id
    or new.closed_at is distinct from old.closed_at
  ) then
    raise exception 'O nível Operador não pode alterar valor, status ou cobrança da OS' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists os_operator_guard on public.service_orders;
create trigger os_operator_guard before update on public.service_orders
  for each row execute function public.trg_os_operator_guard();
