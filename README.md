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

1. `0001_fase1_financeiro.sql` — financeiro, rateio, RLS (depois: 0002–0006, nesta ordem)
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
| `OPENAI_API_KEY` | não | Alternativa à tela **Admin → Integrações**: IA de imagem e **leitura automática das fotos de nota**. O que estiver cadastrado em Integrações tem prioridade |
| `OPENAI_VISION_MODEL` | não | modelo que lê as notas (padrão `gpt-4o-mini`) |
| `SUPABASE_SERVICE_ROLE_KEY` | sim (usuários e backup) | Supabase → Project Settings → API Keys → *service_role*. **Segredo**: só no servidor, nunca com `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | não | Alternativa à tela **Admin → Integrações**: chave do [Resend](https://resend.com) para o backup por e-mail |
| `BACKUP_EMAIL_TO` | não | Destino do backup (padrão `nortedronesto@gmail.com`) |
| `CRON_SECRET` | sim (agendamentos) | Texto longo e aleatório; a Vercel o envia nos agendamentos |

```bash
cp .env.example .env.local   # preencha
npm install
npm run dev
```

## Foto da nota com preenchimento automático

Em **Despesa com foto** e em **Lançamentos → Novo lançamento** dá para tirar a foto (ou escolher da galeria). O sistema lê a nota e preenche valor, data, descrição, categoria (e entrada/saída) — o usuário só confere e salva. O aviso informa qual IA leu.

### IA híbrida (várias chaves, troca automática)

Em **Admin → Integrações** você cola a chave de qualquer IA e o sistema descobre qual é pelo formato (`AIza…`/`AQ.…` Gemini, `xai-…` Grok, `gsk_…` Groq, `sk-ant-…` Claude, `sk-or-v1-…` OpenRouter, `fw_…` Fireworks, `hf_…` Hugging Face, `nvapi-…` NVIDIA, 64 hex Together, `sk-…` OpenAI; Mistral, Cohere e DeepInfra não têm prefixo — aí você escolhe a IA na lista). As IAs ficam numa **ordem de uso** (padrão: Gemini → Grok → Groq → OpenRouter → Mistral → Together → Fireworks → NVIDIA → DeepInfra → Hugging Face → Cohere → OpenAI → Claude; só entram as que têm chave). A leitura usa a primeira com crédito; se ela ficar sem cota/crédito, a chave for recusada ou a IA estiver fora do ar, passa sozinha para a próxima. Quem estourou o crédito fica de molho por um tempo (15 min se for limite de uso, 3 h se acabou o saldo) e depois volta a ser tentada. O painel mostra qual está **em uso agora** e o estado de cada uma. A lógica está em `lib/ai-routing.ts` (testada em `tests/ai-routing.test.ts`, rode `npm test`); as chamadas, em `lib/ai-providers.ts`; a leitura da nota, em `lib/receipt-ai.ts` e `/api/gestao/receipt-scan` (só quem pode lançar).

## Integrações (chaves de serviços externos)

Em **/admin → Integrações** (só administrador) você cola as chaves das IAs (Gemini, Grok, Groq, OpenAI) e a do **Resend** (e-mail do backup). A IA de imagem dos posts usa só a OpenAI. Elas ficam **criptografadas no Supabase Vault**, só o servidor as usa (o painel mostra apenas o final da chave) e valem na hora, sem Redeploy. Rode `supabase/migrations/0006_cofre_de_segredos.sql` uma vez. Exige a `SUPABASE_SERVICE_ROLE_KEY` na Vercel.

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
2. Na Vercel, cadastre `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` e faça Redeploy. Depois cole a chave do Resend em **Admin → Integrações**.
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
