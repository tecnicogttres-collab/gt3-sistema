// ─── Conferência de Comprovantes de Depósito — lógica de leitura e comparação ──
//
// Portado do protótipo `htmls-referencia/comparador-comprovantes (1).html`
// (só a lógica de negócio — nada de aparência foi copiado de lá).
// Módulo 100% client-side: nenhuma função aqui toca em rede ou em Supabase.

// ─── Utilidades de texto ────────────────────────────────────────────────────

export function semAcento(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}
export function normBusca(s: string): string {
  return semAcento(s || '').toUpperCase()
}
export function normNome(s: string): string {
  return normBusca(s).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()
}
const PALAVRAS_IGNORADAS = ['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']
export function chaveNome(s: string): string {
  return normNome(s).split(' ').filter(p => PALAVRAS_IGNORADAS.indexOf(p) < 0).join(' ')
}
export function soDigitos(s: string): string {
  return (s || '').replace(/\D/g, '')
}
export function normCpf(s: string): string {
  let d = soDigitos(s)
  if (!d) return ''
  if (d.length > 11) d = d.slice(-11)
  return d.padStart(11, '0')
}
export function fmtCpf(c: string): string {
  return c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : (c || '')
}
export function fmtCpfMasc(c: string): string {
  return c && c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : (c || '')
}
export function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
/** Listas configuráveis separadas por vírgula (vínculos, cargos, rótulos). */
export function listaCsv(s: string): string[] {
  return (s || '').split(',').map(x => normBusca(x).trim()).filter(Boolean)
}
export function z2(n: number): string {
  return String(n).padStart(2, '0')
}
export function dataBr(d: Date | null | undefined): string {
  return d ? `${z2(d.getDate())}/${z2(d.getMonth() + 1)}/${d.getFullYear()}` : ''
}
export function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`
}

/** Distância de Levenshtein normalizada (1 = idêntico, 0 = nada em comum). */
export function similar(a: string, b: string): number {
  a = chaveNome(a); b = chaveNome(b)
  if (!a || !b) return 0
  if (a === b) return 1
  const m = a.length, n = b.length
  let prev: number[] = []
  const cur: number[] = []
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur.slice()
  }
  return 1 - prev[n] / Math.max(m, n)
}

export function paraData(s: string, fmt: 'mdy' | 'dmy'): Date | null {
  if (!s) return null
  const p = s.split('/').map(x => parseInt(x, 10))
  if (p.length < 3 || isNaN(p[0]) || isNaN(p[1]) || isNaN(p[2])) return null
  let dia: number, mes: number
  if (fmt === 'dmy') { dia = p[0]; mes = p[1] } else { mes = p[0]; dia = p[1] }
  if (mes > 12) { const t = mes; mes = dia; dia = t }
  const ano = p[2] < 100 ? 2000 + p[2] : p[2]
  return new Date(ano, mes - 1, dia)
}

export function paraNumero(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}
export function dinheiroBr(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ─── Feriados e dias úteis ──────────────────────────────────────────────────

/** Domingo de Páscoa pelo algoritmo de Gauss. */
export function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}
export function feriadosNacionais(ano: number): Date[] {
  const f = [[1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25]].map(
    p => new Date(ano, p[0] - 1, p[1])
  )
  const p = pascoa(ano), dia = 86400000
  f.push(new Date(p.getTime() - 47 * dia)) // Carnaval
  f.push(new Date(p.getTime() - 2 * dia))  // Sexta-feira Santa
  f.push(new Date(p.getTime() + 60 * dia)) // Corpus Christi
  return f
}
export function conjuntoFeriados(ano: number, extras: string): Record<string, boolean> {
  const s: Record<string, boolean> = {}
  feriadosNacionais(ano).concat(feriadosNacionais(ano + 1)).forEach(d => { s[chaveDia(d)] = true })
  ;(extras || '').split(',').forEach(x => {
    const p = x.trim().split('/')
    if (p.length === 3) s[`${p[2]}-${z2(+p[1])}-${z2(+p[0])}`] = true
  })
  return s
}
export function ehDiaUtil(d: Date, fer: Record<string, boolean>): boolean {
  return d.getDay() !== 0 && d.getDay() !== 6 && !fer[chaveDia(d)]
}
export function nesimoDiaUtil(ano: number, mes: number, n: number, fer: Record<string, boolean>): Date | null {
  const d = new Date(ano, mes, 1)
  let conta = 0
  for (;;) {
    if (ehDiaUtil(d, fer)) conta++
    if (conta >= n) return new Date(d)
    d.setDate(d.getDate() + 1)
    if (d.getMonth() !== mes && conta === 0) return null
  }
}

export type Janela = { inicio: Date; fim: Date; competencia: string }
export type ConfigPrazo = { diasFim: number; diasUteis: number; feriados: string }

/** Janela de depósito: últimos N dias da competência até o Nº dia útil do mês seguinte. */
export function janelaPrazo(comp: string, cfg: ConfigPrazo): Janela | null {
  const p = (comp || '').split('/')
  if (p.length !== 2) return null
  const mes = parseInt(p[0], 10) - 1
  let ano = parseInt(p[1], 10)
  if (isNaN(mes) || isNaN(ano) || mes < 0 || mes > 11) return null
  if (ano < 100) ano += 2000
  const fer = conjuntoFeriados(ano, cfg.feriados)
  const ultimo = new Date(ano, mes + 1, 0)
  const inicio = new Date(ano, mes + 1, 0)
  inicio.setDate(ultimo.getDate() - (cfg.diasFim - 1))
  let proxMes = mes + 1, proxAno = ano
  if (proxMes > 11) { proxMes = 0; proxAno++ }
  const fim = nesimoDiaUtil(proxAno, proxMes, cfg.diasUteis, fer)
  if (!fim) return null
  fim.setHours(23, 59, 59)
  return { inicio, fim, competencia: comp }
}

/** Aceita "08/2026" ou "082026"/"0826" — os dois primeiros dígitos são sempre o mês. */
export function normalizarComp(v: string): string {
  const s = (v || '').trim()
  let m = /^(\d{1,2})\s*[/\-.]\s*(\d{2,4})$/.exec(s)
  if (!m) {
    const m2 = /^(\d{2})(\d{2}|\d{4})$/.exec(s)
    if (m2) m = m2
  }
  if (!m) return ''
  const mes = z2(parseInt(m[1], 10)), ano = m[2].length === 2 ? '20' + m[2] : m[2]
  if (+mes < 1 || +mes > 12) return ''
  return mes + '/' + ano
}

// ─── Diagnóstico de leitura de página ───────────────────────────────────────

export function textoUtil(t: string): number {
  return (t || '').replace(/[^A-Za-z0-9À-ÿ]/g, '').length
}
export function palavrasLegiveis(t: string): number {
  return ((t || '').match(/\b[A-Za-zÀ-ÿ]{3,}\b/g) || []).length
}
/** Algumas fontes de PDF não têm mapa de caracteres: o texto existe, mas vira
 *  ruído ("4 ) R S T ( < > >"). Tem caractere, não tem palavra — precisa de OCR
 *  tanto quanto uma página escaneada. */
export function diagnosticarPagina(tx: string, minChars: number): { chars: number; palavras: number; motivo: string } {
  const chars = textoUtil(tx), palavras = palavrasLegiveis(tx)
  let motivo = ''
  if (chars < minChars) motivo = 'pouco texto'
  else if (palavras < 5) motivo = 'texto ilegível (fonte sem mapa de caracteres)'
  return { chars, palavras, motivo }
}

export type OrigemPagina = 'pdf' | 'ocr' | 'ocr-vazio' | 'ocr-erro'
export type DiagPagina = {
  n: number
  chars: number
  palavras: number
  itens: number
  origem: OrigemPagina
  motivo?: string
  angulo?: number
  pontos?: number
  detalhe?: string
  classificacao?: 'holerite' | 'comprovante'
}

// ─── Classificação do documento (relatório do Portal x comprovantes) ───────

export type TipoDoc = 'relatorio' | 'comprovantes'

export function pontuarDoc(t: string): { comprovantes: number; relatorio: number } {
  let g = 0, r = 0
  if (/CONFER[EÊ]NCIA GUIA|CONFERENCIA GUIA/i.test(t)) r += 4
  if (/GT1000|INSOFT/i.test(t)) r += 3
  if (/Empresa\s+Pessoa/i.test(t)) r += 4
  if (/Admiss[aã]o/i.test(t)) r += 3
  if (/V[ií]nculo/i.test(t)) r += 2
  if (/\bEFETIVO\b/.test(t)) r += 2

  if (/comprovante/i.test(t)) g += 4
  if (/favorecido|benefici[aá]rio|creditado/i.test(t)) g += 3
  if (/transfer[eê]ncia|pix|ted|doc\b|dep[óo]sito|pagamento/i.test(t)) g += 2
  if (/ag[eê]ncia|conta corrente|banco/i.test(t)) g += 2
  if (/autentica[çc][aã]o|id da transa[çc][aã]o|n[uú]mero do documento/i.test(t)) g += 2
  return { comprovantes: g, relatorio: r }
}
export function classificarTipo(pontos: { comprovantes: number; relatorio: number }): TipoDoc {
  return pontos.relatorio > pontos.comprovantes ? 'relatorio' : 'comprovantes'
}

export type DocPontos = {
  id: string
  tipo: TipoDoc
  manual: boolean
  pontos: { comprovantes: number; relatorio: number } | null
}
/** Se nenhum documento foi classificado como relatório, o de melhor margem migra
 *  para lá — só entre os já lidos e não ajustados manualmente. */
export function equilibrarDocs<T extends DocPontos>(docs: T[]): T[] {
  const prontos = docs.filter(d => d.pontos && !d.manual)
  if (prontos.length < 2 || docs.some(d => d.manual)) return docs
  if (prontos.some(d => d.tipo === 'relatorio')) return docs
  const margem = (d: T) => (d.pontos ? d.pontos.relatorio - d.pontos.comprovantes : -Infinity)
  const cand = [...prontos].sort((a, b) => margem(b) - margem(a))[0]
  if (cand && cand.pontos && cand.pontos.relatorio >= 4) {
    return docs.map(d => (d.id === cand.id ? { ...d, tipo: 'relatorio' as TipoDoc } : d))
  }
  return docs
}

// ─── Relatório do Portal GT3 ────────────────────────────────────────────────

const VINCULOS = ['EFETIVO', 'TEMPORARIO', 'ASSOCIADO', 'PJ', 'AUTONOMO', 'APRENDIZ', 'ESTAGIARIO', 'SOCIO', 'DIRETOR', 'COOPERADO']

export type PessoaRelatorio = {
  pessoa: string
  cpf: string
  atividade: string
  vinculo: string
  cadastro: string
  admissao: string
  dataCad: Date | null
  repeticoes: number
}

export function lerRelatorio(texto: string, formato: 'auto' | 'mdy' | 'dmy'): { pessoas: PessoaRelatorio[]; empresa: string } {
  const linhas = texto.replace(/\t/g, ' ').split(/\n+/)
  const brutos: { antes: string; cpf: string; meio: string; cadastro: string; admissao: string }[] = []
  const re = /^(.*?)\s(\d{8,11})\s+(.*?)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{1,2}\/\d{1,2}\/\d{2,4}))?\s*$/

  linhas.forEach(l0 => {
    const l = l0.replace(/\s+/g, ' ').trim()
    if (!l || /Empresa\s+Pessoa/i.test(l)) return
    const m = re.exec(l)
    if (!m) return
    const antes = m[1].trim()
    if (!/[A-Za-zÀ-ÿ]{3}/.test(antes)) return
    brutos.push({ antes, cpf: normCpf(m[2]), meio: (m[3] || '').trim(), cadastro: m[4], admissao: m[5] || '' })
  })

  let prefixo = ''
  if (brutos.length > 1) {
    prefixo = brutos[0].antes
    brutos.forEach(b => {
      let i = 0
      while (i < prefixo.length && i < b.antes.length && prefixo[i] === b.antes[i]) i++
      prefixo = prefixo.slice(0, i)
    })
    prefixo = prefixo.replace(/\S*$/, '').trim()
  }
  const empresa = prefixo

  let fmt = formato
  if (fmt === 'auto') {
    fmt = 'mdy'
    brutos.forEach(b => { if (parseInt(b.cadastro.split('/')[0], 10) > 12) fmt = 'dmy' })
  }

  const pessoas: PessoaRelatorio[] = brutos.map(b => {
    const pessoa = prefixo && b.antes.indexOf(prefixo) === 0 ? b.antes.slice(prefixo.length).trim() : b.antes
    let vinculo = '', atividade = b.meio
    const tokens = b.meio.split(' ')
    const ultimo = normBusca(tokens[tokens.length - 1] || '')
    if (VINCULOS.indexOf(ultimo) >= 0) {
      vinculo = tokens.pop() as string
      atividade = tokens.join(' ').trim()
    }
    return {
      pessoa, cpf: b.cpf, atividade, vinculo, cadastro: b.cadastro, admissao: b.admissao,
      dataCad: paraData(b.cadastro, fmt as 'mdy' | 'dmy'), repeticoes: 1,
    }
  })

  const vistos: Record<string, PessoaRelatorio> = {}
  const unicos: PessoaRelatorio[] = []
  pessoas.forEach(p => {
    const chave = p.cpf || chaveNome(p.pessoa)
    const j = vistos[chave]
    if (j) {
      j.repeticoes++
      if (!j.atividade && p.atividade) j.atividade = p.atividade
      if (!j.vinculo && p.vinculo) j.vinculo = p.vinculo
      if (p.dataCad && (!j.dataCad || p.dataCad < j.dataCad)) { j.dataCad = p.dataCad; j.cadastro = p.cadastro }
      return
    }
    vistos[chave] = p
    unicos.push(p)
  })
  return { pessoas: unicos, empresa }
}

// ─── Comprovantes de depósito / holerites ───────────────────────────────────

const MESES: Record<string, number> = { JAN: 0, FEV: 1, MAR: 2, ABR: 3, MAI: 4, JUN: 5, JUL: 6, AGO: 7, SET: 8, OUT: 9, NOV: 10, DEZ: 11 }
const MESES_NOME: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7,
  AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
}

export type DataNoBloco = { pos: number; data: Date; texto: string }

/** Datas com posição dentro do bloco de texto. */
export function datasDoBloco(t: string): DataNoBloco[] {
  const achados: DataNoBloco[] = []
  let m: RegExpExecArray | null
  const re1 = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g
  while ((m = re1.exec(t)) !== null) {
    const ano = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    achados.push({ pos: m.index, data: new Date(ano, +m[2] - 1, +m[1]), texto: m[0] })
  }
  const re2 = /\b(\d{4})-(\d{2})-(\d{2})\b/g
  while ((m = re2.exec(t)) !== null) {
    achados.push({ pos: m.index, data: new Date(+m[1], +m[2] - 1, +m[3]), texto: m[0] })
  }
  const re3 = /\b(\d{1,2})\s*(?:DE\s+)?(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\s*(?:DE\s+)?(\d{4})\b/g
  while ((m = re3.exec(t)) !== null) {
    achados.push({ pos: m.index, data: new Date(+m[3], MESES[m[2]], +m[1]), texto: m[0] })
  }
  return achados.filter(a => !isNaN(a.data.getTime()))
}

export type Holerite = { nome: string; liquido: number | null; competencia: string }

/** "RECIBO DE PAGAMENTO" também é usado por alguns bancos como título de
 *  comprovante de depósito comum (ex.: CAIXA), sem relação com folha de
 *  pagamento. Por isso o cabeçalho sozinho não basta: exige-se também um
 *  traço específico de holerite — INSS, FGTS, descontos ou base de cálculo. */
export function ehHolerite(norm: string): boolean {
  const titulo = /RECIBO DE PAGAMENTO|RECIBO DE SALARIO|DEMONSTRATIVO DE PAGAMENTO|DEMONSTRATIVO DE PAGTO|CONTRACHEQUE|HOLERITE/.test(norm)
  const liquidoDireto = /LIQUIDO A RECEBER|LIQ\.? A RECEBER/.test(norm)
  const tracosPayroll = /\bINSS\b|\bFGTS\b|\bDESCONTOS?\b|BASE DE C[AÁ]LCULO|SALARIO BASE|SAL[AÁ]RIO BASE/.test(norm)
  return liquidoDireto || (titulo && tracosPayroll)
}
export function lerHolerite(norm: string): Holerite {
  const dados: Holerite = { nome: '', liquido: null, competencia: '' }
  const re = /(?:RECEBER|L[IÍ]QUIDO)[^0-9]{0,25}(\d{1,3}(?:\.\d{3})*,\d{2})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(norm)) !== null) dados.liquido = paraNumero(m[1])

  const nome = /NOME\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú' ]{4,60}?)\s+(?:LOCAL|NOME SOC|CBO|FUN[CÇ]AO|ORDEM|SAL[AÁ]RIO|DEPTO|MATRICULA|CNPJ)/.exec(norm)
  if (nome) dados.nome = nome[1].replace(/\s+/g, ' ').trim()

  const comp = /\b(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*\/\s*(\d{4})\b/.exec(norm)
  if (comp) dados.competencia = z2(MESES_NOME[comp[1]]) + '/' + comp[2]
  return dados
}

/** Nome do favorecido de um comprovante, para o caso de pagamento a terceiro. */
export function lerFavorecido(norm: string): string {
  const padroes = [
    /DADOS DO FAVORECIDO\s*NOME\s+([A-ZÀ-Ú][A-ZÀ-Ú' ]{4,60}?)\s+(?:CNPJ|CPF|CONTA|BANCO|AG[EÊ]NCIA)/,
    /FAVORECIDO\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú' ]{4,60}?)\s+(?:CNPJ|CPF|CONTA|BANCO|AG[EÊ]NCIA|DATA|VALOR)/,
    /BENEFICI[AÁ]RIO\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú' ]{4,60}?)\s+(?:CNPJ|CPF|CONTA|BANCO|-|DATA|VALOR)/,
    /\bPARA\b\s+([A-ZÀ-Ú][A-ZÀ-Ú' ]{4,60}?)\s+(?:CHAVE|CPF|CNPJ|BANCO|INSTITUI|DADOS)/,
  ]
  for (const padrao of padroes) {
    const m = padrao.exec(norm)
    if (m) return m[1].replace(/\s+/g, ' ').trim()
  }
  return ''
}

/** Nem todo comprovante escreve "R$": alguns bancos imprimem só "Valor 2.255,32",
 *  na mesma linha da data do crédito. */
export function valorProximo(t: string, pos: number, rotulos: string[]): { texto: string; numero: number | null } {
  const re = /(R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g
  let m: RegExpExecArray | null
  let melhor: { peso: number; texto: string; numero: number | null } | null = null
  while ((m = re.exec(t)) !== null) {
    const antes = normBusca(t.slice(Math.max(0, m.index - 45), m.index))
    let bonus = 0
    if (m[1]) bonus += 150
    ;(rotulos || []).forEach(r => { if (r && antes.indexOf(r) >= 0) bonus += 300 })
    if (/\d{2}\/\d{2}\/\d{2,4}[^0-9]{0,15}$/.test(antes)) bonus += 200
    const peso = Math.abs(m.index - pos) - bonus
    if (!melhor || peso < melhor.peso) {
      melhor = { peso, texto: dinheiroBr(paraNumero(m[2])), numero: paraNumero(m[2]) }
    }
  }
  return melhor || { texto: '', numero: null }
}

/** Vocabulário comum de comprovante e holerite: nunca deve ser tratado como
 *  candidato a "nome parecido" — foi assim que "VALMIR" quase casou com a
 *  palavra "VALOR" de um comprovante qualquer. */
const VOCABULARIO_COMPROVANTE: Record<string, 1> = {
  VALOR: 1, DATA: 1, BANCO: 1, CONTA: 1, AGENCIA: 1, TOTAL: 1, DOCUMENTO: 1,
  COMPROVANTE: 1, DEPOSITO: 1, PAGAMENTO: 1, PAGO: 1, NOME: 1, CPF: 1, CNPJ: 1,
  FAVORECIDO: 1, BENEFICIARIO: 1, CREDITO: 1, DEBITO: 1, TRANSFERENCIA: 1,
  AUTENTICACAO: 1, SEGURANCA: 1, ORIGEM: 1, DESTINO: 1, TIPO: 1, FINALIDADE: 1,
  IDENTIFICACAO: 1, RECIBO: 1, SALARIO: 1, LIQUIDO: 1, RECEBER: 1, DESCONTOS: 1,
  BASE: 1, BRUTO: 1, INSS: 1, FGTS: 1, FUNCAO: 1, EMPRESA: 1, MATRICULA: 1,
  ADMISSAO: 1, VINCULO: 1, CADASTRO: 1, ATIVIDADE: 1, EFETIVO: 1, MENSAL: 1,
  CATEGORIA: 1, TRABALHADOR: 1, ESTABELECIMENTO: 1, TOMADOR: 1, GUIA: 1,
  REMUNERACAO: 1, CONVENIO: 1, OPERACAO: 1, PARCELADO: 1, VENCIMENTO: 1,
  ELETRONICA: 1, BANCARIA: 1, OUVIDORIA: 1, ATENDIMENTO: 1, PESSOAS: 1,
  DEFICIENCIA: 1, LOCALIDADES: 1, METROPOLITANAS: 1, REGIOES: 1, CENTRAL: 1,
}

const JANELA_TOKENS = 90

/** Palavras de 3+ letras do bloco, com a posição de cada uma. */
export function palavrasDoTexto(norm: string): { palavra: string; pos: number }[] {
  const lista: { palavra: string; pos: number }[] = []
  const re = /[A-ZÀ-Ú]{3,}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(norm)) !== null) {
    if (!VOCABULARIO_COMPROVANTE[m[0]]) lista.push({ palavra: m[0], pos: m.index })
  }
  return lista
}
/** Quanto uma palavra pode diferir para ainda contar como a mesma, com erro de
 *  digitação: uma letra em palavras curtas, até duas em palavras longas. */
export function distanciaTolerada(tamanho: number): number {
  if (tamanho < 4) return 0
  if (tamanho < 6) return 1
  return 2
}
export function acharPalavraProxima(t: string, palavras: { palavra: string; pos: number }[]): { pos: number; palavra: string }[] {
  const dist = distanciaTolerada(t.length)
  const achadas: { pos: number; palavra: string }[] = []
  if (!dist) return achadas
  palavras.forEach(w => {
    if (Math.abs(w.palavra.length - t.length) > dist) return
    const limiar = 1 - dist / Math.max(t.length, w.palavra.length)
    if (similar(t, w.palavra) >= limiar) achadas.push({ pos: w.pos, palavra: w.palavra })
  })
  return achadas
}

export type DetalheTolerancia = { portal: string; comprovante: string }
export type AcharPorTokensResultado = { pos: number; tolerante: boolean; detalhes: DetalheTolerancia[] }

/** Casa o nome por partes, permitindo pequeno erro de digitação — mas só quando
 *  pelo menos um outro pedaço do nome (sobrenome ou nome do meio, não o
 *  primeiro nome) bate exato no texto. Essa âncora impede que duas pessoas
 *  diferentes, com sobrenomes parecidos, sejam confundidas. */
export function acharPorTokens(norm: string, tokens: string[], janela: number, fracao: number): -1 | AcharPorTokensResultado {
  if (!tokens.length) return -1

  const exatas = tokens.map(t => {
    const re = new RegExp('\\b' + escRegex(t) + '\\b', 'g')
    const achados: number[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(norm)) !== null) achados.push(m.index)
    return achados
  })

  const temAncora = exatas.some((l, i) => i > 0 && l.length > 0)
  let palavras: { palavra: string; pos: number }[] | null = null
  const detalhes: DetalheTolerancia[] = []
  const posicoes = exatas.map((l, i) => {
    if (l.length) return l
    // o primeiro nome nunca tolera erro de digitação: é ele que costuma
    // diferenciar pessoas de verdade
    if (i === 0 || !temAncora) return []
    if (!palavras) palavras = palavrasDoTexto(norm)
    const prox = acharPalavraProxima(tokens[i], palavras)
    if (prox.length) detalhes.push({ portal: tokens[i], comprovante: prox[0].palavra })
    return prox.map(x => x.pos)
  })

  if (!posicoes[0].length) return -1
  const necessarios = tokens.length === 1 ? 1 : Math.max(2, Math.ceil(tokens.length * fracao))
  let achado = -1
  posicoes[0].forEach(p => {
    if (achado >= 0) return
    let conta = 0
    posicoes.forEach(l => { if (l.some(q => Math.abs(q - p) <= janela)) conta++ })
    if (conta >= necessarios) achado = p
  })
  return achado < 0 ? -1 : { pos: achado, tolerante: detalhes.length > 0, detalhes }
}

// ─── Blocos de texto (uma página de um documento de comprovantes) ─────────

export type BlocoTexto = {
  rotulo: string
  ocr: boolean
  bruto: string
  norm: string
  digitos: string
  mapa: Record<number, number>
  datas: DataNoBloco[]
  candidatos: { texto: string; pos: number }[]
  tipo: 'holerite' | 'comprovante'
  holerite: Holerite | null
  favorecido: string
  valores: (number | null)[]
}

export type DocParaBlocos = {
  tipo: TipoDoc
  arquivo: string
  paginas: string[]
  ocr: number[]
  diag?: DiagPagina[]
}

export function prepararBlocos(docs: DocParaBlocos[]): BlocoTexto[] {
  const blocos: BlocoTexto[] = []
  docs.forEach(d => {
    if (d.tipo !== 'comprovantes') return
    d.paginas.forEach((tx, i) => {
      // só fica de fora a página sem nenhuma palavra legível (imagem pura ou
      // fonte sem mapa de caracteres); página curta mas com texto real entra
      if (palavrasLegiveis(tx) < 3) return
      const norm = normBusca(tx)
      let digitos = ''
      const mapa: Record<number, number> = {}
      for (let k = 0; k < norm.length; k++) {
        if (norm[k] >= '0' && norm[k] <= '9') { mapa[digitos.length] = k; digitos += norm[k] }
      }
      const candidatos: { texto: string; pos: number }[] = []
      norm.split('\n').forEach(l => {
        const limpo = l.replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()
        if (limpo.split(' ').length >= 2 && limpo.length >= 8 && limpo.length <= 60) {
          candidatos.push({ texto: limpo, pos: Math.max(0, norm.indexOf(l)) })
        }
      })
      const veioDeOcr = (d.ocr || []).indexOf(i + 1) >= 0
      const holerite = ehHolerite(norm)
      blocos.push({
        rotulo: d.arquivo + ' · pág. ' + (i + 1) + (veioDeOcr ? ' (OCR)' : ''),
        ocr: veioDeOcr,
        bruto: tx, norm, digitos, mapa,
        datas: datasDoBloco(norm), candidatos,
        tipo: holerite ? 'holerite' : 'comprovante',
        holerite: holerite ? lerHolerite(norm) : null,
        favorecido: holerite ? '' : lerFavorecido(norm),
        valores: (norm.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || []).map(paraNumero),
      })
      // devolve a classificação para o diagnóstico por página, para que o
      // usuário veja o que o sistema entendeu sem precisar adivinhar
      if (d.diag && d.diag[i]) d.diag[i].classificacao = holerite ? 'holerite' : 'comprovante'
    })
  })
  return blocos
}

export type ConfigLeitura = { rotulosData: string[]; rotulosValor: string[]; similar: number }

export type Achado = {
  bloco: string
  via: string
  ocr: boolean
  tolerancia: boolean
  detalhesTolerancia: DetalheTolerancia[]
  data: Date | null
  valor: string
  valorNum: number | null
}

/** Localiza a pessoa nos blocos e devolve a melhor ocorrência, por prioridade
 *  decrescente: nome completo exato > CPF completo > CPF mascarado > tokens
 *  do nome com tolerância > nome aproximado por similaridade geral. */
export function localizar(pessoa: PessoaRelatorio, blocos: BlocoTexto[], cfg: ConfigLeitura): Achado | null {
  const nomeTokens = normNome(pessoa.pessoa).split(' ').filter(Boolean)
  if (!nomeTokens.length) return null
  const reNome = new RegExp(nomeTokens.map(escRegex).join('[\\s.]+'))
  const cpf = pessoa.cpf
  const meio = cpf ? cpf.slice(3, 9) : ''
  const reMasc = meio ? new RegExp('\\*{2,3}[.\\s]?' + meio.slice(0, 3) + '[.\\s]?' + meio.slice(3) + '[-\\s]?\\*{2}') : null

  // Varre o documento inteiro e guarda o melhor casamento, não o primeiro —
  // sem isso, um casamento por tolerância numa página cedo no arquivo podia
  // "roubar" a vaga de um casamento exato que só aparecia páginas depois.
  const PRIORIDADE: Record<string, number> = { nome: 5, CPF: 4, 'CPF mascarado': 3, tokenExato: 2, tokenTolerante: 1, aproximado: 0 }
  let melhor: Achado | null = null
  let melhorPrioridade = -1

  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i], t = b.norm
    let pos = -1, via = '', prioridade = -1
    let tolerancia = false
    let detalhesTolerancia: DetalheTolerancia[] = []

    const m = reNome.exec(t)
    if (m) { pos = m.index; via = 'nome'; prioridade = PRIORIDADE.nome }
    if (pos < 0 && cpf) {
      const idx = b.digitos.indexOf(cpf)
      if (idx >= 0) { pos = b.mapa[idx] !== undefined ? b.mapa[idx] : 0; via = 'CPF'; prioridade = PRIORIDADE.CPF }
    }
    if (pos < 0 && reMasc) {
      const mm = reMasc.exec(t)
      if (mm) { pos = mm.index; via = 'CPF mascarado'; prioridade = PRIORIDADE['CPF mascarado'] }
    }
    if (pos < 0) {
      const chave = chaveNome(pessoa.pessoa).split(' ').filter(Boolean)
      const pt = acharPorTokens(t, chave, JANELA_TOKENS, 0.6)
      if (pt !== -1) {
        pos = pt.pos; via = 'nome parcial'; tolerancia = pt.tolerante; detalhesTolerancia = pt.detalhes
        prioridade = tolerancia ? PRIORIDADE.tokenTolerante : PRIORIDADE.tokenExato
      }
    }
    if (pos < 0 && cfg.similar < 1) {
      for (const cand of b.candidatos) {
        if (similar(pessoa.pessoa, cand.texto) >= cfg.similar) {
          pos = cand.pos
          via = 'nome aproximado ("' + cand.texto + '")'
          prioridade = PRIORIDADE.aproximado
          break
        }
      }
    }

    if (pos >= 0 && prioridade > melhorPrioridade) {
      const datas = b.datas
      let escolhida: { peso: number; data: Date; texto: string } | null = null
      datas.forEach(d => {
        const antes = t.slice(Math.max(0, d.pos - 45), d.pos)
        let bonus = 0
        cfg.rotulosData.forEach(r => { if (antes.indexOf(r) >= 0) bonus = 400 })
        const peso = Math.abs(d.pos - pos) - bonus
        if (!escolhida || peso < escolhida.peso) escolhida = { peso, data: d.data, texto: d.texto }
      })
      melhorPrioridade = prioridade
      const vp = valorProximo(b.bruto, pos, cfg.rotulosValor)
      melhor = {
        bloco: b.rotulo, via, ocr: !!b.ocr, tolerancia, detalhesTolerancia,
        data: escolhida ? (escolhida as { data: Date }).data : null,
        valor: vp.texto, valorNum: vp.numero,
      }
      // nome exato é o melhor caso possível — nada supera isso, pode parar
      if (prioridade === PRIORIDADE.nome) break
    }
  }
  return melhor
}

export type HoleriteAchado = { liquido: number | null; competencia: string; nome: string; bloco: string; ocr: boolean }

/** Acha o holerite da pessoa e devolve o líquido a receber. */
export function acharHolerite(pessoa: PessoaRelatorio, blocos: BlocoTexto[], cfg: ConfigLeitura): HoleriteAchado | null {
  const chave = chaveNome(pessoa.pessoa)
  const tokens = chave.split(' ').filter(Boolean)
  for (const b of blocos) {
    const hol = b.holerite
    if (!hol) continue
    let bate = !!(hol.nome && chaveNome(hol.nome) === chave)
    if (!bate && hol.nome && similar(hol.nome, pessoa.pessoa) >= (cfg.similar || 0.88)) bate = true
    if (!bate && acharPorTokens(b.norm, tokens, JANELA_TOKENS, 0.6) !== -1) bate = true
    if (bate) return { liquido: hol.liquido, competencia: hol.competencia, nome: hol.nome, bloco: b.rotulo, ocr: b.ocr }
  }
  return null
}

export type Terceiro = { favorecido: string; bloco: string; ocr: boolean; valorNum: number | null; valor: string; data: Date | null }

/** Comprovante cujo valor bate com o líquido do holerite, mas em nome de outra
 *  pessoa — caso do salário pago a cônjuge mediante procuração/autorização. */
export function acharPagamentoPorValor(liquido: number, blocos: BlocoTexto[]): Terceiro | null {
  if (liquido === null || liquido === undefined) return null
  for (const b of blocos) {
    if (b.tipo === 'holerite') continue
    for (const valor of b.valores) {
      if (valor !== null && Math.abs(valor - liquido) < 0.005) {
        const datas = [...b.datas].sort((x, y) => x.pos - y.pos)
        return {
          favorecido: b.favorecido, bloco: b.rotulo, ocr: b.ocr,
          valorNum: valor, valor: dinheiroBr(valor),
          data: datas.length ? datas[0].data : null,
        }
      }
    }
  }
  return null
}

// ─── Comparação ─────────────────────────────────────────────────────────────

export type Situacao = 'falta' | 'ok' | 'fora' | 'divergente' | 'terceiro' | 'atraso'

export type Resultado = {
  dados: PessoaRelatorio
  situacao: Situacao
  motivo: string
  campo: string
  achado: Achado | null
  holerite: HoleriteAchado | null
  terceiro: Terceiro | null
  nota: string
  diasAtraso: number
}

export type OpcoesComparacao = {
  competencia: string
  janela: Janela | null
  data: boolean
  vinculo: boolean
  cargo: boolean
  prazo: boolean
  vinculos: string[]
  cargos: string[]
  leitura: ConfigLeitura
}

export function ultimoDia(comp: string): Date | null {
  const p = (comp || '').split('/')
  if (p.length !== 2) return null
  return new Date(parseInt(p[1], 10), parseInt(p[0], 10), 0, 23, 59, 59)
}

export function comparar(listaA: PessoaRelatorio[], blocos: BlocoTexto[], opcoes: OpcoesComparacao): Resultado[] {
  const limite = opcoes.data ? ultimoDia(opcoes.competencia) : null

  return listaA.map(p => {
    const r: Resultado = {
      dados: p, situacao: 'ok', motivo: '', campo: '', achado: null, holerite: null, terceiro: null, nota: '', diasAtraso: 0,
    }
    const vin = normBusca(p.vinculo)
    const car = normBusca(p.atividade)

    let fora = false
    if (opcoes.vinculo && opcoes.vinculos.some(v => v && vin.indexOf(v) >= 0)) {
      fora = true; r.campo = 'vinculo'
      r.motivo = 'vínculo ' + (p.vinculo || '').toLowerCase()
    } else if (opcoes.cargo && opcoes.cargos.some(c => c && car.indexOf(c) >= 0)) {
      fora = true; r.campo = 'atividade'
      r.motivo = 'cargo ' + (p.atividade || '').toLowerCase()
    } else if (limite && p.dataCad && p.dataCad > limite) {
      fora = true; r.campo = 'cadastro'
      r.motivo = 'cadastro em ' + dataBr(p.dataCad) + ', posterior à competência ' + opcoes.competencia
    }
    r.situacao = fora ? 'fora' : 'ok'

    let achado: Achado | null = null
    if (!fora) {
      const soComprovantes = blocos.filter(b => b.tipo !== 'holerite')
      achado = localizar(p, soComprovantes, opcoes.leitura)
      r.achado = achado
      r.holerite = acharHolerite(p, blocos, opcoes.leitura)
    }

    // salário pago a terceiro: sem comprovante no nome da pessoa, mas existe um
    // crédito exatamente no valor do líquido do holerite dela
    if (!fora && !achado && r.holerite && r.holerite.liquido !== null) {
      const terceiro = acharPagamentoPorValor(r.holerite.liquido, blocos)
      if (terceiro) {
        r.terceiro = terceiro
        achado = {
          bloco: terceiro.bloco, via: 'valor do holerite', ocr: terceiro.ocr,
          tolerancia: false, detalhesTolerancia: [],
          data: terceiro.data, valor: terceiro.valor, valorNum: terceiro.valorNum,
        }
        r.achado = achado
      }
    }

    if (!fora) {
      if (!achado) {
        r.situacao = 'falta'
      } else if (opcoes.prazo && opcoes.janela && achado.data) {
        if (achado.data > opcoes.janela.fim) {
          r.situacao = 'atraso'
          r.diasAtraso = Math.round((achado.data.getTime() - opcoes.janela.fim.getTime()) / 86400000)
          r.campo = 'deposito'
          r.motivo = 'depósito após o prazo (' + dataBr(opcoes.janela.fim) + ')'
        } else if (achado.data < opcoes.janela.inicio) {
          r.situacao = 'ok'
          r.nota = 'depósito em ' + dataBr(achado.data) + ', anterior à janela do prazo — conferir se é da competência'
        } else {
          r.situacao = 'ok'
        }
      } else {
        r.situacao = 'ok'
        if (!achado.data) r.nota = 'não identifiquei a data neste comprovante'
      }

      if (achado && achado.via === 'nome parcial') {
        r.nota = (r.nota ? r.nota + ' · ' : '') + 'localizado por parte do nome — conferir'
      }
      if (achado && achado.via && achado.via.indexOf('aproximado') >= 0) {
        r.nota = (r.nota ? r.nota + ' · ' : '') + 'localizado por ' + achado.via
      }

      // cruzamento com o holerite
      if (r.holerite) {
        if (r.holerite.competencia && opcoes.competencia && r.holerite.competencia !== opcoes.competencia) {
          r.nota = (r.nota ? r.nota + ' · ' : '') + 'holerite é da competência ' + r.holerite.competencia
        }
        if (r.holerite.liquido !== null && achado && achado.valorNum !== null && achado.valorNum !== undefined) {
          if (Math.abs(achado.valorNum - r.holerite.liquido) >= 0.005 && r.situacao !== 'atraso') {
            r.situacao = 'divergente'
            r.campo = 'valor'
            r.motivo = 'holerite ' + dinheiroBr(r.holerite.liquido) + ', comprovante ' + dinheiroBr(achado.valorNum)
          }
        }
      }
      if (r.terceiro && r.situacao !== 'atraso' && r.situacao !== 'divergente') {
        r.situacao = 'terceiro'
        r.campo = 'deposito'
        r.motivo = 'crédito em nome de ' + (r.terceiro.favorecido || 'outra pessoa') + ', no valor do holerite'
      }
      if (achado && achado.ocr) {
        r.nota = (r.nota ? r.nota + ' · ' : '') + 'página lida por OCR — conferir nome e data'
      }
    }
    return r
  })
}

// ─── Modelos configuráveis (observação / frase de atraso) ─────────────────

export const MODELO_PADRAO = [
  '{#alerta}[CONFERIR ANTES DE ENVIAR — {alerta}. Apague esta linha depois da conferência.]',
  '{/alerta}{data} {hora} - {#faltantes}Por favor, verificar que o(s) seguinte(s) colaborador(es) cadastrado(s) no Portal não possui(em) comprovante de depósito referente à competência {competencia}:',
  '{faltantes}{/faltantes}{#sem_faltantes}todos os colaboradores cadastrados no Portal possuem comprovante de depósito referente à competência {competencia}.{/sem_faltantes}',
  '{#divergencias}',
  'Também identificamos divergência entre o valor do holerite e o do comprovante:',
  '{divergencias}',
  '{/divergencias}{#terceiros}',
  'E o(s) seguinte(s) crédito(s) foi(ram) efetuado(s) em nome de terceiro; favor encaminhar a autorização do colaborador:',
  '{terceiros}',
  '{/terceiros}',
].join('\n')

export const MODELO_ATRASO_PADRAO = [
  '{data} {hora} - Identificamos que o(s) depósito(s) da competência {competencia} foi(ram) realizado(s) após o prazo, que se encerrou em {prazo_final}. O pagamento do salário deve ocorrer até o 5º dia útil do mês seguinte ao trabalhado, conforme o art. 459, §1º, da CLT. Solicitamos atenção para que os próximos depósitos sejam efetuados dentro do prazo.',
  '',
  'Colaborador(es) com depósito fora do prazo:',
  '{atrasados}',
].join('\n')

export const ITEM_FALTA_PADRAO = '{nome}'
export const ITEM_DESC_PADRAO = '{nome} — {motivo}'
export const ITEM_ATRASO_PADRAO = '{nome} — depósito em {data_deposito} ({dias_atraso} dia(s) após o prazo)'
export const ITEM_DIVERG_PADRAO = '{nome} — holerite {valor_holerite}, comprovante {valor}'
export const ITEM_TERCEIRO_PADRAO = '{nome} — crédito de {valor} em nome de {favorecido}'

export const VINCULOS_PADRAO = 'ASSOCIADO, PJ'
export const CARGOS_PADRAO = 'SOCIO, ESTAGIARIO, DIRETOR'
export const ROTULOS_DATA_PADRAO = 'DATA DO PAGAMENTO, DATA DA TRANSFERENCIA, DATA DO DEPOSITO, DATA DA OPERACAO, DATA DE EFETIVACAO, PAGO EM, DATA'
export const ROTULOS_VALOR_PADRAO = 'VALOR, VALOR TOTAL, VALOR DO PAGAMENTO'
export const SIMILAR_PADRAO = 0.88
export const OCR_IDIOMA_PADRAO = 'por'
export const OCR_ESCALA_PADRAO = 2.2
export const OCR_MIN_PADRAO = 60
export const DIAS_FIM_PADRAO = 5
export const DIAS_UTEIS_PADRAO = 5

export function preencherModelo(modelo: string, dados: Record<string, string | number | boolean>): string {
  let t = modelo
  const secoes = ['alerta', 'faltantes', 'sem_faltantes', 'desconsiderados', 'atrasados', 'divergencias', 'terceiros']
  secoes.forEach(s => {
    const re = new RegExp('\\{#' + s + '\\}([\\s\\S]*?)\\{\\/' + s + '\\}', 'g')
    t = t.replace(re, (_m, dentro) => (dados['cond_' + s] ? dentro : ''))
  })
  t = t.replace(/\{(\w+)\}/g, (_todo, chave) => {
    const v = dados[chave]
    return v === undefined || v === null ? '' : String(v)
  })
  return t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim()
}
export function preencherItem(formato: string, campos: Record<string, string>): string {
  return formato.replace(/\{(\w+)\}/g, (_todo, chave) => campos[chave] ?? '')
}

// ─── localStorage ───────────────────────────────────────────────────────────

export function guardar(chave: string, valor: string): boolean {
  try { localStorage.setItem(chave, valor); return true } catch { return false }
}
export function recuperar(chave: string): string | null {
  try { return localStorage.getItem(chave) } catch { return null }
}
