-- =====================================================================
-- Norte Drones — Guia de campo: receitas de calda salvas
-- Guarda só os dados informados (nomes e doses digitados por quem usa); o app não
-- inventa dose nenhuma. Todo nível com acesso lê; quem pode lançar (admin, sócio,
-- financeiro) cria e edita; apagar fica para admin e sócio. Depende de 0001–0005.
-- =====================================================================
create table if not exists public.spray_recipes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 120),
  crop       text,
  target     text,
  rate_l_ha  numeric(8,2) not null check (rate_l_ha > 0),
  tank_l     numeric(8,2) not null check (tank_l > 0),
  products   jsonb not null default '[]'::jsonb check (jsonb_typeof(products) = 'array'),
  notes      text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spray_recipes enable row level security;

drop policy if exists recipes_select on public.spray_recipes;
drop policy if exists recipes_insert on public.spray_recipes;
drop policy if exists recipes_update on public.spray_recipes;
drop policy if exists recipes_delete on public.spray_recipes;
create policy recipes_select on public.spray_recipes for select to authenticated using (public.my_role() is not null);
create policy recipes_insert on public.spray_recipes for insert to authenticated with check (public.can_write_finance());
create policy recipes_update on public.spray_recipes for update to authenticated
  using (public.can_write_finance()) with check (public.can_write_finance());
create policy recipes_delete on public.spray_recipes for delete to authenticated using (public.can_manage());

revoke all on public.spray_recipes from anon;
grant select, insert, update, delete on public.spray_recipes to authenticated;
