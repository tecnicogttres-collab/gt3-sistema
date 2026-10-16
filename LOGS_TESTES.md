# Roteiro de testes — Rodada 1 da redução de logs

Fazer **localmente** (`npm run dev`) antes do push. Ponto de retorno: commit **`9e2cf72`**.

## O que mudou (Rodada 1)
| Commit | Mudança |
|--------|---------|
| `18f8022` | Dashboard: consulta periódica da Designação de Reprovados de 20 s → 3 min |
| `d882520` | Navegador: `getSession()` (local) em ModulesContext e DashboardSidebar; perfil só recarrega se o usuário mudar |
| `16391c7` | AppShell: atas/legislações só recarregam ao sair de `/atas` ou `/legislacoes` |
| `a93ecb8` | Dashboard: consulta periódica de observações pendentes de 60 s → 5 min |

`proxy.ts` e `api-helpers.ts` **não foram alterados** (ficam para a Rodada 2).

## 1. Login e logout (repetir com admin, gestor, colaborador e trainee)
- [ ] Login funciona e cai no dashboard com o nome certo na saudação.
- [ ] Logout leva para `/login`; voltar com o botão do navegador **não** mostra o sistema.
- [ ] Logar com **outro** perfil logo depois (sem recarregar a página) mostra o perfil/módulos do novo usuário, não os do anterior.

## 2. Navegação
- [ ] Navegar por todos os módulos do menu sem ser deslogado e sem redirecionamento em loop.
- [ ] Voltar ao dashboard: Lembretes, Prioridades, Revisão BSA e Designação de Reprovados continuam aparecendo.
- [ ] Deixar a aba em segundo plano 2–3 min, voltar: tudo continua carregado e nenhum erro aparece.

## 3. Permissões
- [ ] Colaborador/trainee **não** acessa Usuários e demais módulos restritos (por URL direta também).
- [ ] Gestor/admin continuam vendo "Observações a validar" e a agenda PDI.
- [ ] Troca de papel de teste (se usar o override de papel) continua funcionando.

## 4. Notificações / tempo real
- [ ] Com dois navegadores (ex.: admin e colaborador): criar uma **prioridade** → o aviso chega ao outro na hora.
- [ ] Validar/publicar uma **ata** → colaborador recebe o aviso.
- [ ] Criar/editar uma **observação** com um gestor no dashboard → "Observações a validar" atualiza sozinho (realtime, sem esperar 5 min).
- [ ] Criar uma **designação de reprovados** → aparece no dashboard do responsável na hora (realtime; o polling agora é só reserva de 3 min).
- [ ] Agendar uma **conversa PDI** para um colaborador → aparece no dashboard dele sem recarregar.
- [ ] Módulos: renomear/recolorir um módulo em Usuários/Configuração → atualiza no outro navegador.

## 5. Atas e legislações (mudança do AppShell)
- [ ] Colaborador com ata não lida: abre `/atas`, lê → ao **sair** da tela o aviso/contador some.
- [ ] Colaborador com legislação pendente: abre `/legislacoes`, confirma leitura → ao sair, o aviso "aguardam confirmação" some.
- [ ] Ao abrir o sistema (F5) os avisos pendentes continuam aparecendo.

## 6. Sessão expirada
- [ ] Fechar o navegador, reabrir depois de um tempo (ideal: > 1 h) → ou continua logado, ou vai para `/login` **uma vez**, sem loop.
- [ ] Apagar os cookies do site com o sistema aberto e navegar para outra tela → redireciona para `/login`.

## 7. Conferir a redução (opcional, mas é o que importa)
- [ ] No DevTools → aba Network → filtrar por `designacao-reprovados/pendentes`: deve haver 1 chamada na abertura e a seguinte só ~3 min depois (antes, a cada 20 s).
- [ ] Filtrar por `auth/v1/user`: na abertura do dashboard devem aparecer **menos** chamadas do que antes (o `getUser` do navegador caiu de 3 para 1).
- [ ] Trocar de tela (fora de atas/legislações): não deve mais disparar `/api/legislacoes` nem `/api/atas`.

## Como desfazer
Voltar tudo ao ponto de retorno (descarta as 4 mudanças da Rodada 1 no seu working tree; faz **só** se não houver outro trabalho não commitado que queira manter):

```
git reset --hard 9e2cf72
```

Desfazer **uma** correção específica, mantendo as outras (mais seguro):

```
git revert a93ecb8   # observações 5 min
git revert 16391c7   # AppShell atas/legislações
git revert d882520   # sessão única no navegador
git revert 18f8022   # designação 3 min
```

Se algo quebrar em **produção**: Vercel → projeto → aba **Deployments** → deployment anterior → **Instant Rollback**.

## Lembrete
Só faça o `git push` depois que todos os testes acima passarem, e de preferência **fora do horário de uso da equipe**.

---

# Rodada 2 — checagem de login com `getClaims()`

Pré-requisito confirmado: o projeto Supabase usa chave de assinatura **ECC (P-256)** (Project Settings → JWT Keys). Ponto de retorno: commit **`4c14ce2`**.

## O que mudou
| Commit | Mudança |
|--------|---------|
| `fef906d` | `proxy.ts` (porteiro das páginas): `getUser()` → `getClaims()` |
| `a662374` | `api-helpers.ts` (`getCaller`, `getCallerWithNome`, `getAuthUser`): `getClaims()`; quem não tem perfil é recusado |
| `577dbc1` | Lote 1 — rotas de Atas e Atas de contratantes passam a usar `getAuthUser` |
| `a3ec05d` | Lote 2 — rotas e páginas de PDI |
| `7e20a53` | Lote 3 — revisões, terceiras, lembretes, enquetes, observações, notificações, coisas a fazer, sugestões, e-mails, usuários |

Antes: cada página e cada chamada de `/api/*` consultava o Auth do Supabase (`GET /auth/v1/user`). Agora o token é validado no servidor com a chave pública; o Supabase só é consultado quando o token precisa ser renovado (~1 vez por hora).

**Ficaram de fora de propósito:** `app/api/admin/*` (criar/banir/excluir usuários — críticas e pouco usadas), `/api/me` (usa `created_at`, que não vem no token) e `UserContext.tsx` (navegador, tratado na Rodada 1).

**Diferença de comportamento conhecida:** usuário desativado em Usuários continua acessando por até ~1 h (até o token vencer). Antes o corte era imediato. Login excluído é recusado na hora (não tem mais perfil).

## Testes (com login — colaborador e gestor)
- [x] Login/logout, navegar pelos módulos sem cair no login nem entrar em loop (testes rápidos ok).
- [ ] Uma ação simples em cada módulo: ler ata, abrir PDI, listar revisões, abrir terceira, confirmar lembrete, abrir Coisas a fazer, editar observação, responder enquete.
- [ ] Colaborador continua sem acesso a Usuários e módulos restritos.
- [ ] Deixar o sistema aberto > 1 h → continua logado (token renovado sozinho).
- [ ] Apagar os cookies com o sistema aberto → vai para `/login`.
- [ ] DevTools → Network, filtrar `auth/v1/user`: ao navegar, quase nada deve aparecer.

Testes sem login já feitos: páginas redirecionam para `/login`, APIs devolvem 401 (inclusive com cookie falso), `/questionario/...` continua público, `npm run build` ok.

## Depois do deploy
- Primeiras horas: atenção a relatos de "deslogou sozinho" ou "não autenticado".
- No dia seguinte: comparar os logs de Auth do Supabase com os de antes (`GET /user` deve cair bastante).

## Como desfazer
Produção, na hora: Vercel → **Deployments** → deployment anterior → **Instant Rollback**.

No código, só um lote (se o problema for em um módulo):
```
git revert 7e20a53   # lote 3 (demais rotas)
git revert a3ec05d   # lote 2 (PDI)
git revert 577dbc1   # lote 1 (atas)
```

Rodada 2 inteira:
```
git revert 7e20a53 a3ec05d 577dbc1 a662374 fef906d
```

---

# Rodada 3 — menos idas ao Auth e ao banco

Investigação e decisões em `OTIMIZACAO_RODADA3.md`. Ponto de retorno (checkpoint): commit **`3d97ac2`**. **Sem push** até os testes abaixo passarem.

## O que mudou
| Commit | Mudança |
|--------|---------|
| `779effa` | **A** — `/api/me`: `getUser()` → `getClaims()` (via `getAuthUser`); a data de criação da conta passa a vir de `profiles.created_at` |
| `ea42f49` | **B** — Dashboard: um recarregamento só ao voltar para a aba (antes 2× ao voltar + 1× ao sair) |
| `762a99e` | **C** — `listUsers` por chamada → cache de 2 min dos logins **desativados** (`app/lib/usuarios-desativados.ts`) em 11 rotas |

**Conferido antes do A:** `profiles.created_at` é igual à data do login em 16 de 17 usuários. O único divergente (perfil criado 3 h 38 min depois) não tem nenhuma ata, legislação ou campanha nessa janela. Logo, nenhum aviso muda para ninguém.

**Ficaram de fora de propósito:** `api-helpers.ts` (o `getActiveProfileIds` antigo continua lá), `proxy.ts`, `app/api/admin/users` (precisa ver o estado real para desativar/reativar) e `app/lib/campanhas-destinatarios.ts` (também usa o helper antigo, sem cache; achado durante a execução, fora do escopo aprovado).

**Diferença de comportamento conhecida (C):** ao desativar ou reativar alguém em Usuários, as listas de seleção levam **até 2 min** para refletir. Login **novo** aparece na hora. Se o Auth do Supabase falhar, as listas mostram todo mundo, em vez de ficarem vazias como antes.

## Testes (com login — colaborador e gestor)
**A — `/api/me`**
- [ ] Abrir o sistema e dar F5 → nome na saudação, papel e módulos corretos.
- [ ] Colaborador com ata, legislação ou campanha pendente continua vendo o aviso.
- [ ] DevTools → Network, filtrar `auth/v1/user`: **1** chamada na abertura (a do `UserContext`, que já existia) e `/api/me` com 200. O `getUser` removido rodava no servidor, então não aparece no Network do navegador; a queda se confere nos logs de Auth do Supabase (ver "Depois do deploy").

**B — Dashboard**
- [ ] No dashboard, trocar de aba e voltar → Network, filtrar `/api/lembretes`: **1** chamada por volta (antes, 2–3).
- [ ] Sair da aba → nenhuma chamada nova enquanto ela está escondida.
- [ ] Alt-tab de outro programa (ex.: Outlook) com o navegador visível → também atualiza.
- [ ] Lembrete confirmado em outra aba some do dashboard ao voltar.

**C — listas de usuários**
- [ ] Listas de seleção continuam com as mesmas pessoas, sem desativados: Lembretes, Observações, Férias, Campanhas, Legislações, Designação de Reprovados, PDI (colaboradores), Aniversários e o "quem não leu" de Atas e Atas de contratantes.
- [ ] Criar um login novo → aparece nas listas na hora.
- [ ] Desativar alguém em Usuários → some das listas em até 2 min; reativar → volta em até 2 min.

`npm run build` ok após cada um dos três commits.

## Depois do deploy
- No dia seguinte: logs de Auth do Supabase. `GET /user` deve cair de novo (aberturas do sistema) e `GET /admin/users` deve cair bastante.

## Como desfazer
Produção, na hora: Vercel → **Deployments** → deployment anterior → **Instant Rollback**.

Um item só:
```
git revert 762a99e   # C — cache de desativados
git revert ea42f49   # B — dashboard
git revert 779effa   # A — /api/me
```

Rodada 3 inteira:
```
git revert 762a99e ea42f49 779effa
```

---

# Rodada 3 – item D — menos consultas com a aba em segundo plano

## O que mudou
- **D1 (`e2a5e14`)** — `app/dashboard/DashboardSidebar.tsx`: o intervalo de 5 min (prioridades + revisão/aniversários/PDI/lembretes) pula o ciclo com a aba escondida. O `aoVoltar` (trava de 2 s do item B) agora recarrega também as prioridades. O commit inclui o `OTIMIZACAO_RODADA3.md` com a investigação.
- **D2 etapa 1 (`88f91ca`)** — `DashboardSidebar.tsx` e `app/lembretes/LembretesClient.tsx`: os canais realtime que reconsultavam (revisão/lembretes, observações pendentes, designações pendentes, Lembretes) ignoram eventos com a aba escondida.
  - Não foi preciso flag de "sujo": os dois já recarregam sempre ao voltar para a aba.
  - No Dashboard, a única recarga de `loadData` ao voltar é a do `aoVoltar`, com a trava de 2 s. A volta gera **uma** recarga só, mesmo com eventos acumulados.
  - Os pop-ups globais do AppShell (prioridades, atas, enquetes, sugestões) **não foram alterados**.
  - Fica para a etapa 2: os demais módulos da tabela D2.
- **D4 (`f597a4a`)** — `app/pdi/PdiListClient.tsx`: a recarga por `focus` dos cards de PDI ganhou trava de 2 s e só roda com a aba visível.

## Testes (com login — colaborador e gestor)
- [ ] **Aba escondida e volta:** abrir o Dashboard, DevTools → Network com "Preserve log". Trocar para outra aba do navegador por 6+ min (passa um ciclo do intervalo de 5 min). Durante esse tempo, **nenhuma** chamada a `/api/lembretes` ou `prioridades`. Ao voltar: `/api/lembretes`, `prioridades` etc. aparecem **1 vez**.
- [ ] **Eventos realtime com a aba escondida → 1 recarga só:** com o Dashboard numa aba escondida, outra pessoa (ou outro navegador) cria/confirma/exclui 2–3 lembretes. Com a aba escondida, nenhuma chamada nova. Ao voltar, `/api/lembretes` aparece **1 vez** no Network.
- [ ] **Lembrete confirmado por outra pessoa aparece ao voltar:** no cenário acima, ao voltar, o lembrete confirmado some/atualiza no Dashboard e na tela de Lembretes, sem F5.
- [ ] **Pop-up de prioridade com a aba escondida:** com o sistema numa aba escondida, outra pessoa cria um aviso de prioridade. Ao voltar, o pop-up já está na tela (chegou pelo realtime do AppShell, sem esperar a volta).
- [ ] **Com a aba visível nada muda:** lembrete confirmado por outra pessoa com o Dashboard na tela atualiza na hora, como antes.
- [ ] **PDI:** na lista de PDI, alt-tab várias vezes seguidas → cada card refaz `/api/pdi/<id>/ciclos` no máximo 1 vez a cada 2 s.

`npm run build` ok após cada um dos três commits.

## Como desfazer
Produção, na hora: Vercel → **Deployments** → deployment anterior → **Instant Rollback**.

Um item só:
```
git revert f597a4a   # D4 — PDI
git revert 88f91ca   # D2 etapa 1 — realtime Dashboard/Lembretes
git revert e2a5e14   # D1 — intervalo do Dashboard (também desfaz o OTIMIZACAO_RODADA3.md)
```

Item D inteiro:
```
git revert f597a4a 88f91ca e2a5e14
```
