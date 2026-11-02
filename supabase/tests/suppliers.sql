-- Testes de fornecedores (0009). Rodar depois de reconcile.sql (usa os helpers t_*).
\set ON_ERROR_STOP on
set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro cadastra fornecedor', t_try($$insert into suppliers (name, doc) values ('Posto Ipiranga', '12.345.678/0001-90')$$) = 'ok');
select t_assert('nome duplicado (maiúscula/minúscula) é recusado', t_try($$insert into suppliers (name) values (' posto ipiranga ')$$) <> 'ok');
select t_assert('financeiro lança saída com fornecedor', t_try($$insert into transactions (type, amount, account_id, category, status, supplier_id) select 'saida', 80, a.id, 'Combustível', 'pago', s.id from bank_accounts a, suppliers s limit 1$$) = 'ok');
select t_assert('financeiro NÃO apaga fornecedor (0 linhas)', t_rows($$delete from suppliers$$) = 0);
reset role;

set role authenticated;
select t_login('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com');
select t_assert('consulta lê fornecedores', t_cnt('select 1 from suppliers') = 1);
select t_assert('consulta NÃO cadastra fornecedor', t_try($$insert into suppliers (name) values ('Indevido')$$) <> 'ok');
select t_assert('consulta NÃO edita (0 linhas)', t_rows($$update suppliers set name = 'x'$$) = 0);
reset role;

set role anon;
select t_assert('anônimo não lê fornecedores', t_cnt('select 1 from suppliers') = 0);
reset role;

set role authenticated;
select t_login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'richiteradm@gmail.com');
select t_assert('sócio apaga fornecedor', t_rows($$delete from suppliers$$) = 1);
select t_assert('lançamento continua, sem vínculo', t_cnt('select 1 from transactions where supplier_id is not null') = 0);
reset role;
