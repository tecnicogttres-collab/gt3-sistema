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
