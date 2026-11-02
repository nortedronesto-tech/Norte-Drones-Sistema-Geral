-- Testes de clientes e OS (0010). Rodar depois de suppliers.sql (usa os helpers t_*).
\set ON_ERROR_STOP on
set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro cadastra cliente com valor por ha', t_try($$insert into clients (name, price_per_ha) values ('Fazenda Boa Vista', 95)$$) = 'ok');
select t_assert('cliente duplicado é recusado', t_try($$insert into clients (name) values (' fazenda boa vista ')$$) <> 'ok');
select t_assert('financeiro cria OS', t_try($$insert into service_orders (client_id, farm, area_ha, price_per_ha, products) select id, 'Talhão 3', 40, 95, '[{"name":"Produto A","dose":0.5,"unit":"L/ha","form":"emulsao"}]' from clients limit 1$$) = 'ok');
select t_assert('total = área × valor por ha', (select total_amount from service_orders limit 1) = 3800);
select t_assert('OS com área zero é recusada', t_try($$insert into service_orders (client_id, area_ha) select id, 0 from clients limit 1$$) <> 'ok');
select t_assert('concluir OS gera conta a receber', t_try($$select close_service_order((select id from service_orders limit 1), (select id from bank_accounts limit 1), current_date + 15)$$) = 'ok');
select t_assert('lançamento criado: entrada a receber de 3800', t_cnt($$select 1 from transactions where type = 'entrada' and status = 'a_receber' and amount = 3800 and description like 'OS nº%Fazenda Boa Vista%'$$) = 1);
select t_assert('OS ficou concluída e ligada ao lançamento', t_cnt($$select 1 from service_orders where status = 'concluida' and transaction_id is not null$$) = 1);
select t_assert('não conclui duas vezes', t_try($$select close_service_order((select id from service_orders limit 1), (select id from bank_accounts limit 1), current_date)$$) <> 'ok');
select t_assert('OS sem valor não conclui', t_try($$with n as (insert into service_orders (client_id, area_ha, price_per_ha) select id, 10, 0 from clients limit 1 returning id) select close_service_order((select id from n), (select id from bank_accounts limit 1), current_date)$$) <> 'ok');
select t_assert('financeiro NÃO apaga OS (0 linhas)', t_rows($$delete from service_orders$$) = 0);
reset role;

set role authenticated;
select t_login('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com');
select t_assert('consulta lê clientes e OS', t_cnt('select 1 from clients') = 1 and t_cnt('select 1 from service_orders') >= 1);
select t_assert('consulta NÃO cria OS', t_try($$insert into service_orders (client_id, area_ha) select id, 5 from clients limit 1$$) <> 'ok');
select t_assert('consulta NÃO conclui OS', t_try($$select close_service_order((select id from service_orders where status = 'aberta' limit 1), (select id from bank_accounts limit 1), current_date)$$) <> 'ok');
reset role;

set role anon;
select t_assert('anônimo não lê clientes', t_cnt('select 1 from clients') = 0);
reset role;

set role authenticated;
select t_login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'richiteradm@gmail.com');
select t_assert('sócio apaga OS', t_rows($$delete from service_orders$$) >= 1);
reset role;
