'use client'

// Perfil: Eneagrama + quatro animais, MBTI e Conclusões numa página só.
// Mesmas regras de edição de antes (gestão; Eneagrama/Conclusões só em PDI do banco;
// MBTI migra PDI estático). Visual novo.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PdiColaborador } from '../../../../data/pdis/types'
import { C, Btn, Vazio, Alerta } from './pdi-ui'

// Cor fixa por animal (paleta validada; a mesma da Visão geral)
const COR_ANIMAL: Record<string, string> = { Lobo: '#2A4F96', Tubarão: '#D9730D', Gato: '#0F9F8F', Águia: '#9B5DE5' }
const MEDALHA = ['🥇', '🥈', '🥉']
const TIPOS_ENEAGRAMA = [
  'Tipo 1 - O Reformador (Perfeccionista)', 'Tipo 2 - O Ajudante (Prestativo)', 'Tipo 3 - O Realizador (Bem-Sucedido)',
  'Tipo 4 - O Individualista (Romântico)', 'Tipo 5 - O Observador (Investigador)', 'Tipo 6 - O Lealista (Questionador)',
  'Tipo 7 - O Entusiasta (Sonhador)', 'Tipo 8 - O Confrontador (Desafiador)', 'Tipo 9 - O Pacifista (Preservador)',
]
const MBTI_TIPOS = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ']
const linhas = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)

async function patchPdi(id: string, body: unknown) {
  const r = await fetch(`/api/pdi/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) { const b = await r.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? 'Erro ao salvar') }
}

function Secao({ titulo, sub, acao, children }: { titulo: string; sub?: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="p2-card">
      <div className="p2-card-h">
        <h3 style={{ fontSize: 15 }}>{titulo}{sub && <span style={{ fontSize: 12, fontWeight: 500, color: C.MU }}>{sub}</span>}</h3>
        {acao}
      </div>
      <div className="p2-card-b">{children}</div>
    </section>
  )
}

function Lista({ titulo, cor, bg, itens }: { titulo: string; cor: string; bg: string; itens: string[] }) {
  if (!itens.length) return null
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '12px 14px', borderTop: `3px solid ${cor}` }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{titulo}</div>
      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {itens.map((p, i) => <li key={i} style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{p}</li>)}
      </ul>
    </div>
  )
}

const BotaoEditar = ({ onClick }: { onClick: () => void }) => <Btn sm v="gho" onClick={onClick}>✎ Editar</Btn>
const Rodape = ({ erro, salvando, onCancel, onSave }: { erro: string; salvando: boolean; onCancel: () => void; onSave: () => void }) => (
  <>
    {erro && <div style={{ marginTop: 12 }}><Alerta>{erro}</Alerta></div>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
      <Btn v="gho" onClick={onCancel} disabled={salvando}>Cancelar</Btn>
      <Btn onClick={onSave} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Btn>
    </div>
  </>
)

// ── Eneagrama + animais ──────────────────────────────────────────────

type Rank = { tipo: string; pontuacao: string }
type AnimalForm = { emoji: string; animal: string; percentual: string; pontoForte: string; tendencia: string }

function Eneagrama({ pdi, podeEditar }: { pdi: PdiColaborador; podeEditar: boolean }) {
  const [en, setEn] = useState(pdi.perfilComportamental.eneagrama)
  const [animais, setAnimais] = useState(pdi.perfilComportamental.animais)
  const [ed, setEd] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [rank, setRank] = useState<Rank[]>([])
  const [fortes, setFortes] = useState(''), [atencao, setAtencao] = useState(''), [desenv, setDesenv] = useState('')
  const [anForm, setAnForm] = useState<AnimalForm[]>([])

  function editar() {
    setRank(en.ranking.map(r => ({ tipo: r.tipo, pontuacao: r.pontuacao })))
    setFortes(en.pontosFortes.join('\n')); setAtencao(en.pontosAtencao.join('\n')); setDesenv(en.comoDesenvolver.join('\n'))
    setAnForm(animais.map(a => ({ emoji: a.emoji, animal: a.animal, percentual: a.percentual?.toString() ?? '', pontoForte: a.pontoForte, tendencia: a.tendencia })))
    setErro(''); setEd(true)
  }
  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const eneagrama = {
        ranking: rank.filter(r => r.tipo).map((r, i) => ({ rank: i + 1, tipo: r.tipo, pontuacao: r.pontuacao })),
        pontosFortes: linhas(fortes), pontosAtencao: linhas(atencao), comoDesenvolver: linhas(desenv),
      }
      const novos = anForm.filter(a => a.animal.trim()).map(a => ({
        emoji: a.emoji, animal: a.animal.trim(), percentual: a.percentual ? Number(a.percentual) : undefined,
        pontoForte: a.pontoForte.trim(), tendencia: a.tendencia.trim(),
      }))
      await patchPdi(pdi.id, { eneagrama, animais: novos })
      setEn(eneagrama); setAnimais(novos as PdiColaborador['perfilComportamental']['animais']); setEd(false)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  if (ed) {
    const setR = (i: number, k: keyof Rank, v: string) => setRank(l => l.map((x, j) => j === i ? { ...x, [k]: v } : x))
    const setA = (i: number, k: keyof AnimalForm, v: string) => setAnForm(l => l.map((x, j) => j === i ? { ...x, [k]: v } : x))
    return (
      <Secao titulo="🔢 Eneagrama e quatro animais" sub=" · editando">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="p2-label" style={{ margin: 0 }}>Ranking (em ordem de pontuação)</span>
          <Btn sm v="gho" onClick={() => setRank(l => [...l, { tipo: '', pontuacao: '' }])}>＋ Tipo</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rank.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 26, fontSize: 16 }}>{MEDALHA[i] ?? `${i + 1}º`}</span>
              <select value={r.tipo} onChange={e => setR(i, 'tipo', e.target.value)} className="p2-input" style={{ flex: 2 }}>
                <option value="">Tipo…</option>{TIPOS_ENEAGRAMA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={r.pontuacao} onChange={e => setR(i, 'pontuacao', e.target.value)} placeholder="ex.: 18/25" className="p2-input" style={{ width: 110 }} />
              <button type="button" className="p2-icon-btn" onClick={() => setRank(l => l.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
          {([['✅ Pontos fortes', fortes, setFortes], ['⚠️ Pontos de atenção', atencao, setAtencao], ['🎯 Como desenvolver', desenv, setDesenv]] as const).map(([l, v, set]) => (
            <div key={l}><span className="p2-label">{l}</span><textarea value={v} onChange={e => set(e.target.value)} rows={5} className="p2-input" style={{ width: '100%' }} placeholder="Um item por linha…" /></div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 8px' }}>
          <span className="p2-label" style={{ margin: 0 }}>Quatro animais</span>
          {anForm.length < 4 && <Btn sm v="gho" onClick={() => setAnForm(l => [...l, { emoji: '🐾', animal: '', percentual: '', pontoForte: '', tendencia: '' }])}>＋ Animal</Btn>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {anForm.map((a, i) => (
            <div key={i} style={{ border: '1px solid var(--p2-line)', borderRadius: 12, padding: 10, borderTop: `3px solid ${COR_ANIMAL[a.animal] ?? '#CBD5E1'}` }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input value={a.emoji} onChange={e => setA(i, 'emoji', e.target.value)} maxLength={2} className="p2-input" style={{ width: 46, textAlign: 'center' }} />
                <input value={a.animal} onChange={e => setA(i, 'animal', e.target.value)} placeholder="Animal" className="p2-input" style={{ flex: 1 }} />
                <input value={a.percentual} onChange={e => setA(i, 'percentual', e.target.value)} type="number" min={0} max={100} placeholder="%" className="p2-input" style={{ width: 66 }} />
                <button type="button" className="p2-icon-btn" onClick={() => setAnForm(l => l.filter((_, j) => j !== i))}>✕</button>
              </div>
              <textarea value={a.pontoForte} onChange={e => setA(i, 'pontoForte', e.target.value)} rows={2} placeholder="Ponto forte" className="p2-input" style={{ width: '100%', marginBottom: 6 }} />
              <textarea value={a.tendencia} onChange={e => setA(i, 'tendencia', e.target.value)} rows={2} placeholder="Tendência / em excesso" className="p2-input" style={{ width: '100%' }} />
            </div>
          ))}
        </div>
        <Rodape erro={erro} salvando={salvando} onCancel={() => setEd(false)} onSave={salvar} />
      </Secao>
    )
  }

  const ordenados = [...animais].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0))
  const total = ordenados.reduce((s, a) => s + (a.percentual ?? 0), 0) || 100
  const pts = (p: string) => { const n = parseInt(p, 10); return Number.isFinite(n) ? n : null }
  const vazio = !en.ranking.length && !animais.length && !en.pontosFortes.length

  return (
    <>
      <Secao titulo="🔢 Eneagrama" acao={podeEditar ? <BotaoEditar onClick={editar} /> : undefined}>
        {vazio ? <Vazio>{podeEditar ? 'Clique em "Editar" para preencher o Eneagrama e os animais.' : 'Eneagrama não disponível.'}</Vazio> : (
          <>
            {en.ranking.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                {en.ranking.map((e, i) => {
                  const n = pts(e.pontuacao)
                  const [nome, apelido] = e.tipo.split(' (')
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px minmax(180px, 1fr) minmax(120px, 2fr) 54px', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 18 }}>{MEDALHA[i] ?? `${i + 1}º`}</span>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: i === 0 ? 800 : 600 }}>{nome}</div>
                        {apelido && <div style={{ fontSize: 11.5, color: C.MU }}>{apelido.replace(')', '')}</div>}
                      </div>
                      <div className="p2-bar" style={{ height: 8 }}><i style={{ width: n !== null ? `${(n / 25) * 100}%` : '0%', background: i === 0 ? '#2A4F96' : '#9FB3D9' }} /></div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'right', color: i === 0 ? C.TX : C.MU }}>{e.pontuacao || '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
              <Lista titulo="✅ Pontos fortes" cor="#166534" bg="#F4FBF7" itens={en.pontosFortes} />
              <Lista titulo="⚠️ Pontos de atenção" cor="#9A3412" bg="#FFF8F1" itens={en.pontosAtencao} />
              <Lista titulo="🎯 Como desenvolver" cor="#1E40AF" bg="#F3F7FD" itens={en.comoDesenvolver} />
            </div>
          </>
        )}
      </Secao>

      {animais.length > 0 && (
        <Secao titulo="🐾 Quatro animais" acao={podeEditar ? <BotaoEditar onClick={editar} /> : undefined}>
          <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
            {ordenados.map(a => <span key={a.animal} title={`${a.animal} ${a.percentual ?? 0}%`} style={{ width: `${((a.percentual ?? 0) / total) * 100}%`, background: COR_ANIMAL[a.animal] ?? '#94A3B8', transition: 'width .6s var(--p2-ease-out)' }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
            {ordenados.map((a, i) => (
              <div key={a.animal} className="p2-card is-hover" style={{ padding: '12px 14px', boxShadow: 'none', borderTop: `3px solid ${COR_ANIMAL[a.animal] ?? '#94A3B8'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{a.emoji}</span>
                  <b style={{ fontSize: 14, flex: 1 }}>{a.animal}</b>
                  {a.percentual !== undefined && <span style={{ fontSize: 20, fontWeight: 800, color: COR_ANIMAL[a.animal] ?? C.TX }}>{a.percentual}%</span>}
                </div>
                {i === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: C.MU, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>dominante</div>}
                {a.pontoForte && <div style={{ fontSize: 12.5, color: '#374151', marginTop: 8 }}><b style={{ color: '#166534' }}>Ponto forte · </b>{a.pontoForte}</div>}
                {a.tendencia && <div style={{ fontSize: 12.5, color: '#374151', marginTop: 6 }}><b style={{ color: '#9A3412' }}>Tendência · </b>{a.tendencia}</div>}
              </div>
            ))}
          </div>
        </Secao>
      )}
    </>
  )
}

// ── MBTI ─────────────────────────────────────────────────────────────

type MbtiForm = { tipo: string; nucleo: string; veredito: string; estiloDecisao: string; relacionamentoAutoridade: string; curvaAprendizado: string; impactoClima: string; zonaRisco: string }
const MBTI_VAZIO: MbtiForm = { tipo: '', nucleo: '', veredito: '', estiloDecisao: '', relacionamentoAutoridade: '', curvaAprendizado: '', impactoClima: '', zonaRisco: '' }
const MBTI_CAMPOS: { k: keyof MbtiForm; l: string; cor: string; bg: string }[] = [
  { k: 'nucleo', l: '🧭 Núcleo de funcionamento', cor: '#334155', bg: '#F5F7FB' },
  { k: 'estiloDecisao', l: '🧩 Estilo de decisão', cor: '#334155', bg: '#F5F7FB' },
  { k: 'relacionamentoAutoridade', l: '🎯 Relação com autoridade e processo', cor: '#334155', bg: '#F5F7FB' },
  { k: 'curvaAprendizado', l: '🔄 Curva de aprendizado', cor: '#166534', bg: '#F4FBF7' },
  { k: 'impactoClima', l: '🤝 Impacto no clima e no time', cor: '#1E40AF', bg: '#F3F7FD' },
  { k: 'zonaRisco', l: '🚨 Zona de risco comportamental', cor: '#B91C1C', bg: '#FEF6F6' },
]

function Mbti({ pdi, isDbPdi, canEdit }: { pdi: PdiColaborador; isDbPdi?: boolean; canEdit: boolean }) {
  const router = useRouter()
  const [dados, setDados] = useState<Partial<MbtiForm> | null>((pdi.perfilComportamental.mbti as Partial<MbtiForm> | undefined) ?? null)
  const [ed, setEd] = useState(false)
  const [form, setForm] = useState<MbtiForm>(MBTI_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      let alvo = pdi.id
      if (!isDbPdi) {
        const r = await fetch('/api/pdi/migrar-estatico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staticId: pdi.id, nome: pdi.nome, funcao: pdi.funcao }) })
        if (!r.ok) { const b = await r.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? 'Erro ao preparar PDI') }
        alvo = (await r.json() as { id: string }).id
      }
      await patchPdi(alvo, { mbti: form })
      setDados(form); setEd(false)
      if (!isDbPdi) router.replace(`/pdi/${alvo}`)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  if (ed) return (
    <Secao titulo="🧠 MBTI" sub=" · editando">
      <span className="p2-label">Tipo</span>
      <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="p2-input" style={{ width: 160, marginBottom: 14 }}>
        <option value="">Selecione…</option>{MBTI_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {[{ k: 'veredito' as const, l: '🧠 Veredito organizacional' }, ...MBTI_CAMPOS].map(c => (
          <div key={c.k}><span className="p2-label">{c.l}</span><textarea value={form[c.k]} onChange={e => setForm({ ...form, [c.k]: e.target.value })} rows={4} className="p2-input" style={{ width: '100%' }} /></div>
        ))}
      </div>
      <Rodape erro={erro} salvando={salvando} onCancel={() => setEd(false)} onSave={salvar} />
    </Secao>
  )

  const tem = !!(dados?.tipo || dados?.nucleo || dados?.veredito)
  return (
    <Secao titulo="🧠 MBTI" acao={canEdit ? <BotaoEditar onClick={() => { setForm({ ...MBTI_VAZIO, ...Object.fromEntries(Object.entries(dados ?? {}).map(([k, v]) => [k, v ?? ''])) } as MbtiForm); setErro(''); setEd(true) }} /> : undefined}>
      {!tem ? <Vazio>{canEdit ? 'Clique em "Editar" para preencher o MBTI.' : 'MBTI não disponível.'}</Vazio> : (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 14 }}>
            {dados?.tipo && (
              <div style={{ background: 'linear-gradient(135deg, var(--p2-navy), var(--p2-blue))', color: 'var(--p2-gold)', borderRadius: 16, padding: '16px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 140, boxShadow: '0 8px 20px -10px rgba(30,58,110,.6)' }}>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 5 }}>{dados.tipo}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {dados.tipo.split('').map((l, i) => <span key={i} style={{ fontSize: 10, color: '#C9D6EE' }}>{({ I: 'Intro', E: 'Extro', S: 'Sens', N: 'Intu', T: 'Pens', F: 'Sent', J: 'Julg', P: 'Perc' } as Record<string, string>)[l] ?? l}</span>)}
                </div>
              </div>
            )}
            {dados?.veredito && (
              <div style={{ flex: 1, minWidth: 260, background: 'var(--p2-gold-bg)', borderRadius: 16, padding: '14px 18px', borderLeft: '4px solid var(--p2-gold)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>🧠 Veredito organizacional</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{dados.veredito}</p>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            {MBTI_CAMPOS.filter(c => dados?.[c.k]).map(c => (
              <div key={c.k} style={{ background: c.bg, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: c.cor, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{c.l}</div>
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{dados?.[c.k]}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Secao>
  )
}

// ── Conclusões ───────────────────────────────────────────────────────

const SECOES_CONC = [
  { k: 'forcas' as const, t: '✅ Forças visíveis', cor: '#166534', bg: '#F4FBF7' },
  { k: 'pontosAtencao' as const, t: '⚠️ Pontos de atenção', cor: '#9A3412', bg: '#FFF8F1' },
  { k: 'ondeAgrega' as const, t: '📌 Onde agrega mais', cor: '#1E40AF', bg: '#F3F7FD' },
  { k: 'comoPodeApoiar' as const, t: '🤝 Pode apoiar bem', cor: '#5B21B6', bg: '#F7F4FE' },
  { k: 'comoLiderar' as const, t: '🚀 Como liderar', cor: '#92400E', bg: 'var(--p2-gold-bg)' },
  { k: 'riscos' as const, t: '⚡ Riscos se mal alocado', cor: '#B91C1C', bg: '#FEF6F6' },
]
type ConcK = typeof SECOES_CONC[number]['k']

function Conclusoes({ pdi, podeEditar }: { pdi: PdiColaborador; podeEditar: boolean }) {
  const [c, setC] = useState(pdi.conclusoes)
  const [ed, setEd] = useState(false)
  const [form, setForm] = useState<Record<ConcK, string>>({ forcas: '', pontosAtencao: '', ondeAgrega: '', comoPodeApoiar: '', comoLiderar: '', riscos: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const novo = Object.fromEntries(SECOES_CONC.map(s => [s.k, linhas(form[s.k])])) as PdiColaborador['conclusoes']
      await patchPdi(pdi.id, { conclusoes: novo })
      setC(novo); setEd(false)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  if (ed) return (
    <Secao titulo="✅ Conclusões" sub=" · editando">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {SECOES_CONC.map(s => (
          <div key={s.k}><span className="p2-label" style={{ color: s.cor }}>{s.t}</span><textarea value={form[s.k]} onChange={e => setForm({ ...form, [s.k]: e.target.value })} rows={5} className="p2-input" style={{ width: '100%' }} placeholder="Um item por linha…" /></div>
        ))}
      </div>
      <Rodape erro={erro} salvando={salvando} onCancel={() => setEd(false)} onSave={salvar} />
    </Secao>
  )

  const vazio = SECOES_CONC.every(s => !c[s.k].length)
  return (
    <Secao titulo="✅ Conclusões" acao={podeEditar ? <BotaoEditar onClick={() => { setForm(Object.fromEntries(SECOES_CONC.map(s => [s.k, c[s.k].join('\n')])) as Record<ConcK, string>); setErro(''); setEd(true) }} /> : undefined}>
      {vazio ? <Vazio>{podeEditar ? 'Clique em "Editar" para preencher as conclusões.' : 'Conclusões não disponíveis.'}</Vazio> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {SECOES_CONC.map(s => <Lista key={s.k} titulo={s.t} cor={s.cor} bg={s.bg} itens={c[s.k]} />)}
        </div>
      )}
    </Secao>
  )
}

export default function PerfilTab({ pdi, isDbPdi, canEdit }: { pdi: PdiColaborador; isDbPdi?: boolean; canEdit: boolean }) {
  return (
    <div className="p2-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Eneagrama pdi={pdi} podeEditar={!!isDbPdi && canEdit} />
      <Mbti pdi={pdi} isDbPdi={isDbPdi} canEdit={canEdit} />
      <Conclusoes pdi={pdi} podeEditar={!!isDbPdi && canEdit} />
      <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>Os testes são instrumentos de reflexão, não diagnóstico. A observação do dia a dia tem peso central.</div>
    </div>
  )
}
