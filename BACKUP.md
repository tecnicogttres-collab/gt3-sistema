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

Todas. Desde 2026-10-21 o script lê a lista de tabelas direto do Supabase (endpoint
REST /rest/v1/), então tabelas novas entram no backup sem precisar editar nada.
Também entram as contas de login (auth.users, sem senhas) e os arquivos de todos os
buckets do Storage.
