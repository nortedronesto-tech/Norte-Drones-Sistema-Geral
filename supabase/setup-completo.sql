-- ============================================================================
-- Norte Drones — INSTALAÇÃO COMPLETA DO BANCO (cole tudo no Supabase SQL Editor)
-- Projeto: zwwalcvfgvnvgsnnxukr (nortedronesto-tech's Project). Rode UMA vez.
-- Ordem: 0001 financeiro · 0002 recibos · 0003 site/admin · 0004 segurança · seed
-- Se o seu login NÃO for richiteradm@gmail.com, troque o e-mail no bloco SEED, no fim.
-- ============================================================================

-- >>>>>>>>>> supabase/migrations/0001_fase1_financeiro.sql
-- =====================================================================
-- Norte Drones — Gestão · Fase 1 (Financeiro)
-- Tabelas: partners, bank_accounts, transactions, reserve_fund_entries
-- Auxiliares: transaction_splits (rateio por sócio), settings
-- =====================================================================

-- Data "de hoje" no fuso de Palmas/TO (UTC-3, sem horário de verão).
-- current_date no Supabase é UTC e viraria "amanhã" depois das 21h.
create or replace function public.today_br() returns date
language sql stable as $$ select (now() at time zone 'America/Araguaina')::date $$;

-- ---------------------------------------------------------------- settings
create table public.settings (
  key   text primary key,
  value text not null
);
insert into public.settings (key, value) values ('reserve_pct', '10');

create or replace function public.reserve_pct() returns numeric
language sql stable as $$
  select coalesce((select value::numeric from public.settings where key = 'reserve_pct'), 10)
$$;

-- ---------------------------------------------------------------- partners
create table public.partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,                         -- e-mail de login (Supabase Auth)
  share_pct  numeric(5,2) not null check (share_pct between 0 and 100),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index partners_email_key on public.partners (lower(email));

-- Atualiza os percentuais de todos os sócios de uma vez e exige soma = 100.
create or replace function public.set_partner_shares(p_ids uuid[], p_pcts numeric[])
returns void language plpgsql as $$
declare total numeric;
begin
  if array_length(p_ids, 1) is distinct from array_length(p_pcts, 1) then
    raise exception 'Listas de sócios e percentuais com tamanhos diferentes';
  end if;
  for i in 1..coalesce(array_length(p_ids, 1), 0) loop
    update public.partners set share_pct = p_pcts[i] where id = p_ids[i];
  end loop;
  select coalesce(sum(share_pct), 0) into total from public.partners where active;
  if abs(total - 100) > 0.001 then
    raise exception 'A soma dos percentuais dos sócios ativos deve ser 100 (atual: %)', total;
  end if;
end $$;

-- ----------------------------------------------------------- bank_accounts
create table public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null default 'mei' check (kind in ('mei', 'empresa', 'caixa')),
  partner_id      uuid references public.partners (id) on delete set null,
  initial_balance numeric(14,2) not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------ transactions
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('entrada', 'saida')),
  amount       numeric(14,2) not null check (amount > 0),
  account_id   uuid not null references public.bank_accounts (id),
  category     text not null,
  description  text,
  status       text not null check (status in ('pago', 'a_pagar', 'a_receber')),
  date         date not null default public.today_br(),   -- fato (pago) ou vencimento (pendente)
  paid_at      date,                                      -- preenchido pelo trigger quando status = pago
  receipt_path text,                                      -- caminho no bucket "receipts"
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint tx_status_matches_type check (
    (type = 'entrada' and status in ('pago', 'a_receber')) or
    (type = 'saida'   and status in ('pago', 'a_pagar'))
  ),
  constraint tx_paid_at_matches_status check ((status = 'pago') = (paid_at is not null))
);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_status_idx  on public.transactions (status);
create index transactions_date_idx    on public.transactions (date desc, created_at desc);

create or replace function public.trg_tx_set_paid_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'pago' then
    new.paid_at := coalesce(new.paid_at,
                            case when tg_op = 'INSERT' then new.date else public.today_br() end);
  else
    new.paid_at := null;
  end if;
  return new;
end $$;
create trigger tx_set_paid_at before insert or update on public.transactions
  for each row execute function public.trg_tx_set_paid_at();

-- ------------------------------------------------------ transaction_splits
-- Parte de cada sócio em cada entrada recebida (snapshot do % na data).
create table public.transaction_splits (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  partner_id     uuid not null references public.partners (id),
  pct            numeric(5,2) not null,
  amount         numeric(14,2) not null,
  created_at     timestamptz not null default now(),
  unique (transaction_id, partner_id)
);

-- -------------------------------------------------------- reserve_fund_entries
-- Extrato do fundo de reserva. amount é assinado: retenção (+), retirada (−).
create table public.reserve_fund_entries (
  id             uuid primary key default gen_random_uuid(),
  entry_date     date not null default public.today_br(),
  kind           text not null check (kind in ('retencao', 'retirada', 'ajuste')),
  amount         numeric(14,2) not null,
  partner_id     uuid references public.partners (id),   -- em nome de quem foi retido (null = fundo geral)
  transaction_id uuid references public.transactions (id) on delete cascade,
  description    text,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint reserve_kind_sign check (
    (kind = 'retencao' and amount > 0 and transaction_id is not null) or
    (kind = 'retirada' and amount < 0) or
    (kind = 'ajuste'   and amount <> 0)
  )
);
create index reserve_entries_date_idx on public.reserve_fund_entries (entry_date desc, created_at desc);

-- Impede retirada maior que o saldo do fundo.
create or replace function public.trg_reserve_no_overdraft() returns trigger
language plpgsql as $$
declare saldo numeric;
begin
  if new.amount < 0 then
    select coalesce(sum(amount), 0) into saldo from public.reserve_fund_entries;
    if saldo + new.amount < 0 then
      raise exception 'Saldo do fundo de reserva insuficiente (saldo: %, retirada: %)', saldo, -new.amount;
    end if;
  end if;
  return new;
end $$;
create trigger reserve_no_overdraft before insert on public.reserve_fund_entries
  for each row execute function public.trg_reserve_no_overdraft();

-- ------------------------------------------------------------------ rateio
-- Distribui p_total centavos entre pesos, pelo método do maior resto
-- (a soma bate exatamente; nenhum centavo se perde).
create or replace function public.allocate_cents(p_total bigint, p_weights numeric[])
returns bigint[] language plpgsql immutable as $$
declare
  n int := coalesce(array_length(p_weights, 1), 0);
  wsum numeric;
  res bigint[] := '{}';
  fr numeric[] := '{}';
  raw numeric; rem bigint; best int; i int;
begin
  select coalesce(sum(w), 0) into wsum from unnest(p_weights) w;
  if n = 0 or wsum = 0 then raise exception 'Pesos inválidos para rateio'; end if;
  for i in 1..n loop
    raw := p_total::numeric * p_weights[i] / wsum;
    res[i] := floor(raw);
    fr[i]  := raw - floor(raw);
  end loop;
  rem := p_total - (select sum(x) from unnest(res) x);
  while rem > 0 loop
    best := 1;
    for i in 2..n loop
      if fr[i] > fr[best] then best := i; end if;
    end loop;
    res[best] := res[best] + 1;
    fr[best] := -1;
    rem := rem - 1;
  end loop;
  return res;
end $$;

-- Regra: toda entrada PAGA (recebida) retém reserve_pct% (padrão 10% = 5% + 5%)
-- para o fundo de reserva e divide o restante entre os sócios ativos conforme
-- share_pct. A retenção é atribuída aos sócios na mesma proporção
-- (50/50 => 5% + 5%). Idempotente: recalcula do zero a cada chamada.
create or replace function public.apply_income_split(p_tx uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  tx public.transactions%rowtype;
  ids uuid[]; pcts numeric[];
  total_c bigint; reserve_c bigint; dist_c bigint;
  res_alloc bigint[]; dist_alloc bigint[];
  i int;
begin
  delete from public.transaction_splits where transaction_id = p_tx;
  delete from public.reserve_fund_entries where transaction_id = p_tx and kind = 'retencao';

  select * into tx from public.transactions where id = p_tx;
  if tx.id is null or tx.type <> 'entrada' or tx.status <> 'pago' then
    return;
  end if;

  select array_agg(id order by share_pct desc, created_at, id),
         array_agg(share_pct order by share_pct desc, created_at, id)
    into ids, pcts
    from public.partners where active;

  if ids is null or abs((select sum(x) from unnest(pcts) x) - 100) > 0.001 then
    raise exception 'Rateio impossível: os percentuais dos sócios ativos precisam somar 100';
  end if;

  total_c   := round(tx.amount * 100);
  reserve_c := round(total_c * public.reserve_pct() / 100);
  dist_c    := total_c - reserve_c;
  res_alloc  := public.allocate_cents(reserve_c, pcts);
  dist_alloc := public.allocate_cents(dist_c, pcts);

  for i in 1..array_length(ids, 1) loop
    if dist_alloc[i] > 0 then
      insert into public.transaction_splits (transaction_id, partner_id, pct, amount)
      values (tx.id, ids[i], pcts[i], dist_alloc[i] / 100.0);
    end if;
    if res_alloc[i] > 0 then
      insert into public.reserve_fund_entries
        (entry_date, kind, amount, partner_id, transaction_id, description)
      values (tx.paid_at, 'retencao', res_alloc[i] / 100.0, ids[i], tx.id,
              'Retenção ' || public.reserve_pct() || '% — ' || coalesce(nullif(tx.description, ''), tx.category));
    end if;
  end loop;
end $$;

create or replace function public.trg_tx_split() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT'
     or (old.amount, old.status, old.type) is distinct from (new.amount, new.status, new.type) then
    perform public.apply_income_split(new.id);
  end if;
  return null;
end $$;
create trigger tx_split after insert or update on public.transactions
  for each row execute function public.trg_tx_split();

-- ------------------------------------------------------------------- views
create view public.account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.partner_id, a.active, a.initial_balance,
       a.initial_balance + coalesce(sum(
         case when t.status = 'pago' then (case t.type when 'entrada' then t.amount else -t.amount end) end
       ), 0) as balance,
       coalesce(sum(case when t.status = 'a_receber' then t.amount end), 0) as to_receive,
       coalesce(sum(case when t.status = 'a_pagar'   then t.amount end), 0) as to_pay
from public.bank_accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

create view public.partner_totals with (security_invoker = true) as
select p.id, p.name, p.share_pct,
       coalesce((select sum(s.amount) from public.transaction_splits s where s.partner_id = p.id), 0) as split_total,
       coalesce((select sum(r.amount) from public.reserve_fund_entries r where r.partner_id = p.id), 0) as reserve_total
from public.partners p
where p.active;

-- --------------------------------------------------------------------- RLS
-- Acesso: somente quem está em partners (e-mail do login = e-mail do sócio ativo).
-- Desative o cadastro público em Authentication → Providers → Email → "Allow new users to sign up".
create or replace function public.is_partner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.partners p
    where p.active and p.email is not null
      and lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

alter table public.settings             enable row level security;
alter table public.partners             enable row level security;
alter table public.bank_accounts        enable row level security;
alter table public.transactions         enable row level security;
alter table public.transaction_splits   enable row level security;
alter table public.reserve_fund_entries enable row level security;

create policy settings_select on public.settings for select to authenticated using (public.is_partner());
create policy settings_update on public.settings for update to authenticated using (public.is_partner()) with check (public.is_partner());

create policy partners_select on public.partners for select to authenticated using (public.is_partner());
create policy partners_update on public.partners for update to authenticated using (public.is_partner()) with check (public.is_partner());

create policy accounts_all on public.bank_accounts for all to authenticated using (public.is_partner()) with check (public.is_partner());
create policy tx_all       on public.transactions   for all to authenticated using (public.is_partner()) with check (public.is_partner());

-- Rateio é gerado só pelo trigger: sócios apenas leem.
create policy splits_select on public.transaction_splits for select to authenticated using (public.is_partner());

-- Extrato da reserva: leitura; sócios só inserem retirada/ajuste manual; retenção vem do trigger.
create policy reserve_select on public.reserve_fund_entries for select to authenticated using (public.is_partner());
create policy reserve_insert on public.reserve_fund_entries for insert to authenticated
  with check (public.is_partner() and kind in ('retirada', 'ajuste'));
create policy reserve_delete on public.reserve_fund_entries for delete to authenticated
  using (public.is_partner() and kind in ('retirada', 'ajuste'));

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.account_balances, public.partner_totals to authenticated;
grant execute on function public.set_partner_shares(uuid[], numeric[]) to authenticated;

-- >>>>>>>>>> supabase/migrations/0002_storage_receipts.sql
-- Bucket privado para fotos de recibo / abastecimento.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_partner());
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_partner());
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_partner());

-- >>>>>>>>>> supabase/migrations/0003_site_publico_admin.sql
-- =====================================================================
-- Norte Drones — site público + painel /admin (projeto único)
-- Conteúdo editável do site (contatos e imagens) em `site_settings` e
-- imagens no bucket público `site-images`.
-- Depende de 0001 (função public.is_partner).
-- =====================================================================

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.site_settings enable row level security;

-- Leitura pública SOMENTE das chaves que alimentam o site (contatos e imagens).
-- Qualquer outra chave que um dia existir aqui continua privada.
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated
  using (key in ('contacts', 'images'));

-- Escrita só por sócios ativos.
create policy site_settings_partner_insert on public.site_settings
  for insert to authenticated with check (public.is_partner());
create policy site_settings_partner_update on public.site_settings
  for update to authenticated using (public.is_partner()) with check (public.is_partner());
create policy site_settings_partner_delete on public.site_settings
  for delete to authenticated using (public.is_partner());

grant select on public.site_settings to anon;
grant select, insert, update, delete on public.site_settings to authenticated;

-- Contatos iniciais (mesmos valores do site anterior; edite em /admin).
insert into public.site_settings (key, value) values (
  'contacts',
  '{"whatsappNumber":"","whatsappMessage":"Ola! Vim pelo site da Norte Drones e gostaria de solicitar um orcamento.","phone":"","email":"","instagramHandle":"","instagramUrl":"","address":"","areaServed":"Porto Nacional, Palmas e regiao (Tocantins)"}'::jsonb
) on conflict (key) do nothing;

-- Bucket público para as imagens do site (hero, "Sobre", logos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- Leitura é pública (bucket público); alterar só sócios.
create policy site_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and public.is_partner());
create policy site_images_update on storage.objects for update to authenticated
  using (bucket_id = 'site-images' and public.is_partner())
  with check (bucket_id = 'site-images' and public.is_partner());
create policy site_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-images' and public.is_partner());

-- >>>>>>>>>> supabase/migrations/0004_hardening_funcoes.sql
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

-- >>>>>>>>>> SEED (sócios e contas iniciais)
-- Dados iniciais. Ajuste e-mails e contas pela tela "Cadastros" depois.
-- O e-mail do Mateus fica em branco até você saber qual ele vai usar no login:
--   update public.partners set email = 'email-do-mateus@...' where name like 'Mateus%';
insert into public.partners (name, email, share_pct) values
  ('Helbert Richiter Gomes Osório', 'richiteradm@gmail.com', 50),
  ('Mateus Neres da Silva',          null,                    50);

insert into public.bank_accounts (name, kind, partner_id)
select 'Conta MEI — Helbert', 'mei', id from public.partners where name like 'Helbert%'
union all
select 'Conta MEI — Mateus', 'mei', id from public.partners where name like 'Mateus%'
union all
select 'Caixa (dinheiro)', 'caixa', null;
