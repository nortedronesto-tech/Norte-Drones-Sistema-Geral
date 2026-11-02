-- =====================================================================
-- Norte Drones — clientes e ordens de serviço (OS) de aplicação
-- Cada cliente tem o seu valor por hectare (padrão da empresa: ~R$ 100/ha, mas varia).
-- A OS registra o serviço feito (área, calda, clima, drone, operador). Ao CONCLUIR, gera
-- sozinha a conta a receber (entrada "a receber") no financeiro, na mesma transação.
-- Todo nível com acesso lê; admin, sócio e financeiro criam/editam/concluem; apagar: admin e sócio.
-- Depende de 0001–0005.
-- =====================================================================
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 120),
  doc          text check (doc is null or length(doc) <= 30),
  phone        text check (phone is null or length(phone) <= 30),
  city         text check (city is null or length(city) <= 80),
  price_per_ha numeric(10,2) check (price_per_ha is null or price_per_ha >= 0),
  notes        text check (notes is null or length(notes) <= 500),
  active       boolean not null default true,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create unique index if not exists clients_name_uniq on public.clients (lower(trim(name)));

create table if not exists public.service_orders (
  id            uuid primary key default gen_random_uuid(),
  number        bigint generated always as identity,
  client_id     uuid not null references public.clients (id),
  farm          text check (farm is null or length(farm) <= 120),
  service_date  date not null default public.today_br(),
  area_ha       numeric(10,2) not null check (area_ha > 0),
  price_per_ha  numeric(10,2) not null default 0 check (price_per_ha >= 0),
  total_amount  numeric(14,2) generated always as (round(area_ha * price_per_ha, 2)) stored,
  crop          text check (crop is null or length(crop) <= 80),
  target        text check (target is null or length(target) <= 120),
  drone         text check (drone is null or length(drone) <= 80),
  operator_name text check (operator_name is null or length(operator_name) <= 80),
  rate_l_ha     numeric(8,2) check (rate_l_ha is null or rate_l_ha > 0),
  tank_l        numeric(8,2) check (tank_l is null or tank_l > 0),
  products      jsonb not null default '[]'::jsonb check (jsonb_typeof(products) = 'array'),
  wind_kmh      numeric(5,1) check (wind_kmh is null or wind_kmh >= 0),
  temp_c        numeric(4,1),
  humidity_pct  numeric(4,1) check (humidity_pct is null or humidity_pct between 0 and 100),
  notes         text check (notes is null or length(notes) <= 1000),
  status        text not null default 'aberta' check (status in ('aberta', 'concluida', 'cancelada')),
  transaction_id uuid references public.transactions (id) on delete set null,
  closed_at     timestamptz,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists service_orders_client_idx on public.service_orders (client_id);
create index if not exists service_orders_status_idx on public.service_orders (status, service_date desc);

alter table public.clients enable row level security;
alter table public.service_orders enable row level security;

drop policy if exists clients_select on public.clients;  drop policy if exists clients_insert on public.clients;
drop policy if exists clients_update on public.clients;  drop policy if exists clients_delete on public.clients;
create policy clients_select on public.clients for select to authenticated using (public.my_role() is not null);
create policy clients_insert on public.clients for insert to authenticated with check (public.can_write_finance());
create policy clients_update on public.clients for update to authenticated using (public.can_write_finance()) with check (public.can_write_finance());
create policy clients_delete on public.clients for delete to authenticated using (public.can_manage());

drop policy if exists os_select on public.service_orders;  drop policy if exists os_insert on public.service_orders;
drop policy if exists os_update on public.service_orders;  drop policy if exists os_delete on public.service_orders;
create policy os_select on public.service_orders for select to authenticated using (public.my_role() is not null);
create policy os_insert on public.service_orders for insert to authenticated with check (public.can_write_finance());
create policy os_update on public.service_orders for update to authenticated using (public.can_write_finance()) with check (public.can_write_finance());
create policy os_delete on public.service_orders for delete to authenticated using (public.can_manage());

revoke all on public.clients, public.service_orders from anon;
grant select, insert, update, delete on public.clients, public.service_orders to authenticated;

-- Conclui a OS e cria a conta a receber, tudo na mesma transação. Roda com as permissões de quem chama (RLS vale).
create or replace function public.close_service_order(p_id uuid, p_account uuid, p_due date)
returns uuid language plpgsql as $$
declare o public.service_orders; cname text; tx uuid;
begin
  select * into o from public.service_orders where id = p_id for update;
  if o.id is null then raise exception 'OS não encontrada' using errcode = 'P0001'; end if;
  if o.status <> 'aberta' then raise exception 'Esta OS já foi concluída ou cancelada' using errcode = 'P0001'; end if;
  if o.total_amount <= 0 then raise exception 'Informe o valor por hectare antes de concluir a OS' using errcode = 'P0001'; end if;
  select name into cname from public.clients where id = o.client_id;
  insert into public.transactions (type, amount, account_id, category, description, status, date)
  values ('entrada', o.total_amount, p_account, 'Serviço de aplicação',
          'OS nº ' || o.number || ' — ' || cname || coalesce(' — ' || nullif(o.farm, ''), '') || ' — ' || o.area_ha || ' ha',
          'a_receber', p_due)
  returning id into tx;
  update public.service_orders set status = 'concluida', closed_at = now(), transaction_id = tx where id = p_id;
  return tx;
end $$;
revoke execute on function public.close_service_order(uuid, uuid, date) from public, anon;
grant execute on function public.close_service_order(uuid, uuid, date) to authenticated;
