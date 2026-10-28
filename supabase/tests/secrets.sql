-- Testes do cofre de segredos (0006): só a chave de serviço grava/lê; o navegador nunca.
\set ON_ERROR_STOP on
create or replace function public.t_try2(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return 'erro:' || sqlstate; end $$;
create or replace function public.t_assert2(n text, c boolean) returns void language plpgsql as $$
begin if c is not true then raise exception 'FALHOU: %', n; end if; raise notice 'ok: %', n; end $$;

set role service_role;
select t_assert2('serviço grava a chave', t_try2($$select public.set_app_secret('OPENAI_API_KEY', 'sk-teste-123456789012345678901234', '…1234', null)$$) = 'ok');
select t_assert2('serviço lê a chave de volta', public.get_app_secret('OPENAI_API_KEY') = 'sk-teste-123456789012345678901234');
select t_assert2('serviço troca a chave (update)', t_try2($$select public.set_app_secret('OPENAI_API_KEY', 'sk-nova-abcdefghijklmnopqrstuvwxyz', '…wxyz', null)$$) = 'ok');
select t_assert2('chave nova vale', public.get_app_secret('OPENAI_API_KEY') = 'sk-nova-abcdefghijklmnopqrstuvwxyz');
reset role;
select t_assert2('metadado guarda só o final', (select hint from public.app_secret_meta where name = 'OPENAI_API_KEY') = '…wxyz');
select t_assert2('só 1 linha no cofre (conferido pelo dono do banco)', (select count(*) from vault.secrets where name = 'OPENAI_API_KEY') = 1);

set role authenticated;
select t_login('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nortedronesto@gmail.com');
select t_assert2('ADMIN logado NÃO lê o segredo pelo navegador', t_try2($$select public.get_app_secret('OPENAI_API_KEY')$$) <> 'ok');
select t_assert2('ADMIN logado NÃO grava segredo pelo navegador', t_try2($$select public.set_app_secret('X', 'y', 'z', null)$$) <> 'ok');
select t_assert2('ADMIN logado NÃO lê a tabela de metadados', t_try2('select * from public.app_secret_meta') <> 'ok');
reset role;

set role anon;
select t_assert2('visitante NÃO lê segredo', t_try2($$select public.get_app_secret('OPENAI_API_KEY')$$) <> 'ok');
select t_assert2('visitante NÃO lê metadados', t_try2('select * from public.app_secret_meta') <> 'ok');
reset role;

set role service_role;
select t_assert2('serviço apaga a chave', t_try2($$select public.delete_app_secret('OPENAI_API_KEY')$$) = 'ok');
select t_assert2('depois de apagar, não existe', public.get_app_secret('OPENAI_API_KEY') is null);
reset role;
\echo 'TESTES DO COFRE PASSARAM'
