# Investigação de logs do Supabase — GT3 Sistema

Fase 1 (somente leitura). Nada foi alterado no código nem no banco; este arquivo é o único criado.

## Resumo em linguagem simples

Toda vez que o sistema quer saber "quem é o usuário logado?", ele pergunta ao Supabase pela internet (isso vira 1 evento em **Auth** e 1 no **API Gateway**). Hoje essa pergunta é feita **de forma repetida**:

- o "porteiro" do site (`proxy.ts`) pergunta a cada página aberta;
- **cada** rota `/api/...` pergunta de novo (são ~90 rotas);
- no navegador, 3 componentes diferentes perguntam ao mesmo tempo ao abrir o sistema;
- o dashboard consulta o servidor a cada 20 segundos (Designação de Reprovados), e cada consulta também gera uma pergunta de autenticação.

Somando, **um único F5 no dashboard gera cerca de 20 chamadas de autenticação**, e cada troca de tela gera mais ~3 (mais as "pré-carregadas" dos links). Isso explica Auth ≈ 971 e Gateway ≈ 2.800 com uma equipe pequena. Não encontrei loops infinitos nem realtime vazando (todos os canais têm cleanup). O banco em si (PostgREST/Postgres/Realtime) está normal.

A boa notícia: a maior parte da redução vem de trocar "perguntar ao Supabase" por "conferir o login localmente" (`getClaims`) e de cortar duplicatas — sem mudar telas nem permissões.

## Achados (ordem de prioridade por impacto)

### 1. Polling de 20 s da Designação de Reprovados no dashboard
- `app/dashboard/DashboardSidebar.tsx:558` — `setInterval(..., 20000)` chamando `/api/designacao-reprovados/pendentes` (+ recarrega ao voltar para a aba, linha 556). Já existe realtime nessa tabela (linha 552), o polling é só "rede de segurança".
- **Estimativa:** 3 chamadas/min por usuário com o dashboard aberto ≈ 180/hora ≈ ~1.400 por usuário por dia de 8 h. Cada chamada = 1 Gateway + 1 Auth (+1 PostgREST). Provavelmente o **maior gerador individual**.
- **Correção:** subir para 120–300 s (o realtime continua instantâneo).
- **Risco: baixo.** Pior caso: se o realtime falhar, a lista demora alguns minutos a atualizar.

### 2. `getUser()` em toda requisição de página (`proxy.ts`)
- `proxy.ts:44` — `supabase.auth.getUser()` roda em **toda** navegação de página (o matcher `'/(.*)'` na linha 70 pega tudo; as exceções de `/_next`, `/api/`, estáticos e `/questionario/` já estão tratadas por `if` no início, então não é o matcher o problema). Inclui as requisições de pré-carregamento dos `<Link>` (dashboard tem ~25 links de módulos + sidebar, `DashboardModuleGrid.tsx:284`, `Sidebar.tsx:162`) — em produção o Next pré-carrega links visíveis. Isso **a confirmar** nos logs (muitos `GET /auth/v1/user` em rajada ao abrir o dashboard).
- **Estimativa:** 1 Auth por página/navegação + até ~25 na abertura do dashboard (se prefetch estiver ativo).
- **Correção:** trocar `getUser()` por `getClaims()` (valida a assinatura do token localmente; só vai à rede se o token precisar ser renovado). **Pré-requisito a verificar:** o projeto Supabase usar chaves de assinatura assimétricas (JWT Signing Keys); se ainda usar o segredo legado, `getClaims` cai em `getUser` e não ajuda. Complemento opcional: `prefetch={false}` nos Links de módulos.
- **Risco: médio.** É a porta de entrada de segurança. Se bem feito (continua redirecionando sem token válido), o comportamento é idêntico. O que poderia quebrar: sessão expirada não renovar → redirecionar para login indevidamente. `prefetch={false}` é baixo risco, só deixa a 1ª abertura de cada módulo um pouco mais lenta.

### 3. `getUser()` em cada rota `/api/*` (~90 rotas)
- Padrão `serverClient.auth.getUser()` em quase todas as rotas e em `app/lib/api-helpers.ts:6,16,26` (`getCaller`, `getCallerWithNome`, `getAuthUser`, usados por `requireGestorAdmin` etc.).
- **Estimativa:** ~7 chamadas do AppShell + ~7 do dashboard + `/api/me` + `/api/notificacoes/usuario` ≈ **15–17 Auth por carregamento** do dashboard; mais ~2–3 por troca de tela (achado 5).
- **Correção:** nos 3 helpers de `api-helpers.ts`, usar `getClaims()` (o `user.id` vem do claim `sub`); depois migrar as rotas que chamam `getUser` direto para esses helpers, em lotes. O papel (admin/gestor…) continua sendo lido do banco como hoje — **a regra de permissão não muda**.
- **Risco: médio.** Mesmo ponto de atenção do achado 2 (mesmo pré-requisito de chaves). Fazer o helper primeiro (cobre as rotas que o usam) e as demais rotas por lotes pequenos. O que poderia quebrar: rota devolver 401 para usuário logado.

### 4. Três `getUser()` no navegador ao abrir o sistema + reload de perfil em todo evento
- `app/components/UserContext.tsx:85` (e `:93` `onAuthStateChange` → `loadProfile` → `/api/me`, que é +1 Auth no servidor), `app/components/ModulesContext.tsx:56`, `app/dashboard/DashboardSidebar.tsx:465`. O contexto central já existe (`useUser`), mas os outros dois ignoram e perguntam por conta própria.
- `onAuthStateChange` dispara em vários eventos (inclusive ao voltar o foco para a aba) e cada um refaz `/api/me`.
- **Estimativa:** 3 Auth por abertura + 1 `/api/me` por evento de sessão.
- **Correção:** Modules e Sidebar usarem `useUser().user` (ou `getSession()`, que é local) para obter o id; em `onAuthStateChange`, só recarregar o perfil se o id do usuário mudou.
- **Risco: baixo.** O que poderia quebrar: o canal realtime não assinar por esperar sessão (há um comentário em `ModulesContext.tsx` explicando que isso importa) — manter a espera pela sessão carregada.

### 5. Recargas a cada troca de tela no AppShell
- `app/components/AppShell.tsx:631-639` — a cada mudança de `pathname` chama `/api/legislacoes` (todos) e `/api/atas` (colaborador/trainee). Cada uma = 1 Gateway + 1 Auth + consultas.
- **Estimativa:** 2–3 chamadas por navegação (mais 1 do `proxy`).
- **Correção:** recarregar só ao **sair** das telas de atas/legislações (comentário da própria linha 630 diz que é essa a intenção), ou limitar a uma vez a cada N minutos.
- **Risco: médio-baixo.** O que poderia quebrar: contador/aviso de "não lida" demorar a atualizar logo após ler uma ata/legislação.

### 6. Demais pollings (menores)
- `DashboardSidebar.tsx:326` — a cada 5 min recarrega prioridades + lembretes + equipe (~4–5 chamadas por ciclo).
- `DashboardSidebar.tsx:527` — a cada 60 s `/api/observacoes/pendentes` (gestor/admin; realtime já existe, linha 522).
- `AppShell.tsx:540` — a cada 2 min, 2 chamadas de PDI (para só quando a aba fica oculta; já está bem).
- **Correção:** observações pendentes 60 s → 300 s. Demais ok.
- **Risco: baixo.**

### 7. Itens verificados sem problema
- **Cliente do navegador:** `createBrowserClient` (`app/lib/supabase.ts`) é cacheado internamente pela biblioteca (singleton). Os ~197 `createClient()` no código não geram conexões extras no navegador; no servidor é o esperado (1 por requisição).
- **Realtime:** 20 `.channel()` x 21 `removeChannel` — todos com cleanup no `useEffect`; nomes aleatórios, mas sempre removidos.
- **`ObservacoesClient.tsx`:** efeitos com dependências corretas, sem loop; canal com cleanup (`:497-527`).
- **`.env.local`:** existe apenas ele (sem `.env.production`), apontando para o projeto Supabase de ref `wfvdq…`. Não consigo ver as variáveis da Vercel, então **não dá para afirmar** se produção usa o mesmo projeto — se usar, o `npm run dev` de vocês também soma nos logs (em dev o React Strict Mode ainda dobra os efeitos). Confirmar em Vercel → Settings → Environment Variables.

## Plano proposto (um commit por item, `npm run build` após cada)

| # | Correção | Impacto | Risco |
|---|----------|---------|-------|
| 1 | Polling Designação 20 s → 180 s | alto | baixo |
| 4 | Sessão única no cliente (Modules/Sidebar usam `useUser`; perfil só recarrega se id mudar) | médio | baixo |
| 2 | `proxy.ts`: `getClaims()` (+ opcional `prefetch={false}`) | alto | médio |
| 3 | `api-helpers.ts` e rotas diretas: `getClaims()` | alto | médio |
| 5 | AppShell: não recarregar legislações/atas a cada rota | médio | médio-baixo |
| 6 | Observações pendentes 60 s → 300 s | baixo | baixo |

Itens 2 e 3 dependem de confirmar que o projeto usa chaves de assinatura assimétricas (Supabase → Project Settings → JWT Keys). Se não usar, eu paro e te pergunto antes (trocar as chaves é mudança no Supabase, fora do escopo).

## Antes de começar a Fase 2
`git status` hoje **não está limpo**: há alterações suas/minhas ainda não commitadas (botão "Excluir" nos cards de Questionários) e dois arquivos de `Prints/` apagados. O checkpoint pedido (`git add .`) incluiria tudo isso — preciso que você diga se quer incluir assim, ou se prefere que eu comite só o botão e deixe os `Prints/` de fora.
