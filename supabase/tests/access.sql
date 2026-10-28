-- Testes dos níveis de acesso (0005). Rodar depois de 0001–0005 + seed + fixtures_users.sql.
\set ON_ERROR_STOP on
create function public.t_try(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return 'erro:' || sqlstate; end $$;
create function public.t_cnt(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || q || ') t' into n; return n;
exception when insufficient_privilege then return 0; end $$;
create function public.t_rows(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute q; get diagnostics n = row_count; return n; end $$;
create function public.t_login(sub uuid, mail text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', sub, 'email', mail)::text, false); end $$;
create function public.t_assert(n text, c boolean) returns void language plpgsql as $$
begin if c is not true then raise exception 'FALHOU: %', n; end if; raise notice 'ok: %', n; end $$;

-- usuários extras (como o /admin faria, com chave de serviço = superusuário)
insert into public.user_access (user_id, email, name, role) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com', 'Financeiro', 'financeiro'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com', 'Consulta', 'consulta');
insert into public.user_access (user_id, email, name, role, active) values
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'desligado@exemplo.com', 'Desligado', 'admin', false);

-- dado para ler: um lançamento criado pelo admin
set role authenticated;
select t_login('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nortedronesto@gmail.com');
select t_assert('admin: my_role = admin', public.my_role() = 'admin');
select t_assert('admin: is_admin', public.is_admin());
select t_assert('admin cria lançamento', t_try($$insert into transactions (type, amount, account_id, category, status) select 'entrada', 100, id, 'Teste', 'pago' from bank_accounts limit 1$$) = 'ok');
select t_assert('admin cria conta', t_try($$insert into bank_accounts (name, kind) values ('Conta nova', 'caixa')$$) = 'ok');
select t_assert('admin grava site_settings', t_try($$insert into site_settings (key, value) values ('images', '{}') on conflict (key) do update set value = excluded.value$$) = 'ok');
select t_assert('admin NÃO escreve direto em user_access', t_try($$insert into user_access (user_id, email, role) values (gen_random_uuid(), 'x@x.com', 'admin')$$) <> 'ok');
reset role;

set role authenticated;
select t_login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'richiteradm@gmail.com');
select t_assert('sócio (via bootstrap): my_role = socio', public.my_role() = 'socio');
select t_assert('sócio não é admin', not public.is_admin());
select t_assert('sócio lê lançamentos', t_cnt('select 1 from transactions') >= 1);
select t_assert('sócio cria conta', t_try($$insert into bank_accounts (name, kind) values ('Conta do sócio', 'caixa')$$) = 'ok');
select t_assert('sócio grava site_settings', t_try($$update site_settings set value = '{"a":1}' where key = 'images'$$) = 'ok');
reset role;

set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro: my_role', public.my_role() = 'financeiro');
select t_assert('financeiro lê lançamentos', t_cnt('select 1 from transactions') >= 1);
select t_assert('financeiro lança entrada', t_try($$insert into transactions (type, amount, account_id, category, status) select 'entrada', 50, id, 'Teste', 'pago' from bank_accounts limit 1$$) = 'ok');
select t_assert('financeiro NÃO cria conta', t_try($$insert into bank_accounts (name, kind) values ('Indevida', 'caixa')$$) <> 'ok');
select t_assert('financeiro NÃO muda sócios (0 linhas)', t_rows($$update partners set share_pct = 1$$) = 0);
select t_assert('financeiro NÃO grava site_settings', t_try($$insert into site_settings (key, value) values ('contacts', '{"x":1}') on conflict (key) do update set value = excluded.value$$) <> 'ok');
select t_assert('financeiro NÃO muda a reserva_pct (0 linhas)', t_rows($$update settings set value = '99'$$) = 0);
reset role;

set role authenticated;
select t_login('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com');
select t_assert('consulta: my_role', public.my_role() = 'consulta');
select t_assert('consulta lê lançamentos', t_cnt('select 1 from transactions') >= 1);
select t_assert('consulta lê reserva', t_cnt('select 1 from reserve_fund_entries') >= 1);
select t_assert('consulta NÃO lança', t_try($$insert into transactions (type, amount, account_id, category, status) select 'saida', 1, id, 'x', 'pago' from bank_accounts limit 1$$) <> 'ok');
select t_assert('consulta NÃO apaga lançamento (0 linhas)', t_rows($$delete from transactions$$) = 0);
select t_assert('consulta NÃO mexe na reserva', t_try($$insert into reserve_fund_entries (kind, amount, description) values ('ajuste', 10, 'x')$$) <> 'ok');
reset role;

set role authenticated;
select t_login('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ninguem@exemplo.com');
select t_assert('sem cadastro: my_role nulo', public.my_role() is null);
select t_assert('sem cadastro não lê lançamentos', t_cnt('select 1 from transactions') = 0);
select t_assert('sem cadastro não lê sócios', t_cnt('select 1 from partners') = 0);
select t_assert('sem cadastro não lê contas', t_cnt('select 1 from bank_accounts') = 0);
reset role;

set role authenticated;
select t_login('ffffffff-ffff-ffff-ffff-ffffffffffff', 'desligado@exemplo.com');
select t_assert('desativado: my_role nulo', public.my_role() is null);
select t_assert('desativado não lê lançamentos', t_cnt('select 1 from transactions') = 0);
reset role;

set role anon;
select t_assert('visitante lê contatos do site', t_cnt($$select 1 from site_settings where key = 'contacts'$$) >= 1);
select t_assert('visitante NÃO lê outras chaves', t_cnt($$select 1 from site_settings where key not in ('contacts','images')$$) = 0);
select t_assert('visitante NÃO chama my_role', t_try('select public.my_role()') <> 'ok');
select t_assert('visitante NÃO lê lançamentos', t_cnt('select 1 from transactions') = 0);
reset role;
\echo 'TODOS OS TESTES DE ACESSO PASSARAM'
