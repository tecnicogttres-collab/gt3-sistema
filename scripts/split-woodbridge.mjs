// Script: divide "WOODBRIDGE MULTIUNIDADES" em 4 contratantes distintas
// Execução: node scripts/split-woodbridge.mjs

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wfvdqugioatzjlpjyiyu.supabase.co'
const KEY = process.env.SUPABASE_SECRET_KEY
if (!KEY) { console.error('Defina SUPABASE_SECRET_KEY no ambiente'); process.exit(1) }

const headers = {
  'Content-Type': 'application/json',
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  Prefer: 'return=representation',
}

async function rest(method, path, body) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  // 1. Busca a Woodbridge Multiunidades
  const rows = await rest('GET', 'terceiras_contratantes?select=id,nome&nome=ilike.*woodbridge*')
  console.log('Contratantes Woodbridge encontradas:', rows)

  const original = rows.find(r => r.nome.toLowerCase().includes('multi'))
  if (!original) {
    console.error('❌ Woodbridge multi-unidade não encontrada. Nomes disponíveis:', rows.map(r => r.nome))
    process.exit(1)
  }
  console.log(`✓ Encontrada: "${original.nome}" (id: ${original.id})`)

  // 2. Renomeia a existente para Capivari (mantém o ID — preserva vínculos das terceiras)
  await rest('PATCH', `terceiras_contratantes?id=eq.${original.id}`, { nome: 'WOODBRIDGE - CAPIVARI' })
  console.log('✓ Renomeada para WOODBRIDGE - CAPIVARI')

  // 3. Cria as outras três
  const novas = ['WOODBRIDGE - SBC', 'WOODBRIDGE - BETIM', 'WOODBRIDGE - CAÇAPAVA']
  for (const nome of novas) {
    // Verifica se já existe para não duplicar
    const existe = await rest('GET', `terceiras_contratantes?select=id,nome&nome=eq.${encodeURIComponent(nome)}`)
    if (existe.length > 0) {
      console.log(`⚠ "${nome}" já existe, pulando`)
      continue
    }
    await rest('POST', 'terceiras_contratantes', { nome, requer_cc: false })
    console.log(`✓ Criada: ${nome}`)
  }

  console.log('\n✅ Concluído! As terceiras que estavam em "WOODBRIDGE MULTIUNIDADES" estão agora em "WOODBRIDGE - CAPIVARI".')
  console.log('   Reatribua-as pelas outras unidades conforme necessário pelo drawer de cada terceira.')
}

main().catch(e => { console.error(e); process.exit(1) })
