-- Testes das receitas de calda (0007). Rodar depois de access.sql (usa os mesmos usuários e helpers t_*).
\set ON_ERROR_STOP on
set role authenticated;
select t_login('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nortedronesto@gmail.com');
select t_assert('admin salva receita', t_try($$insert into spray_recipes (name, rate_l_ha, tank_l, products) values ('Exemplo', 10, 40, '[{"name":"Produto A","dose":0.5,"unit":"L/ha","form":"emulsao"}]')$$) = 'ok');
select t_assert('receita sem volume é recusada', t_try($$insert into spray_recipes (name, rate_l_ha, tank_l) values ('Ruim', 0, 40)$$) <> 'ok');
select t_assert('produtos precisa ser lista', t_try($$insert into spray_recipes (name, rate_l_ha, tank_l, products) values ('Ruim', 10, 40, '{}')$$) <> 'ok');
reset role;

set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro lê receitas', t_cnt('select 1 from spray_recipes') = 1);
select t_assert('financeiro salva receita', t_try($$insert into spray_recipes (name, rate_l_ha, tank_l) values ('Do financeiro', 12, 30)$$) = 'ok');
select t_assert('financeiro NÃO apaga (0 linhas)', t_rows($$delete from spray_recipes$$) = 0);
reset role;

set role authenticated;
select t_login('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com');
select t_assert('consulta lê receitas', t_cnt('select 1 from spray_recipes') = 2);
select t_assert('consulta NÃO salva receita', t_try($$insert into spray_recipes (name, rate_l_ha, tank_l) values ('Indevida', 10, 40)$$) <> 'ok');
select t_assert('consulta NÃO edita (0 linhas)', t_rows($$update spray_recipes set name = 'x'$$) = 0);
reset role;

set role authenticated;
select t_login('ffffffff-ffff-ffff-ffff-ffffffffffff', 'desligado@exemplo.com');
select t_assert('usuário desligado não lê receitas', t_cnt('select 1 from spray_recipes') = 0);
reset role;

set role anon;
select t_assert('anônimo não lê receitas', t_cnt('select 1 from spray_recipes') = 0);
reset role;

set role authenticated;
select t_login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'richiteradm@gmail.com');
select t_assert('sócio apaga receita', t_rows($$delete from spray_recipes where name = 'Do financeiro'$$) = 1);
reset role;
