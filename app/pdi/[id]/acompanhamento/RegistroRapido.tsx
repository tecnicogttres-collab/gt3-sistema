'use client'

// Faixa com as últimas respostas de "status das ações" (vindas dos pop-ups) de uma ação.

import { SITUACOES } from '../../../lib/pdi-checkin'
import { C, fmtData, type Checkin } from './pdi-ui'

/** Faixa com as últimas respostas do registro rápido de uma ação (mais antiga → mais recente). */
export function CheckinStrip({ checkins }: { checkins: Checkin[] }) {
  if (!checkins.length) return null
  const ult = [...checkins].sort((a, b) => a.periodo_ref.localeCompare(b.periodo_ref)).slice(-8)
  const ultimo = ult[ult.length - 1]
  return (
    <div style={{ marginTop: 18 }}>
      <span className="p2-label">⚡ Status nos pop-ups ({checkins.length})</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {ult.map(c => {
          const m = SITUACOES[c.situacao]
          return (
            <span key={c.id} title={`${fmtData(c.periodo_ref)} · ${m.label}${c.nota ? ` · ${c.nota}` : ''}`}
              style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 12, background: m.bg, border: `1px solid ${m.cor}33` }}>
              {m.icon}
            </span>
          )
        })}
        <span style={{ fontSize: 12, color: C.MU, marginLeft: 4 }}>
          último: <b style={{ color: SITUACOES[ultimo.situacao].cor }}>{SITUACOES[ultimo.situacao].label}</b> em {fmtData(ultimo.periodo_ref)}
          {ultimo.nota && <> · “{ultimo.nota}”</>}
        </span>
      </div>
    </div>
  )
}
