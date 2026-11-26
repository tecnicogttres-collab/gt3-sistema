'use client'

// Aba Histórico: Linha do tempo (tudo, por data) e Pesquisas, num seletor só.

import { useState } from 'react'
import type { PdiColaborador } from '../../../../data/pdis/types'
import type { Acompanhamento } from './useAcompanhamento'
import LinhaDoTempoTab from './LinhaDoTempoTab'
import PesquisasTab from '../PesquisasTab'

export default function HistoricoTab({ pdi, papel, canEdit, dados, competenciaInicial }: {
  pdi: PdiColaborador; papel: string; canEdit: boolean; dados: Acompanhamento; competenciaInicial?: string
}) {
  const [vista, setVista] = useState<'linha' | 'pesquisas'>('linha')
  const pend = dados.pesquisas.filter(p => p.status === 'enviado').length
  return (
    <div>
      <div className="p2-seg" style={{ marginBottom: 16 }}>
        <button type="button" aria-pressed={vista === 'linha'} onClick={() => setVista('linha')}>🕒 Linha do tempo</button>
        <button type="button" aria-pressed={vista === 'pesquisas'} onClick={() => setVista('pesquisas')}>
          📝 Pesquisas{dados.pesquisas.length ? ` · ${dados.pesquisas.length}` : ''}{pend ? ` (${pend} pendente${pend > 1 ? 's' : ''})` : ''}
        </button>
      </div>
      <div className="p2-view" key={vista}>
        {vista === 'linha'
          ? <LinhaDoTempoTab pdi={pdi} canEdit={canEdit} dados={dados} competenciaInicial={competenciaInicial} />
          : <PesquisasTab pdi={pdi} papel={papel} dados={dados} />}
      </div>
    </div>
  )
}
