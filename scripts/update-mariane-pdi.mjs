import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://wfvdqugioatzjlpjyiyu.supabase.co',
  'sb_secret_xXRdNj2igFtRW82KIPubkA_-v-D7oRE',
  { auth: { persistSession: false } }
)

const PDI_ID = 'mariane-borges'
const NOVA_DIRETIVA = [2, 2, 2, 3, 3, 2, 2, 1, 2, 1, 2]

async function run() {
  // 1. Atualiza avaliacao_diretiva no ciclo ativo
  const { data: ciclo, error: ce } = await supabase
    .from('pdi_ciclos')
    .select('id, numero_ciclo')
    .eq('pdi_id', PDI_ID)
    .eq('status', 'ativo')
    .maybeSingle()

  if (ce || !ciclo) {
    console.error('Ciclo ativo não encontrado:', ce?.message)
  } else {
    const { error: ue } = await supabase
      .from('pdi_ciclos')
      .update({ avaliacao_diretiva: NOVA_DIRETIVA })
      .eq('id', ciclo.id)
    if (ue) console.error('Erro ao atualizar diretiva:', ue.message)
    else console.log(`✓ Diretiva atualizada no ciclo ${ciclo.numero_ciclo} [${NOVA_DIRETIVA.join(', ')}] = ${NOVA_DIRETIVA.reduce((a,b)=>a+b,0)}`)
  }

  // 2. Remove ações antigas para que o seed das novas rode automaticamente
  const { data: acoes, error: ae } = await supabase
    .from('pdi_acoes')
    .select('id, competencia')
    .eq('pdi_id', PDI_ID)

  if (ae) { console.error('Erro ao buscar ações:', ae.message); return }

  if (acoes && acoes.length > 0) {
    console.log(`  Removendo ${acoes.length} ação(ões) antiga(s): ${acoes.map(a => a.competencia).join(', ')}`)
    const { error: de } = await supabase
      .from('pdi_acoes')
      .delete()
      .eq('pdi_id', PDI_ID)
    if (de) console.error('Erro ao remover ações:', de.message)
    else console.log('✓ Ações antigas removidas — as 4 novas serão semeadas ao abrir o PDI')
  } else {
    console.log('  Nenhuma ação no banco — seed rodará automaticamente ao abrir o PDI')
  }
}

run().catch(console.error)
