'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '../components/UserContext'

// ─── Types ─────────────────────────────────────────────────────────────────────

type DocKey = 'pgr_pcmso' | 'pgr' | 'pcmso' | 'ltcat' | 'pgr_ltcat' | 'todos'
type ResultadoKey = 'aprovado' | '60dias'
type PeriodKey = 'anual' | 'bienal' | 'na'
type TreinKey = 'sim' | 'nao'

type ContratanteConfig = {
  id: string
  name: string
  has60Dias: boolean
  portal: string
}

type Texts = {
  trein_aprovado: string
  trein_restricao: string
  consideracoes: string
  assinatura: string
  frente_intro: string
  frente_inventario: string
  fechamento_aprovado: string
  fechamento_restricao: string
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONTRATANTES: ContratanteConfig[] = [
  { id: 'mar-ana',   name: 'Marcopolo Ana Rech',                                        has60Dias: true,  portal: 'Marcopolo' },
  { id: 'mar-sc',    name: 'Marcopolo São Cristóvão',                                   has60Dias: true,  portal: 'Marcopolo' },
  { id: 'volare',    name: 'Volare',                                                     has60Dias: true,  portal: 'Marcopolo e Volare' },
  { id: 'mar-ambos', name: 'Marcopolo Ana Rech e Marcopolo São Cristóvão',              has60Dias: true,  portal: 'Marcopolo' },
  { id: 'todos',     name: 'Marcopolo Ana Rech, Marcopolo São Cristóvão e Volare',      has60Dias: true,  portal: 'Marcopolo e Volare' },
]

const DEFAULT_TEXTS: Texts = {
  trein_aprovado: `Caso tenha previsão de realizar trabalho em altura (NR 35), operação de PEMT (NR 18), atividades com elétrica (NR 10), operação/manutenção de equipamentos com partes móveis (NR 12) ou atividades em espaço confinado (NR 33), ou outros aplicáveis, por favor nos indicar, a fim de regularizar os requisitos de treinamentos específicos e auxiliar na liberação operacional da atividade no cliente.`,
  trein_restricao: `• Comunicar (se aplicável) os treinamentos necessários para cada funcionário conforme a atividade prevista, ou seja, qual(is) funcionário(s) irá(ão) realizar atividades em altura (NR 35), eletricidade (NR 10), operação de máquinas e equipamentos com partes móveis (NR 12), operação de PEMT (NR 18), espaço confinado (NR 33), manuseio de inflamáveis (NR 20), ou outros aplicáveis.`,
  consideracoes: `Considerações:\n\n• O aditivo ao PGR deve estar assinado e com identificação/registro do elaborador do PGR de referência;\n\n• Ao cadastrar pessoas no Portal, a função indicada no sistema deve ser a mais próxima ao ASO e ficha registro (estes dois precisam conter a mesma função). Havendo dúvida neste ou outro processo no Portal, a pasta à sua esquerda irá lhe auxiliar;`,
  assinatura: `Quanto à assinatura: não é necessário escanear todo o documento. Você pode pegar apenas a página indicada, coletar a assinatura e anexar junto ao documento novamente. Ou, se preferir, pode assinar digitalmente.`,
  frente_intro: `Na indicação da frente de trabalho devem estar descritos os riscos que os funcionários da empresa estão expostos ao realizar as atividades dentro da contratante, a atividade, dados da contratante, os ambientes/setores onde habitualmente as atividades da sua empresa ocorrerão e as medidas preventivas para esses riscos.`,
  frente_inventario: `Para facilitar a verificação dos riscos, o Grupo Marcopolo disponibilizou o Inventário de Riscos para os terceiros (em anexo), que você encontra dentro do Portal no caminho: Pasta Contratantes > Download Documentos > {portal} > Inventário de Riscos-PGR.\n\nAlém do inventário, também em anexo, você encontrará uma sugestão de modelo, onde pode preencher as informações e anexar junto ao seu PGR, bem como o(s) CNPJ de sua(s) contratante(s), para facilitar o preenchimento dos dados no campo "Dados da contratante".`,
  fechamento_aprovado: `Se necessário atualizá-los antes do prazo do portal, por favor nos contate.`,
  fechamento_restricao: `Dúvidas, estamos à disposição.`,
}

const TEXT_LABELS: Record<keyof Texts, string> = {
  trein_aprovado:       'Bloco de treinamentos NR — Aprovação',
  trein_restricao:      'Bloco de treinamentos NR — Restrição 60 dias',
  consideracoes:        'Considerações — Restrição 60 dias',
  assinatura:           'Texto sobre assinatura do documento',
  frente_intro:         'Introdução da frente de trabalho',
  frente_inventario:    'Inventário de riscos — caminho do portal',
  fechamento_aprovado:  'Fechamento — Aprovação',
  fechamento_restricao: 'Fechamento — Restrição 60 dias',
}

const DOC_OPTIONS: { val: DocKey; label: string }[] = [
  { val: 'pgr_pcmso', label: 'PGR + PCMSO' },
  { val: 'pgr',       label: 'PGR' },
  { val: 'pcmso',     label: 'PCMSO' },
  { val: 'ltcat',     label: 'LTCAT' },
  { val: 'pgr_ltcat', label: 'PGR + LTCAT' },
  { val: 'todos',     label: 'PGR + PCMSO + LTCAT' },
]

const DOC_LABEL:   Record<DocKey, string> = { pgr_pcmso: 'PGR e PCMSO', pgr: 'PGR', pcmso: 'PCMSO', ltcat: 'LTCAT', pgr_ltcat: 'PGR e LTCAT', todos: 'PGR, PCMSO e LTCAT' }
const DOC_PLURAL:  Record<DocKey, string> = { pgr_pcmso: 'os programas', pgr: 'o programa', pcmso: 'o programa', ltcat: 'o programa', pgr_ltcat: 'os programas', todos: 'os programas' }
const DOC_AMBOS:   Record<DocKey, string> = { pgr_pcmso: 'ambos aprovados', pgr: 'aprovado', pcmso: 'aprovado', ltcat: 'aprovado', pgr_ltcat: 'ambos aprovados', todos: 'todos aprovados' }

function hasPcmso(d: DocKey) { return ['pgr_pcmso', 'pcmso', 'todos'].includes(d) }
function hasPgr(d: DocKey)   { return ['pgr_pcmso', 'pgr', 'pgr_ltcat', 'todos'].includes(d) }
function hasLtcat(d: DocKey) { return ['ltcat', 'pgr_ltcat', 'todos'].includes(d) }

// ─── Theme ─────────────────────────────────────────────────────────────────────

const S = {
  primary: '#2A4F96', primaryDark: '#1f3d75', primaryLight: '#eaf0fa',
  accent: '#D1AE6E',
  surface: '#ffffff', bg: '#F4F6FA',
  border: '#e2e6ee', borderStrong: '#cbd2dd',
  text: '#1f2937', textMuted: '#6b7280',
  ok: '#16a34a', okBg: '#dcfce7',
  warn: '#d97706', warnBg: '#fef3c7',
  danger: '#dc2626', dangerBg: '#fee2e2',
  radius: '10px', radiusSm: '6px',
}

const STORAGE_KEY_CT   = 'pgr-pcmso-contratantes'
const STORAGE_KEY_TX   = 'pgr-pcmso-texts'

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PgrPcmsoClient() {
  const { profile } = useUser()
  const papel = profile?.papel ?? 'colaborador'
  const canConfig = papel === 'admin' || papel === 'gestor'

  // form state
  const [empresa, setEmpresa] = useState('')
  const [contratanteId, setContratanteId] = useState('mar-ana')
  const [docs, setDocs] = useState<DocKey>('pgr_pcmso')
  const [resultado, setResultado] = useState<ResultadoKey>('aprovado')
  const [periodicidade, setPeriodicidade] = useState<PeriodKey>('anual')
  const [treinamentos, setTreinamentos] = useState<TreinKey>('sim')
  const [restricoes, setRestricoes] = useState<Set<string>>(new Set())
  const [saudacao, setSaudacao] = useState('Bom dia!')

  // persisted config
  const [contratantes, setContratantes] = useState<ContratanteConfig[]>(DEFAULT_CONTRATANTES)
  const [texts, setTexts] = useState<Texts>(DEFAULT_TEXTS)

  // config modal
  const [configOpen, setConfigOpen] = useState(false)
  const [configTab, setConfigTab] = useState<'contratantes' | 'textos'>('contratantes')
  const [openTextKey, setOpenTextKey] = useState<keyof Texts | null>(null)

  // new contratante form
  const [newCtName, setNewCtName] = useState('')
  const [newCtPortal, setNewCtPortal] = useState('Marcopolo')
  const [newCt60, setNewCt60] = useState(true)

  // copy feedback
  const [copied, setCopied] = useState<'assunto' | 'corpo' | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // load from localStorage
  useEffect(() => {
    try {
      const ct = localStorage.getItem(STORAGE_KEY_CT)
      if (ct) setContratantes(JSON.parse(ct))
      const tx = localStorage.getItem(STORAGE_KEY_TX)
      if (tx) setTexts(prev => ({ ...prev, ...JSON.parse(tx) }))
    } catch { /* noop */ }
  }, [])

  function saveContratantes(list: ContratanteConfig[]) {
    setContratantes(list)
    localStorage.setItem(STORAGE_KEY_CT, JSON.stringify(list))
  }

  function saveTexts(t: Texts) {
    setTexts(t)
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(t))
  }

  // derived
  const selectedCt = contratantes.find(c => c.id === contratanteId) ?? contratantes[0]
  const resultadoOptions: { val: ResultadoKey; label: string }[] = selectedCt?.has60Dias
    ? [{ val: 'aprovado', label: '✅ Aprovado' }, { val: '60dias', label: '⏳ Aprovado com restrição — 60 dias' }]
    : [{ val: 'aprovado', label: '✅ Aprovado' }]

  // if current result is no longer available, reset
  useEffect(() => {
    if (resultado === '60dias' && !selectedCt?.has60Dias) setResultado('aprovado')
  }, [contratanteId, selectedCt?.has60Dias, resultado])

  // ── Build email ──────────────────────────────────────────────

  const buildAssunto = useCallback(() => {
    const emp = empresa.trim() || '[Empresa]'
    return `Portal GT3 - Parecer ${DOC_LABEL[docs]} - ${emp}`
  }, [empresa, docs])

  const buildCorpo = useCallback(() => {
    const s = saudacao
    const plural = DOC_PLURAL[docs]
    const ambos  = DOC_AMBOS[docs]
    const cont   = selectedCt?.name ?? ''

    if (resultado === 'aprovado') {
      let periLine = ''
      if (hasPcmso(docs) && periodicidade !== 'na') {
        if (docs === 'pgr_pcmso') {
          periLine = ` (PGR com periodicidade bienal e PCMSO com periodicidade ${periodicidade}, podendo ambos ser bienais conforme NR 1, a critério do elaborador)`
        } else {
          periLine = ` (PCMSO com periodicidade ${periodicidade})`
        }
      }
      let body = `${s}\n\nFinalizamos a verificação ${plural} de SSO, ${ambos}${periLine}. ${texts.fechamento_aprovado}`
      if (treinamentos === 'sim') body += `\n\n${texts.trein_aprovado}`
      body += `\n\nAtenciosamente,`
      return body
    }

    if (resultado === '60dias') {
      const r = restricoes
      const sufixo = r.has('portal') ? ', bem como demais itens informados no portal' : ''
      let body = `${s}\n\nFinalizamos a verificação ${plural} de SSO enviados ao portal de terceiros, ${ambos} com restrição por 60 dias para que sejam atualizados com a indicação da frente de trabalho ${cont}${sufixo}:\n`
      if (hasPgr(docs))   body += `\nPGR:\n`
      if (hasPcmso(docs)) body += `\nPCMSO:\n`
      if (hasLtcat(docs)) body += `\nLTCAT:\n`
      body += `\n${texts.frente_intro}\n\n`
      body += texts.frente_inventario.replace('{portal}', selectedCt?.portal ?? 'Marcopolo')
      if (r.has('assinatura')) body += `\n\n${texts.assinatura}`
      body += `\n\n${texts.consideracoes}`
      if (r.has('treinamentos')) body += `\n\n${texts.trein_restricao}`
      body += `\n\n${texts.fechamento_restricao}\n\nAtenciosamente,`
      return body
    }

    return ''
  }, [resultado, docs, saudacao, selectedCt, periodicidade, treinamentos, restricoes, texts])

  function toggleRestricao(key: string) {
    setRestricoes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function copiar(tipo: 'assunto' | 'corpo') {
    const txt = tipo === 'assunto' ? buildAssunto() : buildCorpo()
    navigator.clipboard.writeText(txt).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    })
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    setCopied(tipo)
    copyTimerRef.current = setTimeout(() => setCopied(null), 2500)
  }

  // ── Config handlers ──────────────────────────────────────────

  function addContratante() {
    const name = newCtName.trim()
    if (!name) return
    const id = `custom-${Date.now()}`
    saveContratantes([...contratantes, { id, name, has60Dias: newCt60, portal: newCtPortal }])
    setNewCtName(''); setNewCtPortal('Marcopolo'); setNewCt60(true)
  }

  function removeContratante(id: string) {
    if (contratanteId === id) setContratanteId(contratantes.find(c => c.id !== id)?.id ?? '')
    saveContratantes(contratantes.filter(c => c.id !== id))
  }

  function toggle60Dias(id: string) {
    saveContratantes(contratantes.map(c => c.id === id ? { ...c, has60Dias: !c.has60Dias } : c))
  }

  function updateText(key: keyof Texts, val: string) {
    saveTexts({ ...texts, [key]: val })
  }

  function restoreText(key: keyof Texts) {
    saveTexts({ ...texts, [key]: DEFAULT_TEXTS[key] })
  }

  function restoreAllTexts() {
    saveTexts({ ...DEFAULT_TEXTS })
  }

  // ── Styles ───────────────────────────────────────────────────

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: `1px solid ${S.borderStrong}`,
    borderRadius: S.radiusSm, fontSize: 13, fontFamily: 'inherit',
    background: S.surface, outline: 'none', color: S.text,
    boxSizing: 'border-box',
  }
  const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' }
  const labelSt: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: S.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    display: 'block', marginBottom: 5,
  }
  const btnPrimary: React.CSSProperties = {
    background: S.primary, color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: S.radiusSm,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }
  const btnSecondary: React.CSSProperties = {
    background: S.surface, color: S.primary, border: `1px solid ${S.primary}`,
    padding: '8px 16px', borderRadius: S.radiusSm,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }

  const assunto = buildAssunto()
  const corpo   = buildCorpo()

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 24px', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: S.primary, margin: 0 }}>PGR / PCMSO / LTCAT</h1>
          <p style={{ fontSize: 12, color: S.textMuted, marginTop: 3 }}>
            Construtor de e-mails de parecer SSO — preencha os campos e copie o resultado.
          </p>
        </div>
        {canConfig && (
          <button
            onClick={() => setConfigOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: S.radiusSm,
              border: `1px solid ${S.borderStrong}`, background: S.surface,
              color: S.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ⚙ Configurar
          </button>
        )}
      </div>

      {/* Body: two-column */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, flex: 1, minHeight: 0 }}>

        {/* ── Coluna esquerda: formulário ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4 }}>

          {/* Empresa */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, padding: '14px 16px' }}>
            <label style={labelSt}>Empresa destinatária</label>
            <input
              type="text" value={empresa} placeholder="Nome da empresa contratada…"
              onChange={e => setEmpresa(e.target.value)}
              style={inputSt}
            />
          </div>

          {/* Contratante */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, padding: '14px 16px' }}>
            <label style={labelSt}>Contratante</label>
            <select value={contratanteId} onChange={e => setContratanteId(e.target.value)} style={selectSt}>
              {contratantes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Documentos */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, padding: '14px 16px' }}>
            <label style={labelSt}>Documentos avaliados</label>
            <select value={docs} onChange={e => setDocs(e.target.value as DocKey)} style={selectSt}>
              {DOC_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>

          {/* Resultado */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, padding: '14px 16px' }}>
            <label style={labelSt}>Resultado do parecer</label>
            <select value={resultado} onChange={e => setResultado(e.target.value as ResultadoKey)} style={selectSt}>
              {resultadoOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>

          {/* Bloco aprovado */}
          {resultado === 'aprovado' && (
            <div style={{ background: S.primaryLight, border: `1px solid #c4d0ee`, borderRadius: S.radius, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.primary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Aprovação — opções adicionais
              </span>
              {hasPcmso(docs) && (
                <div>
                  <label style={{ ...labelSt, color: S.primary }}>Periodicidade do PCMSO</label>
                  <select value={periodicidade} onChange={e => setPeriodicidade(e.target.value as PeriodKey)} style={selectSt}>
                    <option value="anual">Anual</option>
                    <option value="bienal">Bienal</option>
                    <option value="na">N/A (sem PCMSO)</option>
                  </select>
                </div>
              )}
              <div>
                <label style={{ ...labelSt, color: S.primary }}>Bloco de treinamentos NR</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['sim', 'nao'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setTreinamentos(v)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: S.radiusSm, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        background: treinamentos === v ? S.primary : S.surface,
                        color: treinamentos === v ? '#fff' : S.textMuted,
                        border: `1px solid ${treinamentos === v ? S.primary : S.border}`,
                      }}
                    >
                      {v === 'sim' ? 'Sim, incluir' : 'Não incluir'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bloco 60 dias */}
          {resultado === '60dias' && (
            <div style={{ background: S.primaryLight, border: `1px solid #c4d0ee`, borderRadius: S.radius, padding: '14px 16px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.primary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 10 }}>
                Motivos complementares da restrição
              </span>
              <p style={{ fontSize: 12, color: S.primary, marginBottom: 8 }}>Frente de trabalho sempre inclusa. Marque os adicionais:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { key: 'assinatura',   label: '+ Assinatura' },
                  { key: 'portal',       label: '+ Outros itens do portal' },
                  { key: 'treinamentos', label: '+ Treinamentos NR' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleRestricao(key)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      background: restricoes.has(key) ? S.primary : S.surface,
                      color: restricoes.has(key) ? '#fff' : S.textMuted,
                      border: `1px solid ${restricoes.has(key) ? S.primary : S.border}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Saudação */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, padding: '14px 16px' }}>
            <label style={labelSt}>Saudação</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Bom dia!', 'Boa tarde!', 'Olá!'].map(v => (
                <button
                  key={v}
                  onClick={() => setSaudacao(v)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: S.radiusSm, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    background: saudacao === v ? S.primary : S.surface,
                    color: saudacao === v ? '#fff' : S.textMuted,
                    border: `1px solid ${saudacao === v ? S.primary : S.border}`,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* ── Coluna direita: preview ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {/* Assunto */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${S.border}`, background: '#f8f9fc' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assunto</span>
              <button onClick={() => copiar('assunto')} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: `1px solid ${copied === 'assunto' ? '#a3d4b5' : S.border}`,
                borderRadius: S.radiusSm, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                background: copied === 'assunto' ? S.okBg : S.bg,
                color: copied === 'assunto' ? S.ok : S.textMuted,
                transition: 'all 0.15s',
              }}>
                {copied === 'assunto' ? '✓ Copiado!' : '⎘ Copiar'}
              </button>
            </div>
            <div style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: empresa ? S.text : S.textMuted, fontStyle: empresa ? 'normal' : 'italic', wordBreak: 'break-word' }}>
              {empresa ? assunto : 'Preencha a empresa para gerar o assunto'}
            </div>
          </div>

          {/* Corpo */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.radius, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${S.border}`, background: '#f8f9fc', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Corpo do e-mail</span>
              <button onClick={() => copiar('corpo')} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: `1px solid ${copied === 'corpo' ? '#a3d4b5' : S.border}`,
                borderRadius: S.radiusSm, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                background: copied === 'corpo' ? S.okBg : S.bg,
                color: copied === 'corpo' ? S.ok : S.textMuted,
                transition: 'all 0.15s',
              }}>
                {copied === 'corpo' ? '✓ Copiado!' : '⎘ Copiar'}
              </button>
            </div>
            <div style={{
              padding: '16px', fontSize: 13.5, lineHeight: 1.8,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              color: corpo ? S.text : S.textMuted, fontStyle: corpo ? 'normal' : 'italic',
              overflowY: 'auto', flex: 1,
            }}>
              {corpo || 'Preencha os campos ao lado para gerar o e-mail.'}
            </div>
          </div>

        </div>
      </div>

      {/* ── Modal de configuração ── */}
      {configOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setConfigOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}
        >
          <div style={{ background: S.surface, borderRadius: S.radius, width: '100%', maxWidth: 680, boxShadow: '0 20px 60px rgba(15,23,42,0.2)', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ background: `linear-gradient(135deg, ${S.primary} 0%, ${S.primaryDark} 100%)`, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Configurações</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>Gerencie contratantes e textos padrão</p>
              </div>
              <button onClick={() => setConfigOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
            </div>

            {/* Modal tabs */}
            <div style={{ display: 'flex', borderBottom: `2px solid ${S.border}` }}>
              {(['contratantes', 'textos'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setConfigTab(tab)}
                  style={{
                    padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    border: 'none', borderBottom: `2px solid ${configTab === tab ? S.primary : 'transparent'}`,
                    background: 'none', color: configTab === tab ? S.primary : S.textMuted,
                    marginBottom: -2, transition: 'all 0.15s',
                  }}
                >
                  {tab === 'contratantes' ? 'Contratantes' : 'Textos padrão'}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px 24px', maxHeight: '65vh', overflowY: 'auto' }}>

              {/* Tab: Contratantes */}
              {configTab === 'contratantes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12, color: S.textMuted, marginBottom: 4 }}>
                    Defina quais contratantes aparecem na lista e se oferecem a opção de &ldquo;60 dias&rdquo;.
                  </p>

                  {contratantes.map(ct => (
                    <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${S.border}`, borderRadius: S.radiusSm, background: S.surface }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: S.text }}>{ct.name}</div>
                        <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>Portal: {ct.portal}</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', color: ct.has60Dias ? S.warn : S.textMuted }}>
                        <input
                          type="checkbox" checked={ct.has60Dias}
                          onChange={() => toggle60Dias(ct.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        60 dias
                      </label>
                      <button
                        onClick={() => removeContratante(ct.id)}
                        title="Remover contratante"
                        style={{ background: 'none', border: `1px solid ${S.border}`, borderRadius: S.radiusSm, color: S.danger, cursor: 'pointer', padding: '4px 9px', fontSize: 13, fontFamily: 'inherit' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Add new */}
                  <div style={{ marginTop: 8, padding: '14px 16px', border: `1px dashed ${S.borderStrong}`, borderRadius: S.radiusSm, background: S.bg, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span style={{ ...labelSt, margin: 0 }}>Novo contratante</span>
                    <input
                      type="text" value={newCtName} placeholder="Nome do contratante…"
                      onChange={e => setNewCtName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addContratante() }}
                      style={{ ...inputSt }}
                    />
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ ...labelSt, margin: '0 0 4px' }}>Label do portal</label>
                        <select value={newCtPortal} onChange={e => setNewCtPortal(e.target.value)} style={{ ...selectSt, width: '100%' }}>
                          <option value="Marcopolo">Marcopolo</option>
                          <option value="Marcopolo e Volare">Marcopolo e Volare</option>
                        </select>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', paddingTop: 20 }}>
                        <input type="checkbox" checked={newCt60} onChange={e => setNewCt60(e.target.checked)} />
                        Opção 60 dias
                      </label>
                      <button onClick={addContratante} style={{ ...btnPrimary, paddingTop: 9, paddingBottom: 9, alignSelf: 'flex-end' }}>+ Adicionar</button>
                    </div>
                  </div>

                  <button
                    onClick={() => { saveContratantes(DEFAULT_CONTRATANTES); setContratanteId('mar-ana') }}
                    style={{ alignSelf: 'flex-start', fontSize: 12, color: S.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
                  >
                    Restaurar lista padrão
                  </button>
                </div>
              )}

              {/* Tab: Textos padrão */}
              {configTab === 'textos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 12, color: S.textMuted, marginBottom: 8 }}>
                    Edite os blocos de texto usados na geração do e-mail. Salvos automaticamente no navegador.
                  </p>

                  {(Object.keys(TEXT_LABELS) as (keyof Texts)[]).map(key => {
                    const isOpen = openTextKey === key
                    return (
                      <div key={key} style={{ border: `1px solid ${S.border}`, borderRadius: S.radiusSm, overflow: 'hidden' }}>
                        <button
                          onClick={() => setOpenTextKey(isOpen ? null : key)}
                          style={{
                            width: '100%', padding: '11px 14px', fontSize: 13, fontWeight: 500,
                            color: S.text, background: isOpen ? S.primaryLight : S.surface,
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            textAlign: 'left',
                          }}
                        >
                          <span>{TEXT_LABELS[key]}</span>
                          <span style={{ fontSize: 16, color: S.textMuted, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>⌄</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '12px 14px', background: S.surface, borderTop: `1px solid ${S.border}` }}>
                            <textarea
                              value={texts[key]}
                              onChange={e => updateText(key, e.target.value)}
                              rows={5}
                              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.borderStrong}`, borderRadius: S.radiusSm, fontSize: 12.5, lineHeight: 1.6, fontFamily: 'inherit', color: S.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <button
                              onClick={() => restoreText(key)}
                              style={{ marginTop: 6, fontSize: 11.5, color: S.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
                            >
                              Restaurar padrão
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <button
                    onClick={restoreAllTexts}
                    style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: 12, color: S.danger, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
                  >
                    Restaurar todos os textos para o padrão
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfigOpen(false)} style={btnPrimary}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
