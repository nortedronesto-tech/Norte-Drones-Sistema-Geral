-- Testes da trilha de auditoria (0015). Rodar depois de recorrentes.sql (usa os helpers t_*).
\set ON_ERROR_STOP on
reset role;
select set_config('t.acc', (select id::text from bank_accounts limit 1), false);
delete from audit_log;  -- (superusuário) começa do zero para contar com exatidão

set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('lançar grava INSERT com o e-mail de quem fez', t_try($$insert into transactions (type, amount, account_id, category, description, status) values ('saida', 80, current_setting('t.acc')::uuid, 'Combustível', 'auditoria-teste', 'pago')$$) = 'ok');
select t_assert('editar grava UPDATE só com o que mudou', t_rows($$update transactions set amount = 95.5, description = 'auditoria-teste' where description = 'auditoria-teste'$$) = 1);
select t_assert('editar sem mudar nada não grava', t_rows($$update transactions set amount = 95.5 where description = 'auditoria-teste'$$) = 1);
select t_assert('apagar grava DELETE com a linha antiga', t_rows($$delete from transactions where description = 'auditoria-teste'$$) = 1);
select t_assert('financeiro NÃO lê a trilha', t_cnt('select 1 from audit_log') = 0);
reset role;

select t_assert('INSERT registrado com usuário', (select count(*) from audit_log where table_name = 'transactions' and action = 'INSERT' and user_email = 'fin@exemplo.com' and new_row ->> 'description' = 'auditoria-teste') = 1);
select t_assert('UPDATE guarda de/para do valor', (select changes -> 'amount' ->> 'de' || '→' || (changes -> 'amount' ->> 'para') from audit_log where table_name = 'transactions' and action = 'UPDATE' and user_email = 'fin@exemplo.com' order by id desc limit 1) = '80.00→95.50');
select t_assert('o registro guarda o assunto (descrição do lançamento)', (select count(*) from audit_log where table_name = 'transactions' and subject = 'auditoria-teste') = 3);
select t_assert('UPDATE não guarda a linha inteira', (select old_row is null and new_row is null from audit_log where action = 'UPDATE' and table_name = 'transactions' limit 1));
select t_assert('UPDATE sem mudança não gerou registro', (select count(*) from audit_log where table_name = 'transactions' and action = 'UPDATE') = 1);
select t_assert('DELETE guarda a linha antiga', (select old_row ->> 'amount' from audit_log where table_name = 'transactions' and action = 'DELETE' limit 1) = '95.50');
select t_assert('retenção automática da reserva não é registrada', (select count(*) from audit_log where table_name = 'reserve_fund_entries' and coalesce(new_row ->> 'kind', old_row ->> 'kind') = 'retencao') = 0);

set role authenticated;
select t_login('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com');
select t_assert('consulta NÃO lê a trilha', t_cnt('select 1 from audit_log') = 0);
reset role;
set role authenticated;
select t_login('11111111-1111-1111-1111-111111111111', 'op@exemplo.com');
select t_assert('operador NÃO lê a trilha', t_cnt('select 1 from audit_log') = 0);
reset role;
set role authenticated;
select t_login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'richiteradm@gmail.com');
select t_assert('sócio lê a trilha', t_cnt('select 1 from audit_log') >= 3);
select t_assert('sócio NÃO altera a trilha', t_try($$update audit_log set action = 'DELETE'$$) <> 'ok');
select t_assert('sócio NÃO apaga da trilha', t_try($$delete from audit_log$$) <> 'ok');
select t_assert('sócio NÃO escreve na trilha', t_try($$insert into audit_log (table_name, action) values ('x', 'INSERT')$$) <> 'ok');
reset role;
set role anon;
select t_assert('anônimo NÃO lê a trilha', t_cnt('select 1 from audit_log') = 0);
reset role;

-- cliente e OS também entram na trilha
set role authenticated;
select t_login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com');
select t_assert('cliente novo é registrado', t_try($$insert into clients (name) values ('Cliente auditado')$$) = 'ok');
reset role;
select t_assert('registro do cliente tem o nome', (select count(*) from audit_log where table_name = 'clients' and new_row ->> 'name' = 'Cliente auditado') = 1);
