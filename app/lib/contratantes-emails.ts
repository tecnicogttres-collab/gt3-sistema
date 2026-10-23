/* E-mails do Cadastro de Contratantes — usado pelo "Incluir do Cadastro de Contratantes" (Questionários)
   e pela exportação "Exportar e-mails para planilha". SÓ LÊ: o cadastro guarda tudo em `fields`
   (texto livre), sem um campo "responsável + e-mail", por isso cada e-mail encontrado vira uma linha
   com o(s) nome(s) do(s) campo(s) de onde veio. */

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

type CampoCadastro = { type: 'text'; label: string; value: string } | { type: 'table'; label: string; headers: string[]; rows: string[][] }
type ContratanteRow = { id: string; name: string; fields: unknown }

/** Partes de e-mail que são setor/caixa genérica, não nome de pessoa (não sugerem Nome). */
const GENERICOS = new Set([
  'seguranca', 'segurancadotrabalho', 'sesmt', 'sst', 'tst', 'seg', 'rh', 'dp', 'contato', 'compras', 'portaria', 'adm',
  'administrativo', 'administracao', 'financeiro', 'fiscal', 'documentos', 'documentacao', 'docs', 'doc', 'terceiros',
  'terceirizados', 'cadastro', 'cadastros', 'sac', 'comercial', 'recepcao', 'engenharia', 'qualidade', 'ti', 'suporte',
  'cracha', 'crachas', 'integracao', 'medicina', 'saude', 'juridico', 'ambiental', 'manutencao', 'logistica', 'faturamento',
  'nfe', 'nf', 'atendimento', 'info', 'geral', 'noreply', 'naoresponda', 'empresa', 'fabrica', 'unidade', 'trabalho',
  'concessoes', 'login', 'acesso', 'controle', 'patrimonial', 'seguranca.trabalho', 'servicos', 'obras', 'projetos',
])

/** "joao.silva@" → "Joao Silva"; "fernanda@" → "Fernanda"; caixa genérica ou com números → "". */
export function nomeSugerido(email: string): string {
  const local = email.split('@')[0].toLowerCase()
  if (GENERICOS.has(local.replace(/[._-]/g, ''))) return ''
  const partes = local.split(/[._-]+/).filter(Boolean)
  if (!partes.length || partes.length > 4) return ''
  if (partes.some(p => !/^[a-z]{2,}$/.test(p) || GENERICOS.has(p))) return ''
  return partes.map(p => p[0].toUpperCase() + p.slice(1)).join(' ')
}

/** Campo de contato (rótulo começa com "E-MAIL" ou contém "contato", sem diferenciar acento/caixa).
 *  Os demais (Crachás, Autorização p/ cadastro, Login…) são de uso operacional. */
export function origemDeContato(label: string): boolean {
  const n = label.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  return /^e-?mail/.test(n) || n.includes('contato')
}

export type EmailCadastro = { contratanteId: string; empresa: string; email: string; origens: string[]; nome: string }

/** Um item por e-mail distinto de cada contratante (minúsculo), com todos os campos onde aparece,
 *  na ordem do cadastro. `semEmail` = contratantes sem nenhum e-mail. */
export function extrairEmailsCadastro(cad: ContratanteRow[]) {
  const linhas: EmailCadastro[] = []
  const semEmail: { contratanteId: string; empresa: string }[] = []

  for (const c of cad) {
    const porEmail = new Map<string, EmailCadastro>()
    const campos = (Array.isArray(c.fields) ? c.fields : []) as CampoCadastro[]
    for (const f of campos) {
      const texto = f.type === 'text' ? (f.value ?? '') : JSON.stringify(f.rows ?? [])
      const origem = (f.label ?? '').trim()
      for (const m of texto.match(EMAIL_RE) ?? []) {
        const email = m.toLowerCase()
        const item = porEmail.get(email)
        if (item) { if (!item.origens.includes(origem)) item.origens.push(origem); continue }
        const novo = { contratanteId: c.id, empresa: c.name, email, origens: [origem], nome: nomeSugerido(email) }
        porEmail.set(email, novo)
        linhas.push(novo)
      }
    }
    if (!porEmail.size) semEmail.push({ contratanteId: c.id, empresa: c.name })
  }
  return { linhas, semEmail }
}

/* Planilha "Exportar e-mails para planilha" — também é o formato que a futura importação de
   destinatários de questionários vai ler (aba 1, cabeçalhos exatos, só linhas com Incluir = "Sim"). */
export const PLANILHA_EMAILS_COLUNAS = ['Empresa', 'Nome', 'PrimeiroNome', 'Email', 'CampoOrigem', 'Incluir'] as const
export const PLANILHA_EMAILS_SEPARADOR_ORIGEM = ' / '

/** "Sim" vale com qualquer caixa, acento ou espaço sobrando (edição manual no Excel). */
export function incluirMarcado(valor: unknown): boolean {
  return String(valor ?? '').trim().toLowerCase() === 'sim'
}

const normCab = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').toLowerCase()
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type LinhaPlanilhaEmails = {
  linha: number; empresa: string; nome: string; email: string; origem: string
  /** importar = Incluir "Sim" e válida; ignorada = Incluir diferente de "Sim"; os demais são "Sim" com problema. */
  situacao: 'importar' | 'ignorada' | 'invalida' | 'repetida'
  motivo?: string
}

/** Lê a 1ª aba da planilha "Exportar e-mails para planilha" (já com os valores das células em texto,
 *  linha 1 = cabeçalho). Cabeçalhos achados pelo nome, sem diferenciar caixa/acento/espaço; Empresa, Email
 *  e Incluir são obrigatórios. Nome vazio usa o PrimeiroNome. Mesmo e-mail com "Sim" duas vezes → repetida. */
export function lerPlanilhaEmails(linhas: string[][]): { erro: string } | { linhas: LinhaPlanilhaEmails[] } {
  const cab = (linhas[0] ?? []).map(c => normCab(c ?? ''))
  const col = Object.fromEntries(PLANILHA_EMAILS_COLUNAS.map(n => [n, cab.indexOf(normCab(n))])) as Record<typeof PLANILHA_EMAILS_COLUNAS[number], number>
  const faltam = (['Empresa', 'Email', 'Incluir'] as const).filter(n => col[n] < 0)
  if (faltam.length) {
    return { erro: `A primeira aba precisa ter na linha 1 as colunas ${PLANILHA_EMAILS_COLUNAS.join(' | ')}. Não encontrei: ${faltam.join(', ')}. Use a planilha gerada em Cadastro de Contratantes → "Exportar e-mails para planilha".` }
  }
  const val = (r: string[], n: typeof PLANILHA_EMAILS_COLUNAS[number]) => col[n] < 0 ? '' : String(r[col[n]] ?? '').trim()

  const vistos = new Set<string>()
  const out: LinhaPlanilhaEmails[] = []
  linhas.slice(1).forEach((r, i) => {
    const empresa = val(r, 'Empresa'), email = val(r, 'Email').toLowerCase()
    if (!empresa && !email && !val(r, 'Nome')) return // linha em branco
    const base = { linha: i + 2, empresa, email, nome: val(r, 'Nome') || val(r, 'PrimeiroNome'), origem: val(r, 'CampoOrigem') }
    if (!incluirMarcado(val(r, 'Incluir'))) { out.push({ ...base, situacao: 'ignorada' }); return }
    if (!empresa) { out.push({ ...base, situacao: 'invalida', motivo: 'sem Empresa' }); return }
    if (!EMAIL_OK.test(email)) { out.push({ ...base, situacao: 'invalida', motivo: email ? 'e-mail inválido' : 'sem e-mail' }); return }
    if (vistos.has(email)) { out.push({ ...base, situacao: 'repetida', motivo: 'e-mail repetido na planilha' }); return }
    vistos.add(email)
    out.push({ ...base, situacao: 'importar' })
  })
  return { linhas: out }
}
