-- =====================================================================
-- Norte Drones — níveis de acesso e cadastro de usuários
--   admin       : tudo, inclusive cadastrar usuários e níveis (/admin → Usuários)
--   socio       : gestão completa + admin do site (sem cadastrar usuários)
--   financeiro  : lança e consulta o financeiro (sem cadastros, sem admin do site)
--   consulta    : só leitura do financeiro
-- Quem não está em user_access (e não é sócio ativo em partners) não acessa nada.
-- Depende de 0001–0004.
--
-- ATENÇÃO (instalação nova): o 1º administrador é criado no fim deste script a partir do
-- login nortedronesto@gmail.com. Crie esse login ANTES (Authentication → Users). Se criar
-- depois, rode só o 1º INSERT do fim do arquivo (o que usa role 'admin').
-- =====================================================================

create table if not exists public.user_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null default '',
  role       text not null check (role in ('admin', 'socio', 'financeiro', 'consulta')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create unique index if not exists user_access_email_key on public.user_access (lower(email));

alter table public.user_access enable row level security;
-- Cada usuário lê só a própria linha. Cadastro/edição é feito apenas pelo servidor
-- do /admin (chave de serviço), nunca direto do navegador.
create policy user_access_self_select on public.user_access
  for select to authenticated using (user_id = auth.uid());
grant select on public.user_access to authenticated;

-- Nível do usuário logado. Ex-sócios já cadastrados em partners continuam
-- entrando como 'socio' enquanto não tiverem uma linha própria em user_access.
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select ua.role from public.user_access ua where ua.user_id = auth.uid() and ua.active),
    (select 'socio'::text from public.partners p
      where p.active and p.email is not null
        and lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and not exists (select 1 from public.user_access u2 where u2.user_id = auth.uid()))
  )
$$;

create or replace function public.can_read_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'socio', 'financeiro', 'consulta'), false)
$$;
create or replace function public.can_write_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'socio', 'financeiro'), false)
$$;
create or replace function public.can_manage() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'socio'), false)
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;
-- Compatibilidade: "ser sócio" passa a significar "pode administrar".
create or replace function public.is_partner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage()
$$;

revoke execute on function public.my_role(), public.can_read_finance(), public.can_write_finance(),
  public.can_manage(), public.is_admin(), public.is_partner() from public, anon;
grant execute on function public.my_role(), public.can_read_finance(), public.can_write_finance(),
  public.can_manage(), public.is_admin(), public.is_partner() to authenticated;

-- ------------------------------------------------------------------ policies
drop policy if exists settings_select on public.settings;
drop policy if exists settings_update on public.settings;
create policy settings_select on public.settings for select to authenticated using (public.can_read_finance());
create policy settings_update on public.settings for update to authenticated
  using (public.can_manage()) with check (public.can_manage());

drop policy if exists partners_select on public.partners;
drop policy if exists partners_update on public.partners;
create policy partners_select on public.partners for select to authenticated using (public.can_read_finance());
create policy partners_update on public.partners for update to authenticated
  using (public.can_manage()) with check (public.can_manage());

drop policy if exists accounts_all on public.bank_accounts;
create policy accounts_select on public.bank_accounts for select to authenticated using (public.can_read_finance());
create policy accounts_insert on public.bank_accounts for insert to authenticated with check (public.can_manage());
create policy accounts_update on public.bank_accounts for update to authenticated
  using (public.can_manage()) with check (public.can_manage());
create policy accounts_delete on public.bank_accounts for delete to authenticated using (public.can_manage());

drop policy if exists tx_all on public.transactions;
create policy tx_select on public.transactions for select to authenticated using (public.can_read_finance());
create policy tx_insert on public.transactions for insert to authenticated with check (public.can_write_finance());
create policy tx_update on public.transactions for update to authenticated
  using (public.can_write_finance()) with check (public.can_write_finance());
create policy tx_delete on public.transactions for delete to authenticated using (public.can_write_finance());

drop policy if exists splits_select on public.transaction_splits;
create policy splits_select on public.transaction_splits for select to authenticated using (public.can_read_finance());

drop policy if exists reserve_select on public.reserve_fund_entries;
drop policy if exists reserve_insert on public.reserve_fund_entries;
drop policy if exists reserve_delete on public.reserve_fund_entries;
create policy reserve_select on public.reserve_fund_entries for select to authenticated using (public.can_read_finance());
create policy reserve_insert on public.reserve_fund_entries for insert to authenticated
  with check (public.can_write_finance() and kind in ('retirada', 'ajuste'));
create policy reserve_delete on public.reserve_fund_entries for delete to authenticated
  using (public.can_write_finance() and kind in ('retirada', 'ajuste'));

-- recibos (storage)
drop policy if exists receipts_select on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_delete on storage.objects;
create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.can_read_finance());
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_write_finance());
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.can_write_finance());

-- conteúdo do site e imagens (admin do site: admin e sócio)
drop policy if exists site_settings_partner_insert on public.site_settings;
drop policy if exists site_settings_partner_update on public.site_settings;
drop policy if exists site_settings_partner_delete on public.site_settings;
create policy site_settings_partner_insert on public.site_settings for insert to authenticated with check (public.can_manage());
create policy site_settings_partner_update on public.site_settings for update to authenticated
  using (public.can_manage()) with check (public.can_manage());
create policy site_settings_partner_delete on public.site_settings for delete to authenticated using (public.can_manage());

drop policy if exists site_images_insert on storage.objects;
drop policy if exists site_images_update on storage.objects;
drop policy if exists site_images_delete on storage.objects;
create policy site_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and public.can_manage());
create policy site_images_update on storage.objects for update to authenticated
  using (bucket_id = 'site-images' and public.can_manage())
  with check (bucket_id = 'site-images' and public.can_manage());
create policy site_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-images' and public.can_manage());

-- ---------------------------------------------------------- primeiro administrador
-- Quem já tem login e e-mail de sócio entra como 'socio'; o dono entra como 'admin'.
insert into public.user_access (user_id, email, name, role)
select u.id, u.email, coalesce(p.name, ''), 'admin'
from auth.users u
left join public.partners p on lower(p.email) = lower(u.email)
where lower(u.email) = 'nortedronesto@gmail.com'
on conflict (user_id) do nothing;

insert into public.user_access (user_id, email, name, role)
select u.id, u.email, p.name, 'socio'
from auth.users u
join public.partners p on lower(p.email) = lower(u.email) and p.active
on conflict (user_id) do nothing;
