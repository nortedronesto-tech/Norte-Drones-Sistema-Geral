-- =====================================================================
-- Norte Drones — checklist de pré-voo na OS
-- Guarda quais itens de segurança foram conferidos antes de aplicar (lista de {id, ok}).
-- Quem abre/edita a OS (inclusive o operador, enquanto aberta) preenche. Depende da 0010 e 0012.
-- =====================================================================
alter table public.service_orders
  add column if not exists preflight jsonb check (preflight is null or jsonb_typeof(preflight) = 'array');
