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

| # | Tabela | Descrição |
|---|--------|-----------|
| 1 | `aniversarios` | Aniversários dos colaboradores |
| 2 | `atas` | Atas internas GT3 |
| 3 | `atas_leituras` | Confirmações de leitura de atas |
| 4 | `caf_itens` | Itens do módulo Coisas a Fazer |
| 5 | `caf_modulos` | Módulos/pastas do Coisas a Fazer |
| 6 | `contratantes` | Fichas das empresas contratantes |
| 7 | `contratantes_favs` | Favoritos do módulo contratantes |
| 8 | `controle_revisao_sheets` | Controle de revisão de documentos |
| 9 | `email_templates` | Templates de e-mail padrão |
| 10 | `ferias` | Controle de férias |
| 11 | `ferias_pessoas` | Pessoas no controle de férias |
| 12 | `frases` | Frases diárias motivacionais |
| 13 | `frases_rotacao` | Rotação de frases exibidas |
| 14 | `home_office_sheets` | Controle de home office |
| 15 | `lembretes` | Lembretes do sistema |
| 16 | `lembretes_confirmacoes` | Confirmações de lembretes |
| 17 | `lembretes_historico` | Histórico de lembretes enviados |
| 18 | `manuais_categorias` | Categorias dos manuais |
| 19 | `manuais_documentos` | Documentos de manuais |
| 20 | `observacoes` | Observações de funcionários |
| 21 | `observacoes_layout` | Configurações de layout de observações |
| 22 | `pdi_acoes` | Ações dos PDIs |
| 23 | `pdi_ciclos` | Ciclos de PDI |
| 24 | `pdi_conversa_avisos` | Avisos de conversa PDI |
| 25 | `pdi_notificacoes` | Notificações de PDI |
| 26 | `pdis` | PDIs (Planos de Desenvolvimento Individual) |
| 27 | `prioridades` | Prioridades do sistema |
| 28 | `prioridades_avisos` | Avisos de prioridades |
| 29 | `prioridades_vistas` | Prioridades visualizadas |
| 30 | `ramais` | Lista de ramais telefônicos |
| 31 | `revisoes_datas` | Datas de revisão de documentos |
| 32 | `revisoes_trainee` | Revisões de trainees |
