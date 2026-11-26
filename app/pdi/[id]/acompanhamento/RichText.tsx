'use client'

// Texto rico do Diário: editor (negrito, itálico, sublinhado, tachado, lista, cor da
// fonte e grifo) e exibição. O HTML é sempre limpo antes de exibir: só tags de
// formatação e, de estilo, apenas color/background-color.

import { useEffect, useRef, useState } from 'react'

const FONTE = ['#1E293B', '#2A4F96', '#0F9F8F', '#1E9E6A', '#D9730D', '#D64545', '#9B5DE5', '#94A3B8']
const GRIFO = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA', '#E9D5FF', '#E2E8F0', 'transparent']

const TAGS_OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P', 'SPAN', 'FONT', 'MARK'])

/** Remove tudo que não for formatação simples. Roda só no navegador (DOMParser). */
export function limparHtml(html: string): string {
  if (typeof window === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const raiz = doc.body.firstElementChild as HTMLElement
  const limpar = (el: Element) => {
    for (const filho of [...el.children]) {
      if (!TAGS_OK.has(filho.tagName)) { filho.replaceWith(...[...filho.childNodes]); continue }
      const cor = (filho as HTMLElement).style?.color
      const fundo = (filho as HTMLElement).style?.backgroundColor
      const recuo = (filho as HTMLElement).style?.marginLeft
      const fontColor = filho.tagName === 'FONT' ? filho.getAttribute('color') : null
      for (const a of [...filho.attributes]) filho.removeAttribute(a.name)
      const st: string[] = []
      if (cor || fontColor) st.push(`color:${cor || fontColor}`)
      if (fundo) st.push(`background-color:${fundo}`)
      if (recuo && /^\d+px$/.test(recuo) && parseInt(recuo) <= 200) st.push(`margin-left:${recuo}`)
      if (st.length) filho.setAttribute('style', st.join(';'))
      limpar(filho)
    }
  }
  limpar(raiz)
  return raiz.innerHTML
}

/** Texto sem formatação (para resumos e Linha do tempo). Aceita texto antigo sem HTML. */
export function textoPlano(s: string): string {
  if (!/<[a-z][\s\S]*>/i.test(s)) return s
  return s.replace(/<(br|\/div|\/p|\/li)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim()
}

/** Exibe o texto do Diário (rico ou antigo, só texto). */
export function RichView({ html, style }: { html: string; style?: React.CSSProperties }) {
  const ehHtml = /<[a-z][\s\S]*>/i.test(html)
  const [limpo, setLimpo] = useState('')
  useEffect(() => {
    if (!ehHtml) return
    const t = setTimeout(() => setLimpo(limparHtml(html)), 0)
    return () => clearTimeout(t)
  }, [html, ehHtml])
  if (!ehHtml) return <div className="p2-rich" style={{ whiteSpace: 'pre-wrap', ...style }}>{html}</div>
  return <div className="p2-rich" style={style} dangerouslySetInnerHTML={{ __html: limpo }} />
}

function B({ t, title, onDown, style }: { t: React.ReactNode; title: string; onDown: () => void; style?: React.CSSProperties }) {
  return <button type="button" title={title} className="p2-rt-btn" style={style} onMouseDown={e => { e.preventDefault(); onDown() }}>{t}</button>
}

export function RichEditor({ value, onChange, placeholder, minHeight = 76, autoFocus, onCtrlEnter }: {
  value: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number; autoFocus?: boolean; onCtrlEnter?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const focado = useRef(false)
  const [paleta, setPaleta] = useState<null | 'fonte' | 'grifo'>(null)

  // Valor externo (ex.: limpar depois de salvar) só entra quando o campo não está em edição
  useEffect(() => {
    const el = ref.current
    if (!el || focado.current) return
    if (el.innerHTML !== value) el.innerHTML = value
  }, [value])
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])

  const emitir = () => {
    const html = ref.current?.innerHTML ?? ''
    const plano = ref.current?.textContent?.trim() ?? ''
    onChange(plano ? html : '')
  }
  const cmd = (c: string, v?: string) => {
    ref.current?.focus()
    try { document.execCommand('styleWithCSS', false, 'true') } catch { /* navegadores antigos */ }
    document.execCommand(c, false, v)
    emitir()
  }

  return (
    <div className="p2-rt">
      <div className="p2-rt-bar">
        <B t="N" title="Negrito (Ctrl+B)" onDown={() => cmd('bold')} style={{ fontWeight: 800 }} />
        <B t="I" title="Itálico (Ctrl+I)" onDown={() => cmd('italic')} style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }} />
        <B t="S" title="Sublinhado (Ctrl+U)" onDown={() => cmd('underline')} style={{ textDecoration: 'underline' }} />
        <B t="T" title="Tachado" onDown={() => cmd('strikeThrough')} style={{ textDecoration: 'line-through' }} />
        <span className="p2-rt-sep" />
        <B t={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ fontSize: 15, lineHeight: 0 }}>•</span>Tópicos</span>} title="Tópicos com bolinhas" onDown={() => cmd('insertUnorderedList')} style={{ padding: '0 7px' }} />
        <B t="1." title="Lista numerada" onDown={() => cmd('insertOrderedList')} style={{ fontWeight: 700 }} />
        <B t="⇥" title="Aumentar recuo (sub-tópico)" onDown={() => cmd('indent')} />
        <B t="⇤" title="Diminuir recuo" onDown={() => cmd('outdent')} />
        <span className="p2-rt-sep" />
        <B title="Cor da fonte" onDown={() => setPaleta(p => p === 'fonte' ? null : 'fonte')}
          t={<span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}><b>A</b><i style={{ width: 13, height: 3, borderRadius: 2, background: 'linear-gradient(90deg,#D64545,#2A4F96,#1E9E6A)' }} /></span>} />
        <B title="Grifar" onDown={() => setPaleta(p => p === 'grifo' ? null : 'grifo')} t="🖍" style={{ background: '#FEF08A88' }} />
        <span className="p2-rt-sep" />
        <B t="⌫" title="Limpar formatação" onDown={() => cmd('removeFormat')} />
        {paleta && (
          <div className="p2-rt-pal" onMouseDown={e => e.preventDefault()}>
            {(paleta === 'fonte' ? FONTE : GRIFO).map(c => (
              <button key={c} type="button" title={c === 'transparent' ? 'Sem grifo' : c}
                onMouseDown={e => { e.preventDefault(); cmd(paleta === 'fonte' ? 'foreColor' : 'hiliteColor', c); setPaleta(null) }}
                style={{ background: c === 'transparent' ? 'repeating-linear-gradient(45deg,#fff 0 4px,#E2E8F0 4px 6px)' : paleta === 'fonte' ? '#fff' : c, color: c }}>
                {paleta === 'fonte' ? <b style={{ color: c }}>A</b> : null}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={ref} className="p2-rt-area" contentEditable suppressContentEditableWarning
        data-ph={placeholder} style={{ minHeight }}
        onFocus={() => { focado.current = true }} onBlur={() => { focado.current = false; setPaleta(null) }}
        onInput={emitir}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && onCtrlEnter) { e.preventDefault(); onCtrlEnter() } }}
        onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }} />
    </div>
  )
}
