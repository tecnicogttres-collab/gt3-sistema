/**
 * GT3 Sistema — Backup Supabase
 * Uso: npm run backup
 *
 * Lê .env.local, faz SELECT * de todas as tabelas via service_role,
 * salva cada tabela como JSON em backups/YYYY-MM-DD/
 * e compacta em backups/backup-YYYY-MM-DD.zip.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

// ── Carrega .env.local manualmente (não é carregado fora do Next.js) ──────────
function loadEnvLocal() {
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      // Remove aspas opcionais
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // .env.local não encontrado — assume que as variáveis já estão no ambiente
  }
}

loadEnvLocal()

// ── Lista explícita de todas as tabelas do projeto ────────────────────────────
const TABLES = [
  'aniversarios',
  'atas',
  'atas_leituras',
  'caf_itens',
  'caf_modulos',
  'contratantes',
  'contratantes_favs',
  'controle_revisao_sheets',
  'email_templates',
  'ferias',
  'ferias_pessoas',
  'frases',
  'frases_rotacao',
  'home_office_sheets',
  'lembretes',
  'lembretes_confirmacoes',
  'lembretes_historico',
  'manuais_categorias',
  'manuais_documentos',
  'observacoes',
  'observacoes_layout',
  'pdi_acoes',
  'pdi_ciclos',
  'pdi_conversa_avisos',
  'pdi_notificacoes',
  'pdis',
  'prioridades',
  'prioridades_avisos',
  'prioridades_vistas',
  'ramais',
  'revisoes_datas',
  'revisoes_trainee',
] as const

type TableName = (typeof TABLES)[number]
type RowSummary = { table: TableName; rows: number; status: 'ok' | 'erro'; error?: string }

// ── Formata bytes de forma legível ────────────────────────────────────────────
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    console.error('\n❌  Variáveis de ambiente não encontradas.')
    console.error('    NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar em .env.local\n')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const backupDir = join(process.cwd(), 'backups', today)
  const zipPath = join(process.cwd(), 'backups', `backup-${today}.zip`)

  mkdirSync(backupDir, { recursive: true })

  const startTime = Date.now()
  console.log(`\n${'═'.repeat(52)}`)
  console.log(`  🗄️   GT3 Sistema — Backup Supabase`)
  console.log(`${'═'.repeat(52)}`)
  console.log(`  📅  Data:    ${today}`)
  console.log(`  📁  Destino: backups/${today}/`)
  console.log(`${'─'.repeat(52)}\n`)

  const summary: RowSummary[] = []

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')

    if (error) {
      summary.push({ table, rows: 0, status: 'erro', error: error.message })
      console.log(`  ✗  ${table.padEnd(35)} ERRO: ${error.message}`)
      continue
    }

    const rows = data ?? []
    const filePath = join(backupDir, `${table}.json`)
    writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8')

    summary.push({ table, rows: rows.length, status: 'ok' })
    console.log(`  ✓  ${table.padEnd(35)} ${String(rows.length).padStart(4)} registros`)
  }

  // ── Compacta em .zip via PowerShell (nativo no Windows) ──────────────────
  console.log(`\n  📦  Compactando...`)
  try {
    execSync(
      `Compress-Archive -Path "${backupDir}" -DestinationPath "${zipPath}" -Force`,
      { shell: 'powershell.exe', stdio: 'pipe' }
    )
  } catch {
    // Fallback: tenta com o comando zip do Unix se disponível
    try {
      execSync(`zip -r "${zipPath}" "${backupDir}"`, { stdio: 'pipe' })
    } catch (e2) {
      console.warn('  ⚠️   Não foi possível criar o .zip — os arquivos JSON estão disponíveis na pasta.')
      console.warn('       Instale PowerShell ou zip para habilitar a compactação.')
    }
  }

  // ── Resumo final ──────────────────────────────────────────────────────────
  const totalRows = summary.reduce((s, r) => s + r.rows, 0)
  const ok = summary.filter(r => r.status === 'ok').length
  const errs = summary.filter(r => r.status === 'erro')
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  let zipSize = '—'
  try { zipSize = fmtSize(statSync(zipPath).size) } catch {}

  console.log(`\n${'─'.repeat(52)}`)
  console.log(`  📊  Resumo do backup`)
  console.log(`${'─'.repeat(52)}`)
  console.log(`  Tabelas com sucesso: ${ok}/${TABLES.length}`)
  console.log(`  Total de registros:  ${totalRows.toLocaleString('pt-BR')}`)
  console.log(`  Arquivo ZIP:         backups/backup-${today}.zip (${zipSize})`)
  console.log(`  Tempo:               ${elapsed}s`)

  if (errs.length > 0) {
    console.log(`\n  ⚠️   ${errs.length} tabela(s) com erro:`)
    for (const e of errs) console.log(`       - ${e.table}: ${e.error}`)
  }

  console.log(errs.length === 0
    ? `\n  ✅  Backup concluído com sucesso!\n`
    : `\n  ⚠️   Backup concluído com ${errs.length} erro(s).\n`
  )
  console.log(`${'═'.repeat(52)}\n`)
}

main().catch(err => {
  console.error('\n❌  Erro fatal:', err)
  process.exit(1)
})
