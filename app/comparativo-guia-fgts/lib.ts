// Lógica pura do Comparativo Guia x Relatório (sem React, sem DOM) — leitura do
// relatório do Portal, leitura do detalhe da guia FGTS (texto digital ou vindo de
// OCR) e comparação. Portado de htmls-referencia/comparador-guia-fgts.html.

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type PessoaRelatorio = {
  pessoa: string
  cpf: string
  atividade: string
  vinculo: string
  cadastro: string
  admissao: string
  dataCad: Date | null
  dataAdmissao: Date | null
  repeticoes: number
}

export type PessoaGuia = { cpf: string; nome: string; estab: string; tomador: string }

export type Guia = {
  pessoas: Record<string, PessoaGuia>
  competencia: string
  razao: string
  cnpj: string
  /** "Qtd. Trabalhadores FGTS" informado pela própria guia (0 se não achou). */
  qtd: number
}

export type Situacao = 'falta' | 'ok' | 'fora'

export type Resultado = {
  dados: PessoaRelatorio
  situacao: Situacao
  motivo: string
  campo: string
  achado: PessoaGuia | null
  nota: string
  divergente: boolean
  admissaoPosterior: boolean
  /** Casou por aproximação (CPF com 1–2 dígitos trocados, nome parecido ou nome achado
   *  no texto bruto) — continua "consta", mas pede conferência. */
  aprox: boolean
}

export type DiagPagina = {
  n: number
  chars: number
  palavras: number
  itens?: number
  origem: 'pdf' | 'ocr' | 'ocr-vazio' | 'ocr-erro'
  motivo?: string
  angulo?: number
  pontos?: number
  detalhe?: string
}

// ─── Utilidades de texto ────────────────────────────────────────────────────

export function semAcento(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}
export function normNome(s: string): string {
  return semAcento(s).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()
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
  return c && c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : (c ? fmtCpf(c) : '')
}
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

// ─── OCR: partes que não dependem do navegador ──────────────────────────────

/** Ajustes do OCR (iguais aos do comparador de comprovantes). Caminhos vazios = padrão do
 *  tesseract.js (worker, core e idioma "por" baixados de cdn.jsdelivr.net e guardados em cache). */
export const OCR_CFG = { idioma: 'por', escala: 2.2, minChars: 60, nucleos: 0, workerPath: '', corePath: '', langPath: '' }
export type OcrConfig = typeof OCR_CFG

export function pontuarTexto(t: string): number {
  if (!t) return 0
  let p = 0
  p += (t.match(/\d{2}\/\d{2}\/\d{2,4}/g) || []).length * 6
  p += (t.match(/\d{3}\s?[.,:]?\s?\d{3}\s?[.,:]?\s?\d{3}\s?[-–—]\s?\d{2}/g) || []).length * 6
  p += (t.match(/FGTS|GUIA|TRABALHADOR|COMPET|TOMADOR|ESTABELECIMENTO|MATR[IÍ]CULA|CATEGORIA|CPF|TOTAL|CONFER[EÊ]NCIA|ADMISS|V[IÍ]NCULO|PESSOA/gi) || []).length * 3
  p += (t.match(/\b[A-Za-zÀ-ÿ]{4,}\b/g) || []).length
  return p
}

/** Executa várias páginas ao mesmo tempo, respeitando o número de núcleos. */
export function emParalelo<T>(itens: T[], limite: number, tarefa: (item: T) => Promise<unknown>, aoConcluir?: (feitos: number) => void): Promise<void> {
  let i = 0, ativos = 0, feitos = 0
  return new Promise(resolve => {
    function seguir() {
      if (i >= itens.length && ativos === 0) { resolve(); return }
      while (ativos < limite && i < itens.length) {
        const item = itens[i++]
        ativos++
        tarefa(item).then(() => {}, () => {}).then(() => {
          ativos--; feitos++
          if (aoConcluir) aoConcluir(feitos)
          seguir()
        })
      }
    }
    seguir()
  })
}

export function textoUtil(t: string): number { return (t || '').replace(/[^A-Za-z0-9À-ÿ]/g, '').length }
export function palavrasLegiveis(t: string): number { return ((t || '').match(/\b[A-Za-zÀ-ÿ]{3,}\b/g) || []).length }
/** Alguns PDFs trazem a fonte sem mapa de caracteres: o texto existe, mas sai como códigos
 *  de glifo ("4 ) R S T ( < > >"). Tem caractere, não tem palavra. Nesse caso a página
 *  precisa de OCR tanto quanto uma página escaneada. */
export function diagnosticarPagina(tx: string, minChars: number): { chars: number; palavras: number; motivo: string } {
  const chars = textoUtil(tx), palavras = palavrasLegiveis(tx)
  let motivo = ''
  if (chars < minChars) motivo = 'pouco texto'
  else if (palavras < 5) motivo = 'texto ilegível (fonte sem mapa de caracteres)'
  return { chars, palavras, motivo }
}

// ─── Classificação dos PDFs ─────────────────────────────────────────────────

/** Identifica, pelo conteúdo, se o PDF é a guia do FGTS ou o relatório do Portal. */
export function pontuar(t: string): { guia: number; relatorio: number } {
  let g = 0, r = 0
  if (/Detalhe da Guia/i.test(t)) g += 4
  if (/Rela[çc][aã]o de Trabalhadores/i.test(t)) g += 3
  if (/Nome Trabalhador/i.test(t)) g += 3
  if (/Comp\.?\s*Apura[çc][aã]o/i.test(t)) g += 2
  if (/Total do Tomador|Total FGTS|Total do Estabelecimento/i.test(t)) g += 2
  if ((t.match(/\d{14,22}\s+\d{3}\.\d{3}\.\d{3}-\d{2}/g) || []).length > 3) g += 4
  if ((t.match(/(?<!\d)\d{3}\s?[.,:]?\s?\d{3}\s?[.,:]?\s?\d{3}\s?[-–—]\s?\d{2}(?!\d)/g) || []).length > 3 && /Trabalhador|Matr[ií]cula/i.test(t)) g += 3

  if (/CONFER[EÊ]NCIA GUIA/i.test(t)) r += 4
  if (/GT1000|INSOFT/i.test(t)) r += 3
  if (/Empresa\s+Pessoa/i.test(t)) r += 4
  if (/Admiss[aã]o/i.test(t)) r += 3
  if (/V[ií]nculo/i.test(t)) r += 2
  if (/\bEFETIVO\b/.test(t)) r += 2
  return { guia: g, relatorio: r }
}

// ─── Relatório do Portal GT3 (documento A) ─────────────────────────────────

const VINCULOS = ['EFETIVO', 'TEMPORARIO', 'ASSOCIADO', 'PJ', 'AUTONOMO', 'APRENDIZ', 'ESTAGIARIO', 'SOCIO', 'DIRETOR', 'COOPERADO']

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
export function dataBr(d: Date | null): string {
  if (!d) return ''
  const z = (n: number) => String(n).padStart(2, '0')
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function lerRelatorio(texto: string, formato: 'auto' | 'mdy' | 'dmy'): PessoaRelatorio[] {
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

  let fmt = formato
  if (fmt === 'auto') {
    fmt = 'mdy'
    brutos.forEach(b => { if (parseInt(b.cadastro.split('/')[0], 10) > 12) fmt = 'dmy' })
  }

  const pessoas: PessoaRelatorio[] = brutos.map(b => {
    const pessoa = prefixo && b.antes.indexOf(prefixo) === 0 ? b.antes.slice(prefixo.length).trim() : b.antes
    let vinculo = '', atividade = b.meio
    const tokens = b.meio.split(' ')
    const ultimo = semAcento(tokens[tokens.length - 1] || '').toUpperCase()
    if (VINCULOS.indexOf(ultimo) >= 0) {
      vinculo = tokens.pop() as string
      atividade = tokens.join(' ').trim()
    }
    return {
      pessoa, cpf: b.cpf, atividade, vinculo, cadastro: b.cadastro, admissao: b.admissao,
      dataCad: paraData(b.cadastro, fmt as 'mdy' | 'dmy'),
      dataAdmissao: paraData(b.admissao, fmt as 'mdy' | 'dmy'),
      repeticoes: 1,
    }
  })

  /* o relatório repete a mesma pessoa em várias linhas: conta uma vez só */
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
      if (!j.dataAdmissao && p.dataAdmissao) { j.dataAdmissao = p.dataAdmissao; j.admissao = p.admissao }
      return
    }
    vistos[chave] = p
    unicos.push(p)
  })
  return unicos
}

// ─── Detalhe da guia FGTS (documento B) ────────────────────────────────────

/** CPF tolerante ao OCR: aceita separador trocado (. , :), espaços e travessão no lugar do hífen. */
export const RE_CPF = /(?<!\d)\d{3}[ ]?[.,:]?[ ]?\d{3}[ ]?[.,:]?[ ]?\d{3}[ ]?[-–—][ ]?\d{2}(?!\d)/g
const RE_ESTAB = /(?<!Total do )Estabelecimento[ \t]*:?[ \t_—–\-]*(\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2})/gi
const RE_TOMADOR = /(?<!Total do )Tomador[ \t]*:?[ \t_—–\-]*(\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}|Sem Tomador)/gi
const ROTULOS_GUIA = /MATR[IÍ]CULA|TRABALHADOR|CATEGORIA|COMPET|APURA|REFER[EÊ]NCIA|VENCIMENTO|TOTAL|DEP[OÓ]SITO/i

function fmtCnpj(v: string): string {
  const d = soDigitos(v)
  if (d.length !== 14) return v
  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12)
}

/** O nome fica logo antes da matrícula, que fica logo antes do CPF — tanto no texto digital
 *  quanto no que sai do OCR. Pega o trecho de letras que termina numa "palavra com número"
 *  (a matrícula). */
export function nomeAntesDoCpf(antes: string): string {
  const m = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\- ]{2,80}?)[ \t]+\S*\d\S*[ \t]*$/.exec(antes.replace(/[ \t]+$/, ''))
  if (!m) return ''
  const tokens = m[1].trim().split(/\s+/)
  while (tokens.length && /^[a-zà-ÿ]/.test(tokens[0])) tokens.shift()
  const nome = tokens.join(' ').trim()
  if (nome.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 5 || ROTULOS_GUIA.test(nome)) return ''
  return nome.toUpperCase()
}

export function lerGuia(texto: string): Guia {
  const eventos: { i: number; t: 'e' | 't'; v: string }[] = []
  let m: RegExpExecArray | null
  RE_ESTAB.lastIndex = 0
  while ((m = RE_ESTAB.exec(texto)) !== null) eventos.push({ i: m.index, t: 'e', v: fmtCnpj(m[1]) })
  RE_TOMADOR.lastIndex = 0
  while ((m = RE_TOMADOR.exec(texto)) !== null) eventos.push({ i: m.index, t: 't', v: m[1] })
  eventos.sort((a, b) => a.i - b.i)

  const pessoas: Record<string, PessoaGuia> = {}
  let estab = '', tomador = '', e = 0, fim = 0
  RE_CPF.lastIndex = 0
  while ((m = RE_CPF.exec(texto)) !== null) {
    while (e < eventos.length && eventos[e].i < m.index) {
      if (eventos[e].t === 'e') estab = eventos[e].v; else tomador = eventos[e].v
      e++
    }
    const cpf = normCpf(m[0])
    const nome = nomeAntesDoCpf(texto.slice(fim, m.index))
    fim = m.index + m[0].length
    if (!pessoas[cpf]) pessoas[cpf] = { cpf, nome, estab, tomador }
    else if (!pessoas[cpf].nome && nome) pessoas[cpf].nome = nome
  }

  let comp = ''
  const contagem: Record<string, number> = {}
  const reComp = /(?:^|[^\d\/])(\d{2})\/(\d{4})(?![\d\/])/g
  let x: RegExpExecArray | null
  while ((x = reComp.exec(texto)) !== null) {
    const ch = x[1] + '/' + x[2]
    contagem[ch] = (contagem[ch] || 0) + 1
  }
  Object.keys(contagem).forEach(k => { if (!comp || contagem[k] > contagem[comp]) comp = k })

  // O cabeçalho repete em cada página: vale o MAIOR valor encontrado, não a soma.
  let qtd = 0
  const reQtd = /Qtd\.?\s*Trabalhadores\s*FGTS\s*:?\s*(\d{1,6})/gi
  let q: RegExpExecArray | null
  while ((q = reQtd.exec(texto)) !== null) qtd = Math.max(qtd, parseInt(q[1], 10))

  const primeiroEstab = eventos.filter(v => v.t === 'e')[0]
  return { pessoas, competencia: comp, razao: acharRazao(texto), cnpj: primeiroEstab ? primeiroEstab.v : '', qtd }
}

/** O rótulo nem sempre fica junto do valor no texto extraído: valida e, se não
    servir, procura o nome empresarial que mais se repete no documento. */
export function acharRazao(texto: string): string {
  const valido = (v: string) => /^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,'\-&\/]{3,}$/.test(v) && /[A-ZÀ-Ú]{3}/.test(v)
  const m = /Nome Empregador:\s*([^\n]{4,80}?)(?=\s{2,}|\s+(?:Qtd|Total|Origem|Vencimento|Data|Emitida)\b|\n|$)/i.exec(texto)
  if (m && valido(m[1].replace(/\s+/g, ' ').trim())) return m[1].replace(/\s+/g, ' ').trim()

  const re = /(?:^|[^A-ZÀ-Úa-zà-ÿ])([A-ZÀ-Ú][A-ZÀ-Ú0-9 .,'\-&\/]{3,60}?\s(?:LTDA|EIRELI|S\/A|S\.A\.|ME|EPP|MEI|SA))(?![A-ZÀ-Úa-zà-ÿ])/g
  const cont: Record<string, number> = {}
  let x: RegExpExecArray | null, melhor = ''
  while ((x = re.exec(texto)) !== null) {
    const k = x[1].replace(/\s+/g, ' ').trim()
    cont[k] = (cont[k] || 0) + 1
  }
  Object.keys(cont).forEach(k => { if (!melhor || cont[k] > cont[melhor]) melhor = k })
  return melhor
}

// ─── Comparação ─────────────────────────────────────────────────────────────

const EXC_VINCULO = ['TEMPORARIO', 'ASSOCIADO', 'PJ']
const EXC_CARGO = ['ESTAGIARIO', 'SOCIO', 'DIRETOR']

function ultimoDia(comp: string): Date | null {
  const p = (comp || '').split('/')
  if (p.length !== 2) return null
  return new Date(parseInt(p[1], 10), parseInt(p[0], 10), 0, 23, 59, 59)
}

function escRegexSimples(t: string): string { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
/** Nome sem espaços — cobre o OCR que cola ou separa palavras. */
export function chaveCompacta(s: string): string { return normNome(s).replace(/ /g, '') }
export function distCpf(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 99
  let d = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++
  return d
}
/** Nome "parecido": o primeiro nome tem de bater exato (é ele que separa pessoas de verdade,
 *  ex. LUCIAN e LUCAS), pelo menos mais uma parte do nome também, e o conjunto precisa ser
 *  muito semelhante. O OCR costuma juntar ou separar palavras, por isso a comparação é feita
 *  sem espaços. Não afrouxar estas regras. */
export function nomeParecido(nomePortal: string, nomeGuia: string): number {
  const a = chaveCompacta(nomePortal), b = chaveCompacta(nomeGuia)
  if (!a || !b) return 0
  const toks = normNome(nomePortal).split(' ').filter(Boolean)
  if (!toks.length || b.indexOf(toks[0]) !== 0) return 0
  const ancora = toks.slice(1).some(t => t.length >= 3 && b.indexOf(t) >= 0)
  if (!ancora) return 0
  return similar(a, b)
}

/** Ordem: CPF exato > nome exato sem espaços > nome parecido > CPF com 1 dígito diferente >
 *  CPF com 2 dígitos diferentes + nome parecido > nome completo no texto bruto da guia. */
export function comparar(
  listaA: PessoaRelatorio[], guia: Guia,
  opcoes: { competencia: string; textoNorm: string; data: boolean; vinculo: boolean; cargo: boolean },
): Resultado[] {
  const porCpf = guia.pessoas
  const porCompacto: Record<string, PessoaGuia> = {}, porChave: Record<string, PessoaGuia> = {}
  Object.keys(porCpf).forEach(k => {
    const n = porCpf[k].nome
    if (!n) return
    porCompacto[chaveCompacta(n)] = porCpf[k]
    porChave[chaveNome(n).replace(/ /g, '')] = porCpf[k]
  })

  const limite = opcoes.data ? ultimoDia(opcoes.competencia) : null
  const estabs: Record<string, number> = {}
  let estabPrincipal = ''
  Object.keys(porCpf).forEach(k => { const e = porCpf[k].estab; if (e) estabs[e] = (estabs[e] || 0) + 1 })
  Object.keys(estabs).forEach(e => { if (!estabPrincipal || estabs[e] > estabs[estabPrincipal]) estabPrincipal = e })

  return listaA.map(p => {
    const admissaoPosterior = !!(p.dataAdmissao && p.dataCad && p.dataAdmissao.getTime() > p.dataCad.getTime())
    const r: Resultado = { dados: p, situacao: 'ok', motivo: '', campo: '', achado: null, nota: '', divergente: false, admissaoPosterior, aprox: false }
    const vin = semAcento(p.vinculo).toUpperCase()
    const car = semAcento(p.atividade).toUpperCase()

    let foraSituacao = false
    if (opcoes.vinculo && EXC_VINCULO.some(v => vin.indexOf(v) >= 0)) {
      foraSituacao = true; r.campo = 'vinculo'
      r.motivo = 'vínculo ' + (p.vinculo || '').toLowerCase()
    } else if (opcoes.cargo && EXC_CARGO.some(cg => car.indexOf(cg) >= 0)) {
      foraSituacao = true; r.campo = 'atividade'
      r.motivo = 'cargo ' + (p.atividade || '').toLowerCase()
    } else if (limite && p.dataCad && p.dataCad > limite) {
      foraSituacao = true; r.campo = 'cadastro'
      r.motivo = 'cadastro em ' + dataBr(p.dataCad) + ', posterior à competência ' + opcoes.competencia
    }

    let achado: PessoaGuia | null = null
    if (p.cpf && porCpf[p.cpf]) {
      achado = porCpf[p.cpf]
      if (achado.nome && chaveCompacta(achado.nome) !== chaveCompacta(p.pessoa) &&
        chaveNome(achado.nome).replace(/ /g, '') !== chaveNome(p.pessoa).replace(/ /g, '')) {
        r.nota = 'mesmo CPF, grafia diferente na guia: “' + achado.nome + '”'
      }
    } else {
      achado = porCompacto[chaveCompacta(p.pessoa)] || porChave[chaveNome(p.pessoa).replace(/ /g, '')] || null
    }

    if (!achado && p.pessoa) {
      let melhor: { g: PessoaGuia; motivo: string } | null = null, score = 0
      Object.keys(porCpf).forEach(k => {
        const g = porCpf[k]
        const d = distCpf(p.cpf, g.cpf)
        const s = g.nome ? nomeParecido(p.pessoa, g.nome) : 0
        let pontos = 0, motivo = ''
        if (d <= 1) { pontos = 2 + (s >= 0.6 ? s : 0); motivo = 'cpf' }
        else if (d === 2 && s >= 0.7) { pontos = 1 + s; motivo = 'cpf+nome' }
        else if (s >= 0.84) { pontos = s; motivo = 'nome' }
        if (pontos > score) { score = pontos; melhor = { g, motivo } }
      })
      if (melhor) {
        const mm = melhor as { g: PessoaGuia; motivo: string }
        achado = mm.g
        r.aprox = true
        r.nota = mm.motivo === 'nome'
          ? 'leitura aproximada do nome: guia traz “' + (mm.g.nome || '') + '” (CPF ' + fmtCpfMasc(mm.g.cpf) + ') — conferir'
          : 'CPF da guia difere em poucos dígitos (' + fmtCpfMasc(mm.g.cpf) + ')' +
            (mm.g.nome ? ', nome “' + mm.g.nome + '”' : '') + ' — conferir'
      }
    }

    /* última chance: o nome aparece no texto da guia, mas a linha perdeu o CPF
       (comum no OCR). Só vale com o nome completo, em palavras inteiras. */
    if (!achado && p.pessoa && opcoes.textoNorm) {
      const toks = normNome(p.pessoa).split(' ').filter(Boolean)
      if (toks.length >= 2 && toks.join('').length >= 10) {
        const reNome = new RegExp('(?<![A-Z])(?:' + toks.map(escRegexSimples).join(' +') + '|' +
          escRegexSimples(toks.join('')) + ')(?![A-Z])')
        if (reNome.test(opcoes.textoNorm)) {
          achado = { cpf: '', nome: p.pessoa, estab: '', tomador: '' }
          r.aprox = true
          r.nota = 'nome localizado no texto da guia, mas a linha não trouxe CPF legível — conferir'
        }
      }
    }

    r.achado = achado
    r.situacao = foraSituacao ? 'fora' : (achado ? 'ok' : 'falta')
    if (achado && achado.estab && estabPrincipal && achado.estab !== estabPrincipal) {
      r.nota = (r.nota ? r.nota + ' · ' : '') + 'CNPJ divergente: ' + achado.estab
      r.divergente = true
    }
    return r
  })
}
