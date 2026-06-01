import rawData from './observacoes-raw.json'

export type Card = { motivo: string; parecer: string; group?: string; imagem_url?: string }
export type Column = { title: string; cards: Card[]; isFixed?: boolean; imageOnly?: boolean }
export type Subtab = { key: string; columns: Column[] }
export type Category = {
  key: string
  label: string
  icon: string
  subtabs: Subtab[]
  totalCards: number
}

const ICONS: Record<string, string> = {
  'Funcionários': '👤',
  'Empresas': '🏢',
  'PGR & PCMSO & LTCAT': '📋',
  'Orientações Gerais': '💡',
  'BSA': '🔵',
  'Prompts': '✨',
  'GPF - Alimentar': '📊',
  'Contratantes': '🤝',
}

function countItems(node: unknown): number {
  if (Array.isArray(node)) return node.length
  if (node && typeof node === 'object') {
    let n = 0
    for (const k in node as Record<string, unknown>) {
      if (k === '__fixed_right__') continue
      n += countItems((node as Record<string, unknown>)[k])
    }
    return n
  }
  return 0
}

function normalizeCategory(key: string, rawCat: unknown): Category | null {
  // Prompts: top-level is an array
  if (Array.isArray(rawCat)) {
    const items = rawCat as Array<{ titulo: string; prompt: string }>
    return {
      key,
      label: key,
      icon: ICONS[key] || '📌',
      subtabs: [{
        key: 'Todos',
        columns: [{ title: 'Prompts IA', cards: items.map(p => ({ motivo: p.titulo, parecer: p.prompt })) }],
      }],
      totalCards: items.length,
    }
  }

  if (!rawCat || typeof rawCat !== 'object') return null
  const data = rawCat as Record<string, unknown>

  // Fixed right columns at category level (Funcionários pattern)
  const catFixed = data['__fixed_right__'] as Record<string, Card[]> | undefined
  const fixedRightCols: Column[] = catFixed
    ? Object.entries(catFixed).map(([k, v]) => ({ title: k, cards: v, isFixed: true }))
    : []

  const subtabKeys = Object.keys(data).filter(k => k !== '__fixed_right__')

  const subtabs: Subtab[] = subtabKeys.flatMap(subKey => {
    const subVal = data[subKey]
    let columns: Column[] = []

    if (Array.isArray(subVal)) {
      // Flat: subtab is a single column (Contratantes, PGR, BSA, etc.)
      columns = [{ title: subKey, cards: subVal as Card[] }]
    } else if (subVal && typeof subVal === 'object') {
      const subObj = subVal as Record<string, unknown>

      if (subObj.groups) {
        // Empresas Docs Mensais / Certidões pattern: {groups: {...}, __fixed_right__?: {...}}
        const groups = subObj.groups as Record<string, Card[]>
        columns = Object.entries(groups).map(([k, v]) => ({ title: k, cards: v }))
        if (subObj.__fixed_right__) {
          const stFixed = subObj.__fixed_right__ as Record<string, Card[]>
          Object.entries(stFixed).forEach(([k, v]) => {
            columns.push({ title: k, cards: v, isFixed: true })
          })
        }
      } else if (subObj.__images__) {
        const imgs = subObj.__images__ as Array<{ titulo: string; descricao: string; src: string }>
        columns = [{
          title: 'Informações NR',
          imageOnly: true,
          cards: imgs.map(img => ({ motivo: img.titulo, parecer: img.descricao, imagem_url: img.src })),
        }]
      } else {
        // Normal subtab with multiple column groups (Funcionários subtabs)
        columns = Object.entries(subObj)
          .filter(([k]) => k !== '__images__')
          .map(([k, v]) => ({ title: k, cards: Array.isArray(v) ? (v as Card[]) : [] }))
          .filter(col => col.cards.length > 0)
      }
    }

    // Append category-level fixed right to every subtab
    columns = [...columns, ...fixedRightCols]

    // Deduplicate columns by title (keep first occurrence)
    const seen = new Set<string>()
    columns = columns.filter(col => {
      if (seen.has(col.title)) return false
      seen.add(col.title)
      return true
    })

    if (columns.length === 0) return []
    return [{ key: subKey, columns }]
  })

  if (subtabs.length === 0) return null

  return {
    key,
    label: key,
    icon: ICONS[key] || '📌',
    subtabs,
    totalCards: countItems(rawCat),
  }
}

const raw = rawData as Record<string, unknown>

export const CATEGORIES: Category[] = Object.entries(raw)
  .map(([key, val]) => normalizeCategory(key, val))
  .filter((c): c is Category => c !== null)
