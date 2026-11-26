'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PdiColaborador } from '../../../../data/pdis/types'
import type { Acao, Anotacao, Etapa, EventoHist, Pesquisa, Vinculo, CicloResumo, Checkin, PopupGestao, PopupResposta } from './pdi-ui'

/** Carrega tudo o que o acompanhamento usa: ações, etapas, anotações, pesquisas,
 *  ligações pesquisa→competência, ciclos e (gestão) histórico. Se o PDI vier do
 *  arquivo estático e ainda não tiver ações no banco, semeia como a aba antiga. */
export function useAcompanhamento(pdi: PdiColaborador, canEdit: boolean) {
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([])
  const [pesquisasVinculado, setPesquisasVinculado] = useState(true)
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [ciclos, setCiclos] = useState<CicloResumo[]>([])
  const [historico, setHistorico] = useState<EventoHist[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [popups, setPopups] = useState<PopupGestao[]>([])
  const [popupRespostas, setPopupRespostas] = useState<PopupResposta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    const json = async <T,>(r: Response, vazio: T): Promise<T> => (r.ok ? r.json() : vazio)
    try {
      const base = `/api/pdi/${pdi.id}`
      const vazio = () => Promise.resolve(new Response('null', { status: 404 }))
      const [ra, re, rn, rp, rv, rc, rh, rk, rg, rr] = await Promise.all([
        fetch(`${base}/acoes`), fetch(`${base}/etapas`), fetch(`${base}/anotacoes`),
        fetch(`${base}/pesquisas`), fetch(`${base}/vinculos`), fetch(`${base}/ciclos`),
        canEdit ? fetch(`${base}/historico`) : Promise.resolve(new Response('[]')),
        fetch(`${base}/checkins`),
        canEdit ? fetch(`${base}/popups`) : vazio(),
        fetch(`${base}/popup-respostas`),
      ])
      if (!ra.ok) throw new Error('Não foi possível carregar as ações.')
      let lista: Acao[] = await ra.json()
      if (lista.length === 0 && canEdit && pdi.planoDeAcao.length > 0) {
        const rs = await fetch(`${base}/acoes/seed`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acoes: pdi.planoDeAcao }),
        })
        if (rs.ok) lista = await rs.json()
      }
      setAcoes(lista)
      setEtapas(await json(re, []))
      setAnotacoes(await json(rn, []))
      const pq = await json(rp, { vinculado: true, pesquisas: [] as Pesquisa[] })
      setPesquisas(pq.pesquisas ?? []); setPesquisasVinculado(pq.vinculado !== false)
      setVinculos(await json(rv, []))
      setCiclos(await json(rc, []))
      setHistorico(await json(rh, []))
      setCheckins(await json(rk, []))
      setPopups(await json(rg, []))
      setPopupRespostas(await json(rr, []))
      const faltando = [!re.ok && 'etapas', !rn.ok && 'diário', !rv.ok && 'ligações de pesquisa'].filter(Boolean)
      setErro(faltando.length ? `Indisponível: ${faltando.join(', ')}. Confira se os SQLs do PDI (sql/pdi-acompanhamento*.sql) foram rodados.` : '')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setCarregando(false)
    }
  }, [pdi.id, pdi.planoDeAcao, canEdit])

  useEffect(() => {
    const t = setTimeout(recarregar, 0) // fora do corpo do efeito (regra react-hooks/set-state-in-effect)
    return () => clearTimeout(t)
  }, [recarregar])

  return {
    acoes, setAcoes, etapas, setEtapas, anotacoes, setAnotacoes, pesquisas, pesquisasVinculado, vinculos, setVinculos,
    ciclos, historico, checkins, popups, setPopups, popupRespostas, carregando, erro, setErro, recarregar,
  }
}

export type Acompanhamento = ReturnType<typeof useAcompanhamento>
