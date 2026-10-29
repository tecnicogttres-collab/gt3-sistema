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
  orientacoes?: string[]; observacoes?: string[]
  funcoes?: DeparaFuncao[]
}

/** Parte do retorno que fica guardada na análise (dados.retornoClaude) para consulta. */
export type RetornoClaudeResumo = {
  importadoEm: string; geradoEm?: string
  reprovacoes: { PGR?: string; PCMSO?: string; LTCAT?: string }
  orientacoes: string[]; observacoes: string[]; funcoes: DeparaFuncao[]
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
  return { ok: true, data: { ...d, checklists: d.checklists.map(String), respostas } as DeparaJson }
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
  const doJson = data.respostas.map((r, idx) => ({ r, idx })).filter(({ r }) => r.visivel !== false)
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

function casar(r: DeparaRespostaJson, idx: number, item: DeparaItem, atual?: DeparaResposta): LinhaDepara {
  const base: LinhaDepara = {
    chave: String(idx), documento: r.documento, item: item.titulo, itemId: item.id,
    situacao: 'novo', atualTxt: respostaTxt(item, atual), claudeTxt: '',
    paginas: (r.paginas ?? []).filter(n => Number.isFinite(n)), evidencia: r.evidencia ?? '',
    reprovacao: false, invalidas: [],
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
