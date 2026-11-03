-- Testes de recorrentes (0014) e de edição de lançamento. Rodar depois de preflight.sql (usa os helpers t_*).
\set ON_ERROR_STOP on
reset role;
select set_config('t.acc', (select id::text from bank_accounts limit 1), false);

set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro cria regra recorrente', t_try($$insert into recurring_transactions (type, amount, account_id, category, description, day_of_month, next_due) values ('saida', 1500, current_setting('t.acc')::uuid, 'Aluguel de veículo', 'Aluguel do carro', 10, current_date + 3)$$) = 'ok');
select t_assert('dia do mês inválido é recusado', t_try($$insert into recurring_transactions (type, amount, account_id, category, day_of_month, next_due) values ('saida', 10, current_setting('t.acc')::uuid, 'X', 32, current_date)$$) <> 'ok');
select t_assert('financeiro gera o lançamento pendente', t_try($$insert into transactions (type, amount, account_id, category, description, status, date, recurring_id, recurring_due) select type, amount, account_id, category, description, 'a_pagar', next_due, id, next_due from recurring_transactions limit 1$$) = 'ok');
select t_assert('o mesmo mês não gera duas vezes (índice único)', t_try($$insert into transactions (type, amount, account_id, category, description, status, date, recurring_id, recurring_due) select type, amount, account_id, category, description, 'a_pagar', next_due, id, next_due from recurring_transactions limit 1$$) <> 'ok');
select t_assert('financeiro NÃO apaga regra (0 linhas)', t_rows($$delete from recurring_transactions$$) = 0);
reset role;

set role authenticated;
select t_login('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com');
select t_assert('consulta lê as regras', t_cnt('select 1 from recurring_transactions') = 1);
select t_assert('consulta NÃO cria regra', t_try($$insert into recurring_transactions (type, amount, account_id, category, day_of_month, next_due) values ('saida', 10, current_setting('t.acc')::uuid, 'X', 5, current_date)$$) <> 'ok');
reset role;

set role authenticated;
select t_login('11111111-1111-1111-1111-111111111111', 'op@exemplo.com');
select t_assert('operador NÃO vê regras recorrentes', t_cnt('select 1 from recurring_transactions') = 0);
reset role;

-- edição de entrada paga: rateio e reserva se recalculam
reset role;
insert into transactions (type, amount, account_id, category, status, description) values ('entrada', 1000, current_setting('t.acc')::uuid, 'Serviço de aplicação', 'pago', 'edicao-teste');
select t_assert('antes: rateio + reserva somam 1000', (select coalesce(sum(s.amount), 0) from transaction_splits s join transactions t on t.id = s.transaction_id where t.description = 'edicao-teste') + (select coalesce(sum(r.amount), 0) from reserve_fund_entries r join transactions t on t.id = r.transaction_id where t.description = 'edicao-teste' and r.kind = 'retencao') = 1000);
set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('financeiro corrige o valor da entrada paga', t_rows($$update transactions set amount = 2000, description = 'edicao-teste' where description = 'edicao-teste'$$) = 1);
reset role;
select t_assert('depois: rateio + reserva somam 2000', (select coalesce(sum(s.amount), 0) from transaction_splits s join transactions t on t.id = s.transaction_id where t.description = 'edicao-teste') + (select coalesce(sum(r.amount), 0) from reserve_fund_entries r join transactions t on t.id = r.transaction_id where t.description = 'edicao-teste' and r.kind = 'retencao') = 2000);
