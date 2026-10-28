-- =====================================================================
-- Norte Drones — cofre de segredos (chaves de integração cadastradas no /admin)
-- As chaves (OpenAI, Resend) ficam CRIPTOGRAFADAS no Supabase Vault. Nunca são
-- lidas pelo navegador: só o servidor do app, com a chave de serviço, chama
-- estas funções. Depende de 0001–0005.
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'supabase_vault') then
    create extension if not exists supabase_vault;
  end if;
end $$;

-- Só metadados (nome, final da chave, quando mudou): o valor mesmo fica no Vault.
create table if not exists public.app_secret_meta (
  name       text primary key,
  hint       text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.app_secret_meta enable row level security;      -- sem policies: ninguém lê pelo navegador
revoke all on public.app_secret_meta from anon, authenticated;

create or replace function public.set_app_secret(p_name text, p_value text, p_hint text, p_user uuid)
returns void language plpgsql security definer set search_path = public, vault as $$
declare existing uuid;
begin
  select id into existing from vault.secrets where name = p_name;
  if existing is null then
    perform vault.create_secret(p_value, p_name, 'Norte Drones — chave de integração');
  else
    perform vault.update_secret(existing, p_value, p_name);
  end if;
  insert into public.app_secret_meta (name, hint, updated_at, updated_by)
  values (p_name, p_hint, now(), p_user)
  on conflict (name) do update set hint = excluded.hint, updated_at = now(), updated_by = excluded.updated_by;
end $$;

create or replace function public.get_app_secret(p_name text)
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name
$$;

create or replace function public.delete_app_secret(p_name text)
returns void language plpgsql security definer set search_path = public, vault as $$
begin
  delete from vault.secrets where name = p_name;
  delete from public.app_secret_meta where name = p_name;
end $$;

-- Só a chave de serviço (servidor do app) executa. Ninguém pela API pública.
revoke execute on function public.set_app_secret(text, text, text, uuid),
  public.get_app_secret(text), public.delete_app_secret(text) from public, anon, authenticated;
grant execute on function public.set_app_secret(text, text, text, uuid),
  public.get_app_secret(text), public.delete_app_secret(text) to service_role;
grant select on public.app_secret_meta to service_role;
