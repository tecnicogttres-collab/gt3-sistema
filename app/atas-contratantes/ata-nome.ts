// Nome e número automáticos das Atas Contratantes.
//  • Número: maior "NN/AA" da contratante no ano da reunião + 1 (renova todo ano: 01/27, 02/27…).
//  • Nome: modelo por contratante (⋮ da pasta → "Nome da ata"). Sem modelo salvo, deduz do
//    título da última ata dela; sem histórico, usa o padrão "Ata de {{data}}".

export const MODELO_TITULO_PADRAO = 'Ata de {{data}}'

export const VARIAVEIS_TITULO: { v: string; desc: string }[] = [
  { v: '{{data}}', desc: 'Data da reunião (19/10/2026)' },
  { v: '{{numero}}', desc: 'Número da ata (09/26)' },
  { v: '{{contratante}}', desc: 'Nome da contratante' },
  { v: '{{mes}}', desc: 'Mês por extenso (Outubro)' },
  { v: '{{ano}}', desc: 'Ano (2026)' },
]

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type AtaResumo = { cliente: string | null; data: string; titulo: string | null; numero_ata: string | null }

function dataBR(iso: string) {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

const mesmoCliente = (a: AtaResumo, cliente: string) => (a.cliente ?? '').trim() === cliente.trim()

function lerNumero(n: string | null): { seq: number; ano: number } | null {
  const m = (n ?? '').match(/(\d{1,4})\s*\/\s*(\d{2,4})/)
  if (!m) return null
  return { seq: Number(m[1]), ano: Number(m[2]) % 100 }
}

export function proximoNumeroAta(atas: AtaResumo[], cliente: string, dataISO: string): string {
  const ano = Number(dataISO.slice(0, 4)) % 100
  if (!cliente.trim() || Number.isNaN(ano)) return ''
  const max = atas
    .filter(a => mesmoCliente(a, cliente))
    .map(a => lerNumero(a.numero_ata))
    .filter((n): n is { seq: number; ano: number } => !!n && n.ano === ano)
    .reduce((m, n) => Math.max(m, n.seq), 0)
  return `${String(max + 1).padStart(2, '0')}/${String(ano).padStart(2, '0')}`
}

/** Modelo deduzido do título da última ata (troca a data e o número dela pelas variáveis). */
export function modeloInferido(atas: AtaResumo[], cliente: string): string | null {
  const ultima = atas
    .filter(a => mesmoCliente(a, cliente) && a.titulo?.trim())
    .sort((a, b) => b.data.localeCompare(a.data))[0]
  if (!ultima) return null
  let t = ultima.titulo!.trim()
  const d = dataBR(ultima.data)
  if (t.includes(d)) t = t.split(d).join('{{data}}')
  const num = ultima.numero_ata?.trim()
  if (num && t.includes(num)) t = t.split(num).join('{{numero}}')
  return t.includes('{{') ? t : null
}

export function modeloTituloDo(cliente: string, modelos: Record<string, string>, atas: AtaResumo[]): string {
  return modelos[cliente.trim()]?.trim() || modeloInferido(atas, cliente) || MODELO_TITULO_PADRAO
}

export function aplicarModeloTitulo(modelo: string, v: { data: string; numero: string; contratante: string }): string {
  const [y, m] = v.data.split('-')
  return modelo
    .split('{{data}}').join(dataBR(v.data))
    .split('{{numero}}').join(v.numero)
    .split('{{contratante}}').join(v.contratante)
    .split('{{mes}}').join(MESES[Number(m) - 1] ?? '')
    .split('{{ano}}').join(y ?? '')
}

export function nomeAutomatico(atas: AtaResumo[], modelos: Record<string, string>, cliente: string, dataISO: string) {
  const numero = proximoNumeroAta(atas, cliente, dataISO)
  const titulo = cliente.trim()
    ? aplicarModeloTitulo(modeloTituloDo(cliente, modelos, atas), { data: dataISO, numero, contratante: cliente })
    : ''
  return { titulo, numero }
}
