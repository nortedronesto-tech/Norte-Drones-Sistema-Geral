-- Testes do checklist de pré-voo (0013). Rodar depois de operador.sql (usa os helpers t_*).
\set ON_ERROR_STOP on
reset role;
insert into service_orders (client_id, area_ha, price_per_ha) select id, 5, 100 from clients where name = 'Cliente do Operador';
set role authenticated;
select t_login('11111111-1111-1111-1111-111111111111', 'op@exemplo.com');
select t_assert('operador grava o checklist na OS aberta', t_rows($$update service_orders set preflight = '[{"id":"epi","ok":true},{"id":"bateria","ok":true}]' where status = 'aberta' and area_ha = 5$$) = 1);
select t_assert('checklist precisa ser lista', t_try($$update service_orders set preflight = '{"epi":true}' where status = 'aberta' and area_ha = 5$$) <> 'ok');
reset role;
select t_assert('checklist ficou guardado', (select jsonb_array_length(preflight) from service_orders where area_ha = 5 and preflight is not null limit 1) = 2);
