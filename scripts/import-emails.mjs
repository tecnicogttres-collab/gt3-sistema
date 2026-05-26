import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import { randomUUID } from 'crypto'

const SUPABASE_URL = 'https://wfvdqugioatzjlpjyiyu.supabase.co'
const SUPABASE_KEY = 'sb_secret_xXRdNj2igFtRW82KIPubkA_-v-D7oRE'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

const BASE = 'C:\\Users\\rodri\\gt3-sistema\\. EMAIL - COMUNICAÇAO 2024'

const FOLDERS = [
  { dir: '2026 - E-MAIL COM ORIENTAÇÕES INICIAIS NOVAS EMPRESAS', category: 'Orientação Inicial' },
  { dir: '2026 - ORIENTAÇÕES PARA ACESSO AO PORTAL',              category: 'Acesso ao Portal'   },
]

function extractClient(title) {
  const idx = title.indexOf(' - ')
  return idx > 0 ? title.slice(0, idx).trim() : title.trim()
}

async function run() {
  let ok = 0
  let fail = 0

  for (const { dir, category } of FOLDERS) {
    const folderPath = join(BASE, dir)
    const files = readdirSync(folderPath).filter(f => {
      const full = join(folderPath, f)
      return statSync(full).isFile() && f.toLowerCase().endsWith('.msg')
    })

    console.log(`\n📁 ${category} (${files.length} arquivos)`)

    for (const filename of files) {
      const filePath = join(folderPath, filename)
      const stat = statSync(filePath)
      const title = basename(filename, extname(filename)).trim()
      const client = extractClient(title)

      const buffer = readFileSync(filePath)
      const base64 = buffer.toString('base64')
      const dataUrl = `data:application/vnd.ms-outlook;base64,${base64}`

      const payload = {
        id: randomUUID(),
        title,
        client,
        category,
        subject: '',
        tags: [],
        notes: '',
        file: { name: filename, size: stat.size, data: dataUrl },
      }

      const { error } = await supabase.from('email_templates').insert(payload)

      if (error) {
        console.error(`  ✗ ${filename}\n    ${error.message}`)
        fail++
      } else {
        console.log(`  ✓ ${client}  [${Math.round(stat.size / 1024)} KB]`)
        ok++
      }
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Concluído: ${ok} importados, ${fail} erros`)
}

run().catch(console.error)
