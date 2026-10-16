# Norte Drones — projeto único (site + gestão + admin)

Um só projeto Next.js 16 (App Router) + Supabase, publicado em um único projeto na Vercel.

| Área | Rota | Acesso | O que é |
|---|---|---|---|
| Site público | `/` | aberto | Site institucional (contatos e imagens vêm do Supabase) |
| Gestão (financeiro) | `/gestao/*` | sócios logados | Lançamentos, despesa com foto, fundo de reserva, cadastros, rateio por sócio |
| Painel administrativo | `/admin` | sócios logados | Contatos e imagens do site, gerador de posts e de vídeos |
| Login | `/login` | aberto | E-mail + senha (Supabase Auth), serve para `/gestao` e `/admin` |

Stack: Next.js 16 · React 19 · Tailwind 4 · Supabase (Postgres + Auth + Storage) · PWA (só em `/gestao`).

## Segurança

- **Login único (Supabase Auth)**; só e-mails cadastrados em *Cadastros → Sócios* (tabela `partners`, ativo) têm acesso.
- `proxy.ts` bloqueia `/gestao`, `/admin` e `/api/admin` sem sessão; as rotas `/api/admin/*` e o layout `/admin` conferem de novo se é sócio.
- **O banco também protege (RLS)**: visitante e usuário não-sócio não leem nem gravam nada interno. O site público só lê as chaves `contacts` e `images` de `site_settings`.
- Nenhuma chave privada no frontend: só a chave pública (`anon`/publishable) do Supabase. **Nunca** use a `service_role` neste projeto.
- Rateio e reserva são calculados por trigger no banco; ninguém chama `apply_income_split` pela API.

## Banco (Supabase)

Migrações em `supabase/migrations`, em ordem:

1. `0001_fase1_financeiro.sql` — financeiro, rateio, RLS
2. `0002_storage_receipts.sql` — bucket privado de recibos
3. `0003_site_publico_admin.sql` — `site_settings` (contatos/imagens) e bucket público `site-images`
4. `0004_hardening_funcoes.sql` — search_path fixo e revogação de execução pública
5. `seed.sql` — 2 sócios 50/50 e 3 contas (rode uma vez)

## Variáveis de ambiente

| Variável | Obrigatória | Onde achar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | mesma tela (chave anon/publishable) |
| `NEXT_PUBLIC_SITE_URL` | recomendada | URL final do site |
| `OPENAI_API_KEY` | não | só para a IA de imagem no `/admin` (servidor) |

```bash
cp .env.example .env.local   # preencha
npm install
npm run dev
```

## Primeiro acesso

1. Supabase → **Authentication → Users → Add user**: e-mail do sócio (ex.: `richiteradm@gmail.com`), senha, *Auto Confirm*.
2. Supabase → **Authentication → Sign In / Providers → Email**: desligue **Allow new users to sign up**.
3. Entre em `/login`. Para o Mateus: cadastre o e-mail dele em *Gestão → Cadastros → Sócios* e crie o login dele igual ao passo 1.
4. Em `/admin`, preencha WhatsApp, telefone, e-mail, Instagram e envie as imagens do site.

## Testes

```bash
npm run typecheck
PGUSER=postgres npm run test:sql   # precisa de Postgres 15+ local
```

## Estrutura

```
app/(site)/page.tsx     site público
app/gestao/            sistema interno
app/admin/             painel administrativo (+ geradores de post/vídeo)
app/api/admin/         rotas protegidas (contatos, imagens, IA, proxy de imagem)
components/site/       componentes do site público
components/            componentes da gestão
lib/                   supabase (server/client/public), conteúdo do site, guarda de sócio
supabase/              migrações, seed e testes SQL
```
