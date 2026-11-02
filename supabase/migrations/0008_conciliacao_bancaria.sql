-- =====================================================================
-- Norte Drones — conciliação bancária
-- Marca cada lançamento PAGO como "conferido com o extrato do banco". Só guarda a data e
-- quem conferiu; não muda saldo, rateio nem reserva. Quem pode lançar (admin, sócio,
-- financeiro) concilia (as policies de update da 0005 já valem). Depende de 0001–0005.
-- =====================================================================
alter table public.transactions
  add column if not exists reconciled_at date,
  add column if not exists reconciled_by uuid;

create index if not exists transactions_reconciled_idx on public.transactions (account_id, reconciled_at);

-- só lançamento pago pode estar conciliado
alter table public.transactions drop constraint if exists tx_reconciled_only_paid;
alter table public.transactions add constraint tx_reconciled_only_paid
  check (reconciled_at is null or status = 'pago') not valid;
