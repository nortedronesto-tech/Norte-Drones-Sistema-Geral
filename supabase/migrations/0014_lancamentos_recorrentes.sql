-- =====================================================================
-- Norte Drones — lançamentos recorrentes (aluguel, seguro, DAS do MEI, mensalidades...)
-- Uma regra mensal gera, sozinha, o lançamento pendente (a pagar / a receber) alguns dias antes do vencimento.
-- A geração é idempotente: o mesmo mês nunca é criado duas vezes (índice único).
-- Todo nível que lê o financeiro vê; admin, sócio e financeiro criam/editam; apagar: admin e sócio.
-- Depende de 0001–0005 e 0009.
-- =====================================================================
create table if not exists public.recurring_transactions (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('entrada', 'saida')),
  amount       numeric(14,2) not null check (amount > 0),
  account_id   uuid not null references public.bank_accounts (id),
  category     text not null,
  description  text check (description is null or length(description) <= 300),
  supplier_id  uuid references public.suppliers (id) on delete set null,
  day_of_month int not null check (day_of_month between 1 and 31),
  next_due     date not null,
  end_date     date,
  active       boolean not null default true,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

alter table public.transactions
  add column if not exists recurring_id uuid references public.recurring_transactions (id) on delete set null,
  add column if not exists recurring_due date;
create unique index if not exists transactions_recurring_once on public.transactions (recurring_id, recurring_due) where recurring_id is not null;

alter table public.recurring_transactions enable row level security;
drop policy if exists recurring_select on public.recurring_transactions;
drop policy if exists recurring_insert on public.recurring_transactions;
drop policy if exists recurring_update on public.recurring_transactions;
drop policy if exists recurring_delete on public.recurring_transactions;
create policy recurring_select on public.recurring_transactions for select to authenticated using (public.can_read_finance());
create policy recurring_insert on public.recurring_transactions for insert to authenticated with check (public.can_write_finance());
create policy recurring_update on public.recurring_transactions for update to authenticated using (public.can_write_finance()) with check (public.can_write_finance());
create policy recurring_delete on public.recurring_transactions for delete to authenticated using (public.can_manage());

revoke all on public.recurring_transactions from anon;
grant select, insert, update, delete on public.recurring_transactions to authenticated;
