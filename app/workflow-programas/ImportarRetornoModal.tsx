'use client'

import { useMemo, useState, Fragment } from 'react'
import {
  lerRetorno, montarPreview, soDigitos, normDepara, agruparPorDocumento, SITUACAO_LABEL,
  type DeparaJson, type DeparaItem, type DeparaResposta, type LinhaDepara, type Situacao, type RetornoClaudeResumo,
} from './depara'

// Mesmas cores do WorkflowProgramasClient.
const P = '#2A4F96', PS = '#E8EEF9', AC = '#D1AE6E', ASO = '#FBF4E6'
const LINE = '#E2E8F2', TX = '#1B2432', MU = '#6B7A90', BG = '#F4F6FA'
const OK = '#1E9E6A', OKS = '#E6F6EF', NO = '#D64545', NOS = '#FCEBEB'

const SIT_COR: Record<Situacao, { bg: string; fg: string }> = {
  novo: { bg: OKS, fg: OK }, igual: { bg: '#EEF1F5', fg: '#54617A' }, diferente: { bg: ASO, fg: '#8A6A22' },
  sem: { bg: NOS, fg: NO }, invalido: { bg: NOS, fg: NO }, pendente: { bg: PS, fg: P },
}

type Filtro = 'todos' | 'reprovacoes' | 'diferentes' | 'pendentes'

export type ResultadoImportacao = {
  respostas: Record<string, DeparaResposta>
  resumo: RetornoClaudeResumo
  preenchidos: number; reprovacoes: number; pendentes: number
  /** Primeiro item pendente ou reprovado, para rolar até ele depois de aplicar. */
  focoItemId: string | null
}

export default function ImportarRetornoModal({ respostasAtuais, itensVisiveis, cnpjAnalise, checklistsAnalise, onAplicar, onClose }: {
  respostasAtuais: Record<string, DeparaResposta>
  itensVisiveis: (respostas: Record<string, DeparaResposta>) => DeparaItem[]
  cnpjAnalise: string
  /** Nomes das contratantes selecionadas (ex.: "Volare", "Marcopolo — Ana Rech"). */
  checklistsAnalise: string[]
  onAplicar: (r: ResultadoImportacao) => void
  onClose: () => void
}) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [data, setData] = useState<DeparaJson | null>(null)
  const [linhas, setLinhas] = useState<LinhaDepara[]>([])
  const [sobrescrever, setSobrescrever] = useState<Set<string>>(new Set())
  const [forcarCnpj, setForcarCnpj] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [aberta, setAberta] = useState<string | null>(null)

  function ler() {
    const r = lerRetorno(texto)
    if (!r.ok) { setErro(r.erro); setData(null); return }
    setErro('')
    setData(r.data)
    const novas = montarPreview(r.data, respostasAtuais, itensVisiveis)
    setLinhas(novas)
    // Itens já marcados (pré-preenchidos) que o Claude respondeu diferente vêm com
    // "sobrescrever" ligado — o analista desmarca o que quiser manter.
    setSobrescrever(new Set(novas.filter(l => l.situacao === 'diferente').map(l => l.chave)))
    setForcarCnpj(false)
    setFiltro('todos')
  }

  const cnpjJson = soDigitos(data?.empresa?.cnpj ?? '')
  const cnpjSistema = soDigitos(cnpjAnalise)
  const cnpjDiverge = !!data && !!cnpjJson && !!cnpjSistema && cnpjJson !== cnpjSistema
  const cnpjFaltando = !!data && (!cnpjJson || !cnpjSistema)
  const checklistsFaltando = useMemo(() => {
    if (!data) return []
    const doJson = new Set(data.checklists.map(normDepara))
    // "Marcopolo — Ana Rech" casa tanto com o nome completo quanto só com "Marcopolo".
    return checklistsAnalise.filter(n => !doJson.has(normDepara(n)) && !doJson.has(normDepara(n.split(' — ')[0])))
  }, [data, checklistsAnalise])

  const aplicaveis = linhas.filter(l => l.proposta && (l.situacao === 'novo' || (l.situacao === 'diferente' && sobrescrever.has(l.chave))))
  const diferentes = linhas.filter(l => l.situacao === 'diferente')
  const nReprov = aplicaveis.filter(l => l.reprovacao).length
  const nPend = linhas.filter(l => l.situacao === 'pendente').length
  const bloqueado = cnpjDiverge && !forcarCnpj

  const visiveis = linhas.filter(l =>
    filtro === 'todos' ? true
      : filtro === 'reprovacoes' ? l.reprovacao
        : filtro === 'diferentes' ? l.situacao === 'diferente'
          : l.situacao === 'pendente')

  function aplicar() {
    if (!data || bloqueado) return
    const respostas: Record<string, DeparaResposta> = {}
    aplicaveis.forEach(l => { respostas[l.itemId!] = l.proposta! })
    const foco = linhas.find(l => l.itemId && (l.situacao === 'pendente' || (l.reprovacao && aplicaveis.includes(l))))
    onAplicar({
      respostas,
      resumo: {
        importadoEm: new Date().toISOString(), geradoEm: data.geradoEm,
        reprovacoes: data.reprovacoes ?? {}, orientacoes: data.orientacoes ?? [],
        observacoes: data.observacoes ?? [], funcoes: data.funcoes ?? [],
      },
      preenchidos: aplicaveis.length, reprovacoes: nReprov, pendentes: nPend,
      focoItemId: foco?.itemId ?? null,
    })
  }

  const toggle = (chave: string) => setSobrescrever(prev => {
    const n = new Set(prev)
    if (n.has(chave)) n.delete(chave)
    else n.add(chave)
    return n
  })

  return (
    <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflow: 'auto', zIndex: 9999 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="gt3-drop-in" style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: data ? 1100 : 760, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <b style={{ fontSize: 16, color: TX }}>🤖 Importar retorno do Claude</b>
            <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>
              {data ? <>Confira a pré-visualização — nada é gravado até clicar em <b>Aplicar</b>.</> : 'Cole o JSON devolvido pelo Claude (formato gt3.checklist.depara 1.0).'}
            </div>
          </div>
          <button onClick={onClose} className="gt3-close-btn" style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: MU, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '16px 20px', maxHeight: '70vh', overflow: 'auto' }}>
          {!data ? (
            <>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} autoFocus spellCheck={false}
                placeholder="Cole aqui o JSON"
                style={{ width: '100%', minHeight: 320, border: `1px solid ${erro ? NO : LINE}`, borderRadius: 8, padding: 12, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12, background: BG, color: TX, resize: 'vertical', boxSizing: 'border-box' }} />
              {erro && <div style={{ marginTop: 8, padding: '10px 12px', background: NOS, color: NO, borderRadius: 8, fontSize: 13 }}>⚠ {erro}</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: TX, marginBottom: 10 }}>
                <b>{data.empresa?.razaoSocial || '(empresa sem nome)'}</b>
                {data.empresa?.cnpj && <span style={{ color: MU }}> · CNPJ {data.empresa.cnpj}</span>}
                <span style={{ color: MU }}> · checklist(s): {data.checklists.join(', ') || '—'}</span>
                {data.geradoEm && <span style={{ color: MU }}> · gerado em {new Date(data.geradoEm).toLocaleString('pt-BR')}</span>}
              </div>

              {cnpjDiverge && (
                <div style={{ marginBottom: 10, padding: '10px 12px', background: NOS, border: `1px solid ${NO}`, borderLeft: `5px solid ${NO}`, borderRadius: 8, fontSize: 13, color: NO }}>
                  <b>CNPJ diferente da análise aberta.</b> Retorno: {data.empresa?.cnpj} · Análise: {cnpjAnalise}. Confira se colou o retorno da empresa certa.
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: TX, cursor: 'pointer' }}>
                    <input type="checkbox" checked={forcarCnpj} onChange={e => setForcarCnpj(e.target.checked)} /> Aplicar mesmo assim
                  </label>
                </div>
              )}
              {cnpjFaltando && (
                <div style={{ marginBottom: 10, padding: '8px 12px', background: ASO, borderRadius: 8, fontSize: 12.5, color: '#8A6A22' }}>
                  ⚠ Não deu para conferir o CNPJ ({!cnpjSistema ? 'a análise está sem CNPJ' : 'o retorno não traz CNPJ'}).
                </div>
              )}
              {checklistsFaltando.length > 0 && (
                <div style={{ marginBottom: 10, padding: '8px 12px', background: ASO, borderRadius: 8, fontSize: 12.5, color: '#8A6A22' }}>
                  ⚠ O retorno não traz o(s) checklist(s) <b>{checklistsFaltando.join(', ')}</b> — os itens exclusivos dele(s) ficam como estão.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <Contador n={aplicaveis.length} label="serão preenchidos" cor={OK} bg={OKS} />
                <Contador n={nReprov} label="reprovações" cor={NO} bg={NOS} />
                <Contador n={nPend} label="pendentes p/ conferir" cor={P} bg={PS} />
                {diferentes.length > 0 && <Contador n={diferentes.length} label="diferentes do já marcado" cor="#8A6A22" bg={ASO} />}
                {linhas.some(l => l.situacao === 'sem' || l.situacao === 'invalido') && (
                  <Contador n={linhas.filter(l => l.situacao === 'sem' || l.situacao === 'invalido').length} label="sem correspondência / inválidos" cor={NO} bg={NOS} />
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                {([['todos', 'Todos'], ['reprovacoes', 'Reprovações'], ['diferentes', 'Diferentes'], ['pendentes', 'Pendentes']] as [Filtro, string][]).map(([k, t]) => (
                  <button key={k} onClick={() => setFiltro(k)} style={{
                    padding: '4px 12px', borderRadius: 99, border: `1.5px solid ${filtro === k ? P : LINE}`, background: filtro === k ? P : '#fff',
                    color: filtro === k ? '#fff' : TX, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{t}</button>
                ))}
                {diferentes.length > 0 && (
                  <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: TX, cursor: 'pointer' }}>
                    <input type="checkbox" checked={diferentes.every(l => sobrescrever.has(l.chave))}
                      onChange={e => setSobrescrever(e.target.checked ? new Set(diferentes.map(l => l.chave)) : new Set())} />
                    Sobrescrever todas as diferentes
                  </label>
                )}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: BG, color: MU, textAlign: 'left' }}>
                    {['', 'Doc', 'Item', 'Resposta atual', 'Resposta do Claude', 'Páginas', 'Situação'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 8px', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: `1px solid ${LINE}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(l => {
                    const cor = SIT_COR[l.situacao]
                    const expandida = aberta === l.chave
                    const temDetalhe = !!(l.evidencia || l.motivoInvalido || l.aviso || l.invalidas.length)
                    return (
                      <Fragment key={l.chave}>
                        <tr style={{ borderBottom: expandida ? 'none' : `1px solid ${LINE}`, background: l.reprovacao ? '#FEF8F8' : undefined, cursor: temDetalhe ? 'pointer' : undefined }}
                          title={l.evidencia || l.motivoInvalido || ''} onClick={() => temDetalhe && setAberta(expandida ? null : l.chave)}>
                          <td style={{ padding: '7px 8px', width: 24 }} onClick={e => e.stopPropagation()}>
                            {l.situacao === 'diferente' && (
                              <input type="checkbox" checked={sobrescrever.has(l.chave)} onChange={() => toggle(l.chave)} title="Sobrescrever o que já estava marcado" />
                            )}
                          </td>
                          <td style={{ padding: '7px 8px', color: MU, whiteSpace: 'nowrap' }}>{l.documento}</td>
                          <td style={{ padding: '7px 8px', color: TX, fontWeight: 500 }}>{l.item}{temDetalhe && <span style={{ color: MU, marginLeft: 4 }}>{expandida ? '▾' : '▸'}</span>}</td>
                          <td style={{ padding: '7px 8px', color: MU }}>{l.atualTxt || '—'}</td>
                          <td style={{ padding: '7px 8px', color: l.reprovacao ? NO : TX, fontWeight: l.reprovacao ? 600 : 400 }}>{l.claudeTxt || '—'}</td>
                          <td style={{ padding: '7px 8px' }}>
                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                              {l.paginas.map(p => (
                                <span key={p} style={{ minWidth: 18, padding: '1px 5px', borderRadius: 4, background: PS, color: P, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{p}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 99, background: cor.bg, color: cor.fg, fontSize: 11, fontWeight: 600 }}>{SITUACAO_LABEL[l.situacao]}</span>
                          </td>
                        </tr>
                        {expandida && (
                          <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                            <td />
                            <td colSpan={6} style={{ padding: '0 8px 9px', fontSize: 12, color: MU }}>
                              {l.evidencia && <div>📄 {l.evidencia}</div>}
                              {l.aviso && <div style={{ color: '#8A6A22' }}>⚠ {l.aviso}</div>}
                              {l.motivoInvalido && <div style={{ color: NO }}>⚠ {l.motivoInvalido}</div>}
                              {l.situacao !== 'invalido' && l.invalidas.length > 0 && <div style={{ color: NO }}>⚠ Opções inexistentes no item (não aplicadas): {l.invalidas.join(', ')}</div>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {!visiveis.length && (
                    <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: MU }}>Nada neste filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
          {data && <button onClick={() => setData(null)} style={btn(false)}>← Colar outro</button>}
          <button onClick={onClose} style={btn(false)}>Cancelar</button>
          {!data ? (
            <button onClick={ler} style={btn(true)}>Ler retorno</button>
          ) : (
            <button onClick={aplicar} disabled={bloqueado || !aplicaveis.length} style={{ ...btn(true), opacity: bloqueado || !aplicaveis.length ? 0.5 : 1, cursor: bloqueado || !aplicaveis.length ? 'not-allowed' : 'pointer' }}
              title={bloqueado ? 'CNPJ diferente — marque "Aplicar mesmo assim"' : !aplicaveis.length ? 'Nada novo para preencher' : ''}>
              Aplicar ({aplicaveis.length})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Contador({ n, label, cor, bg }: { n: number; label: string; cor: string; bg: string }) {
  return (
    <div style={{ padding: '6px 12px', borderRadius: 8, background: bg, color: cor, fontSize: 12.5 }}>
      <b style={{ fontSize: 16, marginRight: 4 }}>{n}</b>{label}
    </div>
  )
}

const btn = (pri: boolean): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
  border: `1px solid ${pri ? P : LINE}`, background: pri ? P : '#fff', color: pri ? '#fff' : TX,
})

/** Bloco com os textos do retorno guardados na análise (reprovações sugeridas, orientações,
 *  observações e funções divergentes) — fica acima do checklist depois de importar. */
export function PainelRetornoClaude({ resumo, onCopiar, onRemover }: {
  resumo: RetornoClaudeResumo
  onCopiar: (texto: string, rotulo: string) => void
  onRemover: () => void
}) {
  const [aberto, setAberto] = useState(true)
  const [funcoesAbertas, setFuncoesAbertas] = useState(false)
  const reprov = (['PGR', 'PCMSO', 'LTCAT'] as const).filter(d => resumo.reprovacoes[d]?.trim())
  const grupos = agruparPorDocumento(resumo.orientacoes, resumo.observacoes)
  const textoGrupo = (g: { doc: string; itens: string[] }) => (g.doc ? g.doc + ':\n' : '') + g.itens.map(o => '- ' + o).join('\n')
  const SIT: Record<string, string> = { igual: 'Nos dois', so_pgr: 'Só no PGR', so_pcmso: 'Só no PCMSO' }
  return (
    <div style={{ border: `1px solid ${AC}`, borderLeft: `5px solid ${AC}`, borderRadius: 10, background: '#fff', marginBottom: 14, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: ASO, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setAberto(a => !a)}>
        <b style={{ fontSize: 13.5, color: TX }}>🤖 Retorno do Claude</b>
        <span style={{ fontSize: 12, color: MU }}>importado em {new Date(resumo.importadoEm).toLocaleString('pt-BR')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: MU }}>{aberto ? '▾ recolher' : '▸ abrir'}</span>
      </div>
      {aberto && (
        <div style={{ padding: '12px 14px', fontSize: 12.5, color: TX, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grupos.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, color: MU }}>Observações sobre a análise (não entram no texto de reprovação)</span>
                <button onClick={() => onCopiar(grupos.map(textoGrupo).join('\n\n'), 'Observações do Claude')} style={{ ...btn(false), padding: '3px 9px', fontSize: 11.5, marginLeft: 'auto' }}>📋 Copiar todas</button>
              </div>
              {grupos.map(g => (
                <div key={g.doc || '-'} style={{ marginTop: 6 }}>
                  {g.doc && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 12, color: P }}>{g.doc}</b>
                      <button onClick={() => onCopiar(textoGrupo(g), `Observações do Claude (${g.doc})`)} style={{ background: 'none', border: 0, padding: 0, color: MU, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>copiar</button>
                    </div>
                  )}
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>{g.itens.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
          {resumo.funcoes.length > 0 && (
            <div>
              <button onClick={() => setFuncoesAbertas(f => !f)} style={{ background: 'none', border: 0, padding: 0, color: P, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {funcoesAbertas ? '▾' : '▸'} Funções com divergência PGR × PCMSO ({resumo.funcoes.filter(f => f.situacao !== 'igual').length})
              </button>
              {funcoesAbertas && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 12 }}>
                  <thead><tr style={{ background: BG, color: MU, textAlign: 'left' }}>
                    {['PGR', 'Páginas PGR', 'PCMSO', 'Páginas PCMSO', 'Situação'].map(h => <th key={h} style={{ padding: '6px 8px', fontWeight: 600 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {resumo.funcoes.map((f, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td style={{ padding: '5px 8px' }}>{f.pgr || '—'}</td>
                        <td style={{ padding: '5px 8px', color: MU }}>{(f.paginasPgr ?? []).join(', ') || '—'}</td>
                        <td style={{ padding: '5px 8px' }}>{f.pcmso || '—'}</td>
                        <td style={{ padding: '5px 8px', color: MU }}>{(f.paginasPcmso ?? []).join(', ') || '—'}</td>
                        <td style={{ padding: '5px 8px', color: f.situacao === 'igual' ? OK : NO }}>{SIT[f.situacao] ?? f.situacao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {reprov.length > 0 && (
            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
              <div style={{ fontSize: 11.5, color: MU, marginBottom: 4 }}>
                Textos para colar — reprovação sugerida pelo Claude. O parecer continua sendo montado pelo sistema a partir das bolinhas; use este só como apoio.
              </div>
              {reprov.map(d => (
                <div key={d} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, whiteSpace: 'pre-wrap', background: BG, borderRadius: 6, padding: '8px 10px', maxHeight: 140, overflow: 'auto' }}><b>{d}:</b> {resumo.reprovacoes[d]}</div>
                  <button onClick={() => onCopiar(resumo.reprovacoes[d]!, `Texto do Claude (${d})`)} style={{ ...btn(false), padding: '5px 10px', fontSize: 12 }}>📋 Copiar texto do Claude</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <button onClick={onRemover} style={{ background: 'none', border: 0, color: MU, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>remover este bloco</button>
          </div>
        </div>
      )}
    </div>
  )
}
