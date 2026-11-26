# PROMPT PARA O CLAUDE CODE (VS Code) — Importar retorno do Claude no Workflow Programas

Cole tudo abaixo da linha no Claude Code, dentro da pasta do projeto `gt3-sistema`.
Antes, coloque na raiz do projeto (ou em `docs/depara/`) os dois arquivos que acompanham este prompt:
- `exemplo_depara_brfibra_volare.json` (exemplo real de retorno)
- `depara.schema.json` (formato aceito)

---

## Contexto

O GT3 Sistema (Next.js App Router, TypeScript, Tailwind, Supabase, deploy na Vercel) tem o módulo **Workflow Programas**: um checklist manual de análise de PGR/PCMSO/LTCAT por contratante, em que o analista marca "bolinhas" (radio buttons) item a item, itens iguais entre checklists aparecem uma vez só, itens específicos de cada contratante aparecem separados, e o sistema gera o parecer/texto de reprovação.

Hoje o analista marca tudo na mão. Quero acelerar assim:
1. O analista envia os PDFs para o Claude (fora do sistema).
2. O Claude devolve um **JSON pronto** (formato `gt3.checklist.depara`, versão 1.0).
3. O analista **cola o JSON no sistema** e o sistema **preenche as bolinhas sozinho**.

Os PDFs NÃO entram no sistema. O sistema só recebe o JSON colado. Nada de chamada a API de IA, nada de upload de PDF.

## Tarefa

Criar a funcionalidade **"Importar retorno do Claude"** dentro do Workflow Programas.

### 0. Antes de codar
- Explore o projeto: ache o componente do Workflow Programas, como o checklist é montado, onde as respostas são guardadas (estado local, tabelas do Supabase), como funciona a condição "Aparece quando" (item que só aparece se outro item tem certa resposta), como itens de múltipla escolha (ex.: Treinamentos) são guardados e como o parecer é gerado.
- Reaproveite o que já existe. Não crie tabelas novas se as atuais servirem. Se precisar de coluna ou tabela, gere o SQL em arquivo separado, com `GRANT` explícito, como nos outros módulos.
- Me mostre um plano curto (arquivos que vai criar/alterar) e siga em frente sem esperar aprovação, a menos que encontre algo que mude a arquitetura.

### 1. Interface
- Botão **"Importar retorno do Claude"** na tela do checklist de uma análise (visível para admin e gestor; veja quem usa o módulo hoje e mantenha a mesma regra de acesso).
- Abre um painel/modal com uma caixa de texto grande ("Cole aqui o JSON") e o botão **Ler retorno**.
- Visual do sistema: azul `#2A4F96`, dourado `#D1AE6E`, fundo `#F4F6FA`, aparência clara e limpa. Textos em português.

### 2. Validação (ao clicar em Ler retorno)
- JSON inválido: mensagem clara com a posição do erro. Aceite JSON colado dentro de bloco de código markdown (```json ... ```): tire as cercas antes de ler.
- `formato` precisa ser `gt3.checklist.depara` e `versao` `1.0`; caso contrário, avise a versão encontrada.
- **CNPJ:** compare `empresa.cnpj` (só dígitos) com o CNPJ da empresa da análise aberta. Se divergir, bloqueie com aviso vermelho e só deixe seguir se o usuário marcar "Aplicar mesmo assim".
- **Checklists:** compare `checklists` do JSON com os checklists selecionados na análise. Se faltar algum, avise (itens do checklist que não estão no JSON ficam como estão).

### 3. Casamento (De-Para)
- Cada item de `respostas[]` casa com um item do checklist pelo par **`documento` + `item`**. Compare normalizando: sem acento, minúsculas, espaços e traços repetidos colapsados. Mantenha o texto exato do item do sistema como verdade.
- Não achou o par: vai para a lista **"Itens do JSON sem correspondência"**, sem quebrar o resto.
- Item do checklist que não veio no JSON: continua como está.
- `resposta` (texto da bolinha) deve ser igual a uma das opções daquele item (compare normalizado, por exemplo "Reprovação" = "reprovacao"). Se a opção não existir no item, não aplique e liste em **"Respostas inválidas"**.
- Itens de múltipla escolha (`valores[]`, ex.: Treinamentos): marque as opções correspondentes; as que não existirem vão para "Respostas inválidas".
- Itens com `resposta: null` e `origem: "pendente"` ficam sem marcar e entram em **"Pendentes para conferir manualmente"**.
- `visivel: false` no JSON: ignore a resposta (a condição "Aparece quando" não vale). Depois de aplicar, o sistema deve **reavaliar as condições "Aparece quando"** com as respostas novas, porque marcar um item pode fazer outro aparecer (por exemplo, "Local de assinatura - reprovação" aparece quando a assinatura é Reprovação). Se um item que apareceu tem resposta no JSON, aplique também (repita até estabilizar, com limite de 5 passadas).

### 4. Pré-visualização antes de aplicar (obrigatório)
Antes de gravar qualquer coisa, mostre uma tabela, no estilo dos outros módulos:

| Doc | Item | Resposta atual | Resposta do Claude | Páginas | Situação |

- **Situação:** Novo (vai preencher), Igual (já estava assim), Diferente (o analista já tinha marcado outra), Sem correspondência, Inválido, Pendente.
- Linhas "Diferente" vêm **desmarcadas**; o analista escolhe se sobrescreve (checkbox por linha e "marcar todas"). Resposta que o analista marcou manualmente nunca é sobrescrita sem esse aceite.
- Mostre `paginas` como pequenos quadradinhos (badges) e a `evidencia` ao passar o mouse ou numa linha expandida.
- Filtros: Todos / Reprovações / Diferentes / Pendentes.
- Contadores no topo: quantos itens serão preenchidos, quantos reprovações, quantos pendentes.
- Botão **Aplicar** e botão **Cancelar**.

### 5. Aplicar
- Ao aplicar, preencher as bolinhas na tela do checklist e gravar da mesma forma que o sistema já grava quando o analista marca na mão (não invente um segundo caminho de gravação).
- Marque cada resposta preenchida pelo import com uma marca discreta ("preenchido pelo Claude") e guarde `paginas` e `evidencia` junto, se o modelo de dados permitir, para o analista ver de onde veio. Se editar a bolinha depois, a marca some e a origem passa a ser `usuario`.
- Textos de reprovação: o JSON traz `reprovacoes.PGR`, `reprovacoes.PCMSO`, `reprovacoes.LTCAT` já prontos ("dd/mm/aaaa hh:mm - Favor rever..."). Se o sistema gera o parecer a partir das bolinhas, **prefira o texto do sistema**, e ofereça o texto do JSON como sugestão copiável ("Copiar texto do Claude"). Se o sistema tem um campo de parecer livre, preencha com o texto do JSON, sem apagar texto que o analista já escreveu (pergunte se substitui ou acrescenta).
- `orientacoes[]` e `observacoes[]`: mostre num bloco "Orientações do Claude" (copiável) na tela; não entram no texto de reprovação.
- `funcoes[]` (divergências de funções PGR × PCMSO): mostre numa tabela recolhível "Funções com divergência", com as páginas.

### 6. Pós-aplicação
- Toast "N itens preenchidos, M reprovações, K pendentes".
- Role/destaque para o primeiro item pendente ou reprovado.
- Opcional, se for barato: registrar no banco quem importou, quando, e o JSON bruto (para auditoria). Sem os PDFs.

## Regras do formato (resumo do `depara.schema.json`)

```
formato: "gt3.checklist.depara", versao: "1.0", geradoEm, ferramenta
empresa: { razaoSocial, cnpj }
checklists: ["Volare", ...]               // nomes iguais aos do sistema
respostas[]: {
  documento: "PGR" | "PCMSO" | "LTCAT" | "GERAL",
  item: "nome exato do item",
  checklists: [...], escopo: "Base" | "Específico", critico: boolean,
  visivel: boolean,                        // false = condição "Aparece quando" não atendida
  resposta: "Conforme" | "Reprovação" | "Aprovado com restrição" | "Não aplicável" | "Página específica" | "Capa" | ... | null,
  valores: [..],                           // só nos itens de múltipla escolha
  origem: "automatica" | "usuario" | "pendente",
  paginas: [números de página do PDF],
  evidencia: "texto curto",
  motivo, textoReprovacao, textoNaoConforme   // só quando resposta = Reprovação
}
pendentes[]: { documento, item }
reprovacoes: { PGR, PCMSO, LTCAT }         // texto pronto
orientacoes[]: [texto], observacoes[]: [texto]
funcoes[]: { pgr, pcmso, situacao: "igual"|"so_pgr"|"so_pcmso", paginasPgr[], paginasPcmso[] }
```

Observações:
- O JSON pode ter `"Conforme*"` nas evidências, mas o campo `resposta` sempre usa o texto exato de uma bolinha.
- Itens críticos com Reprovação vão para o texto de reprovação; não críticos viram orientação (já vem separado em `reprovacoes` e `orientacoes`; não recalcule).

## Teste de aceitação

Use `exemplo_depara_brfibra_volare.json` (checklist Volare, 27 itens):
1. Abrir uma análise de empresa com CNPJ 73.972.002/0028-36 e checklist Volare. Colar o JSON, ver a pré-visualização com 16 itens a preencher, 6 pendentes (LTCAT e GERAL) e 6 itens em Reprovação (PGR: funções, aditivo de frente, psicossociais Marcopolo e psicossociais NR-01, que é não crítico e vira só orientação; PCMSO: funções e assinatura). Os 5 itens ocultos pela condição "Aparece quando" não entram na contagem.
2. Aplicar. Conferir que "Treinamentos" ficou com NR 10, NR10 - SEP, NR 18, NR 33 e NR 35 marcados.
3. Conferir que "Local de assinatura - reprovação" (PCMSO) apareceu e ficou em "Página específica", e que o equivalente do PGR continua escondido.
4. Colar de novo: tudo deve aparecer como "Igual", sem alterar nada.
5. Marcar uma bolinha na mão, colar de novo com outra resposta: deve aparecer como "Diferente" e desmarcada.
6. Colar com CNPJ de outra empresa: bloqueio com aviso.
7. Colar texto que não é JSON: erro claro.
8. `npm run build` sem erros de tipo.

## Restrições
- TypeScript estrito, sem `any` desnecessário; componentes pequenos; reaproveitar componentes existentes.
- Nenhum PDF ou conteúdo de documento sobe para o Supabase; só as respostas e o JSON de auditoria, se eu aprovar.
- Sem chamada a APIs externas de IA.
- Ao final: liste os arquivos alterados, rode o build, e faça o commit com mensagem clara (`feat(workflow-programas): importar retorno do Claude (De-Para JSON)`).
