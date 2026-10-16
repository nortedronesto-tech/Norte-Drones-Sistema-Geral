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
