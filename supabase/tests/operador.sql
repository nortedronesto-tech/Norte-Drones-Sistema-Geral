-- Testes do nível Operador (0012). Rodar depois de os_ok.sql (usa os helpers t_*).
\set ON_ERROR_STOP on
reset role;
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'op@exemplo.com');
insert into user_access (user_id, email, name, role) values ('11111111-1111-1111-1111-111111111111', 'op@exemplo.com', 'Operador', 'operador');
insert into clients (name, price_per_ha) values ('Cliente do Operador', 100) on conflict do nothing;
insert into service_orders (client_id, area_ha, price_per_ha, farm) select id, 20, 100, 'Talhão X' from clients where name = 'Cliente do Operador';

select set_config('t.acc', (select id::text from bank_accounts limit 1), false);
set role authenticated;
select t_login('11111111-1111-1111-1111-111111111111', 'op@exemplo.com');
select t_assert('operador: my_role', public.my_role() = 'operador');
select t_assert('operador lê clientes e OS', t_cnt('select 1 from clients') >= 1 and t_cnt('select 1 from service_orders') >= 1);
select t_assert('operador cria OS', t_try($$insert into service_orders (client_id, area_ha, price_per_ha) select id, 15, 100 from clients where name = 'Cliente do Operador'$$) = 'ok');
select t_assert('operador cadastra cliente novo', t_try($$insert into clients (name) values ('Cliente criado no campo')$$) = 'ok');
select t_assert('operador edita dados da OS aberta', t_rows($$update service_orders set farm = 'Talhão Y', wind_kmh = 5 where status = 'aberta' and farm = 'Talhão X'$$) = 1);
select t_assert('operador NÃO muda o valor por ha', t_try($$update service_orders set price_per_ha = 1 where status = 'aberta'$$) <> 'ok');
select t_assert('operador NÃO conclui por update', t_try($$update service_orders set status = 'concluida' where status = 'aberta'$$) <> 'ok');
select t_assert('operador NÃO conclui/cobra pela função', t_try($$select close_service_order((select id from service_orders where status = 'aberta' limit 1), (select id from bank_accounts limit 1), current_date)$$) <> 'ok');
select t_assert('operador NÃO edita cliente (0 linhas)', t_rows($$update clients set price_per_ha = 1$$) = 0);
select t_assert('operador NÃO apaga OS (0 linhas)', t_rows($$delete from service_orders$$) = 0);
select t_assert('operador NÃO vê lançamentos', t_cnt('select 1 from transactions') = 0);
select t_assert('operador NÃO vê contas/saldos', t_cnt('select 1 from account_balances') = 0);
select t_assert('operador NÃO vê reserva nem rateio', t_cnt('select 1 from reserve_fund_entries') = 0 and t_cnt('select 1 from transaction_splits') = 0);
select t_assert('operador NÃO lança nada', t_try($$insert into transactions (type, amount, account_id, category, status) values ('saida', 1, current_setting('t.acc')::uuid, 'Teste', 'pago')$$) <> 'ok');
select t_assert('operador salva receita de calda', t_try($$insert into spray_recipes (name, rate_l_ha, tank_l) values ('Do operador', 10, 40)$$) = 'ok');
reset role;

-- financeiro continua concluindo normalmente
set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro ainda conclui OS', t_try($$select close_service_order((select id from service_orders where status = 'aberta' limit 1), (select id from bank_accounts limit 1), current_date + 10)$$) = 'ok');
reset role;
