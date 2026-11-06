// Custo de Servir — camadas 2 e 3 (material "Medindo o Suporte GT3"). Calculos puros.

export type Atividade = {
  id: string; chave: string; nome: string; unidade: 'quantidade' | 'minutos'
  fonte: string | null; liga_por: string | null; ordem: number; ativo: boolean
}
export type AtivMedicao = {
  id: string; atividade_id: string; duracao_ms: number; situacao: 'validada' | 'descartada'
  motivo: string | null; avaliador_id: string; created_at: string
  /** Medicao feita para esse contratante (opcional); grupo = vale para o principal e todas as unidades. */
  contratante_cod: string | null; grupo: boolean
}
export type VolumeLote = { id: string; nome: string | null; dias_uteis: number | null; created_by: string | null; created_at: string }
export type VolumeLinha = { atividade_id: string; contratantes: string[]; quantidade: number; prestador: string | null; referencia: string | null }
export type Amostragem = {
  id: string; nome: string; inicio: string; fim: string; avisos_dia: number; hora_ini: string; hora_fim: string
  participantes: string[] | null; ativa: boolean; created_by: string | null; created_at: string
}
export type Amostra = {
  id: string; amostragem_id: string; usuario_id: string; previsto_em: string; respondido_em: string
  atividade: ChaveAmostra; contratante_cod: string | null
}

// ── Opcoes do aviso (lista 3.3 do material) ──────────────────────────────────
export type ChaveAmostra = 'avaliacao' | 'cadastro' | 'email' | 'ligacao' | 'whatsapp' | 'orientacao' | 'interno' | 'sem_demanda'
export type Classe = 'camada1' | 'camada2' | 'camada3' | 'interno' | 'ociosa'
export const OPCOES_AMOSTRA: { chave: ChaveAmostra; label: string; inclui: string; classe: Classe; pedeContratante: boolean }[] = [
  { chave: 'avaliacao', label: 'Avaliação', inclui: 'Avaliar documento no sistema', classe: 'camada1', pedeContratante: true },
  { chave: 'cadastro', label: 'Cadastro', inclui: 'Empresa, pessoa, turno, vinculação', classe: 'camada2', pedeContratante: true },
  { chave: 'email', label: 'E-mail', inclui: 'Ler, responder, cobrar por e-mail', classe: 'camada2', pedeContratante: true },
  { chave: 'ligacao', label: 'Ligação', inclui: 'Atender ou fazer ligação', classe: 'camada2', pedeContratante: true },
  { chave: 'whatsapp', label: 'WhatsApp', inclui: 'Conversas com prestador ou contratante', classe: 'camada3', pedeContratante: true },
  { chave: 'orientacao', label: 'Orientação', inclui: 'Explicar requisito, ajudar a montar documento', classe: 'camada3', pedeContratante: true },
  { chave: 'interno', label: 'Interno', inclui: 'Reunião, treinamento, tarefas da GT3', classe: 'interno', pedeContratante: false },
  { chave: 'sem_demanda', label: 'Sem demanda', inclui: 'Nada pendente naquele momento', classe: 'ociosa', pedeContratante: false },
]
export const CLASSES: Record<Classe, string> = {
  camada1: 'Camada 1 · Avaliação', camada2: 'Camada 2 · Com rastro', camada3: 'Camada 3 · Difuso',
  interno: 'Interno (estrutura)', ociosa: 'Capacidade ociosa',
}
export const classeDe = (k: ChaveAmostra) => OPCOES_AMOSTRA.find(o => o.chave === k)!.classe

// ── Horarios sorteados (deterministicos por amostragem + pessoa + dia) ───────
// Sem servidor de agendamento: cada navegador calcula os mesmos horarios a partir de uma semente.
function semente(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const minutos = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }
/** Dia util (seg a sex). */
export const diaUtil = (iso: string) => { const d = new Date(iso + 'T12:00:00'); const w = d.getDay(); return w !== 0 && w !== 6 }
/** Horarios (Date local) dos avisos de uma pessoa num dia. Espacamento minimo de 20 min entre avisos. */
export function horariosDoDia(a: Pick<Amostragem, 'id' | 'avisos_dia' | 'hora_ini' | 'hora_fim'>, usuarioId: string, diaIso: string): Date[] {
  if (!diaUtil(diaIso)) return []
  const ini = minutos(a.hora_ini), fim = minutos(a.hora_fim)
  const n = Math.min(a.avisos_dia, Math.floor((fim - ini) / 20))
  if (n <= 0) return []
  const rnd = semente(a.id + '|' + usuarioId + '|' + diaIso)
  // Divide a janela em n faixas iguais e sorteia um minuto em cada (com folga de 10 min nas bordas)
  const faixa = (fim - ini) / n
  const out: Date[] = []
  for (let i = 0; i < n; i++) {
    const m = Math.round(ini + i * faixa + 10 + rnd() * Math.max(0, faixa - 20))
    const d = new Date(diaIso + 'T00:00:00')
    d.setHours(Math.floor(m / 60), m % 60, 0, 0)
    out.push(d)
  }
  return out
}
export const hojeIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const participa = (a: Amostragem, usuarioId: string) => !a.participantes || a.participantes.includes(usuarioId)
/** Quantos avisos ja deveriam ter saido ate agora (para a taxa de resposta). */
export function avisosPrevistosAte(a: Amostragem, usuarios: string[], agora = new Date()): number {
  let n = 0
  for (let d = new Date(a.inicio + 'T00:00:00'); hojeIso(d) <= a.fim && d <= agora; d.setDate(d.getDate() + 1)) {
    const dia = hojeIso(d)
    for (const u of usuarios) if (participa(a, u)) n += horariosDoDia(a, u, dia).filter(h => h <= agora).length
  }
  return n
}

// ── Estatistica da amostragem ────────────────────────────────────────────────
/** Margem de erro (pontos percentuais) com 95% de confianca. */
export const margemErro = (p: number, n: number) => (n > 0 ? 1.96 * Math.sqrt((p * (1 - p)) / n) * 100 : 0)
/** Margem no pior caso (p = 50%): a referencia do material (480 obs = ±4,5 p.p.). */
export const margemPiorCaso = (n: number) => margemErro(0.5, n)

// ── Camada 2 ─────────────────────────────────────────────────────────────────
export type TempoAtiv = { n: number; val: number | null; mean: number | null; med: number | null }
export function tempoAtividade(meds: AtivMedicao[], atividadeId: string, base: 'mediana' | 'media', filtro?: (m: AtivMedicao) => boolean): TempoAtiv {
  const v = meds.filter(m => m.atividade_id === atividadeId && m.situacao === 'validada' && (!filtro || filtro(m))).map(m => m.duracao_ms / 60000).sort((a, b) => a - b)
  const n = v.length
  if (!n) return { n: 0, val: null, mean: null, med: null }
  const mean = v.reduce((a, b) => a + b, 0) / n
  const med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2
  return { n, mean, med, val: base === 'media' ? mean : med }
}

/** A medicao vale para o contratante? (feita para ele, ou para o grupo do principal dele) */
export const medicaoVale = (m: AtivMedicao, cod: string, principal: (c: string) => string) =>
  m.contratante_cod === cod || (m.grupo && !!m.contratante_cod && m.contratante_cod === principal(cod))

export type FonteTempo = 'contratante' | 'grupo' | 'geral'
/** Tempo da atividade para o contratante: o especifico (contratante, depois grupo) se tiver o minimo de medicoes; senao o geral. */
export function tempoPara(meds: AtivMedicao[], ativId: string, cod: string | null, base: 'mediana' | 'media', minimo: number, principal: (c: string) => string): { val: number | null; fonte: FonteTempo; n: number } {
  if (cod) {
    const proprio = tempoAtividade(meds, ativId, base, m => m.contratante_cod === cod && !m.grupo)
    if (proprio.n >= minimo) return { val: proprio.val, fonte: 'contratante', n: proprio.n }
    const p = principal(cod)
    const grupo = tempoAtividade(meds, ativId, base, m => m.grupo && m.contratante_cod === p)
    if (grupo.n >= minimo) return { val: grupo.val, fonte: 'grupo', n: grupo.n }
  }
  const g = tempoAtividade(meds, ativId, base)
  return { val: g.val, fonte: 'geral', n: g.n }
}

export type Camada2 = {
  porCtt: Record<string, number>          // minutos no periodo do lote
  porAtiv: Record<string, number>         // minutos por atividade
  semTempo: Record<string, number>        // atividade sem tempo-padrao -> quantidade
  semContratante: number                  // linhas sem contratante
  especificos: number                     // partes que usaram tempo do contratante/grupo
  total: number
}
export function calcCamada2(linhas: VolumeLinha[], ativs: Atividade[], tempo: (id: string, cod: string | null) => { val: number | null; fonte: FonteTempo }): Camada2 {
  const out: Camada2 = { porCtt: {}, porAtiv: {}, semTempo: {}, semContratante: 0, especificos: 0, total: 0 }
  for (const l of linhas) {
    const a = ativs.find(x => x.id === l.atividade_id)
    if (!a) continue
    const cs = [...new Set(l.contratantes)]
    if (!cs.length) { out.semContratante++; continue }
    for (const c of cs) {
      const parte = l.quantidade / cs.length            // divide igual entre os validos
      let min: number
      if (a.unidade === 'minutos') min = parte
      else {
        const t = tempo(a.id, c)
        if (t.val == null) { out.semTempo[a.id] = (out.semTempo[a.id] || 0) + parte; continue }
        if (t.fonte !== 'geral') out.especificos++
        min = parte * t.val
      }
      out.total += min
      out.porAtiv[a.id] = (out.porAtiv[a.id] || 0) + min
      out.porCtt[c] = (out.porCtt[c] || 0) + min
    }
  }
  return out
}

// ── Camada 3 ─────────────────────────────────────────────────────────────────
export type Camada3 = {
  n: number
  porOpcao: Record<ChaveAmostra, number>
  porClasse: Record<Classe, number>
  porCttCamada3: Record<string, number>      // observacoes de camada 3 por contratante
  porCttOpcao: Record<string, Partial<Record<ChaveAmostra, number>>>
  camada3SemCtt: number
}
export function calcCamada3(amostras: Amostra[]): Camada3 {
  const out: Camada3 = {
    n: amostras.length, porOpcao: {} as Record<ChaveAmostra, number>, porClasse: {} as Record<Classe, number>,
    porCttCamada3: {}, porCttOpcao: {}, camada3SemCtt: 0,
  }
  for (const o of OPCOES_AMOSTRA) out.porOpcao[o.chave] = 0
  for (const k of Object.keys(CLASSES) as Classe[]) out.porClasse[k] = 0
  for (const a of amostras) {
    out.porOpcao[a.atividade]++
    const cl = classeDe(a.atividade)
    out.porClasse[cl]++
    if (a.contratante_cod) {
      const m = (out.porCttOpcao[a.contratante_cod] ||= {})
      m[a.atividade] = (m[a.atividade] || 0) + 1
      if (cl === 'camada3') out.porCttCamada3[a.contratante_cod] = (out.porCttCamada3[a.contratante_cod] || 0) + 1
    } else if (cl === 'camada3') out.camada3SemCtt++
  }
  return out
}
