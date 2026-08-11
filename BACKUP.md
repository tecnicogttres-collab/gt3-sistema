# Backup do Supabase — GT3 Sistema

O plano gratuito do Supabase não possui backup automático nativo.
Este script faz o backup completo de todas as tabelas localmente.

## Como rodar manualmente

```bash
npm run backup
```

O script irá:
1. Conectar ao Supabase usando o `service_role` (lê `.env.local`)
2. Fazer `SELECT *` de todas as 32 tabelas do projeto
3. Salvar cada tabela como `backups/YYYY-MM-DD/<tabela>.json`
4. Compactar tudo em `backups/backup-YYYY-MM-DD.zip`
5. Exibir um resumo no console

## Onde os backups ficam

```
backups/
├── 2026-06-25/
│   ├── aniversarios.json
│   ├── atas.json
│   ├── contratantes.json
│   └── ... (32 arquivos .json)
└── backup-2026-06-25.zip   ← arquivo final compactado
```

A pasta `backups/` está no `.gitignore` e **não é enviada ao GitHub** (contém dados dos usuários).

## Recomendação de frequência

**1x por semana**, preferencialmente às sextas-feiras antes de fechar o expediente.

## Como restaurar um backup

Em caso de perda de dados, siga estes passos:

### 1. Acesse o Supabase SQL Editor

Entre em [supabase.com](https://supabase.com) → seu projeto → **SQL Editor**.

### 2. Leia o arquivo JSON da tabela desejada

Abra o arquivo `backups/YYYY-MM-DD/<nome-tabela>.json` em qualquer editor de texto.

### 3. Restaure os registros

Para cada tabela, execute um `INSERT` ou use o **Table Editor** do Supabase para importar via CSV.

**Opção A — via SQL (rápido para tabelas pequenas):**
```sql
-- Exemplo: restaurar a tabela 'frases'
INSERT INTO frases (id, texto, autor, categoria)
VALUES
  ('uuid-aqui', 'Texto da frase', 'Autor', 'categoria'),
  ...;
```

**Opção B — via Table Editor (sem SQL):**
1. Supabase → Table Editor → selecione a tabela
2. Clique em **Insert rows** → cole os dados do JSON

**Opção C — via script Node.js:**
```js
const { createClient } = require('@supabase/supabase-js')
const data = require('./backups/2026-06-25/frases.json')
const supabase = createClient(URL, SERVICE_KEY)
await supabase.from('frases').upsert(data)
```

### Atenção

- Sempre use `UPSERT` (não `INSERT`) para evitar duplicatas se a tabela já tiver dados
- Respeite a ordem de inserção quando houver chaves estrangeiras (ex.: categorias antes de documentos)
- A tabela `email_templates` pode conter arquivos `.msg` em base64 — o JSON pode ser grande

## Tabelas incluídas no backup

Lista atualizada em 2026-08-11 (61 tabelas). Ao criar uma tabela nova em qualquer
módulo, adicione o nome também em `TABLES` no `scripts/backup-supabase.ts`.

| # | Tabela | Descrição |
|---|--------|-----------|
| 1 | `aniversarios` | Aniversários dos colaboradores |
| 2 | `anotacoes_cic` | Concessões/exceções de contratantes por feira |
| 3 | `atas` | Atas internas GT3 |
| 4 | `atas_contratantes` | Atas de reunião com contratantes |
| 5 | `atas_contratantes_clientes_arquivados` | Clientes arquivados em Atas Contratantes |
| 6 | `atas_contratantes_leituras` | Confirmações de leitura de atas de contratantes |
| 7 | `atas_contratantes_notificacoes` | Notificações enviadas sobre atas de contratantes |
| 8 | `atas_leituras` | Confirmações de leitura de atas GT3 |
| 9 | `banco_empresas_cic` | Nomes de empresas para autocomplete em Anotações CIC |
| 10 | `caf_itens` | Itens do módulo Coisas a Fazer |
| 11 | `caf_modulos` | Módulos/pastas do Coisas a Fazer |
| 12 | `cafe_sheets` | Escala semanal do módulo Café |
| 13 | `contratantes` | Fichas das empresas contratantes |
| 14 | `contratantes_favs` | Favoritos do módulo contratantes |
| 15 | `controle_revisao_sheets` | Controle de revisão de documentos (BSA) |
| 16 | `dashboard_prefs` | Ordenação dos cards do Dashboard, por usuário |
| 17 | `email_templates` | Templates de e-mail padrão |
| 18 | `enquete_opcoes` | Opções das enquetes |
| 19 | `enquete_perguntas` | Perguntas das enquetes |
| 20 | `enquete_respostas` | Respostas às enquetes |
| 21 | `enquetes` | Enquetes internas |
| 22 | `ferias` | Controle de férias |
| 23 | `ferias_pessoas` | Pessoas no controle de férias |
| 24 | `frases` | Frases diárias motivacionais |
| 25 | `frases_rotacao` | Rotação de frases exibidas |
| 26 | `home_office_sheets` | Controle de home office |
| 27 | `legislacoes` | Atualizações normativas |
| 28 | `legislacoes_categorias` | Categorias de legislações |
| 29 | `legislacoes_lidas` | Confirmações de leitura de legislações |
| 30 | `lembretes` | Lembretes do sistema |
| 31 | `lembretes_historico` | Histórico de confirmações de lembretes |
| 32 | `manuais_categorias` | Categorias dos manuais |
| 33 | `manuais_documentos` | Documentos de manuais |
| 34 | `modulos_config` | Nome/cor personalizados por módulo |
| 35 | `notificacoes_config` | Configuração de notificações por módulo |
| 36 | `notificacoes_usuario` | Notificações pendentes por usuário |
| 37 | `observacoes` | Observações de funcionários |
| 38 | `observacoes_layout` | Configurações de layout de observações |
| 39 | `observacoes_subtabs` | Sub-abas do módulo observações |
| 40 | `pdi_acoes` | Ações dos PDIs |
| 41 | `pdi_ciclos` | Ciclos de PDI |
| 42 | `pdi_notificacoes` | Notificações de PDI |
| 43 | `pdi_rascunhos` | Rascunhos de conversa de PDI |
| 44 | `pdis` | PDIs (Planos de Desenvolvimento Individual) |
| 45 | `pgr_arquivos` | Arquivos do módulo PGR/PCMSO/LTCAT |
| 46 | `prioridades` | Prioridades do sistema |
| 47 | `prioridades_avisos` | Avisos de prioridades |
| 48 | `prioridades_vistas` | Prioridades visualizadas |
| 49 | `profiles` | Usuários, papéis e permissões |
| 50 | `ramais` | Lista de ramais telefônicos |
| 51 | `repositorio_modelos` | Arquivos modelo por contratante |
| 52 | `revisao_nr_registros` | Registros do controle de revisão (NR) |
| 53 | `revisoes_datas` | Datas de revisão de documentos |
| 54 | `revisoes_docs` | Checklists de revisão de documentos |
| 55 | `revisoes_documentos` | Registros de revisão de documentos |
| 56 | `revisoes_trainee` | Revisões de trainees |
| 57 | `sugestoes` | Caixa de sugestões anônimas |
| 58 | `terceiras` | Cadastro de empresas terceiras |
| 59 | `terceiras_contratantes` | Vínculo terceiras × contratantes |
| 60 | `terceiras_historico` | Histórico de etapas do cadastro de terceiras |

**Nota:** `dashboard_prefs` só será incluída de fato no backup depois que o SQL
`supabase-dashboard-prefs.sql` for executado no Supabase — até lá o backup
registra um erro esperado para essa tabela e segue normalmente com as demais.
