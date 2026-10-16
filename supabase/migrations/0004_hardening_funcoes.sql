-- search_path fixo nas funções (evita sequestro via search_path)
alter function public.trg_tx_split() security definer set search_path = public;
alter function public.set_partner_shares(uuid[], numeric[]) set search_path = public;
alter function public.trg_reserve_no_overdraft() set search_path = public;
alter function public.allocate_cents(bigint, numeric[]) set search_path = public;
alter function public.trg_tx_set_paid_at() set search_path = public;
alter function public.today_br() set search_path = public;
alter function public.reserve_pct() set search_path = public;

-- O rateio só roda pelo trigger: ninguém chama pela API (/rest/v1/rpc).
revoke execute on function public.apply_income_split(uuid) from public, anon, authenticated;
revoke execute on function public.trg_tx_split() from public, anon, authenticated;

-- is_partner() só para quem está logado (a RLS das tabelas internas usa).
revoke execute on function public.is_partner() from public, anon;
grant execute on function public.is_partner() to authenticated;
