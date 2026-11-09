// Custo de Servir — tipos e calculos puros (sem React, sem Supabase).

export type Resultado = 'aprovado' | 'reprovado'
export type Situacao = 'validada' | 'descartada'

export type Grupo = { id: string; nome: string; padrao: boolean; ordem: number; contratantes: string[] }
export type Documento = {
  id: string; nome: string; codigo: string | null; volume_ref: number; reprovados_ref: number
  nao_conta: boolean; ativo: boolean
  /** Validade em dias (mensal 30, anual 365...). null = nao definida; 0 = unico (nao vence). */
  validade_dias: number | null
  /** empresa | pessoa: define a regra do requisito comum (vinculacao x turno). null = ainda nao classificado. */
  tipo: 'empresa' | 'pessoa' | null
}
export type Medicao = {
  id: string; grupo_id: string | null; documento_id: string; duracao_ms: number
  resultado: Resultado; situacao: Situacao; motivo: string | null; avaliador_id: string; created_at: string
  /** Copia ("tempo padrao") de outra medicao do mesmo documento, feita em outro grupo. null = medicao propria. */
  origem_id?: string | null
}
/** codigo_integracao preenchido ("Código Perfil Integração" do GT0130) = turno com catraca de acesso. */
export type Turno = { turno_cod: string; contratante_cod: string; descricao: string | null; codigo_integracao: string | null }
/** contratante_pai: contratante principal (ex.: unidades da SEDE / MATRIZ). */
export type Contratante = { contratante_cod: string; nome: string; faturamento_mensal: number; contratante_pai: string | null }
/** Documento exigido pelo contratante no GT0010 (por contratante ou por contrato de servico). */
export type DocCtt = {
  documento_id: string; contratante_cod: string; origem: 'contratante' | 'contrato_servico'
  tipo_doc: 'E' | 'C' | null; periodicidade: string | null; bloqueia_acesso: boolean; data_inicio: string | null
  ativo: boolean; qtd_contratos: number
}
export type Config = {
  base: 'mediana' | 'media'; minimo: number
  custo_mensal: number | null; pessoas: number | null; dias_uteis: number | null; horas_dia: number | null
  dias_mes: number | null; pct_capacidade: number; margem_desejada: number
  nome_modulo: string; abas_perfis: Record<string, string[]>
}
export type Relatorio = { id: string; nome: string | null; dias_uteis: number | null; created_by: string | null; created_at: string }
export type LinhaRel = {
  data: string | null; cod_documento: string | null; documento: string | null; status: string | null
  empresa_pessoa: string | null; cod_cadastro: string | null; razao_social: string | null; cnpj: string | null
  vinculacao: string[]; ignorados: string[]; gt0010: string[]; turnos: string[]; usuario: string | null
}
export type Usuario = { id: string; nome: string | null; usuario: string | null; papel: string | null; desativado?: boolean }

export const MOTIVOS = ['Interrupção', 'Documento atípico', 'Erro de medição', 'Avaliei mais de um documento']

export const ABAS = [
  { id: 'cronometrar', label: 'Cronometrar' },
  { id: 'tempos', label: 'Tempos-padrão' },
  { id: 'medicoes', label: 'Medições' },
  { id: 'contagem', label: 'Contagem por contratante' },
  { id: 'resultado', label: 'Resultado' },
  { id: 'suporte', label: 'Suporte' },
  { id: 'extra', label: 'Extra portal' },
  { id: 'bases', label: 'Documentos e bases' },
  { id: 'configuracoes', label: 'Configurações' },
  { id: 'fechamento', label: 'Fechamento' },
] as const
export type AbaId = typeof ABAS[number]['id']
export const PERFIS = ['admin', 'gestor', 'colaborador'] as const

// ── Formatacao ────────────────────────────────────────────────────────────────
export const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
export const fmt = (n: number, d = 0) =>
  (+n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
export const brl = (n: number) =>
  (+n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export const brl2 = (n: number) =>
  (+n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const mmss = (ms: number) => {
  const t = Math.max(0, ms) / 1000, m = Math.floor(t / 60), s = t - m * 60
  return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0').replace('.', ',')
}
export const dt = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
export const nomeUsuario = (u: Usuario | undefined) => u?.nome?.trim() || u?.usuario?.trim() || 'Usuário removido'

// ── Estatistica ───────────────────────────────────────────────────────────────
export type Stat = { n: number; val: number | null; mean: number | null; med: number | null; min: number | null; max: number | null }
const STAT_VAZIA: Stat = { n: 0, val: null, mean: null, med: null, min: null, max: null }

/** Indice de minutos validados por grupo|documento|resultado (ordenados). */
export function indexarMedicoes(meds: Medicao[]) {
  const idx = new Map<string, number[]>()
  for (const m of meds) {
    if (m.situacao !== 'validada' || !m.grupo_id) continue
    const k = m.grupo_id + '|' + m.documento_id + '|' + m.resultado
    const arr = idx.get(k)
    if (arr) arr.push(m.duracao_ms / 60000); else idx.set(k, [m.duracao_ms / 60000])
  }
  for (const arr of idx.values()) arr.sort((a, b) => a - b)
  return idx
}

export type Ctx = {
  cfg: Config
  grupos: Grupo[]
  docs: Map<string, Documento>
  gd: Map<string, Set<string>>          // grupo -> documentos
  idx: Map<string, number[]>
  turnos: Map<string, string>           // turno -> contratante
  catraca: Map<string, number>          // contratante -> nº de turnos com catraca
  exige: Map<string, Set<string>>       // documento -> contratantes que exigem no GT0010 (vinculos ativos)
  ctts: Map<string, Contratante>
}

export function stat(ctx: Ctx, g: string, d: string, r: Resultado): Stat {
  const v = ctx.idx.get(g + '|' + d + '|' + r)
  if (!v || !v.length) return STAT_VAZIA
  const n = v.length
  const mean = v.reduce((a, b) => a + b, 0) / n
  const med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2
  return { n, mean, med, min: v[0], max: v[n - 1], val: ctx.cfg.base === 'media' ? mean : med }
}

/** Tempo-padrao no grupo; reprovado sem medicao usa o de aprovado (estimado). */
export function tempo(ctx: Ctx, g: string, d: string, r: Resultado): { val: number | null; est: boolean } {
  const s = stat(ctx, g, d, r)
  if (s.val != null) return { val: s.val, est: false }
  if (r === 'reprovado') {
    const a = stat(ctx, g, d, 'aprovado')
    if (a.val != null) return { val: a.val, est: true }
  }
  return { val: null, est: false }
}

export type SituacaoDoc = 'pronto' | 'andamento' | 'sem'
export function situacaoDoc(ctx: Ctx, g: string, d: string): SituacaoDoc {
  const n = stat(ctx, g, d, 'aprovado').n
  return n >= ctx.cfg.minimo ? 'pronto' : n > 0 ? 'andamento' : 'sem'
}

export const grupoPadrao = (ctx: Ctx) => ctx.grupos.find(g => g.padrao) ?? ctx.grupos[0]
export const grupoDe = (ctx: Ctx, cod: string) =>
  ctx.grupos.find(g => !g.padrao && g.contratantes.includes(String(cod))) ?? grupoPadrao(ctx)
export const noGrupo = (ctx: Ctx, g: string, d: string) => !!ctx.gd.get(g)?.has(d)
/** Contratante com catraca de acesso = tem ao menos um turno com codigo de integracao. */
export const temCatraca = (ctx: Ctx, cod: string) => (ctx.catraca.get(String(cod)) ?? 0) > 0
export const nomeCtt = (ctx: Ctx, cod: string) =>
  ctx.ctts.get(String(cod))?.nome || 'Contratante ' + cod + ' (sem cadastro)'

/** Tempo do contratante para o documento: grupo dele; se o documento nao estiver no grupo
 *  (ou nao tiver tempo nele), usa o do grupo padrao. */
export function tempoCtt(ctx: Ctx, cod: string, d: string, r: Resultado): { val: number | null; g: string } {
  const g = grupoDe(ctx, cod), p = grupoPadrao(ctx)
  if (!g || !p) return { val: null, g: '' }
  if (!g.padrao && noGrupo(ctx, g.id, d)) {
    const t = tempo(ctx, g.id, d, r)
    if (t.val != null) return { val: t.val, g: g.id }
    const tp = tempo(ctx, p.id, d, r)
    return tp.val != null ? { val: tp.val, g: p.id } : { val: null, g: g.id }
  }
  if (noGrupo(ctx, p.id, d)) return { val: tempo(ctx, p.id, d, r).val, g: p.id }
  return { val: null, g: p.id }
}

// ── Contratante principal e unidades ──────────────────────────────────────────
/** Contratante principal do codigo (ele mesmo, se nao for unidade de ninguem). */
export const principalDe = (ctx: Ctx, cod: string) => ctx.ctts.get(cod)?.contratante_pai || cod
export const unidadesDe = (ctx: Ctx, cod: string) =>
  [...ctx.ctts.values()].filter(c => c.contratante_pai === cod).map(c => c.contratante_cod)
/** Agrupa os codigos pelo contratante principal: principal -> membros (inclui o proprio principal se estiver na lista). */
export function agruparUnidades(ctx: Ctx, cods: string[]) {
  const m = new Map<string, string[]>()
  for (const c of cods) { const p = principalDe(ctx, c); const arr = m.get(p); if (arr) arr.push(c); else m.set(p, [c]) }
  return m
}

// ── Contagem por contratante ──────────────────────────────────────────────────
// ── Atribuicao por contratante (Mapa da Atribuicao, EFIDOCEMP-201) ────────────
// 1. Cod. GT0010 preenchido -> 100% para esse contratante (cada requisito e uma avaliacao propria;
//    os Ignorados do GT0120 nao se aplicam).
// 2. Requisito comum, documento de PESSOA -> contratantes dos turnos ativos (GT0130) com vinculacao
//    ativa (GT0120), menos os Ignorados. Sem turno: nao conta para ninguem.
// 3. Requisito comum, documento de EMPRESA -> contratantes da vinculacao ativa, menos os Ignorados.
// 4. Documento sem tipo no catalogo: turnos se houver, senao vinculacao (regra antiga, sinalizada).
// 5. Item de presenca ("nao conta") sai da conta.
export type Regra = 'gt0010' | 'pessoa_turno' | 'empresa_vinc' | 'sem_tipo_turno' | 'sem_tipo_vinc'
export type Bloqueio = 'doc_desconhecido' | 'nao_conta' | 'pessoa_sem_turno' | 'turno_fora_vinculo' | 'sem_vinculo' | 'todos_ignorados' | 'sem_tempo'

export const REGRAS: Record<Regra, string> = {
  gt0010: 'GT0010: 100% para o contratante do requisito',
  pessoa_turno: 'Pessoa: turnos ativos com vinculação, menos ignorados',
  empresa_vinc: 'Empresa: vinculação ativa, menos ignorados',
  sem_tipo_turno: 'Documento sem tipo: usou os turnos',
  sem_tipo_vinc: 'Documento sem tipo: usou a vinculação',
}
export const BLOQUEIOS: Record<Bloqueio, string> = {
  doc_desconhecido: 'Documento fora do catálogo',
  nao_conta: 'Não conta (item de presença)',
  pessoa_sem_turno: 'Pessoa sem turno ativo: não trabalha para nenhum contratante',
  turno_fora_vinculo: 'Turnos sem vinculação ativa (ou turno não cadastrado)',
  sem_vinculo: 'Sem vinculação ativa',
  todos_ignorados: 'Todos os contratantes ignoram o documento (GT0120)',
  sem_tempo: 'Sem tempo-padrão cronometrado',
}

export type Atribuicao = { validos: string[]; regra: Regra | null; bloqueio: Bloqueio | null; turnosDesconhecidos: string[] }

export function atribuir(l: LinhaRel, tipo: Documento['tipo'], turnos: Map<string, string>): Atribuicao {
  const uniq = (a: string[]) => [...new Set(a)]
  const tDesc = l.turnos.filter(t => !turnos.has(t))
  if (l.gt0010.length) return { validos: uniq(l.gt0010), regra: 'gt0010', bloqueio: null, turnosDesconhecidos: tDesc }
  const menosIgnorados = (v: string[], regra: Regra): Atribuicao => {
    const r = v.filter(c => !l.ignorados.includes(c))
    return { validos: r, regra: r.length ? regra : null, bloqueio: r.length ? null : 'todos_ignorados', turnosDesconhecidos: tDesc }
  }
  const pelosTurnos = (regra: Regra): Atribuicao => {
    let v = uniq(l.turnos.map(t => turnos.get(t)).filter((c): c is string => !!c))
    if (l.vinculacao.length) v = v.filter(c => l.vinculacao.includes(c))
    if (!v.length) return { validos: [], regra: null, bloqueio: 'turno_fora_vinculo', turnosDesconhecidos: tDesc }
    return menosIgnorados(v, regra)
  }
  const pelaVinculacao = (regra: Regra): Atribuicao => {
    const v = uniq(l.vinculacao)
    if (!v.length) return { validos: [], regra: null, bloqueio: 'sem_vinculo', turnosDesconhecidos: tDesc }
    return menosIgnorados(v, regra)
  }
  if (tipo === 'pessoa') {
    if (!l.turnos.length) return { validos: [], regra: null, bloqueio: 'pessoa_sem_turno', turnosDesconhecidos: tDesc }
    return pelosTurnos('pessoa_turno')
  }
  if (tipo === 'empresa') return pelaVinculacao('empresa_vinc')
  return l.turnos.length ? pelosTurnos('sem_tipo_turno') : pelaVinculacao('sem_tipo_vinc')
}

/** Mantido para compatibilidade: so os contratantes validos. */
export function contratantesValidos(l: LinhaRel, turnos: Map<string, string>, tipo: Documento['tipo'] = null): string[] {
  return atribuir(l, tipo, turnos).validos
}

export type PorCtt = { min: number; n: number; int: number; ev: number; docs: Record<string, number>; evd: Record<string, number> }
export type PorCadastro = { cod: string; razao: string; cnpj: string; n: number; min: number; ok: number; ctts: Record<string, number> }
export type Rastro = {
  i: number; documento: string; docId: string | null; empresa: string; status: string
  regra: Regra | null; bloqueio: Bloqueio | null; partes: Record<string, number>; total: number
}
export type Contagem = {
  rows: number; ok: number; pend: number; noCtt: number; ign: number; unk: number
  bloqueios: Partial<Record<Bloqueio, number>>
  regras: Partial<Record<Regra, number>>
  by: Record<string, PorCtt>
  pendList: Record<string, number>   // "grupo|documento" -> linhas
  unkList: Record<string, number>    // nome do documento -> linhas
  turnosDesc: Record<string, number> // turno nao cadastrado -> linhas
  gt0010SemCadastro: Record<string, number> // "documento|contratante": GT0010 no relatorio sem o vinculo no cadastro
  semTipo: Record<string, number>    // documento sem tipo (empresa/pessoa) usado na conta -> linhas
  cadastros: Record<string, PorCadastro>
  rastro: Rastro[]
  real: number                       // minutos
  items: { v: string[]; t: number[] }[]
}

export function contar(ctx: Ctx, linhas: LinhaRel[]): Contagem {
  const out: Contagem = {
    rows: 0, ok: 0, pend: 0, noCtt: 0, ign: 0, unk: 0, bloqueios: {}, regras: {}, by: {}, pendList: {}, unkList: {},
    turnosDesc: {}, gt0010SemCadastro: {}, semTipo: {}, cadastros: {}, rastro: [], real: 0, items: [],
  }
  const porNome = new Map<string, Documento>(), porCod = new Map<string, Documento>()
  for (const d of ctx.docs.values()) {
    porNome.set(norm(d.nome), d)
    if (d.codigo?.trim()) porCod.set(d.codigo.trim(), d)
  }
  const inc = <K extends string>(o: Partial<Record<K, number>>, k: K) => { o[k] = (o[k] || 0) + 1 }
  linhas.forEach((l, i) => {
    out.rows++
    const rastro: Rastro = {
      i: i + 1, documento: l.documento || '', docId: null, empresa: l.empresa_pessoa || l.razao_social || '', status: l.status || '',
      regra: null, bloqueio: null, partes: {}, total: 0,
    }
    out.rastro.push(rastro)
    const cadKey = l.cod_cadastro?.trim() || ''
    const cad = cadKey ? (out.cadastros[cadKey] ||= { cod: cadKey, razao: l.razao_social || l.empresa_pessoa || '', cnpj: l.cnpj || '', n: 0, min: 0, ok: 0, ctts: {} }) : null
    if (cad) cad.n++
    const bloquear = (b: Bloqueio) => { rastro.bloqueio = b; inc(out.bloqueios, b) }

    const doc = (l.cod_documento && porCod.get(l.cod_documento.trim())) || porNome.get(norm(l.documento))
    if (!doc) { const k = l.documento || '(sem nome)'; out.unk++; out.unkList[k] = (out.unkList[k] || 0) + 1; bloquear('doc_desconhecido'); return }
    rastro.docId = doc.id
    if (doc.nao_conta) { out.ign++; bloquear('nao_conta'); return }
    const r: Resultado = /REPROV/i.test(l.status || '') ? 'reprovado' : 'aprovado'
    const at = atribuir(l, doc.tipo, ctx.turnos)
    for (const t of at.turnosDesconhecidos) out.turnosDesc[t] = (out.turnosDesc[t] || 0) + 1
    if (!at.validos.length) { out.noCtt++; bloquear(at.bloqueio ?? 'sem_vinculo'); return }
    if (at.regra === 'gt0010' && ctx.exige.size) {
      for (const c of at.validos) if (!ctx.exige.get(doc.id)?.has(c)) { const k = doc.id + '|' + c; out.gt0010SemCadastro[k] = (out.gt0010SemCadastro[k] || 0) + 1 }
    }
    rastro.regra = at.regra
    if (at.regra === 'sem_tipo_turno' || at.regra === 'sem_tipo_vinc') out.semTipo[doc.id] = (out.semTipo[doc.id] || 0) + 1
    const valid = at.validos
    const ts = valid.map(c => ({ c, ...tempoCtt(ctx, c, doc.id, r) }))
    const miss = ts.filter(t => t.val == null)
    if (miss.length) {
      out.pend++
      for (const t of miss) { const k = t.g + '|' + doc.id; out.pendList[k] = (out.pendList[k] || 0) + 1 }
      bloquear('sem_tempo')
      return
    }
    if (at.regra) inc(out.regras, at.regra)
    const tv = ts as { c: string; val: number; g: string }[]
    // Camadas: cada degrau e dividido entre quem tem tempo maior ou igual
    // (tempos iguais => divisao igual, como no mapa: ASO de 1 min para 4 = 15 s cada)
    const sorted = [...tv].sort((a, b) => a.val - b.val)
    const share: Record<string, number> = {}
    for (const c of valid) share[c] = 0
    let prev = 0
    sorted.forEach((t, k) => {
      const layer = t.val - prev
      if (layer > 0) { const who = sorted.slice(k); for (const w of who) share[w.c] += layer / who.length }
      prev = t.val
    })
    out.ok++
    const total = sorted[sorted.length - 1].val
    out.real += total
    rastro.partes = share; rastro.total = total
    if (cad) { cad.ok++; cad.min += total; for (const c of valid) cad.ctts[c] = (cad.ctts[c] || 0) + share[c] }
    out.items.push({ v: tv.map(x => x.c), t: tv.map(x => x.val) })
    for (const x of tv) {
      const o = out.by[x.c] || (out.by[x.c] = { min: 0, n: 0, int: 0, ev: 0, docs: {}, evd: {} })
      o.min += share[x.c]; o.n += 1 / valid.length; o.int += x.val
      o.docs[doc.id] = (o.docs[doc.id] || 0) + share[x.c]
      const outros = tv.filter(y => y.c !== x.c).map(y => y.val)
      const ev = total - (outros.length ? Math.max(...outros) : 0)
      o.ev += ev
      if (ev > 0) o.evd[doc.id] = (o.evd[doc.id] || 0) + ev
    }
  })
  return out
}

/** Documentos que aparecem com turno no relatorio: sao documentos de pessoa (turno so existe em pessoa). */
export function docsComTurno(ctx: Ctx, linhas: LinhaRel[]): Set<string> {
  const porNome = new Map<string, string>(), porCod = new Map<string, string>()
  for (const d of ctx.docs.values()) { porNome.set(norm(d.nome), d.id); if (d.codigo?.trim()) porCod.set(d.codigo.trim(), d.id) }
  const s = new Set<string>()
  for (const l of linhas) {
    if (!l.turnos.length) continue
    const id = (l.cod_documento && porCod.get(l.cod_documento.trim())) || porNome.get(norm(l.documento))
    if (id) s.add(id)
  }
  return s
}

/** Minutos liberados se o conjunto de contratantes sair junto. */
export function liberado(c: Contagem, sai: Set<string>): number {
  let f = 0
  for (const it of c.items) {
    const total = Math.max(...it.t)
    const resto = it.t.filter((_, i) => !sai.has(it.v[i]))
    f += total - (resto.length ? Math.max(...resto) : 0)
  }
  return f
}

// ── Resultado ─────────────────────────────────────────────────────────────────
export type Financeiro = { ok: boolean; cap: number; ch: number; hmin: number }
/** Parametros da equipe vazios => ok=false (a tela pede para preencher em vez de calcular). */
export function financeiro(cfg: Config): Financeiro {
  const { custo_mensal, pessoas, dias_uteis, horas_dia } = cfg
  if ([custo_mensal, pessoas, dias_uteis, horas_dia].some(v => v == null || !(+v! > 0)))
    return { ok: false, cap: 0, ch: 0, hmin: 0 }
  const cap = pessoas! * dias_uteis! * horas_dia! * (cfg.pct_capacidade / 100)
  const ch = cap > 0 ? custo_mensal! / cap : 0
  const hmin = ch / (1 - Math.min(0.95, Math.max(0, cfg.margem_desejada / 100)))
  return { ok: cap > 0, cap, ch, hmin }
}

/** Fator de projecao do relatorio para o mes: dias do mes / dias do relatorio. */
export function fatorMes(cfg: Config, rel: Relatorio | null): number | null {
  const mes = cfg.dias_mes ?? cfg.dias_uteis
  if (!rel?.dias_uteis || !mes) return null
  return mes / rel.dias_uteis
}

// ── Importacao do relatorio ───────────────────────────────────────────────────
export const COLUNAS_MODELO = [
  'Data', 'Cód. documento', 'Documento', 'Status', 'Empresa/Pessoa', 'Cód. cadastro', 'Razão social', 'CNPJ',
  'Cód. vinculação', 'Cód. ignorado GT0120', 'Cód. contratante GT0010', 'Cód. turno GT0130', 'Usuário',
]

function dataIso(v: string): string | null {
  const s = v.trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

export function parseLinhas(aoa: unknown[][]): LinhaRel[] {
  if (!aoa.length) return []
  const h = aoa[0].map(x => norm(x).toLowerCase().replace(/[^a-z0-9]/g, ''))
  const find = (f: (x: string) => boolean) => h.findIndex(f)
  const ix = {
    ign: find(x => x.includes('ignorado')), gt: find(x => x.includes('gt0010')), tur: find(x => x.includes('turno')),
    vinc: find(x => x.includes('vinculacao')), cad: find(x => x.includes('cadastro')), raz: find(x => x.includes('razao')),
    cnpj: find(x => x.includes('cnpj')), usr: find(x => x.includes('usuario')), st: find(x => x === 'status'),
    ep: find(x => x.includes('empresapessoa')), cod: find(x => x.includes('cod') && x.includes('doc')),
    doc: find(x => x === 'documento' || x === 'descricaodocumento'), data: find(x => x === 'data' || x.startsWith('data')),
  }
  if (ix.doc < 0) throw new Error('Coluna "Documento" não encontrada no cabeçalho.')
  const lista = (v: unknown) => String(v ?? '').split(/[;,\s]+/).map(s => s.trim()).filter(Boolean)
  const g = (r: unknown[], k: keyof typeof ix) => (ix[k] >= 0 ? r[ix[k]] : '')
  const txt = (r: unknown[], k: keyof typeof ix) => { const s = String(g(r, k) ?? '').trim(); return s || null }
  return aoa.slice(1)
    .filter(r => r && String(g(r, 'doc') ?? '').trim())
    .map(r => ({
      data: dataIso(String(g(r, 'data') ?? '')),
      cod_documento: txt(r, 'cod'),
      documento: String(g(r, 'doc')).trim(),
      status: txt(r, 'st') ?? 'APROVADO',
      empresa_pessoa: txt(r, 'ep'), cod_cadastro: txt(r, 'cad'), razao_social: txt(r, 'raz'), cnpj: txt(r, 'cnpj'),
      vinculacao: lista(g(r, 'vinc')), ignorados: lista(g(r, 'ign')), gt0010: lista(g(r, 'gt')), turnos: lista(g(r, 'tur')),
      usuario: txt(r, 'usr'),
    }))
}

export const csvCell = (v: unknown) => {
  const s = String(v ?? '')
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
export function baixar(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Validade do documento ─────────────────────────────────────────────────────
export const VALIDADES: { dias: number; label: string }[] = [
  { dias: 0, label: 'Único (não vence)' }, { dias: 30, label: 'Mensal' }, { dias: 60, label: '60 dias' }, { dias: 90, label: 'Trimestral' },
  { dias: 120, label: '120 dias' }, { dias: 180, label: 'Semestral' }, { dias: 365, label: 'Anual' }, { dias: 730, label: 'Bienal' },
  { dias: 1095, label: '3 anos' }, { dias: 1825, label: '5 anos' }, { dias: 3650, label: '10 anos' },
]
export const rotuloValidade = (dias: number | null | undefined) =>
  dias == null ? '—' : VALIDADES.find(v => v.dias === dias)?.label ?? `${dias} dias`
/** Avaliacoes por mes de um documento com essa validade (unico ou sem validade = 0). */
export const porMes = (dias: number | null | undefined) => (dias && dias > 0 ? 365 / 12 / dias : 0)
const PER_GT0010: Record<string, number> = { U: 0, M: 30, T: 90, S: 180, A: 365, B: 730 }
/** Validade lida do nome (ex.: "ASO - ANUAL" = 365, "EPI - 60 DIAS" = 60, "VACINA - 10A" = 3650) ou,
 *  sem pista no nome, da periodicidade do GT0010. null = sem pista (ex.: "INFORMADA": vale a data do documento). */
export function validadePeloNome(nome: string, periodicidadeGt0010?: string | null): number | null {
  const n = norm(nome)
  if (/\bUNICO\b/.test(n)) return 0
  if (/\bINFORMAD[OA]\b/.test(n)) return null
  const dias = n.match(/-\s*(\d+)\s*DIAS\s*$/); if (dias) return +dias[1]
  const anos = n.match(/-\s*(\d+)\s*A(NOS?)?\s*$/); if (anos) return +anos[1] * 365
  const pal: [RegExp, number][] = [[/\bBIMESTRAL\b/, 60], [/\bQUADRIMESTRAL\b/, 120], [/\bTRIMESTRAL\b/, 90], [/\bSEMESTRAL\b/, 180],
    [/\bMENSAL\b/, 30], [/\bANUAL\b/, 365], [/\bBIENAL\b/, 730], [/\bTRIENAL\b/, 1095]]
  for (const [re, d] of pal) if (re.test(n)) return d
  const p = periodicidadeGt0010?.split('/')[0]?.trim()
  return p && p in PER_GT0010 ? PER_GT0010[p] : null
}

// ── Bases prontas (conjuntos de documentos) ───────────────────────────────────
/** perk = nivel de venda (Base...); os demais sao grupos de contratantes (so o que difere da Base). */
export type Conjunto = { id: string; nome: string; descricao: string | null; created_by: string | null; created_at: string; docs: string[]; perk: boolean; ordem: number }
/** Tempo do documento num grupo de criterio; sem tempo no grupo, usa o do padrao. */
export function tempoNoGrupo(ctx: Ctx, g: string, d: string, r: Resultado): { val: number | null; est: boolean; g: string | null } {
  const p = grupoPadrao(ctx)
  if (g && noGrupo(ctx, g, d)) { const t = tempo(ctx, g, d, r); if (t.val != null) return { ...t, g } }
  if (p) { const t = tempo(ctx, p.id, d, r); if (t.val != null) return { ...t, g: p.id } }
  return { val: null, est: false, g: null }
}
