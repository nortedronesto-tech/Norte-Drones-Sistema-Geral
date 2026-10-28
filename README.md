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
| `SUPABASE_SERVICE_ROLE_KEY` | sim (usuários e backup) | Supabase → Project Settings → API Keys → *service_role*. **Segredo**: só no servidor, nunca com `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | sim (backup) | Chave do [Resend](https://resend.com) (conta criada com o e-mail que recebe o backup) |
| `BACKUP_EMAIL_TO` | não | Destino do backup (padrão `nortedronesto@gmail.com`) |
| `CRON_SECRET` | sim (agendamentos) | Texto longo e aleatório; a Vercel o envia nos agendamentos |

```bash
cp .env.example .env.local   # preencha
npm install
npm run dev
```

## Níveis de acesso e usuários

Em **/admin → Usuários** (só administrador) você cadastra o login (e-mail + senha), escolhe o nível, troca senha, desativa ou exclui.

| Nível | Pode |
|---|---|
| Administrador | Tudo, inclusive cadastrar usuários |
| Sócio | Gestão completa + admin do site |
| Financeiro | Lançar e consultar o financeiro (sem cadastros, sem admin do site) |
| Consulta | Só visualizar o financeiro |

O nível vale no banco (RLS), não só na tela. Rode `supabase/migrations/0005_niveis_de_acesso.sql` no SQL Editor para ativar.

## Backup semanal por e-mail

Toda segunda, 8h (Brasília), a Vercel chama `/api/cron/backup`, que envia por e-mail o backup completo (.json) e a planilha de lançamentos (.csv). Um 2º agendamento diário (`/api/cron/keepalive`) evita que o Supabase gratuito pause o projeto. Os dois estão em `vercel.json`.

Configuração (uma vez):
1. Crie uma conta em resend.com **com o e-mail que vai receber o backup** e gere uma *API Key*.
2. Na Vercel, cadastre `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET`, e faça Redeploy.
3. Em **/admin → Backup**, clique em *Enviar backup agora* para testar.

## Domínio próprio

Vercel → projeto → **Settings → Domains → Add** → digite o domínio (ex.: `nortedrones.com.br`). A Vercel mostra os registros DNS; copie-os no painel de DNS de quem vendeu o domínio (no Registro.br: *Editar zona DNS*): um registro **A** para `76.76.21.21` (domínio sem www) e um **CNAME** `www` → `cname.vercel-dns.com`. Depois ajuste `NEXT_PUBLIC_SITE_URL` e faça Redeploy.

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
