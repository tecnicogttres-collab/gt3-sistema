'use client'

// Extra portal (antiga camada 3 do Suporte): amostragem do trabalho fora do portal (WhatsApp, ligacao etc.).
// Todos: veem se recebem o pop-up e registram por conta propria quando liberado.
// Gestor/admin: configuram em passos simples (quem recebe, quem mais responde, o que conta, horarios).

import { useEffect, useMemo, useState } from 'react'
import { useCs } from '../cs-data'
import { contar, fatorMes, financeiro, fmt, nomeCtt, nomeUsuario, type Ctx } from '../cs-lib'
import {
  avisosEfetivos, avisosPrevistosAte, calcCamada2, calcCamada3, CLASSES, cttsDaAmostra, diasUteisEntre, diaUtil, faixasMin, hojeIso,
  labelOpcao, margemErro, margemPiorCaso, minutosDia, montarOpcoes, opcoesDe, participa, podeRegistrar, tempoC2,
  type Amostra, type Amostragem, type AtividadeC3, type ChaveAmostra, type Classe, type Janela,
} from '../cs-suporte-lib'
import { BotaoConfirmar, useOrdem } from '../cs-ui'
import { EscolherResposta } from '../CsAmostraAviso'
import { createClient } from '../../lib/supabase'
import { useSuporte, type SuporteApi } from './suporte-data'

export default function ExtraPortal() {
  const { ctx, meuId, papel } = useCs()
  const s = useSuporte(meuId)
  const gerencia = papel === 'admin' || papel === 'gestor'
  if (!ctx) return null
  if (s.carregando) return <div className="empty">Carregando…</div>
  if (s.faltaSql) return <div className="box"><h2>Falta criar as tabelas</h2><p className="note">Rode <b>sql/custo-servir-suporte.sql</b> no SQL Editor do Supabase.</p></div>
  return (
    <>
      <MinhaParticipacao ctx={ctx} s={s} />
      {gerencia && <AtividadesC3 s={s} />}
      {gerencia && <Configurar s={s} />}
      {gerencia && <ResultadoPesquisa ctx={ctx} s={s} />}
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Para todos: participacao e registro por conta propria
// ═════════════════════════════════════════════════════════════════════════════
function MinhaParticipacao({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { d, meuId, tentar } = useCs()
  const hoje = hojeIso()
  const ativas = s.amostragens.filter(a => a.ativa && a.inicio <= hoje && a.fim >= hoje && podeRegistrar(a, meuId))
  const [abrir, setAbrir] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [minhas, setMinhas] = useState<Amostra[]>([])
  const ctts = useMemo(() => [...d.ctts].sort((a, b) => (+a.contratante_cod || 0) - (+b.contratante_cod || 0)), [d.ctts])

  // Minhas respostas de hoje (pop-up e por conta propria)
  const ids = ativas.map(a => a.id).join(',')
  useEffect(() => {
    if (!ids) return
    let vivo = true
    void createClient().from('cs_amostras').select('*').eq('usuario_id', meuId).in('amostragem_id', ids.split(','))
      .gte('respondido_em', new Date(hojeIso() + 'T00:00:00').toISOString()).order('respondido_em', { ascending: false })
      .then(({ data }) => { if (vivo) setMinhas((data ?? []) as Amostra[]) })
    return () => { vivo = false }
  }, [ids, meuId])

  if (!ativas.length) {
    return (
      <div className="box">
        <h2>Extra portal</h2>
        <p className="note">Aqui medimos o trabalho que acontece fora do portal (WhatsApp, ligações, orientações…). No momento não há nenhuma pesquisa ativa para você. Quando houver, ela aparece aqui.</p>
      </div>
    )
  }
  return (
    <div className="box">
      <h2>Extra portal</h2>
      <p className="note">Mede o trabalho que acontece fora do portal. Mede o contratante, não a pessoa: ninguém vê quem respondeu o quê.</p>
      {ativas.map(a => {
        const obrig = participa(a, meuId)
        const faixas = faixasMin(a).map(j => minParaHora(j.ini) + '–' + minParaHora(j.fim)).join(' e ')
        return (
          <div key={a.id} className="tp-bloco">
            <div className="row between">
              <b>{a.nome}</b>
              <span className="note">até {a.fim.split('-').reverse().join('/')}</span>
            </div>
            <p className="note">
              {obrig
                ? <>Você vai receber <b>{avisosEfetivos(a)} pop-ups por dia</b> em horários sorteados entre {faixas}. É só responder o que estava fazendo naquele momento (2 cliques).</>
                : <>Você não recebe o pop-up, mas pode registrar por conta própria quando fizer algo fora do portal.</>}
            </p>
            {abrir === a.id ? (
              <>
                <EscolherResposta amostragem={a} todas={montarOpcoes(s.c3)} ctts={ctts} salvando={salvando} onRegistrar={async (atv, cs) => {
                  setSalvando(true)
                  let r: Amostra | null = null
                  const okk = await tentar(async () => { r = await s.registrarAmostra(a.id, atv, cs) }, 'Registrado. Obrigado!')
                  setSalvando(false)
                  const novo = r as Amostra | null
                  if (okk && novo) { setMinhas(p => [novo, ...p]); setAbrir(null) }
                  return !!okk
                }} />
                <div className="row"><button type="button" className="link" onClick={() => setAbrir(null)}>cancelar</button></div>
              </>
            ) : (
              <div className="row"><button type="button" className="btn solid xl" onClick={() => setAbrir(a.id)}>✋ Registrar o que estou fazendo agora</button></div>
            )}
          </div>
        )
      })}
      {minhas.length > 0 && <>
        <h3>Minhas respostas de hoje</h3>
        <div className="tbl">
          <table>
            <thead><tr><th>Hora</th><th>O quê</th><th>Contratante</th><th>Como</th></tr></thead>
            <tbody>
              {minhas.map(m => (
                <tr key={m.id}>
                  <td className="mono">{new Date(m.respondido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{labelOpcao(m.atividade, montarOpcoes(s.c3, true))}</td>
                  <td className="note">{cttsDaAmostra(m).map(c => `${c} · ${nomeCtt(ctx, c)}`).join('; ') || '—'}</td>
                  <td className="note">{m.espontanea ? 'por conta própria' : 'pop-up'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Gestor/admin: atividades da camada 3 (opcoes do pop-up fora do portal)
// ═════════════════════════════════════════════════════════════════════════════
function AtividadesC3({ s }: { s: SuporteApi }) {
  const { toast, tentar } = useCs()
  const [novo, setNovo] = useState({ label: '', inclui: '' })
  const [edit, setEdit] = useState<{ chave: string; label: string; inclui: string } | null>(null)
  const [verInativas, setVerInativas] = useState(false)
  const ativas = s.c3.filter(a => a.ativo).sort((a, b) => a.ordem - b.ordem)
  const inativas = s.c3.filter(a => !a.ativo)
  const nomeRepetido = (label: string, chave?: string) =>
    s.c3.some(a => a.chave !== chave && a.ativo && a.label.trim().toLowerCase() === label.trim().toLowerCase())

  async function incluir() {
    if (await tentar(() => s.adicionarC3(novo.label.trim(), novo.inclui.trim()), 'Atividade incluída')) setNovo({ label: '', inclui: '' })
  }
  async function salvarEdicao() {
    if (!edit) return
    if (await tentar(() => s.salvarC3(edit.chave, { label: edit.label.trim(), inclui: edit.inclui.trim() || null }), 'Atividade salva')) setEdit(null)
  }
  async function remover(a: AtividadeC3) {
    let r: 'excluida' | 'desativada' | null = null
    await tentar(async () => { r = await s.removerC3(a.chave) })
    if (r === 'excluida') toast(`"${a.label}" excluída`)
    if (r === 'desativada') toast(`"${a.label}" removida do pop-up; as respostas já dadas continuam no resultado`)
  }
  async function mover(a: AtividadeC3, dir: -1 | 1) {
    const i = ativas.findIndex(x => x.chave === a.chave)
    const b = ativas[i + dir]
    if (!b) return
    await tentar(async () => { await s.salvarC3(a.chave, { ordem: b.ordem }); await s.salvarC3(b.chave, { ordem: a.ordem }) })
  }

  return (
    <div className="box">
      <h2>Atividades da camada 3 (gestor e admin)</h2>
      <p className="note">Trabalho fora do portal sem rastro, medido pela amostragem. Estas atividades aparecem como botões no pop-up, entre as fixas (Avaliação, Cadastro, E-mail, Ligação, Faturamento, Interno e Sem demanda), e sempre pedem o contratante.</p>
      {!s.c3Tabela && <div className="warnbox">Para editar, rode <b>sql/custo-servir-camada3-atividades.sql</b> no SQL Editor do Supabase. Até lá valem WhatsApp e Orientação.</div>}

      <div className="tbl">
        <table>
          <thead><tr><th style={{ width: 70 }}>Ordem</th><th>Atividade</th><th>O que inclui (texto do botão)</th><th /></tr></thead>
          <tbody>
            {ativas.map((a, i) => edit?.chave === a.chave ? (
              <tr key={a.chave}>
                <td />
                <td><input type="text" value={edit.label} aria-label="Nome da atividade" onChange={e => setEdit({ ...edit, label: e.target.value })} /></td>
                <td><input type="text" value={edit.inclui} aria-label="O que inclui" onChange={e => setEdit({ ...edit, inclui: e.target.value })} /></td>
                <td>
                  <span className="pills">
                    <button type="button" className="btn sm solid" disabled={!edit.label.trim() || nomeRepetido(edit.label, a.chave)} onClick={() => void salvarEdicao()}>Salvar</button>
                    <button type="button" className="btn sm" onClick={() => setEdit(null)}>Cancelar</button>
                  </span>
                </td>
              </tr>
            ) : (
              <tr key={a.chave}>
                <td>
                  <span className="pills">
                    <button type="button" className="link" aria-label="Subir" disabled={i === 0 || !s.c3Tabela} onClick={() => void mover(a, -1)}>▲</button>
                    <button type="button" className="link" aria-label="Descer" disabled={i === ativas.length - 1 || !s.c3Tabela} onClick={() => void mover(a, 1)}>▼</button>
                  </span>
                </td>
                <td><b style={{ fontWeight: 600 }}>{a.label}</b></td>
                <td className="note">{a.inclui || '—'}</td>
                <td>
                  <span className="pills">
                    <button type="button" className="btn sm" disabled={!s.c3Tabela} onClick={() => setEdit({ chave: a.chave, label: a.label, inclui: a.inclui ?? '' })}>Editar</button>
                    <BotaoConfirmar disabled={!s.c3Tabela} onConfirm={() => void remover(a)}>Remover</BotaoConfirmar>
                  </span>
                </td>
              </tr>
            ))}
            {!ativas.length && <tr><td colSpan={4} className="empty">Nenhuma atividade de camada 3 ativa. O pop-up mostra só as opções fixas.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="kv">
        <label>Nova atividade<input type="text" value={novo.label} disabled={!s.c3Tabela} onChange={e => setNovo({ ...novo, label: e.target.value })} placeholder="ex.: Teams" /></label>
        <label>O que inclui<input type="text" value={novo.inclui} disabled={!s.c3Tabela} onChange={e => setNovo({ ...novo, inclui: e.target.value })} placeholder="ex.: Mensagens e chamadas pelo Teams" /></label>
      </div>
      <div className="row">
        <button type="button" className="btn solid" disabled={!s.c3Tabela || !novo.label.trim() || nomeRepetido(novo.label)} onClick={() => void incluir()}>+ Incluir atividade</button>
        {novo.label.trim() && nomeRepetido(novo.label) && <span className="note">Já existe uma atividade com esse nome.</span>}
      </div>
      <p className="note">Pesquisas com &quot;O que conta: todas&quot; passam a mostrar a nova atividade no pop-up na hora. Nas que têm opções escolhidas, marque-a em Editar. Remover uma atividade que já tem respostas só a tira do pop-up: as respostas continuam no resultado.</p>

      {inativas.length > 0 && (
        <>
          <button type="button" className="link" onClick={() => setVerInativas(v => !v)}>{verInativas ? 'ocultar' : 'ver'} removidas com histórico ({inativas.length})</button>
          {verInativas && (
            <div className="row">
              {inativas.map(a => (
                <span key={a.chave} className="selbar" style={{ padding: '4px 10px' }}>
                  {a.label}
                  <button type="button" className="link" disabled={!s.c3Tabela} onClick={() => void tentar(() => s.salvarC3(a.chave, { ativo: true, ordem: Math.max(0, ...s.c3.map(x => x.ordem)) + 1 }), `"${a.label}" voltou ao pop-up`)}>reativar</button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Gestor/admin: configuracao em passos
// ═════════════════════════════════════════════════════════════════════════════
type Quem = 'todos' | 'escolher' | 'ninguem'
function Configurar({ s }: { s: SuporteApi }) {
  const { d, tentar } = useCs()
  const ativos = d.usuarios.filter(u => !u.desativado)
  const todasOp = montarOpcoes(s.c3)
  const TODAS: ChaveAmostra[] = todasOp.map(o => o.chave)
  const vazio = {
    id: null as string | null, nome: '', inicio: hojeIso(), fim: '', avisos: 6, janelas: JANELAS_PADRAO,
    quem: 'todos' as Quem, pessoas: [] as string[], aberta: true, opcoes: TODAS,
  }
  const [f, setF] = useState(vazio)
  const [aberto, setAberto] = useState(false)
  const editar = (x: Amostragem) => {
    setF({
      id: x.id, nome: x.nome, inicio: x.inicio, fim: x.fim, avisos: x.avisos_dia,
      janelas: x.janelas?.length ? x.janelas : [{ ini: x.hora_ini.slice(0, 5), fim: x.hora_fim.slice(0, 5) }],
      quem: !x.participantes ? 'todos' : x.participantes.length ? 'escolher' : 'ninguem', pessoas: x.participantes ?? [],
      aberta: !!x.aberta_todos, opcoes: opcoesDe(x, todasOp).map(o => o.chave),
    })
    setAberto(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const fx = faixasMin({ hora_ini: '00:00', hora_fim: '00:00', janelas: f.janelas })
  const janelasOk = f.janelas.length > 0 && f.janelas.every(j => j.ini && j.fim && j.fim > j.ini)
  const faltas = [
    !f.nome.trim() && 'dê um nome',
    (!f.inicio || !f.fim || f.fim < f.inicio) && 'escolha o período',
    !janelasOk && 'confira os horários',
    f.quem === 'escolher' && !f.pessoas.length && 'escolha quem recebe o pop-up',
    f.quem === 'ninguem' && !f.aberta && 'sem pop-up, libere o registro por conta própria',
    !f.opcoes.length && 'marque pelo menos uma opção',
  ].filter(Boolean) as string[]
  const somarSemanas = (n: number) => {
    const dt = new Date((f.inicio || hojeIso()) + 'T12:00:00'); dt.setDate(dt.getDate() + n * 7 - 1)
    while (!diaUtil(hojeIso(dt))) dt.setDate(dt.getDate() - 1)
    setF({ ...f, fim: hojeIso(dt) })
  }
  async function salvar() {
    const ordenadas = [...f.janelas].sort((x, y) => x.ini.localeCompare(y.ini))
    const dados = {
      nome: f.nome.trim(), inicio: f.inicio, fim: f.fim, avisos_dia: f.avisos,
      hora_ini: fx[0] ? minParaHora(fx[0].ini) : ordenadas[0].ini, hora_fim: fx.length ? minParaHora(fx[fx.length - 1].fim) : ordenadas[ordenadas.length - 1].fim,
      janelas: ordenadas, participantes: f.quem === 'todos' ? null : f.quem === 'ninguem' ? [] : f.pessoas,
      aberta_todos: f.aberta, opcoes: f.opcoes.length === TODAS.length ? null : f.opcoes,
    }
    const okk = f.id
      ? await tentar(() => s.salvarAmostragem(f.id!, dados), 'Pesquisa salva')
      : await tentar(() => s.criarAmostragem({ ...dados, ativa: true }), 'Pesquisa criada')
    if (okk) { setF(vazio); setAberto(false) }
  }
  const nPopup = f.quem === 'todos' ? ativos.length : f.quem === 'ninguem' ? 0 : f.pessoas.length
  const alternarPessoa = (id: string) => setF({ ...f, pessoas: f.pessoas.includes(id) ? f.pessoas.filter(x => x !== id) : [...f.pessoas, id] })
  // Mantem a ordem da lista de opcoes (e a ordem em que aparecem no pop-up)
  const alternarOpcao = (k: ChaveAmostra) => setF({ ...f, opcoes: TODAS.filter(x => (x === k ? !f.opcoes.includes(x) : f.opcoes.includes(x))) })

  return (
    <div className="box">
      <div className="row between">
        <h2>Configurar (gestor e admin)</h2>
        {!aberto && <button type="button" className="btn solid" onClick={() => { setF(vazio); setAberto(true) }}>+ Nova pesquisa</button>}
      </div>

      {aberto && (
        <div className={'tp-bloco' + (f.id ? ' padrao' : '')}>
          <b>{f.id ? 'Editando pesquisa' : 'Nova pesquisa'}</b>

          <div className="ep-passo">
            <span className="ep-num">1</span>
            <div>
              <b>Nome e período</b>
              <div className="kv">
                <label>Nome<input type="text" value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="ex.: Extra portal nov/2026" /></label>
                <label>Começa<input type="date" value={f.inicio} onChange={e => setF({ ...f, inicio: e.target.value })} /></label>
                <label>Termina<input type="date" value={f.fim} onChange={e => setF({ ...f, fim: e.target.value })} /></label>
              </div>
              <div className="row">
                <span className="note">Duração rápida:</span>
                {[1, 2, 3, 4].map(n => <button key={n} type="button" className="btn sm" onClick={() => somarSemanas(n)}>{n} semana{n > 1 ? 's' : ''}</button>)}
              </div>
            </div>
          </div>

          <div className="ep-passo">
            <span className="ep-num">2</span>
            <div>
              <b>Quem recebe o pop-up (obrigatório)</b>
              <div className="row">
                {([['todos', `Todos (${ativos.length})`], ['escolher', 'Escolher pessoas'], ['ninguem', 'Ninguém']] as [Quem, string][]).map(([k, l]) => (
                  <button key={k} type="button" className={'btn sm' + (f.quem === k ? ' solid' : '')} onClick={() => setF({ ...f, quem: k })}>{l}</button>
                ))}
              </div>
              {f.quem === 'escolher' && (
                <div className="row">
                  {ativos.map(u => (
                    <button key={u.id} type="button" className={'pill ' + (f.pessoas.includes(u.id) ? 'p-blue' : 'p-gray')} style={{ cursor: 'pointer', padding: '3px 10px', fontSize: 12.5, border: 0 }}
                      onClick={() => alternarPessoa(u.id)}>
                      {f.pessoas.includes(u.id) ? '✓ ' : ''}{nomeUsuario(u)}
                    </button>
                  ))}
                </div>
              )}
              {f.quem !== 'ninguem' && (
                <div className="row">
                  <span className="note">Pop-ups por dia, por pessoa:</span>
                  {[3, 4, 6, 8].map(n => <button key={n} type="button" className={'btn sm' + (f.avisos === n ? ' solid' : '')} onClick={() => setF({ ...f, avisos: n })}>{n}</button>)}
                  <input type="number" min={1} max={20} value={f.avisos} aria-label="Pop-ups por dia" style={{ width: 70 }} onChange={e => setF({ ...f, avisos: Math.min(20, Math.max(1, +e.target.value || 1)) })} />
                </div>
              )}
            </div>
          </div>

          <div className="ep-passo">
            <span className="ep-num">3</span>
            <div>
              <b>Os outros também podem responder por conta própria?</b>
              <div className="row">
                <button type="button" className={'btn sm' + (f.aberta ? ' solid' : '')} onClick={() => setF({ ...f, aberta: true })}>Sim, qualquer usuário</button>
                <button type="button" className={'btn sm' + (!f.aberta ? ' solid' : '')} onClick={() => setF({ ...f, aberta: false })}>Não, só quem recebe o pop-up</button>
              </div>
              <p className="note">Quem pode responder vê o botão &quot;Registrar o que estou fazendo agora&quot; nesta aba.</p>
            </div>
          </div>

          <div className="ep-passo">
            <span className="ep-num">4</span>
            <div>
              <b>O que conta</b>
              <div className="row">
                {todasOp.map(o => (
                  <button key={o.chave} type="button" title={o.inclui} className={'pill ' + (f.opcoes.includes(o.chave) ? 'p-blue' : 'p-gray')} style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13, border: 0 }}
                    onClick={() => alternarOpcao(o.chave)}>
                    {f.opcoes.includes(o.chave) ? '✓ ' : ''}{o.label}
                  </button>
                ))}
              </div>
              <div className="row">
                <button type="button" className="btn sm" onClick={() => setF({ ...f, opcoes: TODAS })}>Todas</button>
                <button type="button" className="btn sm" onClick={() => setF({ ...f, opcoes: TODAS.filter(k => k === 'email' || k === 'ligacao' || k === 'sem_demanda' || todasOp.find(o => o.chave === k)?.classe === 'camada3') })}>Só fora do portal</button>
              </div>
              <p className="note">São os botões que aparecem no pop-up. Deixe &quot;Interno&quot; e &quot;Sem demanda&quot; marcados para a conta fechar 100% do tempo.</p>
            </div>
          </div>

          <div className="ep-passo">
            <span className="ep-num">5</span>
            <div>
              <b>Horários em que o pop-up pode aparecer</b>
              <div className="row">
                {f.janelas.map((j, i) => (
                  <span key={i} className="selbar" style={{ padding: '4px 8px' }}>
                    <input type="time" value={j.ini} aria-label={`Faixa ${i + 1}: início`} onChange={e => setF({ ...f, janelas: f.janelas.map((x, k) => (k === i ? { ...x, ini: e.target.value } : x)) })} />
                    <span>–</span>
                    <input type="time" value={j.fim} aria-label={`Faixa ${i + 1}: fim`} onChange={e => setF({ ...f, janelas: f.janelas.map((x, k) => (k === i ? { ...x, fim: e.target.value } : x)) })} />
                    {f.janelas.length > 1 && <button type="button" className="link" aria-label="Remover faixa" onClick={() => setF({ ...f, janelas: f.janelas.filter((_, k) => k !== i) })}>✕</button>}
                  </span>
                ))}
              </div>
              <div className="row">
                <button type="button" className="btn sm" onClick={() => setF({ ...f, janelas: JANELAS_PADRAO })}>08–12 e 13:30–18</button>
                <button type="button" className="btn sm" onClick={() => setF({ ...f, janelas: [{ ini: '08:00', fim: '18:00' }] })}>08–18 direto</button>
                <button type="button" className="btn sm" onClick={() => setF({ ...f, janelas: [...f.janelas, { ini: '', fim: '' }] })}>+ Outra faixa</button>
              </div>
              <p className="note">Só dias úteis (segunda a sexta).</p>
            </div>
          </div>

          <ResumoAmostragem a={{ id: f.id ?? 'novo', inicio: f.inicio, fim: f.fim, avisos_dia: f.avisos, hora_ini: '00:00', hora_fim: '00:00', janelas: f.janelas }} pessoas={nPopup} />

          <div className="row">
            <button type="button" className="btn solid" disabled={faltas.length > 0} onClick={() => void salvar()}>{f.id ? 'Salvar alterações' : 'Criar pesquisa'}</button>
            <button type="button" className="btn" onClick={() => { setF(vazio); setAberto(false) }}>Cancelar</button>
            {faltas.length > 0 && <span className="note">Falta: {faltas.join(', ')}.</span>}
          </div>
          {f.id && <p className="note">Mudar horários ou pop-ups por dia muda os sorteios a partir de agora; as respostas já dadas ficam.</p>}
        </div>
      )}

      {s.amostragens.length > 0 ? (
        <div className="tbl">
          <table>
            <thead><tr><th>Pesquisa</th><th>Período</th><th>Pop-up para</th><th>Por conta própria</th><th>O que conta</th><th className="c">Ativa</th><th /></tr></thead>
            <tbody>
              {s.amostragens.map(x => {
                const nomes = x.participantes?.map(id => nomeUsuario(d.usuarios.find(u => u.id === id))) ?? []
                const ops = opcoesDe(x, todasOp)
                return (
                  <tr key={x.id} className={'click' + (s.amSel?.id === x.id ? ' sel' : '')} onClick={() => s.setAmId(x.id)}>
                    <td><b style={{ fontWeight: 600 }}>{x.nome}</b></td>
                    <td className="mono">{x.inicio.split('-').reverse().join('/')} a {x.fim.split('-').reverse().join('/')}</td>
                    <td className="note" title={nomes.join(', ')}>
                      {!x.participantes ? 'todos' : !nomes.length ? 'ninguém' : nomes.length <= 3 ? nomes.join(', ') : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`}
                      {x.participantes?.length !== 0 && <> · {avisosEfetivos(x)}/dia</>}
                    </td>
                    <td className="note">{x.aberta_todos ? 'qualquer um' : 'não'}</td>
                    <td className="note">{!x.opcoes?.length ? 'todas' : ops.map(o => o.label).join(', ')}</td>
                    <td className="c" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={x.ativa} aria-label="Ativa" onChange={e => tentar(() => s.salvarAmostragem(x.id, { ativa: e.target.checked }))} />
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <span className="pills">
                        <button type="button" className="btn sm" onClick={() => editar(x)}>Editar</button>
                        <BotaoConfirmar onConfirm={() => tentar(() => s.excluirAmostragem(x.id), 'Pesquisa excluída')}>Excluir</BotaoConfirmar>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : !aberto && <p className="note">Nenhuma pesquisa criada ainda. Clique em &quot;+ Nova pesquisa&quot;.</p>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Gestor/admin: resultado
// ═════════════════════════════════════════════════════════════════════════════
function ResultadoPesquisa({ ctx, s }: { ctx: Ctx; s: SuporteApi }) {
  const { d } = useCs()
  const a = s.amSel
  if (!a) return null
  const ativos = d.usuarios.filter(u => !u.desativado)
  const c3 = calcCamada3(s.amostras)
  const fin = financeiro(ctx.cfg)
  const previstas = avisosPrevistosAte(a, ativos.map(u => u.id))
  const nPopup = s.amostras.filter(x => !x.espontanea).length
  const nProprio = c3.n - nPopup
  const pct = (n: number) => (c3.n ? n / c3.n : 0)
  const nomesC3 = s.c3.filter(x => x.ativo).map(x => x.label).join(', ')
  return (
    <div className="box">
      <div className="row between">
        <h2>Resultado: {a.nome}</h2>
        <button type="button" className="btn sm" onClick={() => s.recarregarAmostras(a.id)}>Atualizar</button>
      </div>
      <ResumoAmostragem a={a} pessoas={a.participantes ? a.participantes.length : ativos.length} />
      <div className="tiles">
        <div className="tile"><b>{c3.n}</b><span>respostas ({nPopup} pelo pop-up · {nProprio} por conta própria)</span></div>
        <div className="tile"><b>±{fmt(margemPiorCaso(c3.n), 1)} p.p.</b><span>margem de erro (95%, pior caso)</span></div>
        <div className="tile"><b>{previstas ? fmt((nPopup / previstas) * 100) + '%' : '—'}</b><span>pop-ups respondidos ({previstas} até agora)</span></div>
        <div className="tile"><b>{fin.ok ? fmt(fin.cap) + ' h' : '—'}</b><span>capacidade prática/mês (para converter % em horas)</span></div>
      </div>
      {nProprio > 0 && <p className="note">Respostas por conta própria entram na conta, mas tendem a puxar para cima o que é lembrado (ex.: WhatsApp). Para o percentual mais fiel, o pop-up sorteado é a base.</p>}
      {c3.n === 0 ? <p className="note">Nenhuma resposta ainda.</p> : <>
        <h3>Para onde vai o tempo</h3>
        <div className="tbl">
          <table>
            <thead><tr><th>Atividade</th><th>Classe</th><th className="r">Obs.</th><th className="r">%</th><th className="r">± p.p.</th><th style={{ width: '30%' }} /><th className="r">h/mês</th></tr></thead>
            <tbody>
              {opcoesDe(a, montarOpcoes(s.c3, true)).filter(o => o.ativo || c3.porOpcao[o.chave]).map(o => {
                const p = pct(c3.porOpcao[o.chave] ?? 0)
                const me = margemErro(p, c3.n)
                return (
                  <tr key={o.chave}>
                    <td>{o.label}{!o.ativo && <span className="note"> (removida)</span>}</td>
                    <td className="note">{CLASSES[o.classe]}</td>
                    <td className="r mono">{c3.porOpcao[o.chave] ?? 0}</td>
                    <td className="r mono">{fmt(p * 100, 1)}%</td>
                    <td className="r mono">±{fmt(me, 1)}</td>
                    <td><Barra p={p} me={me / 100} /></td>
                    <td className="r mono">{fin.ok ? fmt(p * fin.cap, 0) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <ConferenciaCamadas ctx={ctx} s={s} pctClasse={k => pct(c3.porClasse[k])} />
        <h3>Camada 3{nomesC3 ? ` (${nomesC3})` : ''} por contratante</h3>
        <PorContratanteC3 ctx={ctx} porCtt={c3.porCttCamada3} n={c3.n} semCtt={c3.camada3SemCtt} cap={fin.ok ? fin.cap : null} />
      </>}
    </div>
  )
}

const JANELAS_PADRAO: Janela[] = [{ ini: '08:00', fim: '12:00' }, { ini: '13:30', fim: '18:00' }]
const minParaHora = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')

/** Duracao total da amostragem: dias uteis, horas cobertas por dia e observacoes esperadas. */
function ResumoAmostragem({ a, pessoas }: { a: Pick<Amostragem, 'id' | 'inicio' | 'fim' | 'avisos_dia' | 'hora_ini' | 'hora_fim' | 'janelas'>; pessoas: number }) {
  const dias = diasUteisEntre(a.inicio, a.fim)
  const minDia = minutosDia(a)
  const n = avisosEfetivos(a)
  const total = dias * n * pessoas
  const esperado = Math.round(total * 0.8)
  const semanas = a.inicio && a.fim && a.fim >= a.inicio ? (new Date(a.fim + 'T12:00:00').getTime() - new Date(a.inicio + 'T12:00:00').getTime()) / 86_400_000 / 7 + 1 / 7 : 0
  return (
    <div className="tiles">
      <div className="tile"><b>{dias}</b><span>dias úteis{semanas ? ` · ${fmt(semanas, 1)} semana(s)` : ''}</span></div>
      <div className="tile"><b>{fmt(minDia / 60, 1)} h</b><span>cobertas por dia (faixas)</span></div>
      <div className="tile"><b>{fmt(dias * minDia / 60, 0)} h</b><span>duração total da camada por pessoa</span></div>
      <div className="tile"><b>{n}{n < a.avisos_dia ? '*' : ''}</b><span>avisos/dia por pessoa{n < a.avisos_dia ? ' (*limitado: 20 min entre avisos)' : ''}</span></div>
      <div className="tile"><b>{fmt(total)}</b><span>avisos no período · {pessoas} pessoa(s)</span></div>
      <div className="tile"><b>±{esperado ? fmt(margemPiorCaso(esperado), 1) : '—'} p.p.</b><span>margem esperada (80% de resposta ≈ {fmt(esperado)} obs.)</span></div>
    </div>
  )
}

function Barra({ p, me }: { p: number; me: number }) {
  return (
    <div style={{ position: 'relative', height: 12, background: 'var(--cs-tint)', borderRadius: 4 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, p * 100)}%`, background: 'var(--cs-edge)', borderRadius: 4 }} />
      <div title="margem de erro" style={{ position: 'absolute', top: 5, height: 2, left: `${Math.max(0, (p - me) * 100)}%`, width: `${Math.min(100, (p + me) * 100) - Math.max(0, (p - me) * 100)}%`, background: 'var(--cs-gold)' }} />
    </div>
  )
}

function PorContratanteC3({ ctx, porCtt, n, semCtt, cap }: { ctx: Ctx; porCtt: Record<string, number>; n: number; semCtt: number; cap: number | null }) {
  const lista = Object.entries(porCtt).map(([c, k]) => ({ c, k }))
  const { sorted, th } = useOrdem(lista, { c: x => +x.c || x.c, nome: x => nomeCtt(ctx, x.c), k: x => x.k }, { col: 'k', dir: 'desc' })
  if (!lista.length) return <p className="note">Nenhuma observação de camada 3 com contratante ainda.</p>
  return (
    <div className="tbl scroll" style={{ maxHeight: 340 }}>
      <table>
        <thead><tr>{th('c', 'Cód.')}{th('nome', 'Contratante')}{th('k', 'Obs.', 'r')}<th className="r">% do tempo</th><th className="r">± p.p.</th><th className="r">h/mês</th></tr></thead>
        <tbody>
          {sorted.map(x => {
            const p = x.k / n
            return <tr key={x.c}><td className="mono">{x.c}</td><td>{nomeCtt(ctx, x.c)}</td><td className="r mono">{fmt(x.k, x.k % 1 ? 1 : 0)}</td><td className="r mono">{fmt(p * 100, 1)}%</td><td className="r mono">±{fmt(margemErro(p, n), 1)}</td><td className="r mono">{cap ? fmt(p * cap, 1) : '—'}</td></tr>
          })}
          {semCtt > 0 && <tr><td /><td className="note">Sem contratante</td><td className="r mono">{semCtt}</td><td className="r mono">{fmt((semCtt / n) * 100, 1)}%</td><td /><td className="r mono">{cap ? fmt((semCtt / n) * cap, 1) : '—'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

/** Conferencia: a amostragem confere as camadas 1 e 2 (se os % batem com as horas medidas). */
function ConferenciaCamadas({ ctx, s, pctClasse }: { ctx: Ctx; s: SuporteApi; pctClasse: (k: Classe) => number }) {
  const { linhas, relSel } = useCs()
  const fin = financeiro(ctx.cfg)
  const r = useMemo(() => contar(ctx, linhas), [ctx, linhas])
  if (!fin.ok) return <div className="warnbox">Preencha os parâmetros da equipe (aba Resultado) para comparar a amostragem com as camadas 1 e 2.</div>
  const f1 = fatorMes(ctx.cfg, relSel)
  const h1 = f1 ? (r.real / 60) * f1 : null
  const diasMes = ctx.cfg.dias_mes ?? ctx.cfg.dias_uteis
  const f2 = s.loteSel?.dias_uteis && diasMes ? diasMes / s.loteSel.dias_uteis : null
  const c2 = calcCamada2(s.linhas, s.ativs, tempoC2(ctx, s.meds))
  const h2 = f2 && s.linhas.length ? (c2.total / 60) * f2 : null
  const linha = (titulo: string, amostra: number, medido: number | null) => {
    const dif = medido != null && amostra ? (medido - amostra) / amostra : null
    return (
      <tr>
        <td>{titulo}</td>
        <td className="r mono">{fmt(amostra, 0)} h</td>
        <td className="r mono">{medido != null ? fmt(medido, 0) + ' h' : '—'}</td>
        <td>{dif == null ? <span className="note">sem dado medido</span> : Math.abs(dif) <= 0.15 ? <span className="pill p-good">bate ({fmt(dif * 100)}%)</span> : <span className="pill p-warn">revisar tempos ({dif > 0 ? '+' : ''}{fmt(dif * 100)}%)</span>}</td>
      </tr>
    )
  }
  return <>
    <h3>Conferência com as camadas medidas</h3>
    <div className="tbl">
      <table>
        <thead><tr><th>Camada</th><th className="r">Pela amostragem (h/mês)</th><th className="r">Pela medição (h/mês)</th><th>Leitura</th></tr></thead>
        <tbody>
          {linha('Camada 1 · Avaliação (relatório × tempo-padrão)', pctClasse('camada1') * fin.cap, h1)}
          {linha('Camada 2 · Com rastro (volumes × tempo-padrão)', pctClasse('camada2') * fin.cap, h2)}
        </tbody>
      </table>
    </div>
    <p className="note">Se a amostragem e a medição ficam perto (até ±15%), os tempos-padrão estão bem calibrados.</p>
  </>
}
