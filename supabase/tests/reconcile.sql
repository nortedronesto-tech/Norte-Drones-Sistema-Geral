-- Testes da conciliação (0008). Rodar depois de recipes.sql (usa os helpers t_*).
\set ON_ERROR_STOP on
set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro concilia lançamento pago', t_rows($$update transactions set reconciled_at = current_date where status = 'pago' and reconciled_at is null and id = (select id from transactions where status = 'pago' limit 1)$$) = 1);
select t_assert('não concilia pendente', t_try($$insert into transactions (type, amount, account_id, category, status, reconciled_at) select 'saida', 5, id, 'Teste', 'a_pagar', current_date from bank_accounts limit 1$$) <> 'ok');
select t_assert('financeiro desfaz conciliação', t_rows($$update transactions set reconciled_at = null where reconciled_at is not null$$) >= 1);
reset role;

set role authenticated;
select t_login('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com');
select t_assert('consulta NÃO concilia (0 linhas)', t_rows($$update transactions set reconciled_at = current_date where status = 'pago'$$) = 0);
reset role;

