// Deleta os 3 registros errados da Alexandra e recria com todos os dados da planilha
// node scripts/recriar-alexandra.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wfvdqugioatzjlpjyiyu.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
if (!SUPABASE_KEY) { console.error('Defina SUPABASE_SECRET_KEY no ambiente'); process.exit(1) }

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const WRONG_IDS = [
  '92f83f8a-a13a-4e0a-a30a-d2d743a86a2e',
  '01831b32-9ba7-41a9-be1e-5e4e5ce55c33',
  'a989b6ef-2ca6-45ab-98e2-c02bd89f1900',
]

const PROFILE_ID = '0943bba5-3e5e-4347-b475-79af28a277ba' // GT3.ALEXANDRA

// ── Dados da planilha / arquivo estático ──────────────────────────────────────

const competencias = [
  'Relacionamento Interpessoal',
  'Inteligência Emocional no Trabalho',
  'E-mail',
  'WhatsApp',
  'Comprometimento',
  'Doc funcionário',
  'Doc empresa',
  'PGR/PCMSO/LTCAT',
  'Cadastro e itens relacionados',
  'Doc veículo',
  'Atendimento ao cliente',
]
const diretiva  = [3, 3, 4, 4, 5, 2, 4, 1, 5, 1, 3]
const auto_     = [3, 3, 4, 4, 4, 3, 5, 2, 5, 2, 4]
const ambicao   = [4, 4, 5, 5, 5, 4, 5, 4, 5, 4, 5]

const eneagrama = {
  ranking: [
    { rank: 1, tipo: 'Tipo 1 — Perfeccionista', pontuacao: '20/25' },
    { rank: 2, tipo: 'Tipo 2 — Ajudante',       pontuacao: '17/25' },
    { rank: 3, tipo: 'Tipo 8 — Poderoso',        pontuacao: '17/25' },
  ],
  pontosFortes: [
    'Alta competência técnica e preocupação com qualidade',
    'Muito responsável, proativa e dedicada — sempre busca entregar o melhor trabalho possível',
    'Versatilidade operacional',
  ],
  pontosAtencao: [
    'Dificuldade em lidar com ambiguidades ou processos que não seguem um padrão claro',
    'Rigidez e perfeccionismo em situações de pressão ou quando percebe mudanças de processo.',
  ],
  comoDesenvolver: [
    'Onboarding e cadastros de novos clientes (contato inicial, orientação e acompanhamento dos primeiros passos no portal)',
    'Funções de suporte operacional com ênfase em qualidade e conformidade.',
  ],
}

const animais = [
  { animal: 'Gato',    emoji: '🐱', percentual: 40, pontoForte: 'Harmonia, boa comunicação, empatia e facilidade em lidar com pessoas.', tendencia: 'Busca preservar harmonia e evitar confrontos. Pode demorar mais para dar feedbacks difíceis ou impor limites quando necessário.' },
  { animal: 'Lobo',    emoji: '🐺', percentual: 24, pontoForte: 'Boa organização, atenção a detalhes e preocupação em seguir processos e padrões de qualidade nos cadastros.', tendencia: 'Gosta de regras claras e trabalho bem estruturado, porém com menor intensidade que o Gato e o Tubarão neste perfil.' },
  { animal: 'Tubarão', emoji: '🦈', percentual: 20, pontoForte: 'Capacidade de agir com agilidade e senso de urgência quando identifica pendências ou precisa resolver questões rapidamente durante o cadastro', tendencia: 'Ajuda a manter o fluxo de onboarding em movimento, mas pode gerar ansiedade interna ou pressa excessiva em situações de volume alto.' },
  { animal: 'Águia',   emoji: '🦅', percentual: 8,  pontoForte: 'Capacidade básica de visualizar o contexto geral do processo de cadastro.', tendencia: 'Baixa influência. Prefere seguir caminhos já conhecidos e testados em vez de inovar ou propor grandes mudanças nos fluxos.' },
]

const conclusoes = {
  _original_slug: 'alexandra-otobelli-trentin',
  forcas: [
    'Atividades que demandem organização, paciência e padrão elevado de qualidade.',
    'Análise criteriosa de documentos (guias, certidões e comprovações).',
  ],
  pontosAtencao: [],
  ondeAgrega: [
    'Suporte em processos financeiros e emissão de documentos.',
    'Auxílio em verificações de conformidade e rotinas administrativas estruturadas.',
  ],
  comoPodeApoiar: [],
  riscos: [
    'Posições que exijam constante negociação, confronto direto ou tomada de decisão rápida em ambiente de conflito.',
    'Exposição a feedbacks frequentes e diretos sem estrutura adequada, podendo impactar o clima da equipe e aumentar rotatividade',
  ],
  comoLiderar: [
    'Dar feedback de forma estruturada, calma e factual. Reconhecer publicamente a qualidade e dedicação ao trabalho. Antecipar mudanças de processo sempre que possível.',
    'Fornecer clareza de expectativas, processos bem definidos, reconhecimento frequente do trabalho bem feito e autonomia dentro de padrões estabelecidos.',
  ],
}

const acoes = [
  { competencia: 'Relacionamento interpessoal /  Controle de ansiedade para lidar com personalidades variadas', desenvolver: 'Ser mais aberta/tolerante  à novas pessoas, bem como, a dividir processos com pessoas que já estão aqui', acoes: 'Auxiliar na busca de cursos ou formações que possam contibuir para integração da equipe, visando quebrar barreiras de relacionamento, medos e etariedade.', resultados_esperados: 'Melhor relacionamento na equipe. Visando mudar ambiente, com maior satisfação na convivência, com diferentes personalidades.', inicio: '2026-03-26', termino: '', status: '' },
  { competencia: 'Ações comportamentais pontuais', desenvolver: 'Casos como reclamar dos clientes em tom de voz alto - buscar evitar', acoes: "Entende-se que é uma colega ''modelo/exemplo'' a todos, portanto, momentos em que se vê a Alexandra publicamente falando algo, os demais se sentem seguros de fazer o mesmo.", resultados_esperados: 'Utilizar deste exemplo para coisas boas, como já é feito na maioria dos casos. (caso banheiro / cafeteira)', inicio: '2026-03-26', termino: '', status: '' },
  { competencia: 'Docs de pessoas e Programas', desenvolver: 'Desenvolver maior entendimento conceitual sobre estes itens', acoes: 'Acompanhar andamento de e-mails sobre estes assuntos, conversar sobre com colegas', resultados_esperados: 'Poder realizar avaliações pontuais, principalmente as que agilizem cadastros', inicio: '2026-03-26', termino: '', status: '' },
  { competencia: 'Flexibilidade', desenvolver: "Maior ''jogo de cintura'' para lidar com algumas questões de cadastro, envolvendo pessoas da GT3 ou de fora", acoes: 'Ver itens que é possível flexibilizar/adaptar em demandas, debater / divulgar e difundir tais conceitos entre a equipe.', resultados_esperados: 'Facilitar seu dia a dia e facilitar a liberação de clientes.', inicio: '2026-03-26', termino: '', status: '' },
  { competencia: 'Liderança', desenvolver: 'Entender se é um caminho que você se enxerga em algum momento futuro', acoes: 'Trabalhar junto a pessoas de outros setores em demandas em comum e ver como seria a experiência de delegar algo pontual.', resultados_esperados: 'Ver se é algo que lhe motiva/lhe assenta bem realizar, em virtude de possíveis casos de indisposição com algum colega por conta disso', inicio: '2026-03-26', termino: '', status: '' },
  { competencia: 'Paciência', desenvolver: 'Trabalhar a calma em situações adversas, por mais simples que sejam, como jarra do café e lixo', acoes: 'Usar de recursos lúdicos para passar a mensagem de organização e /ou clareza na orientação para melhor convívio', resultados_esperados: 'Leveza nas relações', inicio: '2026-03-26', termino: '', status: '' },
  { competencia: 'WorkFlow automatizado de cadastro', desenvolver: 'Ajudar a GT3 a desenvolver algo melhor', acoes: 'Puxar / organizar breves reuniões de bate papos, para desenvolver o tema e contribuir com seu conhecimento de dia a dia sobre o item no sistema.', resultados_esperados: 'Melhoria no seu próprio processo a partir da sua efetiva contribuição na construção efetiva da ideia.', inicio: '2026-03-26', termino: '', status: '' },
]

async function run() {
  // 1. Limpa registros errados (ciclos, acoes, notificacoes e depois o pdi)
  console.log('🗑  Deletando registros errados...')
  for (const id of WRONG_IDS) {
    await admin.from('pdi_ciclos').delete().eq('pdi_id', id)
    await admin.from('pdi_acoes').delete().eq('pdi_id', id)
    await admin.from('pdi_notificacoes').delete().eq('pdi_id', id)
    const { error } = await admin.from('pdis').delete().eq('id', id)
    if (error) console.warn(`  ⚠ ${id}: ${error.message}`)
    else console.log(`  ✓ Deletado: ${id}`)
  }

  // 2. Cria o registro correto
  console.log('\n📋 Criando PDI correto...')
  const { data: newPdi, error: insertErr } = await admin
    .from('pdis')
    .insert({
      nome: 'ALEXANDRA OTOBELLI TRENTIN',
      funcao: 'Analista de Serviços',
      data_inicio: '2020-01-06',
      competencias,
      eneagrama,
      animais,
      conclusoes,
    })
    .select('id')
    .single()

  if (insertErr || !newPdi) { console.error('❌ Erro ao criar PDI:', insertErr?.message); process.exit(1) }
  const newId = newPdi.id
  console.log(`  ✓ PDI criado: ${newId}`)

  // 3. Atualiza pdi_slug do perfil
  const { error: profileErr } = await admin.from('profiles').update({ pdi_slug: newId }).eq('id', PROFILE_ID)
  if (profileErr) console.warn('  ⚠ profiles:', profileErr.message)
  else console.log('  ✓ profiles.pdi_slug atualizado')

  // 4. Cria ciclo 1 com as avaliações da planilha
  const { error: cicloErr } = await admin.from('pdi_ciclos').insert({
    pdi_id: newId,
    colaborador_id: PROFILE_ID,
    numero_ciclo: 1,
    status: 'ativo',
    avaliacao_diretiva: diretiva,
    autoavaliacao: auto_,
    ambicao: ambicao,
    autoavaliacao_salva: true,
  })
  if (cicloErr) console.warn('  ⚠ ciclo:', cicloErr.message)
  else console.log('  ✓ Ciclo 1 criado com avaliações')

  // 5. Importa as ações
  const acoesComId = acoes.map(a => ({ ...a, pdi_id: newId }))
  const { error: acoesErr } = await admin.from('pdi_acoes').insert(acoesComId)
  if (acoesErr) console.warn('  ⚠ acoes:', acoesErr.message)
  else console.log(`  ✓ ${acoes.length} ações importadas`)

  console.log('\n✅ Concluído! Alexandra recriada corretamente.')
  console.log(`   Novo UUID: ${newId}`)
  console.log(`   URL: /pdi/${newId}`)
}

run().catch(e => { console.error(e); process.exit(1) })
