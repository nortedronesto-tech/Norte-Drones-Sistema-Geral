# Norte Drones · Gestão

Sistema interno de gestão da Norte Drones. **Fase 1 — Financeiro.**
Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + Storage) · PWA.

## O que a Fase 1 faz

| Tela | Rota | Para quê |
|---|---|---|
| Visão geral | `/` | Saldo por conta, saldo total, fundo de reserva, a pagar/receber, rateio por sócio |
| Lançamentos | `/lancamentos` | Lista com filtros; marcar como pago/recebido; ver foto; excluir |
| Novo lançamento | `/lancamentos/novo` | Entrada/saída com conta, categoria e status, com prévia do rateio |
| Despesa com foto | `/despesa-foto` | Valor + categoria + conta + foto, para lançar em segundos |
| Fundo de reserva | `/reserva` | Extrato com saldo corrente e registro de retiradas |
| Cadastros | `/cadastros` | Sócios (nome, e-mail, %) e contas |

### Regra de rateio (vive no banco, não no front)

Toda entrada **recebida** (status `pago`) passa pelo trigger `apply_income_split`:

1. Retém `reserve_pct`% (10%) para o fundo de reserva → linhas em `reserve_fund_entries`, em nome de cada sócio na proporção da participação (50/50 = 5% + 5%).
2. Divide o restante entre os sócios ativos conforme `partners.share_pct` → linhas em `transaction_splits`.
3. Centavos: método do maior resto, a soma sempre fecha exatamente.
4. Entrada `a_receber` **não** gera rateio; ao marcar como recebida, gera. Editar valor/status refaz; excluir desfaz.

Os percentuais dos sócios ativos precisam somar 100, senão a entrada é recusada.

## Colocar no ar (passo a passo)

### 1. Criar o banco no Supabase
1. Em supabase.com, crie um projeto (região **South America – São Paulo**).
2. Abra **SQL Editor → New query**. Cole e rode, **nesta ordem**, o conteúdo de:
   1. `supabase/migrations/0001_fase1_financeiro.sql`
   2. `supabase/migrations/0002_storage_receipts.sql`
   3. `supabase/seed.sql` (cria os 2 sócios 50/50 e 3 contas de exemplo)

### 2. Criar os logins
1. **Authentication → Users → Add user → Create new user**: e-mail `richiteradm@gmail.com`, defina uma senha, marque *Auto Confirm User*.
2. Faça o mesmo para o Mateus quando souber o e-mail dele e depois preencha esse e-mail em **Cadastros → Sócios** (só e-mails cadastrados como sócio acessam os dados).
3. **Authentication → Sign In / Providers → Email**: desligue **Allow new users to sign up** (o cadastro público tem que ficar fechado).

### 3. Rodar no seu computador
```bash
cp .env.example .env.local     # preencha com URL e anon key de Project Settings → API
npm install
npm run dev                    # abre http://localhost:3000
```

### 4. Publicar na Vercel
Importe o repositório, em **Environment Variables** crie `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` e faça o deploy. No celular, abra o site e use **Adicionar à tela inicial** para instalar o app.

## Testes

```bash
PGUSER=postgres npm run test:sql
```
Sobe um banco temporário, aplica as migrations e confere rateio (incl. centavos), reserva, constraints e RLS. Precisa de um Postgres 15+ local.

## Organização

```
app/(app)/           telas protegidas + server actions (actions.ts)
app/login/           login (e-mail + senha)
components/          formulários e listas (client) e primitivos de UI
lib/                 supabase clients, dados, formatação, rateio (prévia), imagem
supabase/migrations  schema, trigger de rateio, RLS, storage
supabase/tests       testes SQL
public/sw.js         service worker (ver abaixo)
proxy.ts             renovação de sessão e proteção de rotas (Next 16)
```

## Limites conhecidos da Fase 1

- **Offline:** o service worker só torna o app instalável, guarda arquivos estáticos e mostra uma tela "sem conexão". Páginas e dados financeiros **não** ficam em cache no aparelho de propósito. A fila offline com IndexedDB (foto/captura em campo sincronizando depois) entra na **Fase 4**.
- **Retirada da reserva** só baixa o saldo do fundo; a despesa correspondente deve ser lançada à parte.
- Não há edição de lançamento existente: exclua e lance de novo.
- O rateio acumulado por sócio é um *razão* do que cada um tem a receber; pagamento/pró-labore efetivo não é controlado ainda.
