export type Opcao = { id: string; ordem: number; texto: string }

export type Pergunta = {
  id: string
  ordem: number
  texto: string
  tipo: 'text' | 'radio' | 'checkbox'
  obrigatoria: boolean
  opcoes: Opcao[]
  /** Só aparece se esta pergunta foi respondida com uma de condicao_opcao_ids */
  condicao_pergunta_id: string | null
  condicao_opcao_ids: string[] | null
}

export type Respostas = Record<string, string | string[]>

/** Perguntas visíveis com as respostas atuais — a condicional some se a pergunta de que
 *  depende está oculta ou não foi respondida com uma das opções escolhidas. */
export function perguntasVisiveis(perguntas: Pergunta[], answers: Respostas): Pergunta[] {
  const visiveis = new Set<string>()
  for (const p of perguntas) {
    if (!p.condicao_pergunta_id || !p.condicao_opcao_ids?.length) { visiveis.add(p.id); continue }
    if (!visiveis.has(p.condicao_pergunta_id)) continue
    const ans = answers[p.condicao_pergunta_id]
    const marcadas = Array.isArray(ans) ? ans : ans ? [ans] : []
    if (marcadas.some(o => p.condicao_opcao_ids!.includes(o))) visiveis.add(p.id)
  }
  return perguntas.filter(p => visiveis.has(p.id))
}

export function respostaVazia(ans: string | string[] | undefined): boolean {
  return !ans || (Array.isArray(ans) ? ans.length === 0 : !String(ans).trim())
}

/** Corpo do POST /api/enquetes/[id]/responder — só as perguntas visíveis entram. */
export function montarRespostas(perguntas: Pergunta[], answers: Respostas) {
  const respostas: Array<{ pergunta_id: string; opcao_id?: string; texto_livre?: string }> = []
  for (const p of perguntasVisiveis(perguntas, answers)) {
    const ans = answers[p.id]
    if (p.tipo === 'text') {
      if (typeof ans === 'string' && ans.trim()) respostas.push({ pergunta_id: p.id, texto_livre: ans.trim() })
    } else if (p.tipo === 'radio') {
      if (typeof ans === 'string' && ans) respostas.push({ pergunta_id: p.id, opcao_id: ans })
    } else {
      (Array.isArray(ans) ? ans : []).forEach(oid => respostas.push({ pergunta_id: p.id, opcao_id: oid }))
    }
  }
  return respostas
}
