-- =====================================================================
-- Norte Drones — registro do "OK" do cliente na OS
-- O cliente autoriza respondendo OK no WhatsApp (sem contrato). Aqui fica o registro dentro da OS:
-- a data em que respondeu e uma observação (ex.: "respondeu OK às 14h"). Não muda cobrança nem saldo.
-- Quem pode lançar (admin, sócio, financeiro) registra, pelas policies da 0010. Depende da 0010.
-- =====================================================================
alter table public.service_orders
  add column if not exists client_ok_at date,
  add column if not exists client_ok_note text check (client_ok_note is null or length(client_ok_note) <= 300);
