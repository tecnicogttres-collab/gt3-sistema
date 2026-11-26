// Pop-ups de acompanhamento do PDI: tipos, modelos e agenda.
// Código puro (sem banco): roda no servidor (o que está pendente agora) e no
// navegador (prévia das próximas aberturas na configuração).
// Horários sempre em Brasília (UTC−3, sem horário de verão desde 2019).

export type TipoPergunta = 'acoes' | 'humor' | 'escala' | 'unica' | 'multipla' | 'simnao' | 'texto'

export type Pergunta = {
  id: string
  tipo: TipoPergunta
  texto: string
  obrigatoria: boolean
  opcoes?: string[]          // unica / multipla
  min?: string               // escala: rótulo do 1
  max?: string               // escala: rótulo do 5
  acoes?: string[] | null    // acoes: null = todas as ativas
  nota?: boolean             // acoes/humor/escala/simnao: permite comentário
  proximoPasso?: boolean     // acoes: mostra a próxima etapa como lembrete
}

export type TipoAgenda = 'semanal' | 'quinzenal' | 'mensal' | 'diaria' | 'datas' | 'aleatoria'

export type Agenda = {
  tipo: TipoAgenda
  dias: number[]             // 0 = domingo … 6 = sábado (semanal, quinzenal, aleatória)
  dia_mes: number            // mensal (1–31; meses menores usam o último dia)
  datas: string[]            // datas: YYYY-MM-DD
  hora_ini: string           // HH:MM — abre (ou início da janela do sorteio)
  hora_fim: string           // HH:MM — fim da janela
  vezes: number              // aleatória: quantas vezes…
  por: 'semana' | 'mes'      // …por semana ou por mês
  inicio: string             // vigência (YYYY-MM-DD)
  fim: string | null
  validade: 'janela' | 'proxima' // até o fim da janela do dia, ou até a próxima abertura
}

export type Comportamento = {
  adiar: boolean
  adiar_min: number
}

export type Popup = {
  id: string
  pdi_id: string
  titulo: string
  intro: string
  icone: string
  cor: string
  ativo: boolean
  perguntas: Pergunta[]
  agenda: Agenda
  comportamento: Comportamento
  created_at?: string
  updated_at?: string
}

export type Ocorrencia = { chave: string; abre: Date; fecha: Date }

// ── Metadados para a tela ────────────────────────────────────────────

export const TIPOS_PERGUNTA: Record<TipoPergunta, { label: string; icon: string; desc: string }> = {
  acoes: { label: 'Status das ações', icon: '🎯', desc: 'Avancei · Travei · Não mexi, por ação' },
  humor: { label: 'Humor', icon: '🙂', desc: '5 carinhas, de 😞 a 😄' },
  escala: { label: 'Escala 1 a 5', icon: '📶', desc: 'Nota com rótulos nas pontas' },
  unica: { label: 'Escolha única', icon: '🔘', desc: 'Uma opção entre várias' },
  multipla: { label: 'Múltipla escolha', icon: '☑️', desc: 'Várias opções' },
  simnao: { label: 'Sim / Não', icon: '👍', desc: 'Resposta rápida' },
  texto: { label: 'Texto livre', icon: '✍️', desc: 'Resposta aberta' },
}

export const TIPOS_AGENDA: Record<TipoAgenda, { label: string; icon: string }> = {
  semanal: { label: 'Semanal', icon: '📅' },
  quinzenal: { label: 'Quinzenal', icon: '🗓️' },
  mensal: { label: 'Mensal', icon: '📆' },
  diaria: { label: 'Todo dia útil', icon: '☀️' },
  datas: { label: 'Datas específicas', icon: '📌' },
  aleatoria: { label: 'Aleatória', icon: '🎲' },
}

export const HUMOR = [
  { v: 1, e: '😞', l: 'Muito mal' }, { v: 2, e: '🙁', l: 'Mal' }, { v: 3, e: '😐', l: 'Neutro' },
  { v: 4, e: '🙂', l: 'Bem' }, { v: 5, e: '😄', l: 'Muito bem' },
]
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const CORES_POPUP = ['#2A4F96', '#0F9F8F', '#D9730D', '#9B5DE5', '#B5458F', '#1E9E6A', '#C9A227']
export const ICONES_POPUP = ['⚡', '🎯', '💬', '🙂', '🌱', '🧭', '📝', '☕', '🚀', '❤️']

const novoId = () => Math.random().toString(36).slice(2, 10)
export const hojeSP = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export function perguntaPadrao(tipo: TipoPergunta): Pergunta {
  const base = { id: novoId(), tipo, obrigatoria: tipo !== 'texto' }
  switch (tipo) {
    case 'acoes': return { ...base, texto: 'Como estão suas ações desde o último registro?', acoes: null, nota: true, proximoPasso: true }
    case 'humor': return { ...base, texto: 'Como você se sente hoje?', nota: true }
    case 'escala': return { ...base, texto: 'De 1 a 5, como foi sua semana?', min: 'Muito difícil', max: 'Excelente', nota: false }
    case 'unica': return { ...base, texto: 'O que mais tomou seu tempo?', opcoes: ['Rotina da área', 'Demandas urgentes', 'Aprendendo algo novo'] }
    case 'multipla': return { ...base, texto: 'O que ajudaria agora?', opcoes: ['Mais orientação', 'Mais tempo', 'Um exemplo pronto', 'Conversar com alguém'] }
    case 'simnao': return { ...base, texto: 'Ficou alguma dúvida que você ainda não levou para alguém?', nota: true }
    case 'texto': return { ...base, texto: 'Quer deixar algum recado para a sua liderança?' }
  }
}

export function agendaPadrao(): Agenda {
  return { tipo: 'semanal', dias: [5], dia_mes: 1, datas: [], hora_ini: '10:00', hora_fim: '17:00', vezes: 2, por: 'semana', inicio: hojeSP(), fim: null, validade: 'proxima' }
}

/** Modelos prontos para começar rápido. */
export function modelos(): { id: string; nome: string; desc: string; criar: () => Omit<Popup, 'id' | 'pdi_id'> }[] {
  const comum = { ativo: false, comportamento: { adiar: true, adiar_min: 180 } }
  return [
    {
      id: 'status', nome: '🎯 Status semanal das ações', desc: 'Toda sexta às 10h: avancei / travei / não mexi em cada ação.',
      criar: () => ({ ...comum, titulo: 'Como estão suas ações?', intro: 'Um clique por ação. Leva menos de um minuto.', icone: '🎯', cor: '#2A4F96', perguntas: [perguntaPadrao('acoes')], agenda: { ...agendaPadrao(), tipo: 'semanal', dias: [5], hora_ini: '10:00' } }),
    },
    {
      id: 'humor', nome: '🙂 Como você se sente hoje?', desc: '2 vezes por semana, em horário sorteado entre 9h e 17h.',
      criar: () => ({ ...comum, titulo: 'Como você está hoje?', intro: 'Só para a gente acompanhar como você está. Sem certo ou errado.', icone: '🙂', cor: '#0F9F8F', perguntas: [perguntaPadrao('humor')], agenda: { ...agendaPadrao(), tipo: 'aleatoria', dias: [1, 2, 3, 4, 5], hora_ini: '09:00', hora_fim: '17:00', vezes: 2, por: 'semana', validade: 'janela' }, comportamento: { adiar: true, adiar_min: 60 } }),
    },
    {
      id: 'quinzenal', nome: '🧭 Check-in quinzenal completo', desc: 'A cada 15 dias: ações, humor, uma nota da quinzena e um recado.',
      criar: () => ({ ...comum, titulo: 'Check-in da quinzena', intro: 'Seu retorno ajuda a próxima conversa de PDI.', icone: '🧭', cor: '#9B5DE5', perguntas: [perguntaPadrao('acoes'), perguntaPadrao('humor'), { ...perguntaPadrao('escala'), texto: 'De 1 a 5, como foi sua quinzena?' }, perguntaPadrao('simnao'), perguntaPadrao('texto')], agenda: { ...agendaPadrao(), tipo: 'quinzenal', dias: [4], hora_ini: '14:00' } }),
    },
    {
      id: 'conversa', nome: '💬 Antes da conversa de PDI', desc: 'Numa data marcada: o que quer levar para a conversa.',
      criar: () => ({ ...comum, titulo: 'Preparando nossa conversa', intro: 'Sua conversa de PDI está chegando. O que você quer levar?', icone: '💬', cor: '#D9730D', perguntas: [{ ...perguntaPadrao('multipla'), texto: 'Sobre o que você quer conversar?', opcoes: ['Minhas ações do PDI', 'Rotina e prioridades', 'Aprendizado', 'Relacionamento com a equipe', 'Carreira'] }, { ...perguntaPadrao('texto'), texto: 'Algo mais que você queira trazer?' }], agenda: { ...agendaPadrao(), tipo: 'datas', datas: [], hora_ini: '09:00', validade: 'proxima' } }),
    },
    {
      id: 'branco', nome: '✍️ Em branco', desc: 'Monte do zero.',
      criar: () => ({ ...comum, titulo: 'Novo pop-up', intro: '', icone: '⚡', cor: '#2A4F96', perguntas: [], agenda: agendaPadrao() }),
    },
  ]
}

// ── Agenda ───────────────────────────────────────────────────────────

const DIA = 86_400_000
const diaNum = (d: string) => Math.floor(Date.parse(d + 'T00:00:00Z') / DIA)
const deDiaNum = (n: number) => new Date(n * DIA).toISOString().slice(0, 10)
const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()
const semanaNum = (n: number) => Math.floor((n + 4) / 7) // semanas começando no domingo
const minutos = (hm: string) => { const [h, m] = hm.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const quando = (d: string, h: string) => new Date(`${d}T${h}:00-03:00`)

function semente(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

const vigente = (ag: Agenda, d: string) => d >= ag.inicio && (!ag.fim || d <= ag.fim)

/** Sorteio da agenda aleatória num período (semana ou mês): sempre igual para o mesmo pop-up e período. */
function sorteioPeriodo(ag: Agenda, popupId: string, chavePeriodo: string, diasDoPeriodo: string[]): Date[] {
  const permitidos = diasDoPeriodo.filter(d => vigente(ag, d) && ag.dias.includes(dow(d)))
  if (!permitidos.length || ag.vezes < 1) return []
  const rnd = mulberry(semente(popupId + '|' + chavePeriodo))
  const ini = minutos(ag.hora_ini), fim = Math.max(ini + 15, minutos(ag.hora_fim) - 15)
  const embaralhados = [...permitidos].sort(() => rnd() - 0.5)
  const res: Date[] = []
  for (let i = 0; i < ag.vezes; i++) {
    const d = embaralhados[i % embaralhados.length]
    const m = ini + Math.floor(rnd() * ((fim - ini) / 5)) * 5
    res.push(quando(d, hm(m)))
  }
  return res.sort((a, b) => a.getTime() - b.getTime())
}

/** Todas as aberturas entre duas datas (YYYY-MM-DD, inclusive), em ordem. */
export function aberturas(ag: Agenda, popupId: string, de: string, ate: string): Date[] {
  const res: Date[] = []
  const n0 = diaNum(de), n1 = diaNum(ate)
  if (ag.tipo === 'aleatoria') {
    const periodos = new Map<string, string[]>()
    // pega os períodos inteiros que tocam o intervalo (o sorteio depende do período todo)
    for (let n = n0 - 31; n <= n1 + 31; n++) {
      const d = deDiaNum(n)
      const k = ag.por === 'mes' ? d.slice(0, 7) : `s${semanaNum(n)}`
      if (!periodos.has(k)) periodos.set(k, [])
      periodos.get(k)!.push(d)
    }
    for (const [k, dias] of periodos) {
      const completo = ag.por === 'mes' ? dias.length >= 28 : dias.length === 7
      if (!completo) continue
      for (const t of sorteioPeriodo(ag, popupId, k, dias)) {
        const d = hojeSP(t)
        if (d >= de && d <= ate) res.push(t)
      }
    }
    return res.sort((a, b) => a.getTime() - b.getTime())
  }
  const semIni = semanaNum(diaNum(ag.inicio))
  for (let n = n0; n <= n1; n++) {
    const d = deDiaNum(n)
    if (!vigente(ag, d)) continue
    const w = dow(d)
    let ok = false
    if (ag.tipo === 'semanal') ok = ag.dias.includes(w)
    else if (ag.tipo === 'quinzenal') ok = ag.dias.includes(w) && (semanaNum(n) - semIni) % 2 === 0
    else if (ag.tipo === 'diaria') ok = w >= 1 && w <= 5
    else if (ag.tipo === 'datas') ok = ag.datas.includes(d)
    else if (ag.tipo === 'mensal') {
      const ult = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate()
      ok = +d.slice(8, 10) === Math.min(ag.dia_mes, ult)
    }
    if (ok) res.push(quando(d, ag.hora_ini))
  }
  return res
}

function fechamento(ag: Agenda, popupId: string, abre: Date): Date {
  const d = hojeSP(abre)
  if (ag.validade === 'janela') {
    const f = quando(d, ag.hora_fim)
    return f > abre ? f : new Date(abre.getTime() + 2 * 3_600_000)
  }
  const prox = aberturas(ag, popupId, d, deDiaNum(diaNum(d) + 70)).find(t => t > abre)
  if (prox) return prox
  return ag.fim ? quando(ag.fim, '23:59') : new Date(abre.getTime() + 7 * DIA)
}

/** A abertura em vigor agora (se houver). */
export function ocorrenciaAtual(p: Pick<Popup, 'id' | 'agenda'>, now = new Date()): Ocorrencia | null {
  const hoje = hojeSP(now)
  const lista = aberturas(p.agenda, p.id, deDiaNum(diaNum(hoje) - 70), hoje).filter(t => t <= now)
  const abre = lista[lista.length - 1]
  if (!abre) return null
  const fecha = fechamento(p.agenda, p.id, abre)
  return fecha > now ? { chave: abre.toISOString(), abre, fecha } : null
}

/** Próximas aberturas (para prévia). */
export function proximasAberturas(p: Pick<Popup, 'id' | 'agenda'>, n = 5, now = new Date()): Date[] {
  const hoje = hojeSP(now)
  return aberturas(p.agenda, p.id, hoje, deDiaNum(diaNum(hoje) + 400)).filter(t => t > now).slice(0, n)
}

export const fmtQuando = (t: Date | string) => new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Resumo da agenda em uma linha. */
export function resumoAgenda(ag: Agenda): string {
  const dias = ag.dias.slice().sort().map(d => DIAS_CURTOS[d]).join(', ')
  const janela = `entre ${ag.hora_ini} e ${ag.hora_fim}`
  switch (ag.tipo) {
    case 'semanal': return `Toda semana (${dias || '—'}) às ${ag.hora_ini}`
    case 'quinzenal': return `A cada 15 dias (${dias || '—'}) às ${ag.hora_ini}`
    case 'mensal': return `Todo mês, dia ${ag.dia_mes}, às ${ag.hora_ini}`
    case 'diaria': return `Todo dia útil às ${ag.hora_ini}`
    case 'datas': return ag.datas.length ? `${ag.datas.length} data${ag.datas.length > 1 ? 's' : ''} marcada${ag.datas.length > 1 ? 's' : ''}, às ${ag.hora_ini}` : 'Nenhuma data marcada'
    case 'aleatoria': return `${ag.vezes}× por ${ag.por === 'mes' ? 'mês' : 'semana'}, sorteado ${janela} (${dias || '—'})`
  }
}

/** Valida e completa uma configuração vinda do cliente. */
export function normalizar(b: Partial<Popup>): Omit<Popup, 'id' | 'pdi_id'> {
  const ag = { ...agendaPadrao(), ...(b.agenda ?? {}) }
  ag.dias = (ag.dias ?? []).filter(d => d >= 0 && d <= 6)
  ag.datas = (ag.datas ?? []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  ag.vezes = Math.min(14, Math.max(1, Number(ag.vezes) || 1))
  ag.dia_mes = Math.min(31, Math.max(1, Number(ag.dia_mes) || 1))
  if (!/^\d{2}:\d{2}$/.test(ag.hora_ini)) ag.hora_ini = '10:00'
  if (!/^\d{2}:\d{2}$/.test(ag.hora_fim)) ag.hora_fim = '17:00'
  if (minutos(ag.hora_fim) <= minutos(ag.hora_ini)) ag.hora_fim = hm(Math.min(23 * 60 + 45, minutos(ag.hora_ini) + 60))
  const perguntas = (b.perguntas ?? []).filter(q => q && q.tipo in TIPOS_PERGUNTA).map(q => ({
    ...q, id: q.id || novoId(), texto: String(q.texto ?? '').slice(0, 300),
    opcoes: q.opcoes?.map(o => String(o).trim()).filter(Boolean).slice(0, 12),
  }))
  return {
    titulo: String(b.titulo ?? '').trim().slice(0, 120) || 'Pop-up',
    intro: String(b.intro ?? '').slice(0, 500),
    icone: String(b.icone ?? '⚡').slice(0, 4),
    cor: /^#[0-9A-Fa-f]{6}$/.test(b.cor ?? '') ? b.cor! : '#2A4F96',
    ativo: Boolean(b.ativo),
    perguntas,
    agenda: ag,
    comportamento: { adiar: b.comportamento?.adiar ?? true, adiar_min: Math.min(480, Math.max(15, Number(b.comportamento?.adiar_min) || 180)) },
  }
}
