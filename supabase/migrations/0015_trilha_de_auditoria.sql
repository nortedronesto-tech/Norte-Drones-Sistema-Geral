-- =====================================================================
-- Norte Drones — trilha de auditoria
-- Registra quem criou, alterou ou apagou lançamentos, contas, sócios, clientes, fornecedores, OS,
-- recorrentes, usuários e configurações — com o antes e o depois. Só administrador e sócio leem.
-- Ninguém altera nem apaga o registro pela API (não há política de escrita); o gatilho grava sozinho.
-- Mudanças feitas pelo próprio sistema (rotina diária) aparecem sem usuário. Depende de 0001–0005.
-- =====================================================================
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_id    uuid,
  user_email text,
  table_name text not null,
  row_id     text,
  subject    text,   -- o que foi mexido, em palavras (descrição, nome, "OS nº 12"...)
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_row    jsonb,
  new_row    jsonb,
  changes    jsonb   -- só em UPDATE: { "campo": { "de": ..., "para": ... } }
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_table_idx on public.audit_log (table_name, at desc);

alter table public.audit_log enable row level security;
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated using (public.can_manage());
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb; v_changes jsonb; v_ref jsonb; v_subject text;
begin
  if tg_op = 'INSERT' then v_new := to_jsonb(new); v_ref := v_new;
  elsif tg_op = 'DELETE' then v_old := to_jsonb(old); v_ref := v_old;
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_ref := v_new;
    select jsonb_object_agg(n.key, jsonb_build_object('de', o.value, 'para', n.value)) into v_changes
      from jsonb_each(v_new) n join jsonb_each(v_old) o using (key)
     where n.value is distinct from o.value;
    if v_changes is null then return new; end if;   -- nada mudou de verdade
    v_old := null; v_new := null;                   -- em UPDATE só guarda o que mudou
  end if;

  -- a retenção automática da reserva (gerada a cada entrada paga) não é uma ação de pessoa
  if tg_table_name = 'reserve_fund_entries' and v_ref ->> 'kind' = 'retencao' then
    return coalesce(new, old);
  end if;

  v_subject := case when tg_table_name = 'service_orders' then 'OS nº ' || coalesce(v_ref ->> 'number', '')
                    else nullif(coalesce(v_ref ->> 'description', v_ref ->> 'name', v_ref ->> 'email', v_ref ->> 'category', v_ref ->> 'key', ''), '') end;

  insert into public.audit_log (user_id, user_email, table_name, row_id, subject, action, old_row, new_row, changes)
  values (auth.uid(), nullif(coalesce(auth.jwt() ->> 'email', ''), ''), tg_table_name,
          coalesce(v_ref ->> 'id', v_ref ->> 'key', v_ref ->> 'user_id'), left(v_subject, 160), tg_op, v_old, v_new, v_changes);
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_row() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['transactions', 'bank_accounts', 'partners', 'settings', 'reserve_fund_entries', 'user_access']
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
  -- tabelas das migrations 0007 a 0014 (só as que existem neste banco)
  foreach t in array array['suppliers', 'clients', 'service_orders', 'recurring_transactions', 'spray_recipes']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
      execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
    end if;
  end loop;
end $$;
