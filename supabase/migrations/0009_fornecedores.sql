-- =====================================================================
-- Norte Drones — fornecedores (de quem a Norte compra)
-- Cadastro simples + vínculo opcional em cada lançamento (transactions.supplier_id).
-- Todo nível com acesso lê; quem pode lançar (admin, sócio, financeiro) cadastra e edita;
-- apagar fica para admin e sócio (ao apagar, os lançamentos continuam, só perdem o vínculo).
-- Depende de 0001–0005.
-- =====================================================================
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 120),
  doc        text check (doc is null or length(doc) <= 30),      -- CNPJ ou CPF (opcional)
  phone      text check (phone is null or length(phone) <= 30),
  notes      text check (notes is null or length(notes) <= 500),
  active     boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists suppliers_name_uniq on public.suppliers (lower(trim(name)));

alter table public.suppliers enable row level security;
drop policy if exists suppliers_select on public.suppliers;
drop policy if exists suppliers_insert on public.suppliers;
drop policy if exists suppliers_update on public.suppliers;
drop policy if exists suppliers_delete on public.suppliers;
create policy suppliers_select on public.suppliers for select to authenticated using (public.my_role() is not null);
create policy suppliers_insert on public.suppliers for insert to authenticated with check (public.can_write_finance());
create policy suppliers_update on public.suppliers for update to authenticated
  using (public.can_write_finance()) with check (public.can_write_finance());
create policy suppliers_delete on public.suppliers for delete to authenticated using (public.can_manage());

revoke all on public.suppliers from anon;
grant select, insert, update, delete on public.suppliers to authenticated;

alter table public.transactions
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;
create index if not exists transactions_supplier_idx on public.transactions (supplier_id);
