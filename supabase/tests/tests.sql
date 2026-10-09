\set ON_ERROR_STOP on
\echo '--- 1. como sócio autenticado (Helbert)'
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"richiteradm@gmail.com"}', false);
select count(*) as partners_visiveis from partners;

insert into transactions (type, amount, account_id, category, description, status, date)
select 'entrada', 1000.00, id, 'Serviço de aplicação', 'Fazenda X 10 ha', 'pago', '2026-10-01' from bank_accounts where name like '%Helbert';
select 'entrada R$1000 paga' as caso, amount, partner_id is not null from reserve_fund_entries where kind='retencao' order by amount desc;
select s.amount as split, p.name from transaction_splits s join partners p on p.id=s.partner_id order by p.name;

\echo '--- 2. a receber NÃO gera rateio; ao marcar pago, gera'
insert into transactions (type, amount, account_id, category, status, date)
select 'entrada', 333.33, id, 'Serviço de aplicação', 'a_receber', '2026-10-05' from bank_accounts where name like '%Mateus';
select count(*) as splits_antes_de_receber from transaction_splits;
update transactions set status='pago' where status='a_receber';
select amount, kind from reserve_fund_entries where amount < 100 order by amount;
select sum(amount) as soma_splits_333_33 from transaction_splits s where s.transaction_id = (select id from transactions where amount=333.33);
select (select sum(amount) from reserve_fund_entries r where r.transaction_id=t.id) + (select sum(amount) from transaction_splits s where s.transaction_id=t.id) as total_reserva_mais_splits, t.amount from transactions t where amount=333.33;

\echo '--- 3. centavos ímpares: R$0,05 e R$0,01 (nada se perde)'
insert into transactions (type, amount, account_id, category, status)
select 'entrada', 0.05, id, 'Outros', 'pago' from bank_accounts limit 1;
insert into transactions (type, amount, account_id, category, status)
select 'entrada', 0.01, id, 'Outros', 'pago' from bank_accounts limit 1;
select t.amount, coalesce((select sum(amount) from reserve_fund_entries r where r.transaction_id=t.id),0) + coalesce((select sum(amount) from transaction_splits s where s.transaction_id=t.id),0) as soma
from transactions t where t.amount < 1 order by t.amount;

\echo '--- 4. saída não gera rateio; saldos por conta'
insert into transactions (type, amount, account_id, category, status, description)
select 'saida', 250.00, id, 'Combustível', 'pago', 'Diesel L200' from bank_accounts where name like '%Mateus';
insert into transactions (type, amount, account_id, category, status)
select 'saida', 3000.00, id, 'Aluguel de veículo', 'a_pagar' from bank_accounts where name like '%Mateus';
select name, balance, to_receive, to_pay from account_balances order by name;
select name, split_total, reserve_total from partner_totals order by name;

\echo '--- 5. editar valor re-ratea; deletar remove rateio/reserva'
update transactions set amount = 2000 where amount = 1000;
select sum(amount) as reserva_apos_2000 from reserve_fund_entries where transaction_id=(select id from transactions where amount=2000);
delete from transactions where amount=2000;
select count(*) as splits_restantes from transaction_splits s where s.amount > 500;

\echo '--- 6. constraints'
do $$ begin
  begin insert into transactions (type, amount, account_id, category, status) select 'saida', 10, id, 'x', 'a_receber' from bank_accounts limit 1; raise exception 'FALHOU: saida a_receber aceita'; exception when check_violation then raise notice 'ok: saida/a_receber bloqueada'; end;
  begin insert into transactions (type, amount, account_id, category, status) select 'entrada', -5, id, 'x', 'pago' from bank_accounts limit 1; raise exception 'FALHOU: valor negativo'; exception when check_violation then raise notice 'ok: valor negativo bloqueado'; end;
end $$;

\echo '--- 7. retirada da reserva e overdraft'
select sum(amount) as saldo_reserva from reserve_fund_entries;
insert into reserve_fund_entries (kind, amount, description) values ('retirada', -20.00, 'Bateria');
do $$ begin
  begin insert into reserve_fund_entries (kind, amount, description) values ('retirada', -99999, 'x'); raise exception 'FALHOU: overdraft'; exception when raise_exception then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: overdraft bloqueado'; end;
  begin insert into reserve_fund_entries (kind, amount, transaction_id) values ('retencao', 5, null); raise exception 'FALHOU: retencao manual'; exception when others then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: retencao manual bloqueada (%)', sqlstate; end;
end $$;

\echo '--- 8. percentuais: soma != 100 é rejeitada; 60/40 funciona'
do $$ begin
  begin perform set_partner_shares((select array_agg(id order by name) from partners), array[70, 70]); raise exception 'FALHOU'; exception when raise_exception then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: soma 140 rejeitada'; end;
end $$;
select set_partner_shares((select array_agg(id order by name) from partners), array[60, 40]);
insert into transactions (type, amount, account_id, category, status)
select 'entrada', 100, id, 'Serviço de aplicação', 'pago' from bank_accounts limit 1;
select p.name, s.pct, s.amount from transaction_splits s join partners p on p.id=s.partner_id where s.transaction_id=(select id from transactions where amount=100 and type='entrada') order by p.name;
select p.name, r.amount from reserve_fund_entries r join partners p on p.id=r.partner_id where r.transaction_id=(select id from transactions where amount=100 and type='entrada') order by p.name;

\echo '--- 9. RLS: usuário que NÃO é sócio não vê nada e não escreve'
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"intruso@x.com"}', false);
select count(*) as transacoes_visiveis_intruso from transactions;
select count(*) as contas_visiveis_intruso from account_balances;
do $$ begin
  begin insert into transactions (type, amount, account_id, category, status) values ('entrada', 1, gen_random_uuid(), 'x', 'pago'); raise exception 'FALHOU'; exception when others then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: intruso barrado (%)', sqlstate; end;
end $$;
\echo 'TESTES OK'
