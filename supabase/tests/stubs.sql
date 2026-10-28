-- Simula o mínimo do Supabase (roles, auth.uid/jwt, storage) para testar as migrations em um Postgres comum.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create table auth.users (id uuid primary key, email text);
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema auth, storage, public to authenticated;
grant select, insert on storage.objects to authenticated;

-- Vault simulado (o real vem do Supabase): suficiente para testar o cofre de segredos.
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text, secret text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '') returns uuid language sql as $$
  insert into vault.secrets (name, description, secret) values (new_name, new_description, new_secret) returning id $$;
create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null) returns void language sql as $$
  update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name) where id = secret_id $$;
grant usage on schema public to service_role;
