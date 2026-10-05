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
