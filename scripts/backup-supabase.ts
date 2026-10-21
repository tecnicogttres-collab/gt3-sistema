/**
 * GT3 Sistema — Backup Supabase
 * Uso: npm run backup
 *
 * Lê .env.local, faz SELECT * de todas as tabelas via service_role (descobertas
 * automaticamente), baixa os usuários de login e todos os arquivos do Storage,
 * salva cada tabela como JSON em backups/YYYY-MM-DD/
 * e compacta em backups/backup-YYYY-MM-DD.zip.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync, statSync } from 'fs'
import { dirname } from 'path'
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

// ── Descobre as tabelas direto do schema (PostgREST /rest/v1/) ────────────────
// Antes era uma lista fixa e ficava desatualizada (em 2026-10-21 faltavam 19
// tabelas). Agora qualquer tabela nova entra no backup sozinha.
async function listTables(url: string, key: string): Promise<string[]> {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
  })
  if (!res.ok) throw new Error(`Não foi possível listar as tabelas: HTTP ${res.status}`)
  const spec = await res.json() as { definitions?: Record<string, unknown> }
  return Object.keys(spec.definitions ?? {}).sort()
}

type RowSummary = { table: string; rows: number; status: 'ok' | 'erro'; error?: string }

// O Supabase devolve no máximo 1000 linhas por SELECT — lê em páginas.
const PAGE = 1000
// Tabelas com conteúdo pesado (ex.: email_templates guarda .msg em base64) estouram
// o statement timeout em páginas grandes — nesse caso refaz com páginas pequenas.
async function fetchAll(supabase: SupabaseClient, table: string, size = PAGE): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + size - 1)
    if (error) {
      if (size > 1 && /timeout/i.test(error.message)) return fetchAll(supabase, table, Math.max(1, Math.floor(size / 10)))
      throw new Error(error.message)
    }
    rows.push(...(data ?? []))
    if (!data || data.length < size) return rows
  }
}

// Lista recursivamente todos os arquivos de um bucket.
async function listBucket(supabase: SupabaseClient, bucket: string, prefix = ''): Promise<string[]> {
  const files: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset })
    if (error) throw new Error(error.message)
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      // Pastas vêm sem id
      if (item.id === null) files.push(...await listBucket(supabase, bucket, path))
      else files.push(path)
    }
    if (!data || data.length < PAGE) return files
  }
}

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

  const tables = await listTables(url, key)

  for (const table of tables) {
    let rows: unknown[]
    try {
      rows = await fetchAll(supabase, table)
    } catch (e) {
      const message = (e as Error).message
      summary.push({ table, rows: 0, status: 'erro', error: message })
      console.log(`  ✗  ${table.padEnd(35)} ERRO: ${message}`)
      continue
    }

    const filePath = join(backupDir, `${table}.json`)
    writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8')

    summary.push({ table, rows: rows.length, status: 'ok' })
    console.log(`  ✓  ${table.padEnd(35)} ${String(rows.length).padStart(4)} registros`)
  }

  // ── Contas de login (auth.users) — sem senhas, só cadastro ────────────────
  const authUsers: unknown[] = []
  try {
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE })
      if (error) throw new Error(error.message)
      authUsers.push(...data.users)
      if (data.users.length < PAGE) break
    }
    writeFileSync(join(backupDir, '_auth_users.json'), JSON.stringify(authUsers, null, 2), 'utf-8')
    console.log(`  ✓  ${'(auth) usuários de login'.padEnd(35)} ${String(authUsers.length).padStart(4)} registros`)
  } catch (e) {
    summary.push({ table: '_auth_users', rows: 0, status: 'erro', error: (e as Error).message })
    console.log(`  ✗  ${'(auth) usuários de login'.padEnd(35)} ERRO: ${(e as Error).message}`)
  }

  // ── Arquivos do Storage (anexos, imagens, PDFs) ────────────────────────────
  console.log(`\n  📎  Arquivos do Storage`)
  let storageFiles = 0
  let storageBytes = 0
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets()
  if (bucketsErr) {
    summary.push({ table: '_storage', rows: 0, status: 'erro', error: bucketsErr.message })
    console.log(`  ✗  Storage: ERRO ao listar buckets: ${bucketsErr.message}`)
  }
  for (const bucket of buckets ?? []) {
    let paths: string[]
    try {
      paths = await listBucket(supabase, bucket.name)
    } catch (e) {
      summary.push({ table: `storage:${bucket.name}`, rows: 0, status: 'erro', error: (e as Error).message })
      console.log(`  ✗  ${bucket.name.padEnd(35)} ERRO: ${(e as Error).message}`)
      continue
    }
    let ok = 0
    for (const path of paths) {
      const { data, error } = await supabase.storage.from(bucket.name).download(path)
      if (error || !data) {
        summary.push({ table: `storage:${bucket.name}/${path}`, rows: 0, status: 'erro', error: error?.message ?? 'vazio' })
        continue
      }
      const buf = Buffer.from(await data.arrayBuffer())
      const dest = join(backupDir, '_storage', bucket.name, ...path.split('/'))
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, buf)
      storageBytes += buf.length
      ok++
    }
    storageFiles += ok
    console.log(`  ✓  ${bucket.name.padEnd(35)} ${String(ok).padStart(4)}/${paths.length} arquivos`)
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
  console.log(`  Tabelas com sucesso: ${ok}/${tables.length}`)
  console.log(`  Arquivos do Storage: ${storageFiles} (${fmtSize(storageBytes)})`)
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
