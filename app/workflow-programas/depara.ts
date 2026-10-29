// Leitura do retorno do Claude (JSON "gt3.checklist.depara" v1.0) e casamento com o checklist
// da análise aberta. Só lógica pura — a tela fica em ImportarRetornoModal.tsx. Nada daqui grava:
// o resultado é aplicado pelo mesmo setDraft usado quando o analista marca na mão.

export type DeparaStatus = 'ok' | 'nao' | 'na' | 'restricao'

/** Formato mínimo do checklist que o casamento precisa (estrutural, para não depender dos
 *  tipos internos do WorkflowProgramasClient). */
export type DeparaItem = {
  id: string; titulo: string; documento: string; critico: boolean
  tipo: 'status' | 'opcoes'; multiplaEscolha: boolean; statusOptions: string[]
  opcoes: { id: string; label: string; corpo: string; pedirTexto: boolean }[]
}
export type DeparaResposta = {
  status: DeparaStatus | ''; obs: string
  opcoesSelecionadas?: string[]; textosLivres?: Record<string, string>; prazoRestricaoDias?: number
  /** Marca "preenchido pelo Claude" — some quando o analista mexe na bolinha/opção. */
  claude?: { paginas: number[]; evidencia: string }
}

export type DeparaRespostaJson = {
  documento: string; item: string; visivel: boolean
  checklists?: string[]; escopo?: string; critico?: boolean
  resposta?: string | null; valores?: string[]
  origem?: 'automatica' | 'usuario' | 'pendente'
  paginas?: number[]; evidencia?: string
  motivo?: string; textoReprovacao?: string; textoNaoConforme?: string
}
export type DeparaFuncao = { pgr: string | null; pcmso: string | null; situacao: string; paginasPgr?: number[]; paginasPcmso?: number[] }
export type DeparaJson = {
  formato: string; versao: string; geradoEm?: string; ferramenta?: string
  empresa?: { razaoSocial?: string; cnpj?: string }
  checklists: string[]
  respostas: DeparaRespostaJson[]
  pendentes?: { documento: string; item: string }[]
  reprovacoes?: { PGR?: string; PCMSO?: string; LTCAT?: string }
  orientacoes?: ListaPorDoc; observacoes?: ListaPorDoc
  funcoes?: DeparaFuncao[]
}

/** Orientações/observações: lista simples (formato antigo) ou separadas por documento
 *  ({ "PGR": [...], "PCMSO": [...], "GERAL": [...] }). */
export type ListaPorDoc = string[] | Record<string, string[]>

/** Parte do retorno que fica guardada na análise (dados.retornoClaude) para consulta. */
export type RetornoClaudeResumo = {
  importadoEm: string; geradoEm?: string
  reprovacoes: { PGR?: string; PCMSO?: string; LTCAT?: string }
  orientacoes: ListaPorDoc; observacoes: ListaPorDoc; funcoes: DeparaFuncao[]
}

/** Aceita lista, objeto por documento ou texto solto; descarta o que não for texto. */
function normalizarLista(x: unknown): ListaPorDoc {
  const textos = (v: unknown): string[] =>
    (Array.isArray(v) ? v : [v]).filter((t): t is string => typeof t === 'string' && !!t.trim())
  if (Array.isArray(x) || typeof x === 'string') return textos(x)
  if (!x || typeof x !== 'object') return []
  const out: Record<string, string[]> = {}
  Object.entries(x).forEach(([doc, v]) => { const t = textos(v); if (t.length) out[doc.trim().toUpperCase()] = t })
  return out
}

const ORDEM_DOCS = ['PGR', 'PCMSO', 'LTCAT', 'GERAL']

/** Junta orientações e observações por documento, na ordem PGR, PCMSO, LTCAT, GERAL. Itens
 *  de lista simples ficam em doc '' (sem documento), no topo. */
export function agruparPorDocumento(...listas: (ListaPorDoc | undefined)[]): { doc: string; itens: string[] }[] {
  const grupos = new Map<string, string[]>()
  const add = (doc: string, itens: string[]) => grupos.set(doc, [...(grupos.get(doc) ?? []), ...itens])
  listas.forEach(l => {
    if (!l) return
    if (Array.isArray(l)) add('', l)
    else Object.entries(l).forEach(([doc, itens]) => add(doc, itens))
  })
  const peso = (d: string) => (d === '' ? -1 : ORDEM_DOCS.includes(d) ? ORDEM_DOCS.indexOf(d) : ORDEM_DOCS.length)
  return Array.from(grupos.entries())
    .filter(([, itens]) => itens.length)
    .sort((a, b) => peso(a[0]) - peso(b[0]) || a[0].localeCompare(b[0]))
    .map(([doc, itens]) => ({ doc, itens }))
}

export const normDepara = (s: string) => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[‐-―]/g, '-')
  .replace(/\s+/g, ' ').replace(/-+/g, '-').replace(/\s*-\s*/g, ' - ')
  .trim()

export const soDigitos = (s: string) => (s || '').replace(/\D/g, '')

/** Lê o texto colado: tira cercas de markdown (```json … ```), valida formato/versão e o
 *  mínimo da estrutura. Erros já em português, com posição quando o JSON é inválido. */
export function lerRetorno(texto: string): { ok: true; data: DeparaJson } | { ok: false; erro: string } {
  let t = texto.trim()
  if (!t) return { ok: false, erro: 'Cole o JSON do retorno antes de ler.' }
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (cerca) t = cerca[1].trim()
  let raw: unknown
  try {
    raw = JSON.parse(t)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const pos = Number(msg.match(/position (\d+)/)?.[1])
    let onde = ''
    if (Number.isFinite(pos)) {
      const antes = t.slice(0, pos)
      const linha = antes.split('\n').length
      const coluna = pos - antes.lastIndexOf('\n')
      onde = ` (linha ${linha}, coluna ${coluna}: “${t.slice(Math.max(0, pos - 20), pos + 20).replace(/\s+/g, ' ')}”)`
    } else {
      onde = ` (começa com “${t.slice(0, 30).replace(/\s+/g, ' ')}${t.length > 30 ? '…' : ''}”)`
    }
    return { ok: false, erro: `O texto colado não é um JSON válido${onde}. Confira se copiou o retorno inteiro.` }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, erro: 'O JSON precisa ser um objeto { … } no formato gt3.checklist.depara.' }
  const d = raw as Partial<DeparaJson>
  if (d.formato !== 'gt3.checklist.depara') return { ok: false, erro: `Formato não reconhecido: “${d.formato ?? '(vazio)'}”. Esperado: gt3.checklist.depara.` }
  if (d.versao !== '1.0') return { ok: false, erro: `Versão ${d.versao ?? '(vazia)'} não suportada — o sistema lê a versão 1.0.` }
  if (!Array.isArray(d.respostas)) return { ok: false, erro: 'O JSON não tem a lista "respostas".' }
  if (!Array.isArray(d.checklists)) return { ok: false, erro: 'O JSON não tem a lista "checklists".' }
  const respostas = d.respostas.filter((r): r is DeparaRespostaJson =>
    !!r && typeof r === 'object' && typeof r.documento === 'string' && typeof r.item === 'string')
  return {
    ok: true,
    data: {
      ...d, checklists: d.checklists.map(String), respostas,
      orientacoes: normalizarLista(d.orientacoes), observacoes: normalizarLista(d.observacoes),
    } as DeparaJson,
  }
}

const STATUS_POR_TEXTO: Record<string, DeparaStatus> = {
  conforme: 'ok', aprovado: 'ok', ok: 'ok',
  reprovacao: 'nao', reprovado: 'nao', 'nao conforme': 'nao',
  'aprovado com restricao': 'restricao', restricao: 'restricao',
  'nao aplicavel': 'na', 'n/a': 'na', na: 'na',
}
export const STATUS_LABEL: Record<DeparaStatus, string> = { ok: 'Conforme', nao: 'Reprovação', restricao: 'Aprovado com restrição', na: 'Não aplicável' }

export type Situacao = 'novo' | 'igual' | 'diferente' | 'sem' | 'invalido' | 'pendente'
export const SITUACAO_LABEL: Record<Situacao, string> = {
  novo: 'Novo', igual: 'Igual', diferente: 'Diferente', sem: 'Sem correspondência', invalido: 'Inválido', pendente: 'Pendente',
}

export type LinhaDepara = {
  chave: string
  documento: string; item: string
  itemId: string | null
  situacao: Situacao
  atualTxt: string; claudeTxt: string
  paginas: number[]; evidencia: string
  reprovacao: boolean
  /** Opções do JSON que não existem no item (múltipla escolha aplica as demais). */
  invalidas: string[]
  motivoInvalido?: string
  /** O JSON trouxe o item mais de uma vez (um por checklist) com respostas diferentes. */
  aviso?: string
  proposta?: DeparaResposta
}

function respostaTxt(i: DeparaItem, r?: DeparaResposta): string {
  if (!r) return ''
  if (i.tipo === 'opcoes') {
    const sel = r.opcoesSelecionadas || []
    return i.opcoes.filter(o => sel.includes(o.id)).map(o => o.label).join(', ')
  }
  return r.status ? STATUS_LABEL[r.status] : ''
}

function acharOpcao(i: DeparaItem, texto: string) {
  const n = normDepara(texto)
  return i.opcoes.find(o => normDepara(o.label) === n)
    ?? i.opcoes.find(o => normDepara(o.corpo) === n)
    // "Capa" casa com "Capa ou local de preferência" (rótulo ganhou complemento).
    ?? i.opcoes.find(o => normDepara(o.label).startsWith(n + ' '))
}

/** Monta a pré-visualização. `itensVisiveis(respostas)` devolve os itens da análise com as
 *  condições "Aparece quando" avaliadas para aquelas respostas — é chamado de novo a cada
 *  passada (até 5), porque marcar um item pode fazer outro aparecer. Itens com visivel:false
 *  no JSON são ignorados. */
export function montarPreview(
  data: DeparaJson,
  respostasAtuais: Record<string, DeparaResposta>,
  itensVisiveis: (respostas: Record<string, DeparaResposta>) => DeparaItem[],
): LinhaDepara[] {
  const doJson = consolidarRepetidas(data.respostas.map((r, idx) => ({ r, idx })).filter(({ r }) => r.visivel !== false))
  const linhas = new Map<number, LinhaDepara>()
  const sim: Record<string, DeparaResposta> = { ...respostasAtuais }

  for (let passada = 0; passada < 5; passada++) {
    const itens = itensVisiveis(sim)
    const porChave = new Map(itens.map(i => [normDepara(i.documento) + '|' + normDepara(i.titulo), i]))
    let mudou = false
    for (const { r, idx } of doJson) {
      if (linhas.has(idx)) continue
      const item = porChave.get(normDepara(r.documento) + '|' + normDepara(r.item))
      if (!item) continue
      const linha = casar(r, idx, item, respostasAtuais[item.id])
      linhas.set(idx, linha)
      if (linha.proposta) { sim[item.id] = linha.proposta; mudou = true }
    }
    if (!mudou) break
  }

  // O que sobrou não apareceu no checklist mesmo depois das passadas.
  for (const { r, idx } of doJson) {
    if (linhas.has(idx)) continue
    const pendente = r.resposta == null && !(r.valores?.length)
    linhas.set(idx, {
      chave: String(idx), documento: r.documento, item: r.item, itemId: null,
      situacao: pendente ? 'pendente' : 'sem',
      atualTxt: '', claudeTxt: r.resposta ?? (r.valores ?? []).join(', '),
      paginas: r.paginas ?? [], evidencia: r.evidencia ?? '', reprovacao: false, invalidas: [],
      motivoInvalido: pendente ? undefined : 'Item não encontrado no checklist desta análise',
    })
  }
  return Array.from(linhas.entries()).sort((a, b) => a[0] - b[0]).map(([, l]) => l)
}

const PESO_STATUS: Record<DeparaStatus, number> = { nao: 3, restricao: 2, ok: 1, na: 0 }

/** O Claude responde por checklist (Volare, Marcopolo…), mas aqui o item comum aparece uma vez
 *  só. Sem juntar, as duas respostas do mesmo item iam para o mesmo itemId e a última vencia —
 *  "Reprovação" na Volare + "Conforme" na Marcopolo saía aprovado. Junta tudo numa resposta:
 *  bolinha → a mais restritiva (Reprovação > Restrição > Conforme > N/A); opções → união;
 *  páginas e evidências somadas. */
function consolidarRepetidas(lista: { r: DeparaRespostaJson; idx: number }[]): { r: DeparaRespostaJson & { aviso?: string }; idx: number }[] {
  const grupos = new Map<string, { r: DeparaRespostaJson; idx: number }[]>()
  lista.forEach(e => {
    const k = normDepara(e.r.documento) + '|' + normDepara(e.r.item)
    grupos.set(k, [...(grupos.get(k) ?? []), e])
  })
  return Array.from(grupos.values()).map(g => {
    if (g.length === 1) return g[0]
    const respondidas = g.filter(e => e.r.resposta != null || e.r.valores?.length)
    const peso = (t?: string | null) => {
      const s = STATUS_POR_TEXTO[normDepara(t ?? '')]
      return s ? PESO_STATUS[s] : -1
    }
    const escolhida = respondidas.reduce<{ r: DeparaRespostaJson; idx: number } | undefined>(
      (m, e) => (!m || peso(e.r.resposta) > peso(m.r.resposta) ? e : m), undefined) ?? g[0]
    const unicos = <T,>(xs: T[]) => Array.from(new Set(xs))
    const textos = unicos(respondidas.map(e => e.r.resposta ?? (e.r.valores ?? []).join(', ')))
    const valores = unicos(g.flatMap(e => e.r.valores ?? []))
    const r: DeparaRespostaJson & { aviso?: string } = {
      ...escolhida.r,
      valores: valores.length ? valores : escolhida.r.valores,
      checklists: unicos(g.flatMap(e => e.r.checklists ?? [])),
      paginas: unicos(g.flatMap(e => e.r.paginas ?? [])).sort((a, b) => a - b),
      evidencia: unicos(g.map(e => e.r.evidencia?.trim()).filter(Boolean)).join(' | '),
      aviso: textos.length > 1
        ? `Respostas diferentes entre checklists (${g.map(e => `${(e.r.checklists ?? []).join(', ') || '?'}: ${e.r.resposta ?? ((e.r.valores ?? []).join(', ') || '—')}`).join(' · ')}) — mantida a mais restritiva.`
        : undefined,
    }
    return { r, idx: escolhida.idx }
  })
}

function casar(r: DeparaRespostaJson & { aviso?: string }, idx: number, item: DeparaItem, atual?: DeparaResposta): LinhaDepara {
  const base: LinhaDepara = {
    chave: String(idx), documento: r.documento, item: item.titulo, itemId: item.id,
    situacao: 'novo', atualTxt: respostaTxt(item, atual), claudeTxt: '',
    paginas: (r.paginas ?? []).filter(n => Number.isFinite(n)), evidencia: r.evidencia ?? '',
    reprovacao: false, invalidas: [], aviso: r.aviso,
  }
  const claude = { paginas: base.paginas, evidencia: base.evidencia }
  const temValores = !!r.valores?.length

  if (r.resposta == null && !temValores) return { ...base, situacao: 'pendente' }

  let proposta: DeparaResposta
  if (item.tipo === 'opcoes') {
    const textos = item.multiplaEscolha ? (temValores ? r.valores! : [r.resposta!]) : [r.resposta ?? r.valores![0]]
    const achadas = textos.map(t => ({ t, o: acharOpcao(item, t) }))
    const validas = achadas.filter(a => a.o).map(a => a.o!)
    const invalidas = achadas.filter(a => !a.o).map(a => a.t)
    base.claudeTxt = textos.join(', ')
    base.invalidas = invalidas
    if (!validas.length) return { ...base, situacao: 'invalido', motivoInvalido: `Opção inexistente no item: ${invalidas.join(', ')}` }
    // Opção que pede detalhe (ex.: "Página específica" → número da página): usa a 1ª página
    // citada pelo Claude, sem apagar o que o analista já tinha digitado.
    const textosLivres = { ...(atual?.textosLivres || {}) }
    validas.forEach(o => { if (o.pedirTexto && !textosLivres[o.id]?.trim() && base.paginas.length) textosLivres[o.id] = String(base.paginas[0]) })
    proposta = {
      status: atual?.status || '', obs: atual?.obs || '',
      opcoesSelecionadas: validas.map(o => o.id), textosLivres, claude,
    }
    const atualSel = [...(atual?.opcoesSelecionadas || [])].sort().join('|')
    const novaSel = validas.map(o => o.id).sort().join('|')
    base.situacao = !atualSel ? 'novo' : atualSel === novaSel ? 'igual' : 'diferente'
  } else {
    const status = STATUS_POR_TEXTO[normDepara(r.resposta ?? '')]
    base.claudeTxt = r.resposta ?? ''
    if (!status || !item.statusOptions.includes(status)) {
      return { ...base, situacao: 'invalido', motivoInvalido: `“${r.resposta}” não é uma bolinha deste item` }
    }
    base.reprovacao = status === 'nao'
    base.claudeTxt = STATUS_LABEL[status]
    proposta = { ...(atual || { obs: '' }), status, obs: atual?.obs || '', claude }
    base.situacao = !atual?.status ? 'novo' : atual.status === status ? 'igual' : 'diferente'
  }
  return { ...base, proposta }
}
