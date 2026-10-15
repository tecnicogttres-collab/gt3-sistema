# Rodada 3 — investigação (aguardando aprovação)

Fase somente leitura: nenhum arquivo de código foi alterado, nada foi enviado (push) e nada foi mudado no Supabase.
Estado do git na investigação: working tree **limpo**, HEAD **`974c7a8`**.

Escopo aprovado: **A** (`/api/me` → `getClaims`), **B** (Dashboard: um recarregamento só ao voltar para a aba), **C** (helper único com cache de 2 min para `listUsers`).
Fora desta rodada: `/api/avisos/resumo`, região, `xlsx`, Workflow Programas, `proxy.ts`, `api-helpers.ts`.

---

## A. `app/api/me/route.ts` — `getUser()` → `getClaims()`

**Hoje:** a rota chama `serverClient.auth.getUser()`, que vai até o servidor de autenticação do Supabase a cada abertura do sistema (~300 ms medidos daqui). Nada aparece na tela antes dessa resposta, porque o perfil vem dela.

**Por que ficou de fora na Rodada 2:** a rota devolve `created_at: user.created_at` (data de criação do **login**), e esse campo não vem no token. Ele é usado em `AppShell.tsx` (`criadoAposConta`, linha 251) para **não** mostrar atas, legislações e campanhas criadas antes de a conta existir.

**Substituto encontrado:** a tabela `profiles` tem a coluna `created_at`. Comparei as duas datas (só leitura) nos 17 usuários:

| Resultado | Usuários |
|---|---|
| Data do perfil = data do login (diferença 0 s) | 16 |
| Perfil criado ~3 h 38 min depois do login | 1 |

Para esse 1 usuário, avisos criados **dentro dessa janela de 3 h 38 min** (no dia em que a conta foi criada) deixariam de aparecer como pendentes. Fora dessa janela, nada muda para ninguém.

> **Pendência:** tentei conferir se existe alguma ata/legislação/campanha criada nessa janela, mas a consulta foi bloqueada pela regra de permissão de dados pessoais do Claude Code (cruzava o login de um usuário específico). Não contornei. Se quiser conferir, rode no SQL Editor (só leitura):
>
> ```sql
> with j as (
>   select u.created_at as ini, p.created_at as fim
>   from auth.users u join public.profiles p on p.id = u.id
>   where p.created_at - u.created_at > interval '1 minute'
> )
> select 'atas' t, count(*) from atas, j where atas.created_at >= j.ini and atas.created_at < j.fim
> union all select 'legislacoes', count(*) from legislacoes, j where legislacoes.created_at >= j.ini and legislacoes.created_at < j.fim
> union all select 'campanhas', count(*) from campanhas, j where campanhas.created_at >= j.ini and campanhas.created_at < j.fim;
> ```
> Tudo zero → a troca não muda nada para ninguém.

**Mudança proposta (só esse arquivo):**
- Usar `getAuthUser()` de `api-helpers.ts` (só **importar**; o arquivo não é alterado), que já usa `getClaims()`.
- Incluir `created_at` no `select` de `profiles` e devolver esse valor no lugar de `user.created_at`.
- Mantém a resposta igual: mesmo formato JSON e `401` com `null` quando não há login.

**Diferença de comportamento:** a mesma já aceita na Rodada 2. Login desativado continua abrindo o sistema por até ~1 h (até o token vencer). Login excluído é recusado na hora.

**Ganho esperado:** −1 chamada ao Auth do Supabase por abertura/F5 de cada usuário (~300 ms a menos antes da primeira tela).

---

## B. `app/dashboard/DashboardSidebar.tsx` (linhas 331–342) — um recarregamento só

**Hoje:** o mesmo `loadData()` está ligado a dois eventos: `visibilitychange` (documento) e `focus` (janela).
- Ao **voltar** para a aba, os dois disparam → `loadData()` roda **2 vezes**.
- O `visibilitychange` também dispara ao **sair** da aba (o handler não confere se ficou visível) → mais 1 recarregamento, com a aba escondida.
- `loadData()` faz 4–5 consultas (Revisão BSA, aniversários, `/api/pdi/proxima-conversa`, `/api/lembretes`, `/api/lembretes/equipe-hoje`).
- **Resultado: cada ida e volta da aba gera ~3 recarregamentos ≈ 12–15 consultas.** O certo seria 1 recarregamento (4–5 consultas).

**Mudança proposta:** os dois eventos chamam **um handler só**, que:
1. ignora o evento se a aba não está visível (acaba o recarregamento ao sair);
2. ignora se já recarregou há menos de 2 s (quando os dois eventos chegam juntos, só o primeiro vale).

Assim continua atualizando também ao voltar de outro programa (Outlook → navegador), caso que só o `focus` cobre. A outra opção seria deixar só o `visibilitychange`, que é mais simples mas perde esse caso. **Recomendo a primeira.**

**Sem mudança visual.** Só esse `useEffect` é tocado.

**Não toco (fora do escopo, só registro):** o recarregamento de 5 min da linha 324 roda mesmo com a aba escondida. Os outros dois listeners do arquivo (observações pendentes, linha 541; designação, linha 571) já conferem a visibilidade e não duplicam.

---

## C. `listUsers` — helper único com cache de 2 minutos

**Hoje:** são 10 rotas, e cada chamada de cada uma consulta o Auth do Supabase (`listUsers`) para tirar logins desativados das listas.

| Rota | Como faz hoje |
|---|---|
| `app/api/aniversarios/route.ts` | `getActiveProfileIds` (lista de **ativos**) |
| `app/api/campanhas/usuarios/route.ts` | idem |
| `app/api/designacao-reprovados/usuarios/route.ts` | idem |
| `app/api/ferias/usuarios/route.ts` | idem |
| `app/api/legislacoes/usuarios/route.ts` | idem |
| `app/api/lembretes/usuarios/route.ts` | idem |
| `app/api/observacoes/usuarios/route.ts` | idem |
| `app/api/pdi/colaboradores/route.ts` | idem |
| `app/api/usuarios/route.ts` | idem |
| `app/api/atas/[id]/leituras/route.ts` | `listUsers` direto na rota (lista de **desativados**) |
| `app/api/atas-contratantes/[id]/leituras/route.ts` | idem |

(Contando as duas de atas, são 11 arquivos; as duas de atas são cópias uma da outra. `app/api/admin/users/route.ts` também chama `listUsers`, mas **fica de fora**: é a tela que desativa e reativa logins e precisa ver o estado real na hora.)

### Conflito com o escopo
O helper atual (`getActiveProfileIds`) mora em `api-helpers.ts`, que está **fora** desta rodada. **Proposta:** criar um arquivo novo, `app/lib/usuarios-desativados.ts`, e fazer as rotas importarem dele. `api-helpers.ts` fica intocado; o `getActiveProfileIds` antigo continua lá, sem uso, para ser removido numa rodada em que esse arquivo esteja liberado.

### Decisão 1 — guardar no cache os **desativados** em vez dos **ativos** (recomendado)
Se o cache guardar a lista de **ativos**, um login **recém-criado** fica até 2 min sem aparecer nas listas de seleção (responsável, colaborador etc.), porque ainda não está no cache. Guardando os **desativados**:
- login novo aparece na hora;
- só a **desativação/reativação** leva até 2 min para refletir nas listas.

Nas 9 rotas que usam ativos, a única mudança é o filtro: `ativos.has(p.id)` → `!desativados.has(p.id)`. As duas rotas de atas já usam esse formato.
Hoje não existe perfil sem login (a exclusão apaga os dois juntos, e os 17 perfis têm login), então o resultado das listas é o mesmo.

### Decisão 2 — se o Auth do Supabase falhar
- **Hoje, nas 9 rotas:** falha → lista de ativos vazia → **a lista inteira some** (seleção de responsável vazia etc.).
- **Hoje, nas 2 de atas:** falha → ninguém é tratado como desativado → lista completa.
- **Proposta:** padronizar como nas de atas (lista completa) e **não guardar a falha no cache**, para que a próxima chamada tente de novo. Risco: durante uma falha do Auth, um login desativado pode aparecer numa lista de seleção, o que é inofensivo.

### Detalhes do helper
- Cache em memória com validade de **2 min**.
- Chamadas simultâneas com o cache vencido compartilham a **mesma** consulta (não disparam várias).
- A regra de desativação é a mesma de hoje: `banned_until` no futuro.
- Ao desativar ou reativar alguém em Usuários, as listas levam até 2 min para refletir. Não limpo o cache na rota de admin, porque isso tocaria um arquivo fora das 10 rotas. Se quiser, entra como um 12º arquivo.

**Limite do ganho:** o cache vale por instância de função na Vercel. Com instâncias reaproveitadas (o normal com uso contínuo), quase toda chamada deixa de ir ao Auth. Numa instância nova (após ociosidade ou deploy), a 1ª chamada ainda consulta.

---

## Plano de execução (após aprovação)

1. `git status` → **checkpoint**: commit com este `OTIMIZACAO_RODADA3.md` (working tree limpo), informo o hash.
2. Commit **A** → `npm run build`.
3. Commit **B** → `npm run build`.
4. Commit **C** (helper novo + 11 rotas) → `npm run build`.
5. Commit de docs: bloco **"Rodada 3"** em `LOGS_TESTES.md` (o que mudou, testes, como desfazer).
6. **Sem push.** Paro e informo os hashes.

## Testes que vão para o LOGS_TESTES.md
- **A:** abrir o sistema e dar F5 → nome, módulos e papel corretos. Colaborador com ata, legislação ou campanha pendente continua vendo o aviso. No Network, `auth/v1/user` não aparece mais na abertura.
- **B:** no dashboard, trocar de aba e voltar → no Network, `/api/lembretes` aparece **1 vez** (antes, 2–3). Alt-tab de outro programa também atualiza.
- **C:** abrir as listas de seleção (Lembretes, Observações, Férias, Campanhas, Legislações, Designação, PDI, Aniversários, "quem não leu" das atas) → mesmas pessoas de antes, sem desativados. Criar um login novo → aparece na hora. Desativar alguém → some em até 2 min.

## Preciso da sua aprovação em
1. **A:** seguir com `profiles.created_at` (com ou sem rodar antes a consulta SQL acima)?
2. **B:** handler único com os dois eventos (recomendado) ou só `visibilitychange`?
3. **C:** arquivo novo em vez de mexer em `api-helpers.ts`? Cache de **desativados** (recomendado)? Lista completa em caso de falha do Auth (recomendado)? Limpar o cache na rota de admin (12º arquivo) ou não?
