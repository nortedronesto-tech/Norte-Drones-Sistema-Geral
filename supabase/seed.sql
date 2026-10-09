-- Dados iniciais. Ajuste e-mails e contas pela tela "Cadastros" depois.
-- O e-mail do Mateus fica em branco até você saber qual ele vai usar no login:
--   update public.partners set email = 'email-do-mateus@...' where name like 'Mateus%';
insert into public.partners (name, email, share_pct) values
  ('Helbert Richiter Gomes Osório', 'richiteradm@gmail.com', 50),
  ('Mateus Neres da Silva',          null,                    50);

insert into public.bank_accounts (name, kind, partner_id)
select 'Conta MEI — Helbert', 'mei', id from public.partners where name like 'Helbert%'
union all
select 'Conta MEI — Mateus', 'mei', id from public.partners where name like 'Mateus%'
union all
select 'Caixa (dinheiro)', 'caixa', null;
