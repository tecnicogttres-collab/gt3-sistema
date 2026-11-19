'use client'

// Tela inicial do modulo: situacao de cada aba, mostrada no card.

import { useMemo } from 'react'
import { useCs } from './cs-data'
import { situacaoDoc, type AbaId } from './cs-lib'
import { hojeIso, tempoAtividade } from './cs-suporte-lib'
import { useSuporte } from './abas/suporte-data'

export type Nivel = 'ok' | 'parcial' | 'pendente' | 'info'
export type Status = { txt: string; nivel: Nivel }

const dataBr = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const nivelPct = (a: number, b: number): Nivel => (!b ? 'pendente' : a >= b ? 'ok' : a > 0 ? 'parcial' : 'pendente')

/** Situacao de cada aba. `suporte` = carregar dados das camadas 2 e 3. */
export function useStatusInicio(suporte: boolean): Partial<Record<AbaId, Status>> {
  const { d, ctx, meuId } = useCs()
  const s = useSuporte(suporte ? meuId : '')

  return useMemo(() => {
    const st: Partial<Record<AbaId, Status>> = {}

    // Camada 1 (so para a situacao do Resultado): pares grupo x documento que contam e quantos tem tempo pronto
    let total = 0, prontos = 0
    if (ctx) {
      for (const g of ctx.grupos) {
        for (const id of ctx.gd.get(g.id) ?? []) {
          const doc = ctx.docs.get(id)
          if (!doc || doc.nao_conta || doc.ativo === false) continue
          total++
          if (situacaoDoc(ctx, g.id, id) === 'pronto') prontos++
        }
      }
    }
    const ultMed = d.meds.reduce<string | null>((m, x) => (!m || x.created_at > m ? x.created_at : m), null)
    st.medicoes = d.meds.length
      ? { txt: `Última em ${dataBr(ultMed!)}`, nivel: 'info' }
      : { txt: 'Nenhuma medição ainda', nivel: 'pendente' }

    // Volume: relatorio do sistema importado
    const rel = [...d.rels].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const vol: Status = rel
      ? { txt: `Relatório de ${dataBr(rel.created_at)}`, nivel: 'ok' }
      : { txt: 'Nenhum relatório importado', nivel: 'pendente' }
    st.contagem = vol
    st.resultado = rel ? { txt: 'Pronto para calcular', nivel: total && prontos ? 'ok' : 'parcial' } : { txt: 'Precisa do relatório (Contagem)', nivel: 'pendente' }
    const nCtt = d.ctts.filter(c => c.ativo !== false && !c.contratante_pai).length
    st.comparativo = { txt: `${nCtt} contratante${nCtt === 1 ? '' : 's'}`, nivel: 'info' }

    // Camadas 2 e 3 (so com os dados do suporte carregados)
    if (suporte && !s.carregando && !s.faltaSql) {
      const porQtd = s.ativs.filter(a => a.ativo && a.unidade === 'quantidade')
      const comTempo = porQtd.filter(a => tempoAtividade(s.meds, a.id, d.cfg?.base ?? 'mediana').val != null).length
      const c2: Status = porQtd.length
        ? { txt: comTempo === porQtd.length ? `${porQtd.length} atividades com tempo` : `${comTempo} de ${porQtd.length} atividades com tempo`, nivel: nivelPct(comTempo, porQtd.length) }
        : { txt: 'Nenhuma atividade cadastrada', nivel: 'pendente' }
      st.suporte = c2

      const hoje = hojeIso()
      const ativa = s.amostragens.find(a => a.ativa && a.inicio <= hoje && a.fim >= hoje)
      const ultima = s.amostragens.find(a => a.inicio <= hoje)
      const c3: Status = ativa
        ? { txt: `Amostragem em andamento até ${dataBr(ativa.fim)}`, nivel: 'parcial' }
        : ultima
          ? { txt: `Última amostragem até ${dataBr(ultima.fim)}`, nivel: 'ok' }
          : { txt: 'Nenhuma amostragem feita', nivel: 'pendente' }
      st.extra = c3
    }

    const n = d.ctts.length
    st.bases = { txt: `${d.docs.length} documentos · ${n} contratantes`, nivel: 'info' }
    return st
  }, [d, ctx, suporte, s.carregando, s.faltaSql, s.ativs, s.meds, s.amostragens])
}
