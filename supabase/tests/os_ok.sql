-- Testes do OK do cliente (0011). Rodar depois de os.sql (usa os helpers t_*).
\set ON_ERROR_STOP on
reset role;
insert into service_orders (client_id, area_ha, price_per_ha) select id, 10, 100 from clients limit 1;
set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro registra o OK do cliente', t_rows($$update service_orders set client_ok_at = current_date, client_ok_note = 'respondeu OK às 14h'$$) >= 1);
select t_assert('financeiro desfaz o registro', t_rows($$update service_orders set client_ok_at = null, client_ok_note = null$$) >= 1);
reset role;

set role authenticated;
select t_login('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com');
select t_assert('consulta NÃO registra OK (0 linhas)', t_rows($$update service_orders set client_ok_at = current_date$$) = 0);
reset role;
