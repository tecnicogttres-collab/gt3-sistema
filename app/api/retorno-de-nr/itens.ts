export type Item = { id: string; chave: string; texto: string }

/** Sanitiza a lista de exigências de um treinamento (jsonb rnr_treinamentos.itens). */
export function normalizaItens(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((it, i) => {
      const o = (it ?? {}) as Partial<Item>
      return {
        id: String(o.id ?? `i${i + 1}`),
        chave: String(o.chave ?? '').trim(),
        texto: String(o.texto ?? '').trim(),
      }
    })
    .filter(it => it.texto)
}
