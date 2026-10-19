'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Company } from '../types'
import { SEGMENT_COLORS } from '../types'
import {
  PADRAO_ID, SEM_VARIACAO, FASES, PRESET_NIVEIS,
  type Associacao, type PerfilAssoc, type RegraDoc, type Selecao, type Escopo, type Passo, type Variacao,
  calcularPlano, docKey, exigeNa, notaNa, importarTabela, nomeVariacao, novoId, perfilVazio,
  precisaVariacao, tabelasDaFicha,
} from './model'
import { carregarPerfis, emModoLocal, salvarPerfil } from './store'

export type PedidoAssoc =
  | { tipo: 'hub' }
  | { tipo: 'config'; contratanteId: string }
  | { tipo: 'associar'; nova: Associacao }

// ── Paleta ─────────────────────────────────────────────────────────────────

const C = {
  ink: '#1E253D', text: '#2D3748', mute: '#718096', faint: '#A0AEC0',
  line: '#E2E8F0', soft: '#F7F9FC', primary: '#2A4F96', primaryDark: '#1E3A6E', accent: '#D1AE6E',
  ok: '#2F855A', okBg: '#F0FFF4', okLine: '#9AE6B4',
  bad: '#C53030', badBg: '#FFF5F5', badLine: '#FEB2B2',
}

function corNivel(nome: string) {
  const n = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (n.includes('crit')) return '#C53030'
  if (n.includes('alto') || n.includes('alta')) return '#DD6B20'
  if (n.includes('medi')) return '#B7791F'
  if (n.includes('baix')) return '#2F855A'
  return '#2B6CB0'
}

/** Borda com um lado de cor/largura diferente, só com propriedades longas
 *  (misturar border/borderColor com borderLeft* gera aviso do React ao re-renderizar). */
function bordas(larguras: string, cor: string, lado: { top?: string; left?: string } = {}): React.CSSProperties {
  const [t, r, b, l] = larguras.split(' ')
  return {
    borderTopStyle: 'solid', borderRightStyle: 'solid', borderBottomStyle: 'solid', borderLeftStyle: 'solid',
    borderTopWidth: t, borderRightWidth: r, borderBottomWidth: b, borderLeftWidth: l,
    borderTopColor: lado.top ?? cor, borderRightColor: cor, borderBottomColor: cor, borderLeftColor: lado.left ?? cor,
  }
}

// ── Camada principal ───────────────────────────────────────────────────────

export default function AssociacoesLayer({
  companies, pedido, onFechar,
}: {
  companies: Company[]
  pedido: PedidoAssoc | null
  onFechar: () => void
}) {
  const [carregado, setCarregado] = useState(false)
  const [perfis, setPerfis] = useState<Record<string, PerfilAssoc>>({})
  const [wizard, setWizard] = useState<Associacao | null>(null)

  useEffect(() => {
    if (!pedido || carregado) return
    let cancel = false
    void (async () => {
      const p = await carregarPerfis()
      if (cancel) return
      setPerfis(p); setCarregado(true)
    })()
    return () => { cancel = true }
  }, [pedido, carregado])

  // "Associar" de uma contratante abre direto a tela, com ela como destino.
  const wizardAtual = wizard ?? (pedido?.tipo === 'associar' ? pedido.nova : null)

  const nome = useMemo(() => {
    const m = new Map(companies.map(c => [c.id, c.name]))
    return (id: string) => id === PADRAO_ID ? 'Padrão' : m.get(id) ?? id
  }, [companies])

  async function gravarPerfil(p: PerfilAssoc) {
    const ok = await salvarPerfil(p)
    if (!ok) { alert('Não foi possível salvar a configuração. Confirme que o SQL sql/contratantes-associacoes.sql foi executado.'); return false }
    setPerfis(prev => ({ ...prev, [p.contratanteId]: p }))
    return true
  }

  async function gravarVinculosPadrao(ids: string[], segue: boolean) {
    for (const id of ids) {
      const atual = perfis[id] ?? perfilVazio(id)
      // Sem configuração gravada já conta como padrão; grava mesmo assim para ficar explícito.
      if (perfis[id] && atual.herdaPadrao === segue) continue
      if (!(await gravarPerfil({ ...atual, herdaPadrao: segue }))) return false
    }
    return true
  }

  if (!pedido) return null

  if (!carregado) {
    return (
      <Overlay>
        <div style={{ margin: 'auto', color: '#fff', fontSize: 14, fontWeight: 600 }}>Carregando associações…</div>
      </Overlay>
    )
  }

  const fecharWizard = () => {
    setWizard(null)
    if (pedido.tipo === 'associar') onFechar()
  }

  return (
    <>
      {pedido.tipo === 'hub' && (
        <Hub
          companies={companies}
          perfis={perfis}
          onNova={() => setWizard(novaAssociacao([], []))}
          onSalvarPerfil={gravarPerfil}
          onVincularPadrao={gravarVinculosPadrao}
          onFechar={onFechar}
        />
      )}

      {pedido.tipo === 'config' && (
        <Overlay>
          <Janela largura={1100}>
            <ConfigEditor
              key={pedido.contratanteId}
              contratanteId={pedido.contratanteId}
              companies={companies}
              perfis={perfis}
              onSalvar={gravarPerfil}
              onFechar={onFechar}
            />
          </Janela>
        </Overlay>
      )}

      {wizardAtual && (
        <Wizard
          key={wizardAtual.id}
          inicial={wizardAtual}
          companies={companies}
          perfis={perfis}
          nome={nome}
          onFinalizar={fecharWizard}
        />
      )}
    </>
  )
}

export function novaAssociacao(origem: Selecao[], destino: Selecao[]): Associacao {
  return { id: novoId(), origem, destino, feitos: [] }
}

// ── Estrutura visual ───────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="gt3-overlay-fade" style={{
      position: 'fixed', inset: 0, zIndex: 9990, display: 'flex',
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', padding: 20,
    }}>
      {children}
    </div>
  )
}

function Janela({ children, largura }: { children: React.ReactNode; largura?: number }) {
  return (
    <div className="gt3-drop-in" style={{
      margin: 'auto', width: '100%', maxWidth: largura ?? 1400, height: '100%', maxHeight: 'calc(100vh - 40px)',
      background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 64px rgba(15,23,42,0.35)',
    }}>
      {children}
    </div>
  )
}

function Cabecalho({ titulo, sub, direita, children }: { titulo: React.ReactNode; sub?: React.ReactNode; direita?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div style={{
      background: `linear-gradient(120deg, ${C.primaryDark} 0%, ${C.primary} 60%, #3D6ABF 100%)`,
      color: '#fff', padding: '18px 24px 14px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{titulo}</div>
          {sub && <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4 }}>{sub}</div>}
        </div>
        {direita}
      </div>
      {children}
    </div>
  )
}

function BotaoFechar({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Fechar" className="gt3-close-btn" style={{
      width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)',
      background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0,
    }}>✕</button>
  )
}

function Btn({ onClick, children, tipo = 'sec', disabled, title, small }: {
  onClick: () => void; children: React.ReactNode; tipo?: 'pri' | 'sec' | 'ghost' | 'danger' | 'ouro'; disabled?: boolean; title?: string; small?: boolean
}) {
  const [hov, setHov] = useState(false)
  const st: Record<string, React.CSSProperties> = {
    pri: { background: hov ? '#3D6ABF' : C.primary, color: '#fff', border: '1px solid transparent', boxShadow: '0 2px 8px rgba(42,79,150,0.3)' },
    ouro: { background: hov ? '#C49A52' : C.accent, color: '#2D2410', border: '1px solid transparent', boxShadow: '0 2px 8px rgba(209,174,110,0.4)' },
    sec: { background: hov ? '#EEF2FF' : '#fff', color: hov ? C.primary : '#4A5568', border: `1px solid ${hov ? '#BFD0FF' : C.line}` },
    ghost: { background: hov ? '#EEF2FF' : 'transparent', color: C.primary, border: '1px solid transparent' },
    danger: { background: hov ? C.badBg : '#fff', color: C.bad, border: `1px solid ${C.badLine}` },
  }
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
        padding: small ? '5px 10px' : '8px 16px', borderRadius: 9, fontSize: small ? 12 : 13, fontWeight: 650,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
        transition: 'background-color .15s, color .15s, border-color .15s', ...st[tipo],
      }}
    >{children}</button>
  )
}

function Cartao({ titulo, children, extra, pad = 16 }: { titulo?: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode; pad?: number }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(26,36,54,0.04)', marginBottom: 14 }}>
      {titulo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4A5568' }}>{titulo}</div>
          {extra}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  )
}

function Segmentado<T extends string>({ opcoes, valor, onChange }: { opcoes: { v: T; label: React.ReactNode }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: '#EDF2F7', borderRadius: 10, padding: 3, gap: 2 }}>
      {opcoes.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
          background: valor === o.v ? '#fff' : 'transparent', color: valor === o.v ? C.primary : C.mute,
          boxShadow: valor === o.v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all .15s',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9,
  border: `1px solid #CBD5E0`, fontSize: 13, outline: 'none', background: '#fff', color: C.text,
}

function AvisoModoLocal() {
  if (!emModoLocal()) return null
  return (
    <div style={{ background: '#FFFBEB', borderBottom: '1px solid #F6E05E', color: '#744210', fontSize: 12, padding: '7px 24px' }}>
      ⚠ Modo local: as associações estão sendo guardadas só neste navegador. Execute <b>sql/contratantes-associacoes.sql</b> no Supabase para compartilhar com a equipe.
    </div>
  )
}

// ── Hub (botão geral) ──────────────────────────────────────────────────────

function Hub({
  companies, perfis, onNova, onSalvarPerfil, onVincularPadrao, onFechar,
}: {
  companies: Company[]
  perfis: Record<string, PerfilAssoc>
  onNova: () => void
  onSalvarPerfil: (p: PerfilAssoc) => Promise<boolean>
  onVincularPadrao: (ids: string[], segue: boolean) => Promise<boolean>
  onFechar: () => void
}) {
  const [selConfig, setSelConfig] = useState<string>(PADRAO_ID)
  const [buscaConfig, setBuscaConfig] = useState('')

  const ordenadas = [...companies].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .filter(c => c.name.toLowerCase().includes(buscaConfig.trim().toLowerCase()))

  return (
    <Overlay>
      <Janela>
        <Cabecalho
          titulo={<>🔗 Associações</>}
          sub="Configure as contratantes e veja o que isentar, ignorar, desisentar ou adicionar no GTSoft quando uma empresa passa a atender mais de uma."
          direita={<div style={{ display: 'flex', gap: 8 }}><Btn tipo="ouro" onClick={onNova}>＋ Nova associação</Btn><BotaoFechar onClick={onFechar} /></div>}
        />
        <AvisoModoLocal />

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div style={{ width: 280, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', background: '#fff' }}>
              <div style={{ padding: 12 }}>
                <input type="search" value={buscaConfig} onChange={e => setBuscaConfig(e.target.value)} placeholder="Buscar contratante…" style={inputSt} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
                <ItemConfig
                  ativo={selConfig === PADRAO_ID} onClick={() => setSelConfig(PADRAO_ID)}
                  titulo="Padrão" sub={perfis[PADRAO_ID] ? `${perfis[PADRAO_ID].documentos.length} documentos padrão` : 'Ainda não criado'}
                  cor={C.accent} destaque
                />
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: C.faint, padding: '10px 4px 4px', textTransform: 'uppercase' }}>Contratantes</div>
                {ordenadas.map(c => {
                  const p = perfis[c.id]
                  const tag = !p || (p.documentos.length === 0 && p.variacoes.length === 0)
                    ? (p && !p.herdaPadrao ? 'Sem documentos' : 'Segue o Padrão')
                    : `${p.variacoes.length ? p.variacoes.length + ' variações · ' : ''}${p.documentos.length} regra${p.documentos.length !== 1 ? 's' : ''}`
                  return (
                    <ItemConfig key={c.id} ativo={selConfig === c.id} onClick={() => setSelConfig(c.id)}
                      titulo={c.name} sub={tag} cor={SEGMENT_COLORS[c.segment] ?? '#8C6EDC'} />
                  )
                })}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <ConfigEditor
                key={selConfig}
                contratanteId={selConfig}
                companies={companies}
                perfis={perfis}
                onSalvar={onSalvarPerfil}
                onVincularPadrao={onVincularPadrao}
                embutido
              />
            </div>
          </div>
      </Janela>
    </Overlay>
  )
}

function ItemConfig({ ativo, onClick, titulo, sub, cor, destaque }: { ativo: boolean; onClick: () => void; titulo: string; sub: string; cor: string; destaque?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      padding: '8px 10px', borderRadius: 9, marginBottom: 3, cursor: 'pointer',
      background: ativo ? '#EEF2FF' : hov ? '#F0F3F8' : destaque ? '#FFFAF0' : 'transparent',
      ...bordas('1px 1px 1px 3px', ativo ? '#BFD0FF' : destaque ? '#F6E0B5' : 'transparent', { left: ativo || destaque ? cor : 'transparent' }),
    }}>
      <div style={{ fontSize: 13, fontWeight: 650, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {destaque && '◎ '}{titulo}
      </div>
      <div style={{ fontSize: 11.5, color: C.mute, marginTop: 1 }}>{sub}</div>
    </div>
  )
}

// ── Editor de configurações (uma contratante ou o Padrão) ───────────────────

function ConfigEditor({
  contratanteId, companies, perfis, onSalvar, onFechar, onVincularPadrao, embutido,
}: {
  contratanteId: string
  companies: Company[]
  perfis: Record<string, PerfilAssoc>
  onSalvar: (p: PerfilAssoc) => Promise<boolean>
  onFechar?: () => void
  onVincularPadrao?: (ids: string[], segue: boolean) => Promise<boolean>
  embutido?: boolean
}) {
  const ehPadrao = contratanteId === PADRAO_ID
  const company = companies.find(c => c.id === contratanteId)
  const existe = !!perfis[contratanteId]
  const [rascunho, setRascunho] = useState<PerfilAssoc>(() => structuredClone(perfis[contratanteId] ?? perfilVazio(contratanteId)))
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvoOk, setSalvoOk] = useState(false)
  const [escopo, setEscopo] = useState<Escopo>('empresa')
  const [verHerdados, setVerHerdados] = useState(false)
  const [novoCod, setNovoCod] = useState('')
  const [novoDesc, setNovoDesc] = useState('')
  const [fonteImport, setFonteImport] = useState('')

  const padrao = perfis[PADRAO_ID]
  const muda = (fn: (p: PerfilAssoc) => PerfilAssoc) => { setRascunho(p => fn(structuredClone(p))); setSujo(true); setSalvoOk(false) }

  // Contratantes padrão (só na tela do Padrão): marcação em rascunho, gravada pelo "Salvar".
  // Antes cada clique gravava na hora, sem retorno, e o botão Salvar ficava apagado.
  const seguePadrao = (id: string) => perfis[id]?.herdaPadrao ?? true
  const [vinculos, setVinculos] = useState<Record<string, boolean>>(
    () => Object.fromEntries(companies.map(c => [c.id, seguePadrao(c.id)])),
  )
  const vincMudados = companies.filter(c => vinculos[c.id] !== seguePadrao(c.id))
  const pendente = sujo || vincMudados.length > 0
  const marcar = (ids: string[], v: boolean) => { setVinculos(prev => ({ ...prev, ...Object.fromEntries(ids.map(id => [id, v])) })); setSalvoOk(false) }

  async function salvar() {
    setSalvando(true)
    let ok = true
    if (sujo) ok = await onSalvar(rascunho)
    if (ok && vincMudados.length && onVincularPadrao) {
      const ligar = vincMudados.filter(c => vinculos[c.id]).map(c => c.id)
      const desligar = vincMudados.filter(c => !vinculos[c.id]).map(c => c.id)
      ok = (await onVincularPadrao(ligar, true)) && (await onVincularPadrao(desligar, false))
    }
    setSalvando(false)
    if (ok) { setSujo(false); setSalvoOk(true) }
  }

  function fechar() {
    if (pendente && !confirm('Há alterações não salvas. Sair mesmo assim?')) return
    onFechar?.()
  }

  // Variações
  const addVariacao = (nomeV: string) => muda(p => {
    const v: Variacao = { id: novoId(), nome: nomeV }
    p.variacoes.push(v)
    // Novas variações começam com o mesmo comportamento de "sem variação" (exige).
    for (const d of p.documentos) d.exige[v.id] = d.exige[SEM_VARIACAO] ?? true
    return p
  })
  const removerVariacao = (id: string) => {
    if (!confirm('Remover esta variação? As marcações de documentos dela serão perdidas.')) return
    muda(p => {
      p.variacoes = p.variacoes.filter(v => v.id !== id)
      for (const d of p.documentos) delete d.exige[id]
      return p
    })
  }

  // Documentos
  const colunas: { id: string; nome: string }[] = rascunho.variacoes.length ? rascunho.variacoes : [{ id: SEM_VARIACAO, nome: 'Exigência' }]
  const docsEscopo = rascunho.documentos.filter(d => d.escopo === escopo)
  const proprios = new Set(rascunho.documentos.map(docKey))
  const herdados = !ehPadrao && rascunho.herdaPadrao && padrao ? padrao.documentos.filter(d => d.escopo === escopo && !proprios.has(docKey(d))) : []

  const addDoc = (codigo: string, descricao: string, exigeTudo = true) => {
    if (!codigo.trim() && !descricao.trim()) return
    muda(p => {
      const exige: Record<string, boolean> = {}
      for (const c of colunas) exige[c.id] = exigeTudo
      p.documentos.push({ id: novoId(), codigo: codigo.trim(), descricao: descricao.trim(), escopo, exige })
      return p
    })
  }
  const editDoc = (id: string, patch: Partial<RegraDoc>) => muda(p => { p.documentos = p.documentos.map(d => d.id === id ? { ...d, ...patch } : d); return p })
  const toggleExige = (id: string, col: string) => muda(p => {
    const d = p.documentos.find(x => x.id === id)!
    // Exige → Tira → Não se aplica → Exige
    const atual = exigeNa(d, col === SEM_VARIACAO ? null : col)
    d.exige[col] = atual === true ? false : atual === false ? null : true
    return p
  })
  const marcarColuna = (col: string, valor: boolean) => muda(p => {
    for (const d of p.documentos) if (d.escopo === escopo) d.exige[col] = valor
    return p
  })

  // Importar tabela
  const fontes = (ehPadrao ? companies : company ? [company] : [])
    .flatMap(c => tabelasDaFicha(c).map((t, i) => ({ key: `${c.id}#${i}`, label: ehPadrao ? `${c.name} · ${t.label}` : t.label, t })))
  function importar() {
    const f = fontes.find(x => x.key === fonteImport)
    if (!f) return
    const r = importarTabela(f.t, escopo, ehPadrao ? [] : rascunho.variacoes)
    muda(p => {
      if (!ehPadrao) p.variacoes = r.variacoes
      const porKey = new Map(p.documentos.map(d => [docKey(d), d]))
      for (const d of r.documentos) {
        const doc = ehPadrao ? { ...d, exige: { [SEM_VARIACAO]: true } } : d
        const ex = porKey.get(docKey(doc))
        if (ex) Object.assign(ex, { descricao: doc.descricao || ex.descricao, exige: { ...ex.exige, ...doc.exige }, notas: { ...ex.notas, ...doc.notas } })
        else p.documentos.push(doc)
      }
      return p
    })
    setFonteImport('')
  }

  const titulo = ehPadrao ? 'Padrão' : company?.name ?? contratanteId

  // Vínculo com o Padrão (só no Padrão, pelo botão geral)
  const [buscaVinc, setBuscaVinc] = useState('')
  const ordenadas = [...companies].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {embutido ? (
        <div style={{ padding: '16px 24px 12px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, display: 'flex', gap: 8, alignItems: 'center' }}>
              ⚙ {titulo}
              {ehPadrao && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#FFFAF0', color: '#8A6420', border: '1px solid #F6E0B5' }}>Documentos padrão</span>}
            </div>
            <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>
              {ehPadrao ? 'Documentos exigidos pelas contratantes padrão (marcadas abaixo).' : 'O que esta contratante exige ou pede para tirar, por variação.'}
            </div>
          </div>
        </div>
      ) : (
        <Cabecalho
          titulo={<>⚙ Configurações · {titulo}</>}
          sub="Variações (ex.: nível da empresa) e o que esta contratante exige ou pede para tirar. Vale para todas as associações."
          direita={<BotaoFechar onClick={fechar} />}
        />
      )}
      {!embutido && <AvisoModoLocal />}

      <div style={{ flex: 1, overflowY: 'auto', background: C.soft, padding: 24 }}>
        {ehPadrao && !existe && !sujo && (
          <div style={{ background: 'linear-gradient(135deg,#FFFAF0,#FFF3D6)', border: '1px solid #F6E0B5', borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: '#744210', fontSize: 15 }}>Criar o modelo Padrão</div>
            <div style={{ fontSize: 13, color: '#8A6420', margin: '4px 0 12px' }}>
              Liste os documentos (empresa e pessoas) que a maioria dos clientes exige. Ele funciona como neutro: clientes como a Marcopolo seguem este modelo, e quem pede para tirar algo (ex.: Salton) só registra as diferenças.
            </div>
            <Btn tipo="ouro" onClick={() => muda(p => p)}>Começar o Padrão</Btn>
          </div>
        )}

        {!ehPadrao && (
          <Cartao titulo="Base">
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', fontSize: 13, color: C.text }}>
              <Interruptor ligado={rascunho.herdaPadrao} onChange={v => muda(p => ({ ...p, herdaPadrao: v }))} />
              <span><b>Contratante padrão</b> — exige os documentos padrão; aqui você só registra as diferenças (documentos que ela tira ou acrescenta).</span>
            </label>
            {rascunho.herdaPadrao && !padrao && (
              <div style={{ fontSize: 12, color: '#B7791F', marginTop: 8 }}>O Padrão ainda não foi criado. Crie em Associações → Configurações → Padrão.</div>
            )}
          </Cartao>
        )}

        {!ehPadrao && (
          <Cartao titulo="Variações" extra={<span style={{ fontSize: 11.5, color: C.mute }}>Ex.: nível da empresa Baixo, Médio, Alto, Crítico</span>}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {rascunho.variacoes.map(v => (
                <span key={v.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 10px', borderRadius: 20,
                  background: corNivel(v.nome) + '14', border: `1px solid ${corNivel(v.nome)}55`,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: corNivel(v.nome) }} />
                  <input
                    value={v.nome}
                    onChange={e => muda(p => { p.variacoes = p.variacoes.map(x => x.id === v.id ? { ...x, nome: e.target.value } : x); return p })}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 650, color: C.text, width: Math.max(50, v.nome.length * 8 + 10) }}
                  />
                  <button onClick={() => removerVariacao(v.id)} title="Remover" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.faint, fontSize: 12 }}>✕</button>
                </span>
              ))}
              <Btn small tipo="ghost" onClick={() => addVariacao(`Variação ${rascunho.variacoes.length + 1}`)}>＋ Variação</Btn>
              {rascunho.variacoes.length === 0 && (
                <Btn small onClick={() => muda(p => {
                  for (const n of PRESET_NIVEIS) {
                    const v = { id: novoId(), nome: n }
                    p.variacoes.push(v)
                    for (const d of p.documentos) d.exige[v.id] = d.exige[SEM_VARIACAO] ?? true
                  }
                  return p
                })}>Usar níveis Baixo · Médio · Alto · Crítico</Btn>
              )}
            </div>
            {rascunho.variacoes.length === 0 && (
              <div style={{ fontSize: 12, color: C.mute, marginTop: 8 }}>Sem variações: as regras valem igual para qualquer empresa desta contratante.</div>
            )}
          </Cartao>
        )}

        <Cartao
          titulo="Documentos"
          pad={0}
          extra={
            <Segmentado
              valor={escopo} onChange={setEscopo}
              opcoes={[
                { v: 'empresa', label: `🏢 Empresa · ${rascunho.documentos.filter(d => d.escopo === 'empresa').length}` },
                { v: 'pessoa', label: `👤 Pessoas · ${rascunho.documentos.filter(d => d.escopo === 'pessoa').length}` },
              ]}
            />
          }
        >
          {fontes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px', background: '#FBFCFE', borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: C.mute, fontWeight: 600 }}>Importar de uma tabela da ficha:</span>
              <select value={fonteImport} onChange={e => setFonteImport(e.target.value)} style={{ ...inputSt, width: 'auto', minWidth: 240, padding: '6px 8px' }}>
                <option value="">Escolha a tabela…</option>
                {fontes.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <Btn small disabled={!fonteImport} onClick={importar}>Importar para {escopo === 'empresa' ? 'Empresa' : 'Pessoas'}</Btn>
              <span style={{ fontSize: 11, color: C.faint }}>Colunas além de Cód/Descrição viram variações; “X” = exige, vazio = tira.</span>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F7F9FC' }}>
                  <th style={th(80)}>Cód.</th>
                  <th style={th()}>Descrição</th>
                  {!ehPadrao && colunas.map(c => (
                    <th key={c.id} style={{ ...th(110), textAlign: 'center' }}>
                      <div style={{ color: rascunho.variacoes.length ? corNivel(c.nome) : '#4A5568' }}>{c.nome}</div>
                      {docsEscopo.length > 1 && (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 3, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>
                          <button onClick={() => marcarColuna(c.id, true)} style={miniBtn} title="Marcar todos como exige">todos ✓</button>
                          <button onClick={() => marcarColuna(c.id, false)} style={miniBtn} title="Marcar todos como tira">todos ✕</button>
                        </div>
                      )}
                    </th>
                  ))}
                  <th style={th(36)} />
                </tr>
              </thead>
              <tbody>
                {docsEscopo.length === 0 && herdados.length === 0 && (
                  <tr><td colSpan={colunas.length + 3} style={{ padding: 18, textAlign: 'center', color: C.faint }}>
                    Nenhum documento de {escopo === 'empresa' ? 'empresa' : 'pessoas'}. Adicione abaixo{fontes.length ? ' ou importe de uma tabela' : ''}.
                  </td></tr>
                )}
                {docsEscopo.map((d, i) => (
                  <tr key={d.id} style={{ background: i % 2 ? '#FBFCFE' : '#fff' }}>
                    <td style={td}><input value={d.codigo} onChange={e => editDoc(d.id, { codigo: e.target.value })} style={celInput} placeholder="—" /></td>
                    <td style={td}><input value={d.descricao} onChange={e => editDoc(d.id, { descricao: e.target.value })} style={celInput} /></td>
                    {!ehPadrao && colunas.map(c => {
                      const vid = c.id === SEM_VARIACAO ? null : c.id
                      const ex = exigeNa(d, vid)
                      const nota = notaNa(d, vid)
                      const est = ex === true
                        ? { txt: '✓ Exige', bg: C.okBg, fg: C.ok, ln: C.okLine, dica: 'Exige — clique para marcar que a contratante tira' }
                        : ex === false
                          ? { txt: '✕ Tira', bg: C.badBg, fg: C.bad, ln: C.badLine, dica: 'Tira — clique para marcar “não se aplica”' }
                          : { txt: '— N/A', bg: '#F7F9FC', fg: C.faint, ln: C.line, dica: 'Não se aplica nesta variação (vale o Padrão, se houver) — clique para marcar que exige' }
                      return (
                        <td key={c.id} style={{ ...td, textAlign: 'center' }}>
                          <button onClick={() => toggleExige(d.id, c.id)} title={est.dica} style={{
                            minWidth: 74, padding: '4px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                            background: est.bg, color: est.fg, border: `1px solid ${est.ln}`, transition: 'all .12s',
                          }}>{est.txt}</button>
                          {nota && <div title={nota} style={{ fontSize: 10.5, color: '#8A6420', marginTop: 2, maxWidth: 110, marginInline: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nota}</div>}
                        </td>
                      )
                    })}
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => muda(p => { p.documentos = p.documentos.filter(x => x.id !== d.id); return p })} title="Remover" style={{ border: 'none', background: 'none', color: '#FC8181', cursor: 'pointer' }}>✕</button>
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#F7FAFF' }}>
                  <td style={td}><input value={novoCod} onChange={e => setNovoCod(e.target.value)} placeholder="Cód." style={{ ...celInput, background: '#fff', border: `1px solid ${C.line}` }} /></td>
                  <td style={td} colSpan={ehPadrao ? 1 : colunas.length + 1}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={novoDesc} onChange={e => setNovoDesc(e.target.value)} placeholder={`Novo documento de ${escopo === 'empresa' ? 'empresa' : 'pessoas'}…`}
                        onKeyDown={e => { if (e.key === 'Enter') { addDoc(novoCod, novoDesc); setNovoCod(''); setNovoDesc('') } }}
                        style={{ ...celInput, background: '#fff', border: `1px solid ${C.line}` }}
                      />
                      <Btn small tipo="pri" onClick={() => { addDoc(novoCod, novoDesc); setNovoCod(''); setNovoDesc('') }}>Adicionar</Btn>
                    </div>
                  </td>
                  <td style={td} />
                </tr>
              </tbody>
            </table>
          </div>

          {herdados.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.line}` }}>
              <button onClick={() => setVerHerdados(v => !v)} style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: '#FFFCF5', cursor: 'pointer', fontSize: 12.5, color: '#8A6420', fontWeight: 650 }}>
                {verHerdados ? '▾' : '▸'} {herdados.length} documento{herdados.length !== 1 ? 's' : ''} herdado{herdados.length !== 1 ? 's' : ''} do Padrão (exigidos) — personalize para marcar que esta contratante tira
              </button>
              {verHerdados && (
                <div style={{ padding: '4px 16px 12px', background: '#FFFCF5' }}>
                  {herdados.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px dashed #F6E0B5', fontSize: 13 }}>
                      <span style={{ width: 60, color: C.mute, fontFamily: 'monospace' }}>{d.codigo || '—'}</span>
                      <span style={{ flex: 1, color: C.text }}>{d.descricao}</span>
                      <Btn small onClick={() => addDoc(d.codigo, d.descricao, false)} title="Copia para esta contratante marcado como “tira” em todas as variações">Personalizar (tira)</Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Cartao>

        {ehPadrao && onVincularPadrao && (
          <Cartao
            titulo={`Contratantes padrão · ${ordenadas.filter(c => vinculos[c.id]).length} de ${ordenadas.length}`}
            extra={<span style={{ fontSize: 11.5, color: C.mute }}>Marcadas exigem os documentos acima; depois clique em Salvar</span>}
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="search" value={buscaVinc} onChange={e => setBuscaVinc(e.target.value)} placeholder="Filtrar…" style={{ ...inputSt, maxWidth: 240 }} />
              <Btn small onClick={() => marcar(ordenadas.map(c => c.id), true)}>Marcar todas</Btn>
              <Btn small onClick={() => marcar(ordenadas.map(c => c.id), false)}>Desmarcar todas</Btn>
              {vincMudados.length > 0 && <span style={{ fontSize: 12, color: '#B7791F', fontWeight: 650 }}>● {vincMudados.length} alteração{vincMudados.length !== 1 ? 'ões' : ''} a salvar</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 6 }}>
              {ordenadas.filter(c => c.name.toLowerCase().includes(buscaVinc.trim().toLowerCase())).map(c => {
                const on = !!vinculos[c.id]
                const mudou = on !== seguePadrao(c.id)
                const temDif = (perfis[c.id]?.documentos.length ?? 0) > 0
                return (
                  <label key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5,
                    background: on ? C.okBg : '#fff', border: `1px solid ${mudou ? '#F6AD55' : on ? C.okLine : C.line}`,
                  }}>
                    <input type="checkbox" checked={on} onChange={e => marcar([c.id], e.target.checked)} style={{ accentColor: C.ok, width: 15, height: 15 }} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 650, color: on ? C.text : C.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    {temDif && <span title="Tem configuração própria (diferenças sobre o Padrão)" style={{ fontSize: 10, color: C.primary, fontWeight: 700 }}>+ próprias</span>}
                  </label>
                )
              })}
            </div>
          </Cartao>
        )}
      </div>

      <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.line}`, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12.5, color: pendente ? '#B7791F' : salvoOk ? C.ok : C.faint, fontWeight: 600 }}>
          {pendente ? '● Alterações não salvas' : salvoOk ? '✓ Configuração salva' : existe ? 'Sem alterações' : ehPadrao ? 'Padrão ainda não salvo' : 'Usando o comportamento padrão'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {!embutido && <Btn onClick={fechar}>Fechar</Btn>}
          <Btn tipo="pri" disabled={!pendente || salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar configuração'}</Btn>
        </div>
      </div>
    </div>
  )
}

const th = (w?: number): React.CSSProperties => ({
  padding: '8px 10px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
  color: '#4A5568', borderBottom: `1px solid ${C.line}`, width: w, whiteSpace: 'nowrap',
})
const td: React.CSSProperties = { padding: '4px 8px', borderBottom: `1px solid #EDF2F7`, verticalAlign: 'middle' }
const celInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', fontSize: 13, outline: 'none', color: C.text }
const miniBtn: React.CSSProperties = { fontSize: 10, padding: '1px 5px', borderRadius: 5, border: `1px solid ${C.line}`, background: '#fff', color: C.mute, cursor: 'pointer' }

function Interruptor({ ligado, onChange }: { ligado: boolean; onChange: (v: boolean) => void }) {
  return (
    <span onClick={e => { e.preventDefault(); onChange(!ligado) }} style={{
      width: 40, height: 22, borderRadius: 22, background: ligado ? C.primary : '#CBD5E0', position: 'relative', flexShrink: 0,
      transition: 'background .2s', cursor: 'pointer',
    }}>
      <span style={{ position: 'absolute', top: 3, left: ligado ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </span>
  )
}

// ── Tela de associação (só fecha em "Finalizar") ────────────────────────────
// As marcações de "feito" são só um guia enquanto a tela está aberta — nada é gravado.

function Wizard({
  inicial, companies, perfis, nome, onFinalizar,
}: {
  inicial: Associacao
  companies: Company[]
  perfis: Record<string, PerfilAssoc>
  nome: (id: string) => string
  onFinalizar: () => void
}) {
  const [a, setA] = useState<Associacao>(inicial)
  const [filtroEscopo, setFiltroEscopo] = useState<'todos' | Escopo>('todos')
  const [ocultarFeitos, setOcultarFeitos] = useState(false)

  const faltaVariacao = [...a.origem, ...a.destino].filter(s => precisaVariacao(perfis[s.contratanteId]) && !s.variacaoId)
  const pronto = a.destino.length > 0 && faltaVariacao.length === 0
  const plano = useMemo(() => pronto ? calcularPlano(perfis, a.origem, a.destino, nome) : null, [pronto, perfis, a.origem, a.destino, nome])
  const passos = useMemo(() => plano?.passos ?? [], [plano])
  const feitosValidos = useMemo(() => a.feitos.filter(k => passos.some(p => p.key === k)), [a.feitos, passos])
  const total = passos.length

  function finalizar() {
    const pend = total - feitosValidos.length
    // Só pergunta se a pessoa começou a marcar e parou no meio — as marcações não ficam guardadas.
    if (feitosValidos.length > 0 && pend > 0
      && !confirm(`Ainda há ${pend} etapa${pend !== 1 ? 's' : ''} sem marcar. Fechar mesmo assim? (as marcações não ficam salvas)`)) return
    onFinalizar()
  }

  const marcar = (key: string) => setA(x => ({ ...x, feitos: x.feitos.includes(key) ? x.feitos.filter(k => k !== key) : [...x.feitos, key] }))
  const marcarFase = (keys: string[], valor: boolean) => setA(x => ({ ...x, feitos: valor ? [...new Set([...x.feitos, ...keys])] : x.feitos.filter(k => !keys.includes(k)) }))

  const pct = total ? Math.round((feitosValidos.length / total) * 100) : pronto ? 100 : 0
  const vis = passos.filter(p => (filtroEscopo === 'todos' || p.escopo === filtroEscopo) && (!ocultarFeitos || !a.feitos.includes(p.key)))
  const usados = new Set([...a.origem, ...a.destino].map(s => s.contratanteId))

  return (
    <div className="gt3-overlay-fade" style={{ position: 'fixed', inset: 0, zIndex: 9995, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', padding: 16 }}>
      <div className="gt3-drop-in" style={{ flex: 1, background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(15,23,42,0.4)' }}>
        <Cabecalho
          titulo={<>🔗 Associação</>}
          sub="Escolha as contratantes, siga as etapas no GTSoft e vá marcando o que já fez. Nada fica salvo ao finalizar."
        />
        <AvisoModoLocal />

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Seleção */}
          <div style={{ width: 400, flexShrink: 0, borderRight: `1px solid ${C.line}`, overflowY: 'auto', background: C.soft, padding: 18 }}>
            <ListaSelecao
              titulo="Já presta serviço para"
              ajuda="Contratantes em que a empresa já está cadastrada. Deixe vazio se for uma empresa nova."
              itens={a.origem}
              onChange={origem => setA(x => ({ ...x, origem }))}
              companies={companies} perfis={perfis} nome={nome} usados={usados}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 14px', color: C.primary, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em' }}>
              <div style={{ flex: 1, height: 1, background: '#BFD0FF' }} /> ↓ ASSOCIANDO A <div style={{ flex: 1, height: 1, background: '#BFD0FF' }} />
            </div>
            <ListaSelecao
              titulo="Associar a"
              ajuda="Uma ou várias contratantes. “Padrão” representa qualquer contratante padrão."
              itens={a.destino}
              onChange={destino => setA(x => ({ ...x, destino }))}
              companies={companies} perfis={perfis} nome={nome} usados={usados} destaque
            />
            <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.6, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
              <b style={{ color: C.text }}>Como o sistema decide</b><br />
              • Só uma contratante e ela tira o doc → <b style={{ color: C.bad }}>isentar</b>.<br />
              • Mais de uma → nunca isenta: <b style={{ color: '#2B6CB0' }}>ignorar no GT0120</b> para quem tira.<br />
              • Estava isento e agora precisa aparecer → <b style={{ color: '#B7791F' }}>desisentar primeiro</b>.
            </div>
          </div>

          {/* Plano */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 22 }}>
            {!pronto ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: C.faint, maxWidth: 420 }}>
                  <div style={{ fontSize: 44, opacity: 0.4 }}>🧭</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.mute, marginTop: 6 }}>
                    {a.destino.length === 0 ? 'Indique a quais contratantes a empresa será associada' : 'Escolha a variação de cada contratante'}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    {faltaVariacao.length > 0
                      ? `Falta o nível de: ${faltaVariacao.map(s => nome(s.contratanteId)).join(', ')}.`
                      : 'O plano do que muda no GTSoft aparece aqui na hora.'}
                  </div>
                </div>
              </div>
            ) : plano && (
              <>
                {/* O que muda para qual */}
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4A5568', marginBottom: 10 }}>O que muda para cada contratante</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10, marginBottom: 18 }}>
                  {plano.resumo.map(r => {
                    const v = nomeVariacao(perfis[r.contratanteId], r.variacaoId)
                    const nova = a.destino.some(s => s.contratanteId === r.contratanteId)
                    return (
                      <div key={r.contratanteId} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, background: nova ? '#F7FAFF' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 750, color: C.ink }}>{nome(r.contratanteId)}</span>
                          {v && <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 10, background: corNivel(v), color: '#fff', fontWeight: 700 }}>{v}</span>}
                          {nova && <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 10, background: '#EEF2FF', color: C.primary, fontWeight: 700 }}>nova</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.mute, marginTop: 6, lineHeight: 1.6 }}>
                          {r.ignorados > 0 && <div><b style={{ color: '#2B6CB0' }}>{r.ignorados}</b> doc{r.ignorados !== 1 ? 's' : ''} ignorado{r.ignorados !== 1 ? 's' : ''} (não contabiliza)</div>}
                          {r.exigeNovos > 0 && <div><b style={{ color: C.ok }}>{r.exigeNovos}</b> doc{r.exigeNovos !== 1 ? 's' : ''} que passa{r.exigeNovos !== 1 ? 'm' : ''} a exigir</div>}
                          {r.passaEnxergar > 0 && r.ignorados === 0 && <div><b style={{ color: '#B7791F' }}>{r.passaEnxergar}</b> doc{r.passaEnxergar !== 1 ? 's' : ''} volta{r.passaEnxergar !== 1 ? 'm' : ''} a aparecer (desisentados)</div>}
                          {r.ignorados === 0 && r.exigeNovos === 0 && r.passaEnxergar === 0 && <div>Sem mudança direta</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <Stat n={plano.obrigatorios} label="obrigatórios para todos" cor={C.ok} />
                  <Stat n={plano.ignorados} label="ignorados para alguém" cor="#2B6CB0" />
                  <Stat n={plano.isentos} label="isentos" cor={C.bad} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4A5568' }}>Etapas no GTSoft, nesta ordem</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Segmentado valor={filtroEscopo} onChange={setFiltroEscopo}
                      opcoes={[{ v: 'todos', label: 'Todos' }, { v: 'empresa', label: '🏢 Empresa' }, { v: 'pessoa', label: '👤 Pessoas' }]} />
                    <label style={{ fontSize: 12.5, color: C.mute, display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={ocultarFeitos} onChange={e => setOcultarFeitos(e.target.checked)} /> Ocultar feitos
                    </label>
                  </div>
                </div>

                {total === 0 ? (
                  <div style={{ background: C.okBg, border: `1px solid ${C.okLine}`, borderRadius: 12, padding: 18, color: C.ok, fontWeight: 650, fontSize: 13.5 }}>
                    ✓ Nada a alterar no GTSoft: todas as contratantes exigem os mesmos documentos{plano.isentos ? ' e os isentos continuam isentos' : ''}.
                  </div>
                ) : FASES.map(f => {
                  const todosDaFase = passos.filter(p => p.tipo === f.tipo)
                  const daFase = vis.filter(p => p.tipo === f.tipo)
                  if (todosDaFase.length === 0) return null
                  const feitosFase = todosDaFase.filter(p => a.feitos.includes(p.key)).length
                  const completa = feitosFase === todosDaFase.length
                  return (
                    <div key={f.tipo} style={{ ...bordas('1px 1px 1px 4px', C.line, { left: f.cor }), borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{ background: f.bg, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 24, height: 24, borderRadius: '50%', background: completa ? C.ok : f.cor, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {completa ? '✓' : FASES.filter(x => passos.some(p => p.tipo === x.tipo)).findIndex(x => x.tipo === f.tipo) + 1}
                          </span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: f.cor }}>{f.titulo} <span style={{ fontWeight: 600, color: C.mute, fontSize: 12 }}>· {feitosFase}/{todosDaFase.length}</span></div>
                            <div style={{ fontSize: 12, color: C.mute }}>{f.dica}</div>
                          </div>
                        </div>
                        <Btn small tipo="ghost" onClick={() => marcarFase(todosDaFase.map(p => p.key), !completa)}>{completa ? 'Desmarcar todos' : 'Marcar todos'}</Btn>
                      </div>
                      {daFase.map(p => <LinhaPasso key={p.key} p={p} feito={a.feitos.includes(p.key)} nome={nome} onToggle={() => marcar(p.key)} />)}
                      {daFase.length === 0 && <div style={{ padding: '8px 14px', fontSize: 12, color: C.faint }}>Tudo feito nesta etapa.</div>}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${C.line}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 240, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.mute, marginBottom: 5, fontWeight: 600 }}>
              <span>{pronto ? (total ? `${feitosValidos.length} de ${total} etapas` : 'Sem etapas') : 'Aguardando seleção'}</span><span>{pct}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 7, background: '#EDF2F7', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? C.ok : `linear-gradient(90deg, ${C.primary}, #4C7BD9)`, transition: 'width .3s' }} />
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <Btn tipo="pri" onClick={finalizar}>
            {pronto && total > 0 && feitosValidos.length === total ? '✓ Finalizar' : 'Finalizar'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

function Stat({ n, label, cor }: { n: number; label: string; cor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '8px 14px', borderRadius: 12, background: cor + '0F', border: `1px solid ${cor}33` }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: cor }}>{n}</span>
      <span style={{ fontSize: 12, color: C.mute }}>{label}</span>
    </div>
  )
}

function LinhaPasso({ p, feito, nome, onToggle }: { p: Passo; feito: boolean; nome: (id: string) => string; onToggle: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderTop: `1px solid #EDF2F7`, cursor: 'pointer',
      background: feito ? '#FAFFFB' : hov ? '#F7FAFF' : '#fff', transition: 'background .12s',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${feito ? C.ok : '#CBD5E0'}`, background: feito ? C.ok : '#fff', color: '#fff', fontSize: 12, fontWeight: 900,
        transition: 'all .15s',
      }}>{feito ? '✓' : ''}</span>
      <span style={{ width: 52, fontFamily: 'monospace', fontSize: 12.5, color: C.mute, flexShrink: 0 }}>{p.codigo || '—'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: feito ? C.faint : C.text, textDecoration: feito ? 'line-through' : 'none' }}>
          {p.descricao}
          <span style={{ marginLeft: 8, fontSize: 10.5, padding: '1px 6px', borderRadius: 8, background: '#EDF2F7', color: C.mute, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
            {p.escopo === 'empresa' ? 'Empresa' : 'Pessoas'}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 1 }}>{p.motivo}</div>
        {p.notas && <div style={{ fontSize: 11.5, color: '#8A6420', marginTop: 1 }}>📝 {p.notas}</div>}
      </div>
      {p.contratanteId && (
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#EBF8FF', color: '#2B6CB0', border: '1px solid #BEE3F8', flexShrink: 0 }}>
          {p.tipo === 'remover_ignorado' ? 'deixar de ignorar para ' : 'ignorar para '}{nome(p.contratanteId)}
        </span>
      )}
    </div>
  )
}

// ── Lista de contratantes selecionadas + seletor ────────────────────────────

function ListaSelecao({
  titulo, ajuda, itens, onChange, companies, perfis, nome, usados, destaque,
}: {
  titulo: string
  ajuda: string
  itens: Selecao[]
  onChange: (s: Selecao[]) => void
  companies: Company[]
  perfis: Record<string, PerfilAssoc>
  nome: (id: string) => string
  usados: Set<string>
  destaque?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <div style={{
      background: '#fff', border: `1px solid ${destaque ? '#BFD0FF' : C.line}`, borderRadius: 14, padding: 14, marginBottom: 14,
      boxShadow: destaque ? '0 2px 10px rgba(42,79,150,0.08)' : 'none',
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: destaque ? C.primary : C.ink }}>{titulo}</div>
      <div style={{ fontSize: 11.5, color: C.mute, margin: '2px 0 10px' }}>{ajuda}</div>
      {itens.map(s => {
        const perfil = perfis[s.contratanteId]
        const comp = companies.find(c => c.id === s.contratanteId)
        const padrao = s.contratanteId === PADRAO_ID
        const segue = padrao || !perfil || (perfil.documentos.length === 0)
        const precisa = precisaVariacao(perfil)
        const falta = precisa && !s.variacaoId
        return (
          <div key={s.contratanteId} className="gt3-fade-up" style={{
            border: `1px solid ${falta ? '#F6AD55' : C.line}`, borderRadius: 11, padding: '9px 10px', marginBottom: 8,
            background: falta ? '#FFFAF0' : padrao ? '#FFFCF5' : C.soft,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: padrao ? C.accent : SEGMENT_COLORS[comp?.segment ?? ''] ?? '#8C6EDC' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {padrao ? '◎ Padrão (cliente padrão)' : nome(s.contratanteId)}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: segue ? '#FFFAF0' : '#EEF2FF', color: segue ? '#8A6420' : C.primary }}>
                {segue ? 'Padrão' : 'Configurada'}
              </span>
              <button onClick={() => onChange(itens.filter(x => x.contratanteId !== s.contratanteId))} title="Remover" style={{ border: 'none', background: 'none', color: C.faint, cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
            {precisa && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: falta ? '#C05621' : C.mute, fontWeight: 650, marginBottom: 5 }}>
                  {falta ? 'Qual a variação (nível) da empresa nesta contratante?' : 'Variação'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {perfil!.variacoes.map(v => {
                    const on = s.variacaoId === v.id
                    const cor = corNivel(v.nome)
                    return (
                      <button key={v.id} onClick={() => onChange(itens.map(x => x.contratanteId === s.contratanteId ? { ...x, variacaoId: v.id } : x))} style={{
                        padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: on ? cor : '#fff', color: on ? '#fff' : cor, border: `1.5px solid ${on ? cor : cor + '66'}`,
                        boxShadow: on ? `0 2px 8px ${cor}55` : 'none', transition: 'all .15s',
                      }}>{v.nome}</button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setAberto(v => !v)} style={{
          width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px dashed ${destaque ? C.primary : '#CBD5E0'}`,
          background: 'transparent', color: C.primary, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        }}>＋ Adicionar contratante{itens.length ? '' : 's'}</button>
        {aberto && (
          <Seletor
            companies={companies} perfis={perfis} usados={usados}
            onConfirmar={ids => { onChange([...itens, ...ids.map(id => ({ contratanteId: id, variacaoId: null }))]); setAberto(false) }}
            onFechar={() => setAberto(false)}
          />
        )}
      </div>
    </div>
  )
}

function Seletor({ companies, perfis, usados, onConfirmar, onFechar }: {
  companies: Company[]; perfis: Record<string, PerfilAssoc>; usados: Set<string>
  onConfirmar: (ids: string[]) => void; onFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])
  const opcoes = [
    { id: PADRAO_ID, nome: '◎ Padrão (qualquer cliente padrão)', segment: '' },
    ...[...companies].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(c => ({ id: c.id, nome: c.name, segment: c.segment })),
  ].filter(o => !usados.has(o.id) && o.nome.toLowerCase().includes(busca.trim().toLowerCase()))
  const toggle = (id: string) => setMarcados(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id])
  return (
    <div className="gt3-pop-in" style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20, background: '#fff', borderRadius: 12,
      border: `1px solid ${C.line}`, boxShadow: '0 12px 32px rgba(15,23,42,0.18)', overflow: 'hidden',
    }}>
      <div style={{ padding: 10 }}>
        <input autoFocus type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" style={inputSt}
          onKeyDown={e => { if (e.key === 'Escape') onFechar() }} />
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', padding: '0 6px 6px' }}>
        {opcoes.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: C.faint, textAlign: 'center' }}>Nada encontrado.</div>}
        {opcoes.map(o => {
          const on = marcados.includes(o.id)
          const p = perfis[o.id]
          return (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', background: on ? '#EEF2FF' : 'transparent', fontSize: 13 }}>
              <input type="checkbox" checked={on} onChange={() => toggle(o.id)} />
              <span style={{ flex: 1, color: C.text, fontWeight: o.id === PADRAO_ID ? 700 : 500 }}>{o.nome}</span>
              {p && p.variacoes.length > 0 && <span style={{ fontSize: 10.5, color: C.mute }}>{p.variacoes.length} níveis</span>}
            </label>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: 10, borderTop: `1px solid ${C.line}` }}>
        <Btn small onClick={onFechar}>Cancelar</Btn>
        <Btn small tipo="pri" disabled={marcados.length === 0} onClick={() => onConfirmar(marcados)}>Adicionar {marcados.length || ''}</Btn>
      </div>
    </div>
  )
}
