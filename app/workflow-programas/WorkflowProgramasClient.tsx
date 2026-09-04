'use client'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { useUser, displayName } from '../components/UserContext'

// ─── Types ──────────────────────────────────────────────────────────────────

type StatusResp = 'ok' | 'nao' | 'na' | 'restricao' | ''
type Resposta = { status: StatusResp; obs: string; opcoesSelecionadas?: string[]; textosLivres?: Record<string, string>; prazoRestricaoDias?: number }
type DocKey = 'PGR' | 'PCMSO' | 'LTCAT' | 'GERAL'
type Escopo = 'base' | 'especifico'
type CategoriaTexto = 'abertura' | 'apontamento' | 'fechamento' | 'assinatura' | 'aprovacao' | 'restricao' | 'validade' | 'segmento'
type ChecklistItemTipo = 'status' | 'opcoes'
/** pedirTexto: pede um detalhe livre ao marcar (ex.: "qual página?") — sempre disponível como {{detalhe}}
 *  dentro de corpo, e também como {{variavelDetalhe}} se um nome próprio for definido. */
type ChecklistOpcao = { id: string; label: string; corpo: string; pedirTexto: boolean; placeholder: string; variavelDetalhe: string; padrao: boolean }

type ChecklistItem = {
  id: string; titulo: string; documento: DocKey; descricao: string
  escopo: Escopo; textoId: string; critico: boolean; textoReprovacaoId: string
  /** Quais "bolinhas" de status este item aceita — padrão: ok/nao/na (só vale para tipo "status") */
  statusOptions: StatusResp[]
  /** Texto de e-mail usado quando marcado "Aprovado com restrição" */
  textoRestricaoId: string
  /** Texto de destaque no parecer quando marcado "Conforme" — opcional, só entra se preenchido */
  textoAprovadoId: string
  /** Só aparece no checklist se o item com este id estiver com o valor abaixo
   *  (status do item, ou id da opção marcada, se o item referenciado for tipo "opcoes") */
  condicaoItemId: string
  condicaoValor: string
  /** "status" = as bolinhas de sempre; "opcoes" = lista de opções de texto (única ou múltipla escolha) */
  tipo: ChecklistItemTipo
  multiplaEscolha: boolean
  opcoes: ChecklistOpcao[]
  /** Nome da variável {{...}} preenchida com o texto das opções marcadas (só tipo "opcoes") */
  variavel: string
}
/** `segmentos` só é usado quando categoria === 'segmento' — quais setores de atuação disparam este texto no parecer. */
type TextoEmail = { id: string; titulo: string; categoria: CategoriaTexto; corpo: string; segmentos?: string[] }
type TextoReprovacao = { id: string; titulo: string; documento: DocKey; escopo: Escopo; corpo: string }

/** Os 4 campos de texto de um ChecklistItem, usados pelo inspetor de "Itens de checklist". */
type InspectorCampo = 'textoAprovadoId' | 'textoId' | 'textoReprovacaoId' | 'textoRestricaoId'
const CAMPO_INFO: Record<InspectorCampo, { label: string; tone: 'ok' | 'laranja' | 'no' | 'dourado'; categoria?: 'aprovacao' | 'apontamento' | 'restricao' }> = {
  textoAprovadoId: { label: 'Aprovado', tone: 'ok', categoria: 'aprovacao' },
  textoId: { label: 'Não conforme', tone: 'laranja', categoria: 'apontamento' },
  textoReprovacaoId: { label: 'Reprovado', tone: 'no' },
  textoRestricaoId: { label: 'Aprovado com restrição', tone: 'dourado', categoria: 'restricao' },
}
type ItemLink = { itemId: string; textoId: string | null }
type Contratante = {
  id: string; nome: string; unidade: string; email: string; prazoDias: number
  aberturaId: string; fechamentoId: string; assinaturaId: string; aprovadoId: string
  obs: string; itens: ItemLink[]
}
type CatalogConfig = {
  responsavel: string; assunto: string
  aberturaId: string; fechamentoId: string; assinaturaId: string; aprovadoId: string
  /** Textos usados na observação automática de validade (categoria "validade") — vazio = nenhuma observação */
  validadeAnualId: string; validadePersonalizadaId: string
  prazoDias: number
  /** Chaves de CAMPOS_ANALISE que precisam estar preenchidas antes do checklist liberar em Nova análise. */
  camposObrigatorios: string[]
}

/** Campos do cabeçalho de "Nova análise" que podem ser marcados como obrigatórios pelas Configurações. */
const CAMPOS_ANALISE: { key: 'empresa' | 'emailDestino' | 'data' | 'responsavel' | 'reincidencia' | 'setoresAtuacao'; label: string }[] = [
  { key: 'empresa', label: 'Empresa prestadora' },
  { key: 'emailDestino', label: 'E-mail de destino' },
  { key: 'data', label: 'Data da análise' },
  { key: 'responsavel', label: 'Analista' },
  { key: 'reincidencia', label: 'Reincidência' },
  { key: 'setoresAtuacao', label: 'Setor(es) de atuação' },
]

function campoAnaliseVazio(draft: AnaliseDados, key: string): boolean {
  const v = (draft as unknown as Record<string, unknown>)[key]
  if (Array.isArray(v)) return v.length === 0
  return typeof v === 'string' ? !v.trim() : !v
}
type Catalog = { contratantes: Contratante[]; itens: ChecklistItem[]; textos: TextoEmail[]; textosReprovacao: TextoReprovacao[]; config: CatalogConfig }

type ValidadeTipo = 'bienal' | 'anual' | 'personalizada'
type ValidadeInfo = { tipo: ValidadeTipo; meses: number }
type DocValidavel = 'PGR' | 'PCMSO' | 'LTCAT'

type Reincidencia = '' | 'nova' | 'reincidente'

type AnaliseDados = {
  contratanteIds: string[]; documentos: DocKey[]
  empresa: string; cnpj: string; emailDestino: string
  data: string; prazo: string; responsavel: string
  reincidencia: Reincidencia; setoresAtuacao: string[]
  respostas: Record<string, Resposta>
  validades: Partial<Record<DocValidavel, ValidadeInfo>>
}

/** Setores genéricos de atuação da empresa prestadora — usado no campo "Setor de atuação". */
const SETORES_ATUACAO = [
  'Transporte', 'Manutenção', 'Administrativo', 'Construção Civil', 'Logística / Armazenagem',
  'Elétrica', 'Metalurgia / Metalmecânica', 'Limpeza e Conservação', 'Segurança Patrimonial', 'Alimentação / Refeitório',
]

/** Item resolvido para uma análise: `textoLink` já considera override por contratante;
 *  `contratanteIds` marca de quais contratantes selecionadas na análise esse item veio. */
type ItemDaAnalise = ChecklistItem & { textoLink: string; contratanteIds: string[] }

/** Análises salvas antes do suporte a múltiplas contratantes tinham `contratanteId` (singular). */
function normalizeAnaliseDados(dados: AnaliseDados & { contratanteId?: string; setorAtuacao?: string }): AnaliseDados {
  const { contratanteId, setorAtuacao, ...resto } = dados
  return {
    ...resto,
    contratanteIds: Array.isArray(dados.contratanteIds) ? dados.contratanteIds : (contratanteId ? [contratanteId] : []),
    reincidencia: dados.reincidencia ?? '',
    setoresAtuacao: Array.isArray(dados.setoresAtuacao) ? dados.setoresAtuacao : (setorAtuacao ? [setorAtuacao] : []),
  }
}
type Anexo = { id: string; texto_id: string; name: string; filename: string; mime_type: string; size_bytes: number; created_at: string }

type AnaliseRow = {
  id: string; empresa: string; cnpj: string
  finalizada: boolean; data_final: string | null
  criado_por: string; criado_por_nome: string | null
  created_at: string; updated_at: string
  dados: AnaliseDados
  minha?: boolean
}

type View = 'analises' | 'nova' | 'banco' | 'contratantes' | 'itens' | 'textos' | 'config'

const DOC_TYPES: DocKey[] = ['PGR', 'PCMSO', 'LTCAT']
const DOC_ORDER: DocKey[] = ['PGR', 'PCMSO', 'LTCAT', 'GERAL']

/** Ordena itens do catálogo por documento (PGR → PCMSO → LTCAT → GERAL) — usado em toda
 *  listagem de itens fora do checklist da análise (que já ordena assim por padrão). */
function ordenarPorDocumento<T extends { documento: DocKey }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => DOC_ORDER.indexOf(a.documento) - DOC_ORDER.indexOf(b.documento))
}

/** Item do catálogo padrão que representa o "Aditivo de indicação de frente de trabalho" —
 *  a validade do documento (bienal/anual/personalizada) só é perguntada se este item não
 *  estiver marcado como não conforme. */
const FRENTE_TRABALHO_ITEM_ID = 'i_ger_frente'
const VALIDADE_TIPOS: { val: ValidadeTipo; label: string }[] = [
  { val: 'bienal', label: 'Bienal' }, { val: 'anual', label: 'Anual' }, { val: 'personalizada', label: 'Personalizada' },
]

const DEFAULT_STATUS_OPTIONS: StatusResp[] = ['ok', 'nao', 'na']
const STATUS_LABELS: Record<Exclude<StatusResp, ''>, string> = {
  ok: 'Conforme', nao: 'Reprovação', na: 'Não aplicável', restricao: 'Aprovado com restrição',
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const P = '#2A4F96', PS = '#E8EEF9'
const AC = '#D1AE6E', ASO = '#FBF4E6'
const CARD = '#ffffff', LINE = '#E2E8F2'
const TX = '#1B2432', MU = '#6B7A90'
const OK = '#1E9E6A', OKS = '#E6F6EF'
const NO = '#D64545', NOS = '#FCEBEB'
const NA = '#94A3B8', NAS = '#EEF1F5'
/** Laranja — texto "Não conforme" (orientativo). Dourado escuro — "Aprovado com restrição". */
const LARANJA = '#D9730D', LARANJAS = '#FDF0E4'
const DOURADO = '#9C6B0B', DOURADOS = '#FBF0DA'

type DotDef = { val: Exclude<StatusResp, ''>; label: string; symbol: string; on: string; onFg: string }
const ALL_DOTS: DotDef[] = [
  { val: 'ok', label: 'Conforme', symbol: '✓', on: OK, onFg: '#fff' },
  { val: 'nao', label: 'Reprovação — item crítico marcado assim vira reprovação; se não crítico, entra como orientativo no parecer', symbol: '✕', on: NO, onFg: '#fff' },
  { val: 'na', label: 'Não aplicável', symbol: '–', on: NA, onFg: '#fff' },
  { val: 'restricao', label: 'Aprovado com restrição — entra no parecer', symbol: '◐', on: AC, onFg: '#3A2E14' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(p: string) { return p + '_' + Math.random().toString(36).slice(2, 9) }
function hoje() { return new Date().toISOString().slice(0, 10) }
function addDias(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function fmtD(s?: string | null) { return s ? s.split('-').reverse().join('/') : '' }
function aplicaVars(txt: string, ctx: Record<string, string>) {
  return (txt || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (ctx[k] !== undefined ? ctx[k] : m))
}

/** Junta uma lista em português: "A", "A e B", "A, B e C" */
function joinDocs(itens: string[]): string {
  if (itens.length === 0) return ''
  if (itens.length === 1) return itens[0]
  if (itens.length === 2) return itens[0] + ' e ' + itens[1]
  return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1]
}


// ─── Seed (base padrão GT3) ────────────────────────────────────────────────────

function seedCatalog(): Catalog {
  const T = (id: string, titulo: string, categoria: CategoriaTexto, corpo: string): TextoEmail => ({ id, titulo, categoria, corpo })
  const textos: TextoEmail[] = [
    T('t_abertura', 'Abertura padrão', 'abertura', 'Prezados, bom dia.\n\nRealizamos a análise da documentação de Saúde e Segurança do Trabalho da empresa {{empresa}} (CNPJ {{cnpj}}), referente à prestação de serviços para {{contratante}}.\n\nPara liberação do cadastro, seguem os apontamentos que precisam de ajuste ou complementação:'),
    T('t_fechamento', 'Fechamento padrão', 'fechamento', 'Solicitamos o reenvio dos documentos corrigidos até {{prazo}}, respondendo a este mesmo e-mail.\n\nEnquanto os apontamentos acima não forem sanados, a documentação permanece pendente e a liberação da frente de trabalho fica condicionada à regularização.'),
    T('t_aprovado', 'Documentação aprovada', 'aprovacao', 'Prezados, bom dia.\n\nInformamos que a documentação de SST da empresa {{empresa}} (CNPJ {{cnpj}}), referente à prestação de serviços para {{contratante}}, foi analisada em {{data}} e encontra-se APROVADA, sem apontamentos.\n\nLembramos que qualquer alteração de escopo, função ou frente de trabalho exige nova análise documental.'),
    T('t_assinatura', 'Assinatura GT3', 'assinatura', 'Atenciosamente,\n\n{{responsavel}}\nGT3 Consultoria — Gestão de Terceiros\nCaxias do Sul/RS'),
    T('t_pgr_val', 'PGR — validade vencida', 'apontamento', 'O PGR apresentado está com data de elaboração/revisão vencida. Conforme a NR-01, o inventário de riscos e o plano de ação devem ser revisados no prazo máximo de 2 anos (ou 3 anos, quando adotado sistema de gestão de SST certificado), e sempre que houver alteração nos riscos. Favor encaminhar o documento revisado e vigente.'),
    T('t_pgr_rt', 'PGR — responsável técnico', 'apontamento', 'O documento não apresenta identificação e assinatura legível do responsável técnico habilitado (nome, formação e registro no conselho de classe). Favor reenviar o PGR assinado pelo profissional legalmente habilitado.'),
    T('t_pgr_dados', 'Dados cadastrais divergentes', 'apontamento', 'Os dados cadastrais do documento (razão social, CNPJ e/ou endereço) divergem do cartão CNPJ da empresa. Favor corrigir a identificação no documento para que corresponda exatamente ao cadastro da prestadora.'),
    T('t_pgr_inv', 'Inventário de riscos incompleto', 'apontamento', 'O inventário de riscos não contempla todas as funções que serão utilizadas na frente de trabalho indicada. Favor complementar o inventário com as funções: (informar funções) — descrevendo perigos, fontes geradoras, medidas de controle existentes e nível de risco.'),
    T('t_pgr_psico', 'Riscos psicossociais não contemplados', 'apontamento', 'O inventário de riscos não contempla os fatores de risco psicossociais relacionados ao trabalho. Conforme a NR-01, o gerenciamento de riscos ocupacionais deve incluir a identificação e avaliação desses fatores, com as respectivas medidas de prevenção no plano de ação. Favor complementar o PGR.'),
    T('t_pgr_plano', 'Plano de ação sem prazos/responsáveis', 'apontamento', 'O plano de ação apresentado não contém medidas de prevenção com prazos definidos, responsáveis pela execução e forma de acompanhamento da eficácia. Favor complementar conforme item 1.5.5 da NR-01.'),
    T('t_pgr_quant', 'Avaliações quantitativas ausentes', 'apontamento', 'Não foram apresentadas as avaliações quantitativas dos agentes ambientais aplicáveis às atividades (ex.: ruído, calor, agentes químicos), nem a justificativa técnica para sua dispensa. Favor encaminhar os laudos/medições ou a justificativa do responsável técnico.'),
    T('t_pgr_epi', 'EPI/EPC sem especificação', 'apontamento', 'Os EPIs e EPCs não estão especificados por função, com indicação do Certificado de Aprovação (CA). Favor complementar o documento e anexar as fichas de entrega de EPI dos colaboradores indicados para a frente de trabalho.'),
    T('t_pcm_val', 'PCMSO — validade vencida', 'apontamento', 'O PCMSO apresentado está fora da vigência. Favor encaminhar o documento vigente, com data de elaboração e período de validade legíveis.'),
    T('t_pcm_med', 'PCMSO — médico coordenador', 'apontamento', 'O PCMSO não apresenta identificação e assinatura do médico coordenador, com CRM. Conforme a NR-07, o programa deve estar sob responsabilidade de médico do trabalho. Favor reenviar assinado.'),
    T('t_pcm_vinc', 'PCMSO desvinculado do PGR', 'apontamento', 'Os riscos descritos no PCMSO não correspondem aos riscos identificados no inventário do PGR. Conforme a NR-07, o PCMSO deve ser elaborado a partir do inventário de riscos do PGR. Favor compatibilizar os documentos.'),
    T('t_pcm_exames', 'Exames incompatíveis com os riscos', 'apontamento', 'Os exames complementares previstos não são compatíveis com os riscos ocupacionais das funções indicadas (ex.: audiometria para exposição a ruído, espirometria para agentes químicos, exames específicos para trabalho em altura). Favor revisar o quadro de exames por função.'),
    T('t_pcm_rel', 'Relatório analítico anual', 'apontamento', 'Não foi apresentado o relatório analítico anual do PCMSO referente ao último período. Favor encaminhar o relatório assinado pelo médico coordenador.'),
    T('t_lt_ass', 'LTCAT sem assinatura habilitada', 'apontamento', 'O LTCAT não apresenta assinatura de profissional habilitado (engenheiro de segurança do trabalho ou médico do trabalho) com o respectivo registro. Favor reenviar o laudo devidamente assinado.'),
    T('t_lt_ag', 'LTCAT — agentes nocivos', 'apontamento', 'O LTCAT não apresenta a caracterização dos agentes nocivos por função, com as respectivas intensidades/concentrações e conclusão quanto ao enquadramento para aposentadoria especial. Favor complementar.'),
    T('t_ger_frente', 'Aditivo de frente de trabalho', 'apontamento', 'Não foi recebido o Aditivo de Indicação de Frente de Trabalho preenchido e assinado pela empresa, com a identificação da unidade contratante e dos riscos da atividade. Favor preencher e encaminhar junto com a documentação corrigida.'),
    T('t_mpo_psico', 'Psicossociais — padrão Marcopolo', 'apontamento', 'Os fatores de risco psicossociais devem ser apresentados conforme orientação do SESMT da contratante: identificação dos fatores por função, metodologia de avaliação utilizada, classificação do nível de risco e plano de ação com medidas, prazos e responsáveis. O documento apresentado não atende a esse detalhamento. Favor complementar o PGR.'),
    T('t_mpo_495', 'Inventário no modelo MOD 495/11', 'apontamento', 'O inventário de riscos deve seguir o modelo MOD 495/11 exigido pela contratante, contemplando as categorias de risco por função e a classificação conforme a matriz adotada. Favor adequar e reenviar.'),
    T('t_mpo_trein', 'Treinamentos obrigatórios', 'apontamento', 'Não foram apresentados os certificados de treinamento exigidos para as atividades a serem executadas na unidade (ex.: NR-06, NR-11, NR-35, NR-33, integração), com carga horária, data e assinatura do instrutor responsável. Favor encaminhar os comprovantes dos colaboradores indicados.'),
    T('t_vol_croqui', 'Escopo e local de execução', 'apontamento', 'A documentação não deixa claro o local de execução dos serviços e o escopo das atividades dentro da unidade. Favor descrever no PGR as atividades efetivamente executadas na contratante e a área de atuação.'),
    T('t_validade_anual', 'Validade — Anual', 'validade', 'Identificado que {{documentosValidade}} {{verbo}} como {{adjetivo}}. A sugestão é rever com o elaborador, pois poderia ser bienal, conforme a Norma permite.'),
    T('t_validade_personalizada', 'Validade — Personalizada (até 23 meses)', 'validade', 'Identificado que {{documentosValidade}} {{verbo}} com validade personalizada de {{meses}} meses. A sugestão é rever com o elaborador, pois poderia ser bienal, conforme a Norma permite.'),
  ]

  const I = (id: string, titulo: string, documento: DocKey, descricao: string, escopo: Escopo, textoId: string, critico: boolean, textoReprovacaoId = ''): ChecklistItem => ({
    id, titulo, documento, descricao, escopo, textoId, critico, textoReprovacaoId, statusOptions: [...DEFAULT_STATUS_OPTIONS], textoRestricaoId: '', textoAprovadoId: '',
    condicaoItemId: '', condicaoValor: '', tipo: 'status', multiplaEscolha: false, opcoes: [], variavel: '',
  })
  const itens: ChecklistItem[] = [
    I('i_pgr_val', 'PGR dentro da validade', 'PGR', 'Revisão em até 2 anos (ou 3 com sistema de gestão certificado).', 'base', 't_pgr_val', true, 'r_pgr_validade'),
    I('i_pgr_rt', 'Assinatura do responsável técnico', 'PGR', 'Nome, formação e registro no conselho de classe.', 'base', 't_pgr_rt', true),
    I('i_pgr_dados', 'Dados cadastrais conforme cartão CNPJ', 'PGR', 'Razão social, CNPJ e endereço conferem.', 'base', 't_pgr_dados', false),
    I('i_pgr_inv', 'Inventário contempla todas as funções', 'PGR', 'Funções da frente de trabalho descritas com perigos e controles.', 'base', 't_pgr_inv', true),
    I('i_pgr_psico', 'Fatores de risco psicossociais (NR-01)', 'PGR', 'Identificação e medidas de prevenção no plano de ação.', 'base', 't_pgr_psico', false),
    I('i_pgr_plano', 'Plano de ação com prazos e responsáveis', 'PGR', 'Medidas, cronograma, responsáveis e verificação de eficácia.', 'base', 't_pgr_plano', false),
    I('i_pgr_quant', 'Avaliações quantitativas quando aplicável', 'PGR', 'Ruído, calor, agentes químicos — ou justificativa técnica.', 'base', 't_pgr_quant', false),
    I('i_pgr_epi', 'EPI/EPC especificados por função com CA', 'PGR', 'Inclui fichas de entrega dos colaboradores indicados.', 'base', 't_pgr_epi', false),
    I('i_pcm_val', 'PCMSO dentro da validade', 'PCMSO', 'Vigência legível e atual.', 'base', 't_pcm_val', true, 'r_pcm_validade'),
    I('i_pcm_med', 'Assinatura do médico coordenador (CRM)', 'PCMSO', 'Responsabilidade técnica conforme NR-07.', 'base', 't_pcm_med', true),
    I('i_pcm_vinc', 'PCMSO vinculado ao PGR', 'PCMSO', 'Riscos coincidentes entre os documentos.', 'base', 't_pcm_vinc', true),
    I('i_pcm_exames', 'Exames compatíveis com os riscos', 'PCMSO', 'Quadro de exames por função e periodicidade.', 'base', 't_pcm_exames', false),
    I('i_pcm_rel', 'Relatório analítico anual', 'PCMSO', 'Assinado pelo médico coordenador.', 'base', 't_pcm_rel', false),
    I('i_lt_ass', 'LTCAT assinado por profissional habilitado', 'LTCAT', 'Eng. de segurança ou médico do trabalho com registro.', 'base', 't_lt_ass', false),
    I('i_lt_ag', 'Agentes nocivos e enquadramento', 'LTCAT', 'Intensidades, concentrações e conclusão técnica.', 'base', 't_lt_ag', false),
    I('i_ger_frente', 'Aditivo de indicação de frente de trabalho', 'GERAL', 'Preenchido e assinado pela prestadora.', 'base', 't_ger_frente', false),
    I('e_mpo_psico', 'Psicossociais no padrão do SESMT da contratante', 'PGR', 'Metodologia, classificação e plano de ação específicos.', 'especifico', 't_mpo_psico', true),
    I('e_mpo_495', 'Inventário no modelo MOD 495/11', 'PGR', 'Categorias de risco conforme matriz da contratante.', 'especifico', 't_mpo_495', false),
    I('e_mpo_trein', 'Certificados de treinamento da atividade', 'GERAL', 'NR-06, NR-11, NR-35, NR-33 e integração.', 'especifico', 't_mpo_trein', false),
    I('e_vol_escopo', 'Escopo e local de execução descritos', 'GERAL', 'Atividades e área de atuação dentro da unidade.', 'especifico', 't_vol_croqui', false),
  ]

  const R = (id: string, titulo: string, documento: DocKey, escopo: Escopo, corpo: string): TextoReprovacao => ({ id, titulo, documento, escopo, corpo })
  const textosReprovacao: TextoReprovacao[] = [
    R('r_pgr_cnpj', 'Outro CNPJ', 'PGR', 'base', 'Favor rever: doc enviado refere-se a outro CNPJ - difere do cadastrado no Portal'),
    R('r_pgr_pagina', 'Página específica', 'PGR', 'base', 'Favor coletar assinatura do responsável da empresa (XX) na página XX, onde é solicitado, ou na capa. Pode ser assinado digitalmente. Anexar ao portal o PGR completo + a página assinada, unidos, em um único arquivo.\n\nCaso tenha dúvidas em como unir ou separar arquivos, sugerimos o uso do https://www.ilovepdf.com/pt'),
    R('r_pgr_capa', 'Capa', 'PGR', 'base', 'Favor coletar assinatura do responsável da empresa (XX)  na capa ou em local de preferência.  Pode ser assinado digitalmente. Anexar ao portal o PGR completo + a página assinada, unidos, em um único arquivo. \nCaso tenha dúvidas em como unir ou separar arquivos, sugerimos o uso do https://www.ilovepdf.com/pt'),
    R('r_pgr_frente', 'Frente de serviço', 'PGR', 'base', "Favor rever: não Identificado frente de serviço Marcopolo Ana Rech / São Cristóvão / Volare, conforme solicitado por e-mail no (s) dia (s) 21/03/24, 05/08/24  e 13/09/2024 a: 'XXXXX@XXXXX"),
    R('r_pgr_divporta', 'Diverge Portal', 'PGR', 'base', 'Favor rever: a (s) função (ões) XXXXXX não estão contempladas no PGR, conforme cadastro de colaborador no Portal. Necessário indicar função no PGR para que seja possível aprovar o mesmo'),
    R('r_pgr_divpcmso', 'Diverge PCMSO', 'PGR', 'base', 'Favor rever: a (s) função (ões) XXXXXX diferem em relação ao PCMSO. Funções devem estar consistentes entre ambos documentos'),
    R('r_pgr_plano', 'Plano de ação', 'PGR', 'base', 'Favor rever: não identificado plano de ação. Necessário enviar junto com o PGR (no mesmo arquivo).\nCaso tenha dúvidas em como unir ou separar arquivos, sugerimos o uso do https://www.ilovepdf.com/pt'),
    R('r_pgr_validade', 'Validade', 'PGR', 'base', 'Favor rever: doc anexado está vencido. Necessário anexar PGR vigente, atualizado e assinado pelo representante da sua empresa'),
    R('r_pcm_cnpj', 'Outro CNPJ', 'PCMSO', 'base', 'Favor rever: doc enviado refere-se a outro CNPJ - difere do cadastrado no Portal'),
    R('r_pcm_pagina', 'Página específica', 'PCMSO', 'base', 'Favor coletar assinatura do responsável da empresa (XX) na página XX, onde é solicitado, ou na capa. Pode ser assinado digitalmente. Anexar ao portal o PCMSO completo + a página assinada, unidos, em um único arquivo.\n\nCaso tenha dúvidas em como unir ou separar arquivos, sugerimos o uso do https://www.ilovepdf.com/pt'),
    R('r_pcm_capa', 'Capa', 'PCMSO', 'base', 'Favor coletar assinatura do responsável da empresa (XX)  na capa ou em local de preferência.  Pode ser assinado digitalmente. Anexar ao portal o PCMSO completo + a página assinada, unidos, em um único arquivo. \nCaso tenha dúvidas em como unir ou separar arquivos, sugerimos o uso do https://www.ilovepdf.com/pt'),
    R('r_pcm_60dias', 'Aprovado p/ 60 dias', 'PCMSO', 'base', 'Aprovado com restrição por 60 dias para revisão após a adequação do PGR com a indicação da frente de serviços Marcopolo Ana Rech / Marcopolo São Cristóvão / Volare, conforme NR 01 e e-mail orientativo encaminhado em XX/XX/XX, para xxxx@\nApós adequação, necessário anexar o PCMSO assinado pelo representante da empresa também'),
    R('r_pcm_divporta', 'Diverge Portal', 'PCMSO', 'base', 'Favor rever: a (s) função (ões) XXXXXX não estão contempladas no PCMSO, conforme cadastro de colaborador no Portal. Necessário indicar função no PCMSO para que seja possível aprovar o mesmo. Ou atualizar a função do colaborador no portal'),
    R('r_pcm_divpgr', 'Diverge PGR', 'PCMSO', 'base', 'Favor rever: a (s) função (ões) XXXXXX diferem em relação ao PGR. Funções devem estar consistentes entre ambos documentos'),
    R('r_pcm_vigencia', 'Vigência Cf PGR', 'PCMSO', 'base', 'Favor rever: PCMSO é anterior ao PGR. Necessário anexar doc com vigência igual ou mais recente em relação ao PGR, uma vez que o PCMSO é um doc embasado no PGR, com elaboração posterior ao PGR'),
    R('r_pcm_validade', 'Validade', 'PCMSO', 'base', 'Favor rever: doc anexado está vencido. Necessário anexar PCMSO vigente, atualizado e assinado pelo representante da sua empresa'),
    R('r_lt_cnpj', 'Outro CNPJ', 'LTCAT', 'base', 'Favor rever: doc enviado refere-se a outro CNPJ - difere do cadastrado no Portal'),
    R('r_lt_divporta', 'Diverge Portal', 'LTCAT', 'base', 'Favor rever: a (s) função (ões) XXXXXX não estão contempladas no LTCAT, conforme cadastro de colaborador no Portal. Necessário indicar função no LTCAT para que seja possível aprovar o mesmo'),
    R('r_lt_divpgr', 'Diverge PGR', 'LTCAT', 'base', 'Favor rever: a (s) função (ões) XXXXXX diferem em relação ao PGR. Funções devem estar consistentes entre ambos documentos'),
    R('r_lt_validade', 'Validade', 'LTCAT', 'base', 'Favor rever: doc anexado está vencido. Necessário anexar LTCAT vigente e atualizado conforme PGR de referência atual'),
    R('r_lt_anual', 'Anual', 'LTCAT', 'base', 'Periodicidade Anual. Poderia ser Bienal conforme Art 278 na IN 128 – INSS, em referência ao PGR (NR 01)'),
    R('r_pgr_esp_anual', 'Anual', 'PGR', 'especifico', 'Periodicidade anual, poderia ser bienal conforme orienta a NR01, a critério do seu elaborador'),
    R('r_pgr_esp_60frente', 'Aprovado p/ 60 dias - Frente', 'PGR', 'especifico', 'Aprovado com restrição por 60 dias para revisão e adequação do PGR com a indicação da frente de serviços Marcopolo Ana Rech / Marcopolo São Cristóvão / Volare, conforme NR 01 e e-mail orientativo encaminhado em XX/XX/XX, para xxxx@'),
    R('r_pgr_esp_60frenteassin', 'Aprovado p/ 60 dias frente + assinatura', 'PGR', 'especifico', 'Aprovado com restrição por 60 dias para revisão após a adequação do PGR com a indicação da frente de serviços Marcopolo Ana Rech / Marcopolo São Cristóvão / Volare, conforme NR 01 e e-mail orientativo encaminhado em XX/XX/XX, para xxxx@\n\nBem como, anexar assinado pela própria empresa. A assinatura pode ser em local específico designado no PGR ou na capa'),
    R('r_pgr_esp_planoalianca', 'Plano de ação Aliança', 'PGR', 'especifico', 'Considerado medidas de controle do inventário de riscos como plano de ação'),
    R('r_pcm_esp_anual', 'Anual', 'PCMSO', 'especifico', 'Periodicidade Anual. poderia ser Bienal conforme o PGR (NR 01), a critério do seu elaborador'),
    R('r_pcm_esp_ppra', 'Embasado no PPRA', 'PCMSO', 'especifico', 'Favor rever: doc enviado está embasado no PPRA (extinto em janeiro/22). Necessário que o embasamento esteja relacionada ao PGR vigente'),
  ]

  const base: ItemLink[] = itens.filter(i => i.escopo === 'base').map(i => ({ itemId: i.id, textoId: null }))
  const C = (id: string, nome: string, unidade: string, extras: string[]): Contratante => ({
    id, nome, unidade, email: '', prazoDias: 7,
    aberturaId: 't_abertura', fechamentoId: 't_fechamento', assinaturaId: 't_assinatura', aprovadoId: 't_aprovado', obs: '',
    itens: [...base.map(x => ({ ...x })), ...extras.map(e => ({ itemId: e, textoId: null }))],
  })
  const contratantes: Contratante[] = [
    C('c_mpo_ar', 'Marcopolo', 'Ana Rech', ['e_mpo_psico', 'e_mpo_495', 'e_mpo_trein']),
    C('c_mpo_sc', 'Marcopolo', 'São Cristóvão', ['e_mpo_psico', 'e_mpo_495', 'e_mpo_trein']),
    C('c_volare', 'Volare', 'Caxias do Sul', ['e_mpo_psico', 'e_mpo_trein', 'e_vol_escopo']),
  ]
  contratantes[2].obs = 'Unidade exige descrição do local de execução no PGR.'

  return {
    contratantes, itens, textos, textosReprovacao,
    config: {
      responsavel: 'Rodrigo Balem',
      assunto: 'GT3 · Análise de documentação SST — {{empresa}} — {{contratante}}',
      aberturaId: 't_abertura', fechamentoId: 't_fechamento', assinaturaId: 't_assinatura', aprovadoId: 't_aprovado',
      validadeAnualId: 't_validade_anual', validadePersonalizadaId: 't_validade_personalizada',
      prazoDias: 7,
      camposObrigatorios: [],
    },
  }
}

/** Preenche catálogos salvos antes da existência de "Textos de reprovação" (upgrade in-place). */
function upgradeCatalog(raw: Catalog): { catalog: Catalog; changed: boolean } {
  const idsAprovado = new Set([raw.config?.aprovadoId, ...raw.contratantes.map(c => c.aprovadoId)].filter(Boolean))
  const precisaUpgrade = !Array.isArray(raw.textosReprovacao)
    || raw.itens.some(i => typeof i.textoReprovacaoId !== 'string' || typeof i.textoAprovadoId !== 'string' || !Array.isArray(i.statusOptions) || typeof i.condicaoItemId !== 'string'
      || typeof i.tipo !== 'string' || !Array.isArray(i.opcoes) || i.opcoes.some(o => typeof o.pedirTexto !== 'boolean' || typeof o.variavelDetalhe !== 'string' || typeof o.padrao !== 'boolean'))
    || raw.textos.some(t => idsAprovado.has(t.id) && t.categoria !== 'aprovacao')
    || typeof raw.config.validadeAnualId !== 'string' || typeof raw.config.validadePersonalizadaId !== 'string'
    || !raw.config.aprovadoId || !raw.textos.some(t => t.id === raw.config.aprovadoId)
    || !Array.isArray(raw.config.camposObrigatorios)
  if (!precisaUpgrade) return { catalog: raw, changed: false }
  const seed = seedCatalog()
  let textos = raw.textos.map(t => (idsAprovado.has(t.id) && t.categoria !== 'aprovacao' ? { ...t, categoria: 'aprovacao' as const } : t))
  const config = { ...raw.config }
  if (typeof config.validadeAnualId !== 'string') {
    const seedTexto = seed.textos.find(t => t.id === 't_validade_anual')!
    if (!textos.some(t => t.id === seedTexto.id)) textos = [...textos, seedTexto]
    config.validadeAnualId = seedTexto.id
  }
  if (typeof config.validadePersonalizadaId !== 'string') {
    const seedTexto = seed.textos.find(t => t.id === 't_validade_personalizada')!
    if (!textos.some(t => t.id === seedTexto.id)) textos = [...textos, seedTexto]
    config.validadePersonalizadaId = seedTexto.id
  }
  // Reconstrói o texto de aprovação padrão se o id configurado não existir mais em `textos`
  // (ex.: apagado sem querer) — sem ele, todo parecer 100% aprovado sai com abertura vazia.
  if (!config.aprovadoId || !textos.some(t => t.id === config.aprovadoId)) {
    const seedTexto = seed.textos.find(t => t.id === 't_aprovado')!
    if (!textos.some(t => t.id === seedTexto.id)) textos = [...textos, seedTexto]
    config.aprovadoId = seedTexto.id
  }
  if (!Array.isArray(config.camposObrigatorios)) config.camposObrigatorios = []
  const defaultLink: Record<string, string> = { i_pgr_val: 'r_pgr_validade', i_pcm_val: 'r_pcm_validade' }
  const itens = raw.itens.map(i => {
    const legado = i as ChecklistItem & { condicaoStatus?: string }
    return {
      ...i,
      textoReprovacaoId: typeof i.textoReprovacaoId === 'string' ? i.textoReprovacaoId : (defaultLink[i.id] || ''),
      statusOptions: Array.isArray(i.statusOptions) && i.statusOptions.length ? i.statusOptions : [...DEFAULT_STATUS_OPTIONS],
      textoRestricaoId: typeof i.textoRestricaoId === 'string' ? i.textoRestricaoId : '',
      textoAprovadoId: typeof i.textoAprovadoId === 'string' ? i.textoAprovadoId : '',
      condicaoItemId: typeof i.condicaoItemId === 'string' ? i.condicaoItemId : '',
      condicaoValor: typeof i.condicaoValor === 'string' ? i.condicaoValor : (typeof legado.condicaoStatus === 'string' ? legado.condicaoStatus : ''),
      tipo: i.tipo === 'opcoes' ? 'opcoes' as const : 'status' as const,
      multiplaEscolha: !!i.multiplaEscolha,
      opcoes: (Array.isArray(i.opcoes) ? i.opcoes : []).map(o => ({
        ...o, pedirTexto: !!o.pedirTexto, placeholder: typeof o.placeholder === 'string' ? o.placeholder : '',
        variavelDetalhe: typeof o.variavelDetalhe === 'string' ? o.variavelDetalhe : '',
        padrao: !!o.padrao,
      })),
      variavel: typeof i.variavel === 'string' ? i.variavel : '',
    }
  })
  const textosReprovacao = Array.isArray(raw.textosReprovacao) && raw.textosReprovacao.length ? raw.textosReprovacao : seed.textosReprovacao
  return { catalog: { ...raw, itens, textos, textosReprovacao, config }, changed: true }
}

// ─── Small UI atoms ─────────────────────────────────────────────────────────────

function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'acc' | 'ok' | 'no' | 'na' | 'laranja' | 'dourado' }) {
  const map: Record<string, { bg: string; fg: string }> = {
    default: { bg: PS, fg: P }, acc: { bg: ASO, fg: '#8A6A22' },
    ok: { bg: OKS, fg: OK }, no: { bg: NOS, fg: NO }, na: { bg: NAS, fg: '#54617A' },
    laranja: { bg: LARANJAS, fg: LARANJA }, dourado: { bg: DOURADOS, fg: DOURADO },
  }
  const c = map[tone]
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>
      {children}
    </span>
  )
}

function Btn({ children, onClick, variant = 'default', small = false, disabled = false, title }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'default' | 'pri' | 'acc' | 'gho' | 'danger'; small?: boolean; disabled?: boolean; title?: string
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: '#fff', border: `1px solid ${LINE}`, color: TX },
    pri: { background: P, border: `1px solid ${P}`, color: '#fff' },
    acc: { background: AC, border: `1px solid ${AC}`, color: '#3A2E14', fontWeight: 600 },
    gho: { background: 'transparent', border: '1px solid transparent', color: MU },
    danger: { background: NO, border: `1px solid ${NO}`, color: '#fff', fontWeight: 600 },
  }
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      ...styles[variant], padding: small ? '5px 10px' : '8px 14px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: small ? 12 : 13, display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit',
      opacity: disabled ? 0.55 : 1, whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: MU, marginBottom: 5, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff',
  outline: 'none', fontFamily: 'inherit', fontSize: 13, color: TX, boxSizing: 'border-box',
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 1px 2px rgba(27,36,50,.06), 0 4px 16px rgba(27,36,50,.06)', ...style }}>{children}</div>
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <Card style={{ textAlign: 'center', padding: '44px 20px', color: MU }}>
      <b style={{ display: 'block', color: TX, marginBottom: 4, fontSize: 15 }}>{title}</b>{sub}
    </Card>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkflowProgramasClient() {
  const { profile } = useUser()
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [analises, setAnalises] = useState<AnaliseRow[]>([])
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [view, setView] = useState<View>('analises')
  const [textosSub, setTextosSub] = useState<'hub' | 'aprovacao' | 'apontamento' | 'restricao' | 'reprovacao' | 'validade' | 'segmento'>('hub')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // draft análise
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AnaliseDados | null>(null)
  const [emailEditado, setEmailEditado] = useState(false)
  const [emailOverride, setEmailOverride] = useState('')

  // banco
  const [bancoAba, setBancoAba] = useState<'empresas' | 'relatorio'>('empresas')
  const [bancoQ, setBancoQ] = useState('')
  const [bancoContratante, setBancoContratante] = useState('')
  const [bancoStatus, setBancoStatus] = useState('')
  const [bancoDe, setBancoDe] = useState('')
  const [bancoAte, setBancoAte] = useState('')
  const [bancoAberto, setBancoAberto] = useState<string | null>(null)
  const [bancoItem, setBancoItem] = useState<string | null>(null)

  // modals
  const [modalContratante, setModalContratante] = useState<Contratante | null>(null)
  const [modalContratanteNovo, setModalContratanteNovo] = useState(false)
  const [modalItemEdit, setModalItemEdit] = useState<ChecklistItem | null>(null)
  const [modalItemNovo, setModalItemNovo] = useState(false)
  const [modalTextoEdit, setModalTextoEdit] = useState<TextoEmail | null>(null)
  const [modalTextoNovo, setModalTextoNovo] = useState(false)
  const [modalReprovacaoEdit, setModalReprovacaoEdit] = useState<TextoReprovacao | null>(null)
  const [modalReprovacaoNovo, setModalReprovacaoNovo] = useState(false)

  // inspetor de texto (painel lateral aberto a partir de "Itens de checklist")
  const [inspecionar, setInspecionar] = useState<{ item: ChecklistItem; campo: InspectorCampo } | null>(null)
  const [pendingLink, setPendingLink] = useState<{ itemId: string; campo: InspectorCampo } | null>(null)

  function showToast(m: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(m)
    toastTimer.current = setTimeout(() => setToast(''), 2400)
  }

  // ── load ──
  useEffect(() => {
    let alive = true
    async function load() {
      const [cfgRes, listRes, anexosRes] = await Promise.all([
        fetch('/api/workflow-programas/config').then(r => r.json()).catch(() => ({ dados: null })),
        fetch('/api/workflow-programas').then(r => r.json()).catch(() => []),
        fetch('/api/workflow-programas/anexos').then(r => r.json()).catch(() => []),
      ])
      if (!alive) return
      let cat: Catalog | null = cfgRes?.dados ?? null
      let precisaSalvar = false
      if (!cat) {
        cat = seedCatalog()
        precisaSalvar = true
      } else {
        const upgraded = upgradeCatalog(cat)
        cat = upgraded.catalog
        precisaSalvar = upgraded.changed
      }
      if (precisaSalvar) {
        fetch('/api/workflow-programas/config', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dados: cat }),
        }).catch(() => {})
      }
      setCatalog(cat)
      const listaAnalises: AnaliseRow[] = Array.isArray(listRes) ? listRes : []
      setAnalises(listaAnalises.map(a => ({ ...a, dados: normalizeAnaliseDados(a.dados) })))
      setAnexos(Array.isArray(anexosRes) ? anexosRes : [])
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [])

  function persistCatalog(next: Catalog) {
    setCatalog(next)
    fetch('/api/workflow-programas/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dados: next }),
    }).catch(() => showToast('Falha ao salvar — tente novamente'))
  }

  // ── getters ──
  const getC = (id?: string) => catalog?.contratantes.find(c => c.id === id)
  const getI = (id?: string) => catalog?.itens.find(i => i.id === id)
  const getT = (id?: string | null) => (id ? catalog?.textos.find(t => t.id === id) : undefined)
  const getR = (id?: string | null) => (id ? catalog?.textosReprovacao.find(r => r.id === id) : undefined)
  const nomeC = (c?: Contratante) => (c ? c.nome + (c.unidade ? ' — ' + c.unidade : '') : '')

  /** Une os itens de todas as contratantes selecionadas na análise. `contratanteIds` no
   *  retorno marca de quais dessas contratantes cada item veio — item.contratanteIds.length
   *  igual a a.contratanteIds.length = comum a todas; menor = específico de algumas. O
   *  override de texto (textoLink) fica com a primeira contratante (na ordem selecionada)
   *  que define aquele item. */
  function itensDaAnalise(a: AnaliseDados): ItemDaAnalise[] {
    if (!catalog) return []
    const docs = a.documentos?.length ? a.documentos : (['PGR', 'PCMSO'] as DocKey[])
    const map = new Map<string, { item: ChecklistItem; textoLink: string; contratanteIds: string[] }>()
    a.contratanteIds.forEach(cid => {
      const c = getC(cid)
      if (!c) return
      c.itens.forEach(l => {
        const i = getI(l.itemId)
        if (!i) return
        const atual = map.get(i.id)
        if (atual) atual.contratanteIds.push(cid)
        else map.set(i.id, { item: i, textoLink: l.textoId || i.textoId, contratanteIds: [cid] })
      })
    })
    return Array.from(map.values())
      .map(({ item, textoLink, contratanteIds }) => ({ ...item, textoLink, contratanteIds }))
      .filter((i): i is ItemDaAnalise => i.documento === 'GERAL' || docs.includes(i.documento))
      .filter(i => {
        if (!i.condicaoItemId || !i.condicaoValor || i.condicaoItemId === i.id) return true
        const condItem = getI(i.condicaoItemId)
        if (condItem?.tipo === 'opcoes') return (a.respostas[i.condicaoItemId]?.opcoesSelecionadas || []).includes(i.condicaoValor)
        return a.respostas[i.condicaoItemId]?.status === i.condicaoValor
      })
      .sort((x, y) => DOC_ORDER.indexOf(x.documento) - DOC_ORDER.indexOf(y.documento))
  }

  /** Nomes das contratantes selecionadas, unidos em português ("A", "A e B", "A, B e C"). */
  function nomesContratantes(ids: string[]): string {
    return joinDocs(ids.map(id => nomeC(getC(id))).filter(Boolean))
  }

  function ctxDe(a: AnaliseDados, itens?: ChecklistItem[]) {
    const c = getC(a.contratanteIds[0])
    const vars: Record<string, string> = {}
    itens?.forEach(i => {
      if (i.tipo !== 'opcoes' || !i.variavel) return
      const sel = a.respostas[i.id]?.opcoesSelecionadas || []
      const livres = a.respostas[i.id]?.textosLivres || {}
      const opcoesEfetivas = sel.length ? i.opcoes.filter(o => sel.includes(o.id)) : i.opcoes.filter(o => o.padrao)
      vars[i.variavel] = opcoesEfetivas
        .map(o => {
          const valor = livres[o.id] || ''
          const varsDetalhe: Record<string, string> = { detalhe: valor }
          if (o.variavelDetalhe && o.variavelDetalhe !== 'detalhe') varsDetalhe[o.variavelDetalhe] = valor
          return aplicaVars(o.corpo, varsDetalhe)
        })
        .filter(Boolean).join(', ')
    })
    return {
      empresa: a.empresa || '[EMPRESA]', cnpj: a.cnpj || '[CNPJ]',
      contratante: nomesContratantes(a.contratanteIds) || '[CONTRATANTE]', prazo: fmtD(a.prazo) || '[PRAZO]',
      data: fmtD(a.data), responsavel: a.responsavel || catalog?.config.responsavel || '',
      unidade: c?.unidade || '',
      documentos: joinDocs(a.documentos || []),
      reincidencia: a.reincidencia === 'reincidente' ? 'Reincidente' : a.reincidencia === 'nova' ? 'Nova' : '',
      setoratuacao: joinDocs(a.setoresAtuacao || []),
      email: a.emailDestino || '',
      ...vars,
    }
  }

  /** {{contratante}} dentro do bloco de texto de um item específico de uma só contratante
   *  passa a ser o nome dela, não a lista agregada da análise inteira. */
  function ctxParaItem(ctx: Record<string, string>, item: { id: string; contratanteIds: string[] }, a: AnaliseDados): Record<string, string> {
    let next = ctx
    if (item.contratanteIds.length === 1) {
      const nome = nomeC(getC(item.contratanteIds[0]))
      if (nome) next = { ...next, contratante: nome }
    }
    const r = a.respostas[item.id]
    if (r?.status === 'restricao') {
      next = { ...next, prazorestricao: String(r.prazoRestricaoDias || 60) }
    }
    return next
  }

  /** Observação automática de validade — usa os textos configurados (categoria "validade") por tipo. */
  function buildValidadeObservacao(a: AnaliseDados, baseCtx: Record<string, string>): string {
    if (!catalog) return ''
    const anualBucket = (a.documentos || []).filter((d): d is DocValidavel => a.validades?.[d as DocValidavel]?.tipo === 'anual')
    const persBucket = (a.documentos || []).filter((d): d is DocValidavel => {
      const v = a.validades?.[d as DocValidavel]
      return v?.tipo === 'personalizada' && v.meses <= 23
    })
    const partes: string[] = []
    if (anualBucket.length) {
      const t = getT(catalog.config.validadeAnualId)
      if (t) {
        const txt = aplicaVars(t.corpo, {
          ...baseCtx,
          documentosValidade: joinDocs(anualBucket.map(d => 'o ' + d)),
          verbo: anualBucket.length > 1 ? 'estão' : 'está',
          adjetivo: anualBucket.length > 1 ? 'anuais' : 'anual',
        })
        if (txt.trim()) partes.push(txt)
      }
    }
    if (persBucket.length) {
      const t = getT(catalog.config.validadePersonalizadaId)
      if (t) {
        const meses = Array.from(new Set(persBucket.map(d => a.validades[d]!.meses))).join('/')
        const txt = aplicaVars(t.corpo, {
          ...baseCtx,
          documentosValidade: joinDocs(persBucket.map(d => 'o ' + d)),
          verbo: persBucket.length > 1 ? 'estão' : 'está',
          meses,
        })
        if (txt.trim()) partes.push(txt)
      }
    }
    return partes.join('\n\n')
  }

  /** Observações automáticas por setor de atuação da empresa (categoria "segmento") — entram
   *  no parecer sempre que a análise tiver algum dos setores vinculados àquele texto. */
  function buildSegmentoObservacoes(a: AnaliseDados, baseCtx: Record<string, string>): string {
    if (!catalog || !a.setoresAtuacao?.length) return ''
    const partes: string[] = []
    catalog.textos
      .filter(t => t.categoria === 'segmento' && (t.segmentos ?? []).some(s => a.setoresAtuacao.includes(s)))
      .forEach(t => {
        const txt = aplicaVars(t.corpo, baseCtx)
        if (txt.trim()) partes.push(txt)
      })
    return partes.join('\n\n')
  }

  /** Parecer — só para aprovado / aprovado com restrição. Não conforme não-crítico entra como orientativo (não bloqueia). */
  function buildEmail(a: AnaliseDados) {
    const c = getC(a.contratanteIds[0])
    const itens = itensDaAnalise(a)
    const ctx = ctxDe(a, itens)
    const restricoes = itens.filter(i => a.respostas[i.id]?.status === 'restricao')
    const orientativos = itens.filter(i => !i.critico && a.respostas[i.id]?.status === 'nao')
    const aprovados = itens.filter(i => a.respostas[i.id]?.status === 'ok' && i.textoAprovadoId)
    const observacoes = itens.filter(i => {
      const s = a.respostas[i.id]?.status
      return s === 'restricao' || (!i.critico && s === 'nao') || (s === 'ok' && !!i.textoAprovadoId)
    })
    const marcados = itens.filter(i => a.respostas[i.id]?.status)
    const partes: string[] = []
    partes.push(aplicaVars(getT(c?.aprovadoId || catalog?.config.aprovadoId)?.corpo || '', ctx))
    observacoes.forEach((i, n) => {
      const status = a.respostas[i.id]?.status
      const t = status === 'restricao' ? getT(i.textoRestricaoId) : status === 'ok' ? getT(i.textoAprovadoId) : getT(i.textoLink)
      const obs = a.respostas[i.id]?.obs
      const tag = status === 'restricao' ? ' — APROVADO COM RESTRIÇÃO' : status === 'ok' ? ' — APROVADO' : ' — ORIENTATIVO'
      let bloco = (n + 1) + ') ' + i.documento + ' — ' + i.titulo.toUpperCase() + tag + '\n' +
        aplicaVars(t ? t.corpo : '(sem texto vinculado — cadastre na Biblioteca de textos)', ctxParaItem(ctx, i, a))
      if (obs) bloco += '\nObservação: ' + obs
      partes.push(bloco)
    })
    const obsValidade = buildValidadeObservacao(a, ctx)
    if (obsValidade) partes.push(obsValidade)
    const obsSegmento = buildSegmentoObservacoes(a, ctx)
    if (obsSegmento) partes.push(obsSegmento)
    partes.push(aplicaVars(getT(c?.assinaturaId || catalog?.config.assinaturaId)?.corpo || '', ctx))
    return {
      assunto: aplicaVars(catalog?.config.assunto || '', ctx),
      corpo: partes.filter(Boolean).join('\n\n'),
      restricoes: restricoes.length, orientativos: orientativos.length, aprovados: aprovados.length, criticos: 0, total: itens.length, marcados: marcados.length,
    }
  }

  /** Reprovação — só item crítico marcado como não conforme entra aqui. */
  function buildReprovacao(a: AnaliseDados, criticosReprovados: ItemDaAnalise[]) {
    const c = getC(a.contratanteIds[0])
    const ctx = ctxDe(a, itensDaAnalise(a))
    const plural = criticosReprovados.length > 1
    const linhas = [`Favor rever ${plural ? 'os seguintes itens' : 'o seguinte item'}:`]
    criticosReprovados.forEach((i, n) => {
      const t = getR(i.textoReprovacaoId)
      linhas.push((n + 1) + ' - ' + aplicaVars(t ? t.corpo : '(sem texto de reprovação vinculado — cadastre em Textos de reprovação)', ctxParaItem(ctx, i, a)))
    })
    const corpo = [linhas.join('\n'), aplicaVars(getT(c?.assinaturaId || catalog?.config.assinaturaId)?.corpo || '', ctx)].filter(Boolean).join('\n\n')
    return {
      assunto: 'GT3 · Reprovação de cadastro — ' + ctx.empresa + ' — ' + ctx.contratante,
      corpo,
      restricoes: 0, orientativos: 0, aprovados: 0, criticos: criticosReprovados.length, total: criticosReprovados.length, marcados: criticosReprovados.length,
    }
  }

  const criticosReprovados = useMemo(
    () => (draft ? itensDaAnalise(draft).filter(i => i.critico && draft.respostas[i.id]?.status === 'nao') : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, catalog],
  )
  const modoReprovacao = criticosReprovados.length > 0
  const criticosRestritos = useMemo(
    () => (draft ? itensDaAnalise(draft).filter(i => i.critico && draft.respostas[i.id]?.status === 'restricao') : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, catalog],
  )
  const modoRestricaoCritica = !modoReprovacao && criticosRestritos.length > 0
  const emailBuiltNormal = useMemo(() => (draft ? buildEmail(draft) : null), [draft, catalog]) // eslint-disable-line react-hooks/exhaustive-deps
  const reprovacaoBuilt = useMemo(
    () => (draft && modoReprovacao ? buildReprovacao(draft, criticosReprovados) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, catalog, modoReprovacao, criticosReprovados],
  )
  const emailBuilt = modoReprovacao ? reprovacaoBuilt : emailBuiltNormal
  const emailCorpo = emailEditado ? emailOverride : (emailBuilt?.corpo ?? '')

  // ── análise: navegação / CRUD ──
  function novaAnalise() {
    if (!catalog) return
    setDraftId(null)
    setDraft({
      contratanteIds: [],
      documentos: ['PGR', 'PCMSO'],
      empresa: '', cnpj: '', emailDestino: '',
      data: hoje(), prazo: addDias(catalog.config.prazoDias || 7),
      responsavel: displayName(profile, catalog.config.responsavel || ''),
      reincidencia: '', setoresAtuacao: [],
      respostas: {},
      validades: {},
    })
    setEmailEditado(false)
  }

  function go(v: View) {
    if (v === 'nova' && !draft) novaAnalise()
    if (v === 'textos') setTextosSub('hub')
    setView(v)
  }

  function abrirAnalise(row: AnaliseRow) {
    setDraftId(row.id)
    setDraft(JSON.parse(JSON.stringify(row.dados)))
    setEmailEditado(false)
    setView('nova')
  }

  async function delAnalise(id: string) {
    if (!confirm('Excluir este acompanhamento?')) return
    const res = await fetch(`/api/workflow-programas/${id}`, { method: 'DELETE' })
    if (res.ok) setAnalises(prev => prev.filter(a => a.id !== id))
    else showToast('Sem permissão para excluir')
  }

  async function descartarAnalise() {
    if (!confirm('Descartar esta análise? Todo o preenchimento será perdido.')) return
    if (!confirm('Tem certeza mesmo? Essa ação não pode ser desfeita.')) return
    if (draftId) {
      const res = await fetch(`/api/workflow-programas/${draftId}`, { method: 'DELETE' })
      if (res.ok) setAnalises(prev => prev.filter(a => a.id !== draftId))
      else { showToast('Sem permissão para excluir'); return }
    }
    novaAnalise()
    showToast('Análise descartada')
  }

  async function salvarAnalise() {
    if (!draft || !draft.empresa.trim()) { showToast('Informe a empresa prestadora'); return }
    if (draftId) {
      const res = await fetch(`/api/workflow-programas/${draftId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: draft.empresa, cnpj: draft.cnpj, finalizada: false, dados: draft }),
      })
      const updated: AnaliseRow = await res.json()
      setAnalises(prev => prev.map(a => (a.id === draftId ? updated : a)))
    } else {
      const res = await fetch('/api/workflow-programas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: draft.empresa, cnpj: draft.cnpj, dados: draft }),
      })
      const created: AnaliseRow = await res.json()
      setAnalises(prev => [created, ...prev])
      setDraftId(created.id)
    }
    showToast('Rascunho salvo')
    setView('analises')
  }

  async function finalizarAnalise() {
    if (!draft || !draft.empresa.trim()) { showToast('Informe a empresa prestadora'); return }
    const itens = itensDaAnalise(draft)
    const semMarcar = itens.filter(i => !draft.respostas[i.id]?.status).length
    if (semMarcar && !confirm(`${semMarcar} item(ns) ainda sem marcação. Finalizar mesmo assim?`)) return
    const dataFinal = hoje()
    let row: AnaliseRow
    if (draftId) {
      const res = await fetch(`/api/workflow-programas/${draftId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: draft.empresa, cnpj: draft.cnpj, finalizada: true, data_final: dataFinal, dados: draft }),
      })
      row = await res.json()
      setAnalises(prev => prev.map(a => (a.id === draftId ? row : a)))
    } else {
      const res = await fetch('/api/workflow-programas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: draft.empresa, cnpj: draft.cnpj, dados: draft }),
      })
      const created: AnaliseRow = await res.json()
      const res2 = await fetch(`/api/workflow-programas/${created.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalizada: true, data_final: dataFinal }),
      })
      row = await res2.json()
      setAnalises(prev => [row, ...prev])
    }
    showToast('Análise finalizada e enviada ao banco de dados')
    novaAnalise()
    setView('nova')
  }

  function limparRespostas() {
    if (!confirm('Limpar todas as respostas desta análise?')) return
    setDraft(prev => (prev ? { ...prev, respostas: {} } : prev))
    setEmailEditado(false)
  }

  function toggleDoc(d: DocKey) {
    setDraft(prev => {
      if (!prev) return prev
      let docs = prev.documentos.includes(d) ? prev.documentos.filter(x => x !== d) : [...prev.documentos, d]
      docs = docs.sort((x, y) => DOC_ORDER.indexOf(x) - DOC_ORDER.indexOf(y))
      if (!docs.length) { showToast('Selecione ao menos um documento'); docs = [d] }
      return { ...prev, documentos: docs }
    })
    setEmailEditado(false)
  }

  function toggleContratante(id: string) {
    setDraft(prev => {
      if (!prev) return prev
      const ids = prev.contratanteIds.includes(id) ? prev.contratanteIds.filter(x => x !== id) : [...prev.contratanteIds, id]
      return { ...prev, contratanteIds: ids }
    })
    setEmailEditado(false)
  }

  function toggleSetorAtuacao(setor: string) {
    setDraft(prev => {
      if (!prev) return prev
      const setores = prev.setoresAtuacao.includes(setor) ? prev.setoresAtuacao.filter(x => x !== setor) : [...prev.setoresAtuacao, setor]
      return { ...prev, setoresAtuacao: setores }
    })
    setEmailEditado(false)
  }

  function toggleDot(itemId: string, val: StatusResp) {
    setDraft(prev => {
      if (!prev) return prev
      const cur = prev.respostas[itemId]?.status
      const status: StatusResp = cur === val ? '' : val
      return { ...prev, respostas: { ...prev.respostas, [itemId]: { ...prev.respostas[itemId], status, obs: prev.respostas[itemId]?.obs || '' } } }
    })
    setEmailEditado(false)
  }

  function setObs(itemId: string, obs: string) {
    setDraft(prev => {
      if (!prev) return prev
      return { ...prev, respostas: { ...prev.respostas, [itemId]: { ...prev.respostas[itemId], status: prev.respostas[itemId]?.status || '', obs } } }
    })
    setEmailEditado(false)
  }

  function setPrazoRestricao(itemId: string, dias: number) {
    setDraft(prev => {
      if (!prev) return prev
      const r = prev.respostas[itemId]
      return { ...prev, respostas: { ...prev.respostas, [itemId]: { ...r, status: r?.status || '', obs: r?.obs || '', prazoRestricaoDias: dias } } }
    })
    setEmailEditado(false)
  }

  function setOpcao(itemId: string, opcaoId: string, multipla: boolean) {
    setDraft(prev => {
      if (!prev) return prev
      const r = prev.respostas[itemId]
      const atual = r?.opcoesSelecionadas || []
      const marcado = atual.includes(opcaoId)
      const next = multipla
        ? (marcado ? atual.filter(id => id !== opcaoId) : [...atual, opcaoId])
        : (marcado ? [] : [opcaoId])
      return { ...prev, respostas: { ...prev.respostas, [itemId]: { status: r?.status || '', obs: r?.obs || '', opcoesSelecionadas: next, textosLivres: r?.textosLivres } } }
    })
    setEmailEditado(false)
  }

  function setOpcaoTexto(itemId: string, opcaoId: string, texto: string) {
    setDraft(prev => {
      if (!prev) return prev
      const r = prev.respostas[itemId]
      return {
        ...prev,
        respostas: {
          ...prev.respostas,
          [itemId]: { status: r?.status || '', obs: r?.obs || '', opcoesSelecionadas: r?.opcoesSelecionadas, textosLivres: { ...r?.textosLivres, [opcaoId]: texto } },
        },
      }
    })
    setEmailEditado(false)
  }

  function setDraftField<K extends keyof AnaliseDados>(k: K, v: AnaliseDados[K]) {
    setDraft(prev => (prev ? { ...prev, [k]: v } : prev))
    setEmailEditado(false)
  }

  function setValidade(doc: DocValidavel, patch: Partial<ValidadeInfo>) {
    setDraft(prev => {
      if (!prev) return prev
      const atual = prev.validades?.[doc] ?? { tipo: 'bienal' as ValidadeTipo, meses: 24 }
      return { ...prev, validades: { ...prev.validades, [doc]: { ...atual, ...patch } } }
    })
    setEmailEditado(false)
  }

  function baixarEml() {
    if (!draft || !emailBuilt) return
    const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
    const eml = [
      'To: ' + (draft.emailDestino || ''), 'Subject: =?UTF-8?B?' + b64(emailBuilt.assunto) + '?=',
      'X-Unsent: 1', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', emailCorpo,
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([eml], { type: 'message/rfc822' }))
    const el = document.createElement('a')
    el.href = url
    el.download = ('SST - ' + (draft.empresa || 'empresa')).replace(/[\\/:*?"<>|]/g, '') + '.eml'
    el.click(); URL.revokeObjectURL(url)
    showToast('Arquivo .eml gerado')
  }

  function abrirMailto() {
    if (!draft || !emailBuilt) return
    location.href = 'mailto:' + (draft.emailDestino || '') + '?subject=' + encodeURIComponent(emailBuilt.assunto) + '&body=' + encodeURIComponent(emailCorpo)
  }

  // ── banco de dados ──
  function statusAnalise(row: AnaliseRow): { t: string; c: 'ok' | 'no' | 'na' | 'acc' | 'default'; k: string } {
    const itens = itensDaAnalise(row.dados)
    const criticosNao = itens.filter(i => i.critico && row.dados.respostas[i.id]?.status === 'nao').length
    const restr = itens.filter(i => row.dados.respostas[i.id]?.status === 'restricao').length
    const orientativos = itens.filter(i => !i.critico && row.dados.respostas[i.id]?.status === 'nao').length
    const marc = itens.filter(i => row.dados.respostas[i.id]?.status).length
    if (!marc) return { t: 'Em análise', c: 'na', k: 'analise' }
    if (criticosNao) return { t: criticosNao + ' reprovação(ões)', c: 'no', k: 'reprovada' }
    if (restr || orientativos) {
      const t = [restr ? restr + ' restrição(ões)' : '', orientativos ? orientativos + ' orientativo(s)' : ''].filter(Boolean).join(' · ')
      return { t, c: restr ? 'acc' : 'default', k: restr ? 'restricao' : 'orientativo' }
    }
    return { t: 'Aprovada', c: 'ok', k: 'aprovada' }
  }

  const finalizadas = useMemo(() => analises.filter(a => a.finalizada), [analises])
  const emAndamento = useMemo(() => analises.filter(a => !a.finalizada), [analises])

  const bancoFiltrado = useMemo(() => {
    const q = bancoQ.toLowerCase()
    return finalizadas.filter(a => {
      const d = a.data_final || a.dados.data
      if (q && !((a.empresa || '') + ' ' + (a.cnpj || '')).toLowerCase().includes(q)) return false
      if (bancoContratante && !a.dados.contratanteIds.includes(bancoContratante)) return false
      if (bancoStatus && statusAnalise(a).k !== bancoStatus) return false
      if (bancoDe && (d || '') < bancoDe) return false
      if (bancoAte && (d || '') > bancoAte) return false
      return true
    }).sort((x, y) => ((y.data_final || y.dados.data) || '').localeCompare((x.data_final || x.dados.data) || ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalizadas, bancoQ, bancoContratante, bancoStatus, bancoDe, bancoAte, catalog])

  async function bDel(id: string, nome: string) {
    if (!confirm(`Excluir definitivamente o registro de "${nome || 'sem nome'}"? Todos os dados desta análise serão apagados.`)) return
    const res = await fetch(`/api/workflow-programas/${id}`, { method: 'DELETE' })
    if (res.ok) { setAnalises(prev => prev.filter(a => a.id !== id)); setBancoAberto(null); showToast('Registro excluído') }
    else showToast('Sem permissão para excluir')
  }

  async function bDelFiltro() {
    if (!bancoFiltrado.length) { showToast('Nenhum registro no filtro atual'); return }
    if (!confirm(`Excluir ${bancoFiltrado.length} registro(s)? A ação apaga tudo e não pode ser desfeita.`)) return
    const ids = bancoFiltrado.map(a => a.id)
    await Promise.all(ids.map(id => fetch(`/api/workflow-programas/${id}`, { method: 'DELETE' })))
    setAnalises(prev => prev.filter(a => !ids.includes(a.id)))
    setBancoAberto(null)
    showToast(`${ids.length} registro(s) excluído(s)`)
  }

  async function bReabrir(row: AnaliseRow) {
    const res = await fetch(`/api/workflow-programas/${row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ finalizada: false }),
    })
    const updated: AnaliseRow = await res.json()
    setAnalises(prev => prev.map(a => (a.id === row.id ? updated : a)))
    setDraftId(row.id)
    setDraft(JSON.parse(JSON.stringify(row.dados)))
    setEmailEditado(false)
    showToast('Análise reaberta')
    setView('nova')
  }

  function relatorioItens(lista: AnaliseRow[]) {
    if (!catalog) return []
    return catalog.itens.map(i => {
      let ok = 0, nao = 0, na = 0, restr = 0
      const empresasNao: string[] = [], empresasOk: string[] = []
      lista.forEach(a => {
        const r = a.dados.respostas[i.id]?.status
        if (!r) return
        if (!itensDaAnalise(a.dados).some(x => x.id === i.id)) return
        if (r === 'ok') { ok++; empresasOk.push(a.empresa) }
        else if (r === 'nao') { nao++; empresasNao.push(a.empresa) }
        else if (r === 'restricao') restr++
        else na++
      })
      return { i, ok, nao, na, restr, tot: ok + nao, empresasNao, empresasOk }
    }).filter(l => l.tot + l.na + l.restr > 0).sort((a, b) => b.nao - a.nao)
  }

  function exportarCsv() {
    const lista = bancoFiltrado
    const linhas: string[][] = [['Empresa', 'CNPJ', 'Contratante', 'Documentos', 'Data análise', 'Finalizada', 'Item', 'Documento', 'Resultado', 'Observação']]
    lista.forEach(a => {
      const nomesC = nomesContratantes(a.dados.contratanteIds)
      itensDaAnalise(a.dados).forEach(i => {
        const r = a.dados.respostas[i.id]
        linhas.push([
          a.empresa, a.cnpj, nomesC, (a.dados.documentos || []).join(' '), fmtD(a.dados.data), fmtD(a.data_final || a.dados.data),
          i.titulo, i.documento, ({ ok: 'Conforme', nao: 'Reprovação', na: 'Não aplicável', restricao: 'Aprovado com restrição' } as Record<string, string>)[r?.status || ''] || 'Não avaliado', r?.obs || '',
        ])
      })
    })
    const csv = '﻿' + linhas.map(l => l.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const el = document.createElement('a')
    el.href = url; el.download = 'gt3-banco-pgr-pcmso.csv'; el.click(); URL.revokeObjectURL(url)
    showToast('CSV exportado')
  }

  // ── catálogo: contratantes ──
  function novaContratanteModal() {
    if (!catalog) return
    setModalContratanteNovo(true)
    setModalContratante({
      id: uid('c'), nome: '', unidade: '', email: '', prazoDias: catalog.config.prazoDias, obs: '',
      aberturaId: catalog.config.aberturaId, fechamentoId: catalog.config.fechamentoId,
      assinaturaId: catalog.config.assinaturaId, aprovadoId: catalog.config.aprovadoId,
      itens: catalog.itens.filter(i => i.escopo === 'base').map(i => ({ itemId: i.id, textoId: null })),
    })
  }
  function editarContratanteModal(c: Contratante) {
    setModalContratanteNovo(false)
    setModalContratante(JSON.parse(JSON.stringify(c)))
  }
  function salvarContratanteModal() {
    if (!catalog || !modalContratante) return
    if (!modalContratante.nome.trim()) { showToast('Informe o nome da contratante'); return }
    const next = { ...catalog }
    if (modalContratanteNovo) next.contratantes = [...catalog.contratantes, modalContratante]
    else next.contratantes = catalog.contratantes.map(c => (c.id === modalContratante.id ? modalContratante : c))
    persistCatalog(next)
    setModalContratante(null)
    showToast('Contratante salva')
  }
  function delContratante(id: string) {
    if (!catalog || !confirm('Excluir contratante?')) return
    persistCatalog({ ...catalog, contratantes: catalog.contratantes.filter(c => c.id !== id) })
  }
  function criarItemInline(titulo: string, documento: DocKey, textoId: string) {
    if (!catalog || !modalContratante) return
    const novo: ChecklistItem = {
      id: uid('i'), titulo, documento, descricao: 'Exigência específica da contratante.', escopo: 'especifico', textoId, critico: false,
      textoReprovacaoId: '', statusOptions: [...DEFAULT_STATUS_OPTIONS], textoRestricaoId: '', textoAprovadoId: '', condicaoItemId: '', condicaoValor: '',
      tipo: 'status', multiplaEscolha: false, opcoes: [], variavel: '',
    }
    const nextCatalog = { ...catalog, itens: [...catalog.itens, novo] }
    setCatalog(nextCatalog)
    fetch('/api/workflow-programas/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dados: nextCatalog }) }).catch(() => {})
    setModalContratante(prev => (prev ? { ...prev, itens: [...prev.itens, { itemId: novo.id, textoId: null }] } : prev))
    showToast('Item criado e vinculado')
  }

  // ── catálogo: itens ──
  function novoItemModal() {
    setModalItemNovo(true)
    setModalItemEdit({
      id: uid('i'), titulo: '', documento: 'PGR', descricao: '', escopo: 'base', textoId: '', critico: false,
      textoReprovacaoId: '', statusOptions: [...DEFAULT_STATUS_OPTIONS], textoRestricaoId: '', textoAprovadoId: '', condicaoItemId: '', condicaoValor: '',
      tipo: 'status', multiplaEscolha: false, opcoes: [], variavel: '',
    })
  }
  function editarItemModal(i: ChecklistItem) { setModalItemNovo(false); setModalItemEdit({ ...i }) }
  function salvarItemModal() {
    if (!catalog || !modalItemEdit) return
    if (!modalItemEdit.titulo.trim()) { showToast('Informe o título do item'); return }
    if (modalItemEdit.condicaoItemId && !modalItemEdit.condicaoValor) { showToast('Selecione o valor exigido da condição'); return }
    if (modalItemEdit.tipo === 'opcoes') {
      if (!modalItemEdit.variavel.trim()) { showToast('Informe o nome da variável'); return }
      if (!modalItemEdit.opcoes.length || modalItemEdit.opcoes.some(o => !o.label.trim())) { showToast('Cadastre ao menos uma opção com rótulo'); return }
    }
    const next = { ...catalog }
    if (modalItemNovo) {
      next.itens = [...catalog.itens, modalItemEdit]
      if (modalItemEdit.escopo === 'base') next.contratantes = catalog.contratantes.map(c => ({ ...c, itens: [...c.itens, { itemId: modalItemEdit.id, textoId: null }] }))
    } else {
      next.itens = catalog.itens.map(i => (i.id === modalItemEdit.id ? modalItemEdit : i))
    }
    persistCatalog(next)
    setModalItemEdit(null)
    showToast('Item salvo')
  }
  function delItem(id: string) {
    if (!catalog || !confirm('Excluir item? Ele sairá de todas as contratantes.')) return
    persistCatalog({
      ...catalog,
      itens: catalog.itens.filter(i => i.id !== id),
      contratantes: catalog.contratantes.map(c => ({ ...c, itens: c.itens.filter(l => l.itemId !== id) })),
    })
  }

  // ── catálogo: textos ──
  const CATS: Record<CategoriaTexto, string> = { aprovacao: 'Aprovação', abertura: 'Abertura', apontamento: 'Apontamento', fechamento: 'Fechamento', assinatura: 'Assinatura', restricao: 'Restrição', validade: 'Validade', segmento: 'Segmento' }
  function novoTextoModal(categoriaPadrao: CategoriaTexto = 'apontamento') { setModalTextoNovo(true); setModalTextoEdit({ id: uid('t'), titulo: '', categoria: categoriaPadrao, corpo: '' }) }
  function editarTextoModal(t: TextoEmail) { setModalTextoNovo(false); setModalTextoEdit({ ...t }) }
  function salvarTextoModal() {
    if (!catalog || !modalTextoEdit) return
    if (!modalTextoEdit.titulo.trim()) { showToast('Informe o título'); return }
    const next = { ...catalog }
    next.textos = modalTextoNovo ? [...catalog.textos, modalTextoEdit] : catalog.textos.map(t => (t.id === modalTextoEdit.id ? modalTextoEdit : t))
    if (pendingLink && pendingLink.campo !== 'textoReprovacaoId') {
      next.itens = catalog.itens.map(i => (i.id === pendingLink.itemId ? { ...i, [pendingLink.campo]: modalTextoEdit.id } : i))
    }
    persistCatalog(next)
    setModalTextoEdit(null)
    showToast(pendingLink ? 'Texto criado e vinculado ao item' : 'Texto salvo')
    setPendingLink(null)
  }
  function delTexto(id: string) {
    if (!catalog || !confirm('Excluir texto?')) return
    persistCatalog({ ...catalog, textos: catalog.textos.filter(t => t.id !== id) })
    const orfaos = anexos.filter(a => a.texto_id === id)
    orfaos.forEach(a => { fetch(`/api/workflow-programas/anexos/${a.id}`, { method: 'DELETE' }).catch(() => {}) })
    if (orfaos.length) setAnexos(prev => prev.filter(a => a.texto_id !== id))
  }

  // ── anexos dos pareceres (textos) ──
  async function uploadAnexo(textoId: string, file: File) {
    const form = new FormData()
    form.append('file', file)
    form.append('texto_id', textoId)
    const res = await fetch('/api/workflow-programas/anexos', { method: 'POST', body: form })
    if (!res.ok) { showToast('Erro ao enviar anexo'); return }
    const created: Anexo = await res.json()
    setAnexos(prev => [...prev, created])
    showToast('Anexo adicionado')
  }
  async function delAnexo(id: string) {
    if (!confirm('Excluir este anexo?')) return
    const res = await fetch(`/api/workflow-programas/anexos/${id}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Erro ao excluir anexo'); return }
    setAnexos(prev => prev.filter(a => a.id !== id))
  }
  async function baixarAnexo(id: string) {
    const res = await fetch(`/api/workflow-programas/anexos/${id}/url`)
    if (!res.ok) { showToast('Erro ao baixar anexo'); return }
    const { url } = await res.json()
    window.open(url, '_blank')
  }

  // ── catálogo: textos de reprovação ──
  function novoReprovacaoModal(documentoPadrao: DocKey = 'PGR') { setModalReprovacaoNovo(true); setModalReprovacaoEdit({ id: uid('r'), titulo: '', documento: documentoPadrao === 'GERAL' ? 'PGR' : documentoPadrao, escopo: 'base', corpo: '' }) }
  function editarReprovacaoModal(r: TextoReprovacao) { setModalReprovacaoNovo(false); setModalReprovacaoEdit({ ...r }) }
  function salvarReprovacaoModal() {
    if (!catalog || !modalReprovacaoEdit) return
    if (!modalReprovacaoEdit.titulo.trim()) { showToast('Informe o título'); return }
    const next = { ...catalog }
    next.textosReprovacao = modalReprovacaoNovo
      ? [...catalog.textosReprovacao, modalReprovacaoEdit]
      : catalog.textosReprovacao.map(r => (r.id === modalReprovacaoEdit.id ? modalReprovacaoEdit : r))
    if (pendingLink && pendingLink.campo === 'textoReprovacaoId') {
      next.itens = catalog.itens.map(i => (i.id === pendingLink.itemId ? { ...i, textoReprovacaoId: modalReprovacaoEdit.id } : i))
    }
    persistCatalog(next)
    setModalReprovacaoEdit(null)
    showToast(pendingLink ? 'Texto criado e vinculado ao item' : 'Texto de reprovação salvo')
    setPendingLink(null)
  }
  function delReprovacao(id: string) {
    if (!catalog || !confirm('Excluir texto de reprovação? Itens críticos vinculados a ele ficarão sem texto.')) return
    persistCatalog({
      ...catalog,
      textosReprovacao: catalog.textosReprovacao.filter(r => r.id !== id),
      itens: catalog.itens.map(i => (i.textoReprovacaoId === id ? { ...i, textoReprovacaoId: '' } : i)),
    })
  }

  // ── inspetor de texto (a partir de "Itens de checklist") ──
  function abrirTexto(item: ChecklistItem, campo: InspectorCampo) {
    const id = item[campo]
    if (id) { setInspecionar({ item, campo }); return }
    setPendingLink({ itemId: item.id, campo })
    if (campo === 'textoReprovacaoId') {
      setTextosSub('reprovacao')
      setView('textos')
      novoReprovacaoModal(item.documento)
    } else {
      setTextosSub(CAMPO_INFO[campo].categoria!)
      setView('textos')
      novoTextoModal(CAMPO_INFO[campo].categoria!)
    }
  }
  function abrirDoInspector() {
    if (!inspecionar) return
    const { item, campo } = inspecionar
    if (campo === 'textoReprovacaoId') {
      const r = getR(item.textoReprovacaoId)
      setTextosSub('reprovacao')
      setView('textos')
      if (r) editarReprovacaoModal(r)
    } else {
      const t = getT(item[campo])
      setTextosSub(CAMPO_INFO[campo].categoria!)
      setView('textos')
      if (t) editarTextoModal(t)
    }
    setInspecionar(null)
  }

  // ── config ──
  function salvarConfig(patch: Partial<CatalogConfig>) {
    if (!catalog) return
    persistCatalog({ ...catalog, config: { ...catalog.config, ...patch } })
    showToast('Padrões salvos')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading || !catalog) return <div style={{ padding: 40, textAlign: 'center', color: MU }}>Carregando…</div>

  const MENU: { g?: string; k?: View; t?: string; i?: string }[] = [
    { g: 'Operação' },
    { k: 'analises', t: 'Em andamento', i: '📋' },
    { k: 'nova', t: 'Nova análise', i: '✚' },
    { k: 'banco', t: 'Banco de dados', i: '🗄️' },
    { g: 'Bases' },
    { k: 'contratantes', t: 'Contratantes', i: '🏭' },
    { k: 'itens', t: 'Itens de checklist', i: '☑️' },
    { k: 'textos', t: 'Textos', i: '✉️' },
    { g: 'Sistema' },
    { k: 'config', t: 'Configurações', i: '⚙️' },
  ]

  return (
    <div style={{ padding: '24px 28px 60px', maxWidth: 1400, margin: '0 auto', fontFamily: 'inherit', color: TX }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100, background: TX, color: '#fff', padding: '11px 20px', borderRadius: 8, fontSize: 13.5, boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 3px', fontSize: 21, fontWeight: 700 }}>Workflow Programas</h1>
        <p style={{ margin: 0, color: MU, fontSize: 13 }}>Acompanhamento de análise documental PGR / PCMSO / LTCAT por contratante.</p>
      </div>

      {/* sub-nav */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, alignItems: 'center' }}>
        {MENU.map((m, idx) => m.g ? (
          <span key={idx} style={{ fontSize: 10.5, letterSpacing: '.1em', color: MU, textTransform: 'uppercase', padding: '0 8px', marginLeft: idx ? 8 : 0 }}>{m.g}</span>
        ) : (
          <button key={idx} onClick={() => go(m.k as View)} style={{
            border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
            background: view === m.k ? P : '#fff', color: view === m.k ? '#fff' : TX,
            fontWeight: view === m.k ? 600 : 400, boxShadow: view === m.k ? 'none' : `inset 0 0 0 1px ${LINE}`,
          }}>
            <span style={{ marginRight: 6 }}>{m.i}</span>{m.t}
          </button>
        ))}
      </div>

      {view === 'analises' && (
        <VAnalises lista={emAndamento} nomesContratantes={nomesContratantes} statusAnalise={statusAnalise} onNova={() => go('nova')} onAbrir={abrirAnalise} onDel={delAnalise} />
      )}

      {view === 'nova' && draft && (
        <VAnalise
          draft={draft} draftId={draftId} catalog={catalog} emailCorpo={emailCorpo} emailBuilt={emailBuilt} modoReprovacao={modoReprovacao} modoRestricaoCritica={modoRestricaoCritica}
          itensDaAnalise={itensDaAnalise} getT={getT} getR={getR} nomeC={nomeC} nomesContratantes={nomesContratantes} anexos={anexos}
          onField={setDraftField} onToggleDoc={toggleDoc} onToggleContratante={toggleContratante} onToggleSetor={toggleSetorAtuacao} onDot={toggleDot} onObs={setObs} onPrazoRestricao={setPrazoRestricao} onOpcao={setOpcao} onOpcaoTexto={setOpcaoTexto} onValidade={setValidade}
          onLimpar={limparRespostas} onSalvar={salvarAnalise} onFinalizar={finalizarAnalise} onDescartar={descartarAnalise}
          onEmailChange={(v) => { setEmailOverride(v); setEmailEditado(true) }}
          onCopiar={() => { navigator.clipboard.writeText(emailCorpo); showToast('E-mail copiado') }}
          onEml={baixarEml} onMailto={abrirMailto}
          onRegerar={() => { setEmailEditado(false); showToast('E-mail regerado') }}
          onBaixarAnexo={baixarAnexo}
        />
      )}

      {view === 'banco' && (
        <VBanco
          aba={bancoAba} setAba={setBancoAba} q={bancoQ} setQ={setBancoQ}
          contratante={bancoContratante} setContratante={setBancoContratante}
          status={bancoStatus} setStatus={setBancoStatus} de={bancoDe} setDe={setBancoDe} ate={bancoAte} setAte={setBancoAte}
          aberto={bancoAberto} setAberto={setBancoAberto} itemAberto={bancoItem} setItemAberto={setBancoItem}
          lista={bancoFiltrado} catalog={catalog} nomeC={nomeC} nomesContratantes={nomesContratantes} itensDaAnalise={itensDaAnalise}
          statusAnalise={statusAnalise} relatorioItens={relatorioItens}
          onLimparFiltros={() => { setBancoQ(''); setBancoContratante(''); setBancoStatus(''); setBancoDe(''); setBancoAte('') }}
          onDelFiltro={bDelFiltro} onExportCsv={exportarCsv} onDel={bDel} onReabrir={bReabrir}
        />
      )}

      {view === 'contratantes' && (
        <VContratantes catalog={catalog} getI={getI} onNovo={novaContratanteModal} onEditar={editarContratanteModal} onDel={delContratante} />
      )}

      {view === 'itens' && (
        <VItens catalog={catalog} getT={getT} getR={getR} onNovo={novoItemModal} onEditar={editarItemModal} onDel={delItem} onAbrirTexto={abrirTexto} />
      )}

      {view === 'textos' && textosSub === 'hub' && (
        <VTextosHub catalog={catalog} onAbrir={setTextosSub} />
      )}
      {view === 'textos' && textosSub === 'aprovacao' && (
        <div>
          <Btn small variant="gho" onClick={() => setTextosSub('hub')}>← Textos</Btn>
          <div style={{ marginTop: 10 }}>
            <VTextos catalog={catalog} CATS={{ aprovacao: 'Aprovação' }} onNovo={() => novoTextoModal('aprovacao')} onEditar={editarTextoModal} onDel={delTexto} />
          </div>
        </div>
      )}
      {view === 'textos' && textosSub === 'apontamento' && (
        <div>
          <Btn small variant="gho" onClick={() => setTextosSub('hub')}>← Textos</Btn>
          <div style={{ marginTop: 10 }}>
            <VTextos
              catalog={catalog}
              CATS={{ abertura: 'Abertura', apontamento: 'Apontamento', fechamento: 'Fechamento', assinatura: 'Assinatura' }}
              onNovo={() => novoTextoModal('apontamento')} onEditar={editarTextoModal} onDel={delTexto}
            />
          </div>
        </div>
      )}
      {view === 'textos' && textosSub === 'restricao' && (
        <div>
          <Btn small variant="gho" onClick={() => setTextosSub('hub')}>← Textos</Btn>
          <div style={{ marginTop: 10 }}>
            <VTextos catalog={catalog} CATS={{ restricao: 'Aprovação com restrição' }} onNovo={() => novoTextoModal('restricao')} onEditar={editarTextoModal} onDel={delTexto} />
          </div>
        </div>
      )}
      {view === 'textos' && textosSub === 'reprovacao' && (
        <div>
          <Btn small variant="gho" onClick={() => setTextosSub('hub')}>← Textos</Btn>
          <div style={{ marginTop: 10 }}>
            <VReprovacao catalog={catalog} onNovo={novoReprovacaoModal} onEditar={editarReprovacaoModal} onDel={delReprovacao} />
          </div>
        </div>
      )}
      {view === 'textos' && textosSub === 'validade' && (
        <div>
          <Btn small variant="gho" onClick={() => setTextosSub('hub')}>← Textos</Btn>
          <div style={{ marginTop: 10 }}>
            <VTextos catalog={catalog} CATS={{ validade: 'Validade' }} onNovo={() => novoTextoModal('validade')} onEditar={editarTextoModal} onDel={delTexto} />
          </div>
        </div>
      )}
      {view === 'textos' && textosSub === 'segmento' && (
        <div>
          <Btn small variant="gho" onClick={() => setTextosSub('hub')}>← Textos</Btn>
          <div style={{ marginTop: 10 }}>
            <VTextos catalog={catalog} CATS={{ segmento: 'Segmento' }} onNovo={() => novoTextoModal('segmento')} onEditar={editarTextoModal} onDel={delTexto} />
          </div>
        </div>
      )}

      {view === 'config' && (
        <VConfig config={catalog.config} textos={catalog.textos} onSalvar={salvarConfig} />
      )}

      {/* ── Modal: Contratante ── */}
      {modalContratante && (
        <ContratanteModal
          draft={modalContratante} catalog={catalog} novo={modalContratanteNovo}
          onChange={setModalContratante} onSave={salvarContratanteModal} onClose={() => setModalContratante(null)}
          onCriarItem={criarItemInline}
        />
      )}

      {/* ── Modal: Item ── */}
      {modalItemEdit && (
        <ItemModal draft={modalItemEdit} catalog={catalog} novo={modalItemNovo} onChange={setModalItemEdit} onSave={salvarItemModal} onClose={() => setModalItemEdit(null)} />
      )}

      {/* ── Modal: Texto ── */}
      {modalTextoEdit && (
        <TextoModal
          draft={modalTextoEdit} novo={modalTextoNovo} CATS={CATS} onChange={setModalTextoEdit} onSave={salvarTextoModal} onClose={() => { setModalTextoEdit(null); setPendingLink(null) }}
          anexos={anexos.filter(a => a.texto_id === modalTextoEdit.id)} onUpload={uploadAnexo} onDelAnexo={delAnexo} onBaixarAnexo={baixarAnexo}
        />
      )}

      {modalReprovacaoEdit && (
        <ReprovacaoModal draft={modalReprovacaoEdit} novo={modalReprovacaoNovo} onChange={setModalReprovacaoEdit} onSave={salvarReprovacaoModal} onClose={() => { setModalReprovacaoEdit(null); setPendingLink(null) }} />
      )}

      {inspecionar && (
        <InspectorPanel
          item={inspecionar.item} campo={inspecionar.campo}
          texto={inspecionar.campo === 'textoReprovacaoId' ? getR(inspecionar.item.textoReprovacaoId) : getT(inspecionar.item[inspecionar.campo])}
          onAbrir={abrirDoInspector} onClose={() => setInspecionar(null)}
        />
      )}
    </div>
  )
}

// ─── Modal shell ────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, onSave, saveLabel = 'Salvar', children, wide = false }: {
  title: string; onClose: () => void; onSave: () => void; saveLabel?: string; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflow: 'auto', zIndex: 9999 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: wide ? 900 : 640, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 16 }}>{title}</b>
          <button onClick={onClose} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: MU, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', maxHeight: '66vh', overflow: 'auto' }}>{children}</div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="pri" onClick={onSave}>{saveLabel}</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── View: Em andamento ─────────────────────────────────────────────────────

function VAnalises({ lista, nomesContratantes, statusAnalise, onNova, onAbrir, onDel }: {
  lista: AnaliseRow[]; nomesContratantes: (ids: string[]) => string
  statusAnalise: (r: AnaliseRow) => { t: string; c: 'ok' | 'no' | 'na' | 'acc' | 'default'; k: string }
  onNova: () => void; onAbrir: (r: AnaliseRow) => void; onDel: (id: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13, color: MU }}>Análises em andamento — as finalizadas ficam no Banco de dados.</div>
        <Btn variant="pri" onClick={onNova}>✚ Nova análise</Btn>
      </div>
      {!lista.length ? (
        <Empty title="Nenhuma análise em andamento" sub="Crie uma nova para começar o checklist." />
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Empresa prestadora', 'Contratante', 'Documentos', 'Análise', 'Situação', ''].map((h, i) => (
                    <th key={i} style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: MU, textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.slice().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).map(a => {
                  const s = statusAnalise(a)
                  return (
                    <tr key={a.id}>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                        <b>{a.empresa || '(sem nome)'}</b>
                        <div style={{ color: MU, fontSize: 12 }}>{a.cnpj}</div>
                      </td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{nomesContratantes(a.dados.contratanteIds)}</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                        {(a.dados.documentos || []).map(d => <span key={d} style={{ marginRight: 4 }}><Tag>{d}</Tag></span>)}
                      </td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                        {fmtD(a.dados.data)}<div style={{ color: MU, fontSize: 12 }}>prazo {fmtD(a.dados.prazo)}</div>
                      </td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone={s.c}>{s.t}</Tag></td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}`, textAlign: 'right' }}>
                        <Btn small onClick={() => onAbrir(a)}>Abrir</Btn>{' '}
                        <Btn small variant="gho" onClick={() => onDel(a.id)}>Excluir</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── View: Nova análise (checklist + e-mail) ────────────────────────────────

function VAnalise({ draft, catalog, emailCorpo, emailBuilt, modoReprovacao, modoRestricaoCritica, itensDaAnalise, getT, getR, nomeC, nomesContratantes, anexos, onField, onToggleDoc, onToggleContratante, onToggleSetor, onDot, onObs, onPrazoRestricao, onOpcao, onOpcaoTexto, onValidade, onLimpar, onSalvar, onFinalizar, onDescartar, onEmailChange, onCopiar, onEml, onMailto, onRegerar, onBaixarAnexo }: {
  draft: AnaliseDados; draftId: string | null; catalog: Catalog
  emailCorpo: string; emailBuilt: { assunto: string; corpo: string; restricoes: number; orientativos: number; aprovados: number; criticos: number; total: number; marcados: number } | null; modoReprovacao: boolean; modoRestricaoCritica: boolean
  itensDaAnalise: (a: AnaliseDados) => ItemDaAnalise[]
  getT: (id?: string | null) => TextoEmail | undefined; getR: (id?: string | null) => TextoReprovacao | undefined; nomeC: (c?: Contratante) => string
  nomesContratantes: (ids: string[]) => string
  anexos: Anexo[]
  onField: <K extends keyof AnaliseDados>(k: K, v: AnaliseDados[K]) => void
  onToggleDoc: (d: DocKey) => void; onToggleContratante: (id: string) => void; onToggleSetor: (setor: string) => void
  onDot: (itemId: string, val: StatusResp) => void; onObs: (itemId: string, obs: string) => void
  onPrazoRestricao: (itemId: string, dias: number) => void
  onOpcao: (itemId: string, opcaoId: string, multipla: boolean) => void
  onOpcaoTexto: (itemId: string, opcaoId: string, texto: string) => void
  onValidade: (doc: DocValidavel, patch: Partial<ValidadeInfo>) => void
  onLimpar: () => void; onSalvar: () => void; onFinalizar: () => void; onDescartar: () => void
  onEmailChange: (v: string) => void; onCopiar: () => void; onEml: () => void; onMailto: () => void; onRegerar: () => void
  onBaixarAnexo: (id: string) => void
}) {
  const itens = itensDaAnalise(draft)
  const itensStatus = itens.filter(i => i.tipo !== 'opcoes')
  const grupos = DOC_ORDER.filter(d => itens.some(i => i.documento === d))
  const camposFaltando = (catalog.config.camposObrigatorios ?? []).filter(key => campoAnaliseVazio(draft, key))
  const campoObrigatorioVazio = (key: string) => (catalog.config.camposObrigatorios ?? []).includes(key) && campoAnaliseVazio(draft, key)
  const redStyle = (vazio: boolean): React.CSSProperties => (vazio ? { border: `1px solid ${NO}`, background: NOS } : {})
  const ok = itensStatus.filter(i => draft.respostas[i.id]?.status === 'ok').length
  const restr = itensStatus.filter(i => draft.respostas[i.id]?.status === 'restricao').length
  const na = itensStatus.filter(i => draft.respostas[i.id]?.status === 'na').length
  const textoIdsRelevantes = new Set<string>()
  itens.forEach(i => {
    const s = draft.respostas[i.id]?.status
    if (s === 'nao' && i.textoLink) textoIdsRelevantes.add(i.textoLink)
    else if (s === 'restricao' && i.textoRestricaoId) textoIdsRelevantes.add(i.textoRestricaoId)
  })
  const anexosSugeridos = anexos.filter(a => textoIdsRelevantes.has(a.texto_id))
  const apl = itensStatus.length - na
  const pct = apl ? Math.round((ok + restr) / apl * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: MU }}>Marque cada item — item crítico marcado como reprovação já reprova o cadastro; os demais entram como orientativo ou restrição no parecer.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="gho" onClick={onLimpar}>Limpar respostas</Btn>
          <Btn onClick={onSalvar}>💾 Salvar rascunho</Btn>
          <Btn variant="danger" onClick={onDescartar}>🗑 Descartar análise</Btn>
          <Btn variant="acc" onClick={onFinalizar}>✔ Finalizar análise</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 430px', gap: 16, alignItems: 'start' }}>
        <div>
          <Card style={{ padding: '16px 18px', marginBottom: 14 }}>
            <Field label="Empresa prestadora"><input style={{ ...inputStyle, ...redStyle(campoObrigatorioVazio('empresa')) }} value={draft.empresa} onChange={e => onField('empresa', e.target.value)} placeholder="Razão social" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 12 }}>
              <Field label="E-mail de destino"><input style={{ ...inputStyle, ...redStyle(campoObrigatorioVazio('emailDestino')) }} type="email" value={draft.emailDestino} onChange={e => onField('emailDestino', e.target.value)} placeholder="contato@empresa.com.br" /></Field>
              <Field label="Data da análise"><input style={{ ...inputStyle, ...redStyle(campoObrigatorioVazio('data')) }} type="date" value={draft.data} onChange={e => onField('data', e.target.value)} /></Field>
              <Field label="Analista"><input style={{ ...inputStyle, ...redStyle(campoObrigatorioVazio('responsavel')) }} value={draft.responsavel} onChange={e => onField('responsavel', e.target.value)} /></Field>
              <Field label="Reincidência">
                <select style={{ ...inputStyle, ...redStyle(campoObrigatorioVazio('reincidencia')) }} value={draft.reincidencia} onChange={e => onField('reincidencia', e.target.value as Reincidencia)}>
                  <option value="">— Selecione —</option>
                  <option value="nova">Nova</option>
                  <option value="reincidente">Reincidente</option>
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Setor(es) de atuação">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '9px 12px', borderRadius: 8, border: `1px solid ${LINE}`, ...redStyle(campoObrigatorioVazio('setoresAtuacao')) }}>
                  {SETORES_ATUACAO.map(s => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: TX, cursor: 'pointer' }}>
                      <input type="checkbox" checked={draft.setoresAtuacao.includes(s)} onChange={() => onToggleSetor(s)} />
                      {s}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
            <div style={{ height: 1, background: LINE, margin: '14px 0' }} />
            <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: MU, marginBottom: 5, fontWeight: 600 }}>
              Contratante(s) {draft.contratanteIds.length > 1 && <span style={{ fontWeight: 400, textTransform: 'none', color: MU }}>— itens específicos de cada uma ficam separados no checklist</span>}
            </label>
            {catalog.contratantes.length === 0 ? (
              <span style={{ color: MU, fontSize: 12.5 }}>Cadastre uma contratante primeiro.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {catalog.contratantes.map(c => {
                  const sel = draft.contratanteIds.includes(c.id)
                  return (
                    <button key={c.id} onClick={() => onToggleContratante(c.id)} style={{
                      border: `1px solid ${P}`, background: sel ? P : '#fff', color: sel ? '#fff' : P,
                      padding: '6px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 12.5, fontWeight: sel ? 600 : 400, fontFamily: 'inherit',
                    }}>{nomeC(c)}</button>
                  )
                })}
              </div>
            )}
            {draft.contratanteIds.length > 0 && (
              <div style={{ fontSize: 11.5, color: MU, marginTop: 6 }}>
                {'{{contratante}}'} nos textos gerais do parecer: <b>{nomesContratantes(draft.contratanteIds)}</b>
              </div>
            )}
            <div style={{ height: 1, background: LINE, margin: '14px 0' }} />
            <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: MU, marginBottom: 5, fontWeight: 600 }}>Documentos analisados</label>
            <div style={{ display: 'inline-flex', border: `1px solid ${P}`, borderRadius: 9, overflow: 'hidden' }}>
              {DOC_TYPES.map((d, i) => (
                <button key={d} onClick={() => onToggleDoc(d)} style={{
                  border: 0, background: draft.documentos.includes(d) ? P : '#fff', color: draft.documentos.includes(d) ? '#fff' : P,
                  padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: draft.documentos.includes(d) ? 600 : 400,
                  borderRight: i < DOC_TYPES.length - 1 ? `1px solid ${P}` : 'none', fontFamily: 'inherit',
                }}>{d}</button>
              ))}
            </div>
            <span style={{ color: MU, fontSize: 12, marginLeft: 10 }}>Itens gerais entram sempre.</span>
            <div style={{ height: 1, background: LINE, margin: '14px 0' }} />
            <div style={{ height: 7, background: LINE, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: OK, transition: 'width .25s' }} />
            </div>
            <div style={{ color: MU, fontSize: 12, marginTop: 6 }}>
              {ok} de {apl} itens conformes ({pct}%){restr ? ' · ' + restr + ' com restrição' : ''} · {na} não aplicáveis
            </div>
          </Card>

          {!draft.contratanteIds.length ? (
            <Empty title="Selecione ao menos uma contratante" sub="O checklist libera assim que uma contratante for indicada acima." />
          ) : camposFaltando.length > 0 ? (
            <Empty
              title="Preencha os campos obrigatórios"
              sub={'Faltam: ' + camposFaltando.map(k => CAMPOS_ANALISE.find(c => c.key === k)?.label || k).join(', ') + ' (destacados em vermelho acima).'}
            />
          ) : !itens.length ? (
            <Empty title="Nenhum item vinculado" sub="Cadastre a contratante e selecione os itens de checklist aplicáveis." />
          ) : grupos.map(d => {
            const g = itens.filter(i => i.documento === d)
            const gStatus = g.filter(i => i.tipo !== 'opcoes')
            const okG = gStatus.filter(i => draft.respostas[i.id]?.status === 'ok').length
            const multi = draft.contratanteIds.length > 1
            const comuns = multi ? g.filter(i => i.contratanteIds.length === draft.contratanteIds.length) : g
            const especificos = multi
              ? draft.contratanteIds
                .map(cid => ({
                  contratanteId: cid,
                  nome: nomeC(catalog.contratantes.find(c => c.id === cid)),
                  itens: g.filter(i => i.contratanteIds.length < draft.contratanteIds.length && i.contratanteIds.includes(cid)),
                }))
                .filter(eg => eg.itens.length > 0)
              : []
            const subheader = (texto: string) => (
              <div style={{ padding: '8px 14px', background: '#FBFCFE', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: MU, fontWeight: 600 }}>{texto}</span>
              </div>
            )
            const renderItem = (i: ItemDaAnalise, idx: number, arr: ItemDaAnalise[]) => {
                  if (i.tipo === 'opcoes') {
                    const respondido = draft.respostas[i.id]?.opcoesSelecionadas
                    const selecionadas = respondido && respondido.length ? respondido : i.opcoes.filter(o => o.padrao).map(o => o.id)
                    return (
                      <div key={i.id} style={{ padding: '12px 14px', borderBottom: idx < arr.length - 1 ? '1px solid #F0F3F8' : undefined }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {i.titulo}
                          {multi && i.contratanteIds.length < draft.contratanteIds.length ? (
                            <Tag tone="acc">{i.contratanteIds.map(cid => nomeC(catalog.contratantes.find(c => c.id === cid))).join(', ')}</Tag>
                          ) : i.escopo === 'especifico' ? (
                            <Tag tone="acc">exigência da contratante</Tag>
                          ) : null}
                          <Tag>{'{{' + (i.variavel || '?') + '}}'}</Tag>
                        </div>
                        <div style={{ fontSize: 12.5, color: MU, marginTop: 2 }}>{i.descricao}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          {i.opcoes.map(o => {
                            const sel = selecionadas.includes(o.id)
                            return (
                              <button key={o.id} onClick={() => onOpcao(i.id, o.id, i.multiplaEscolha)} style={{
                                padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${sel ? P : LINE}`,
                                background: sel ? P : '#fff', color: sel ? '#fff' : TX, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: sel ? 600 : 400,
                              }}>{o.label || '(sem rótulo)'}</button>
                            )
                          })}
                          {!i.opcoes.length && <span style={{ fontSize: 12, color: MU }}>Nenhuma opção cadastrada neste item.</span>}
                        </div>
                        {i.opcoes.filter(o => o.pedirTexto && selecionadas.includes(o.id)).map(o => (
                          <input key={o.id} style={{ ...inputStyle, marginTop: 8, fontSize: 12.5, padding: '6px 9px' }}
                            placeholder={o.placeholder || `Detalhe de "${o.label}"`}
                            value={draft.respostas[i.id]?.textosLivres?.[o.id] || ''}
                            onChange={e => onOpcaoTexto(i.id, o.id, e.target.value)} />
                        ))}
                      </div>
                    )
                  }
                  const r = draft.respostas[i.id] || { status: '' as StatusResp, obs: '' }
                  const t = getT(i.textoLink)
                  const tRestr = getT(i.textoRestricaoId)
                  const tAprov = getT(i.textoAprovadoId)
                  const bg = r.status === 'nao' ? '#FEF8F8' : r.status === 'ok' ? '#F8FDFA' : r.status === 'restricao' ? ASO : undefined
                  const opcoesStatus = i.statusOptions?.length ? i.statusOptions : DEFAULT_STATUS_OPTIONS
                  const dots = ALL_DOTS.filter(dd => opcoesStatus.includes(dd.val))
                  return (
                    <div key={i.id} style={{ display: 'flex', gap: 14, padding: '12px 14px', borderBottom: idx < arr.length - 1 ? '1px solid #F0F3F8' : undefined, alignItems: 'flex-start', background: bg }}>
                      <div style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
                        {dots.map(dd => {
                          const on = r.status === dd.val
                          const glow = dd.val === 'ok' ? OKS : dd.val === 'nao' ? NOS : dd.val === 'restricao' ? ASO : NAS
                          return (
                            <button key={dd.val} title={dd.label} onClick={() => onDot(i.id, dd.val)} style={{
                              width: 26, height: 26, borderRadius: '50%', border: `2px solid ${on ? dd.on : P}`, background: on ? dd.on : '#fff',
                              cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: on ? dd.onFg : '#A8B7D2',
                              boxShadow: on ? `0 0 0 3px ${glow}` : '0 1px 2px rgba(42,79,150,.14)',
                            }}>{dd.symbol}</button>
                          )
                        })}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {i.titulo}
                          {i.critico && <Tag tone="no">crítico</Tag>}
                          {multi && i.contratanteIds.length < draft.contratanteIds.length ? (
                            <Tag tone="acc">{i.contratanteIds.map(cid => nomeC(catalog.contratantes.find(c => c.id === cid))).join(', ')}</Tag>
                          ) : i.escopo === 'especifico' ? (
                            <Tag tone="acc">exigência da contratante</Tag>
                          ) : null}
                          {opcoesStatus.includes('nao') && !t && <Tag tone="no">sem texto vinculado</Tag>}
                          {opcoesStatus.includes('restricao') && !tRestr && <Tag tone="acc">sem texto de restrição</Tag>}
                        </div>
                        <div style={{ fontSize: 12.5, color: MU, marginTop: 2 }}>{i.descricao}</div>
                        {r.status === 'ok' && !!i.textoAprovadoId && (
                          <div style={{ marginTop: 6, fontSize: 12, color: OK }}>
                            ✅ Destaque no parecer: {tAprov?.titulo}
                          </div>
                        )}
                        {r.status === 'nao' && i.critico && (
                          <div style={{ marginTop: 6, fontSize: 12, color: NO }}>
                            🚫 Reprovação: {getR(i.textoReprovacaoId)?.titulo || 'sem texto de reprovação vinculado — cadastre em Textos de reprovação'}
                          </div>
                        )}
                        {r.status === 'nao' && !i.critico && (
                          <div style={{ marginTop: 6, fontSize: 12, color: MU }}>
                            📝 Orientativo no parecer: {t?.titulo || 'sem texto vinculado — cadastre na Biblioteca de textos'}
                          </div>
                        )}
                        {r.status === 'restricao' && (
                          <div style={{ marginTop: 6, fontSize: 12, color: '#8A6A22' }}>
                            ◐ Restrição: {tRestr?.titulo || 'sem texto de restrição vinculado — cadastre um texto de categoria Restrição'}
                          </div>
                        )}
                        {r.status === 'restricao' && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11.5, color: MU }}>Prazo da restrição ({'{{prazorestricao}}'}):</span>
                            {[30, 60, 90].map(dias => {
                              const sel = (r.prazoRestricaoDias || 60) === dias
                              return (
                                <button key={dias} onClick={() => onPrazoRestricao(i.id, dias)} style={{
                                  padding: '3px 12px', borderRadius: 99, border: `1.5px solid ${sel ? AC : LINE}`,
                                  background: sel ? ASO : '#fff', color: sel ? '#8A6A22' : MU, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: sel ? 700 : 400,
                                }}>{dias} dias</button>
                              )
                            })}
                          </div>
                        )}
                        {(r.status === 'nao' || r.status === 'restricao') && (
                          <input style={{ ...inputStyle, marginTop: 8, fontSize: 12.5, padding: '6px 9px' }} placeholder="Observação específica (entra no e-mail abaixo do texto padrão)"
                            value={r.obs} onChange={e => onObs(i.id, e.target.value)} />
                        )}
                      </div>
                    </div>
                  )
            }
            return (
              <div key={d} style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#fff' }}>
                <div style={{ background: '#F7F9FD', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${LINE}` }}>
                  <b style={{ fontSize: 13, letterSpacing: '.02em' }}>{d}</b>
                  <span style={{ color: MU, fontSize: 12 }}>{okG}/{gStatus.length} conformes</span>
                </div>
                {!multi ? (
                  comuns.map((i, idx) => renderItem(i, idx, comuns))
                ) : (
                  <>
                    {comuns.length > 0 && (
                      <>
                        {subheader('Comuns')}
                        {comuns.map((i, idx) => renderItem(i, idx, comuns))}
                      </>
                    )}
                    {especificos.map(eg => (
                      <div key={eg.contratanteId}>
                        {subheader('Específicos — ' + eg.nome)}
                        {eg.itens.map((i, idx) => renderItem(i, idx, eg.itens))}
                      </div>
                    ))}
                  </>
                )}
                {(d === 'PGR' || d === 'PCMSO' || d === 'LTCAT') && draft.respostas[FRENTE_TRABALHO_ITEM_ID]?.status !== 'nao' && (
                  <div style={{ padding: '10px 14px', background: '#F7F9FD', borderTop: `1px solid ${LINE}` }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: MU, fontWeight: 600 }}>Validade do {d}</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {VALIDADE_TIPOS.map(vt => {
                        const on = draft.validades?.[d]?.tipo === vt.val
                        return (
                          <button key={vt.val} onClick={() => onValidade(d, vt.val === 'anual' ? { tipo: 'anual', meses: 12 } : vt.val === 'bienal' ? { tipo: 'bienal', meses: 24 } : { tipo: 'personalizada', meses: draft.validades?.[d]?.meses ?? 12 })}
                            style={{
                              border: `1px solid ${on ? P : LINE}`, background: on ? P : '#fff', color: on ? '#fff' : TX,
                              borderRadius: 7, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                            {vt.label}
                          </button>
                        )
                      })}
                      {draft.validades?.[d]?.tipo === 'personalizada' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MU }}>
                          <input type="number" min={1} max={36} value={draft.validades[d]!.meses}
                            onChange={e => onValidade(d, { meses: Math.min(36, Math.max(1, parseInt(e.target.value) || 1)) })}
                            style={{ ...inputStyle, width: 64, padding: '5px 8px' }} /> meses
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ position: 'sticky', top: 16 }}>
        {!draft.contratanteIds.length ? (
          <Card style={{ padding: '32px 20px', textAlign: 'center', color: MU }}>
            <b style={{ display: 'block', color: TX, marginBottom: 4, fontSize: 15 }}>E-mail bloqueado</b>
            Selecione ao menos uma contratante para liberar a montagem do e-mail.
          </Card>
        ) : camposFaltando.length > 0 ? (
          <Card style={{ padding: '32px 20px', textAlign: 'center', color: MU }}>
            <b style={{ display: 'block', color: TX, marginBottom: 4, fontSize: 15 }}>E-mail bloqueado</b>
            Preencha os campos obrigatórios destacados em vermelho acima.
          </Card>
        ) : (
        <>
          <div style={{ background: modoReprovacao ? NO : modoRestricaoCritica ? AC : P, color: modoRestricaoCritica && !modoReprovacao ? '#3A2E14' : '#fff', padding: '12px 16px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 13.5 }}>{modoReprovacao ? '🚫 Reprovação em construção' : modoRestricaoCritica ? '◐ Parecer com restrição crítica' : '✉️ Parecer em construção'}</b>
            <span style={{ fontSize: 12 }}>
              {modoReprovacao
                ? (emailBuilt ? emailBuilt.criticos + ' item(ns) crítico(s)' : '')
                : (emailBuilt
                  ? ([
                      emailBuilt.restricoes ? emailBuilt.restricoes + ' restrição(ões)' : '',
                      emailBuilt.orientativos ? emailBuilt.orientativos + ' orientativo(s)' : '',
                      emailBuilt.aprovados ? emailBuilt.aprovados + ' destaque(s)' : '',
                    ].filter(Boolean).join(' · ') || (emailBuilt.marcados ? 'Aprovado sem observações' : 'Nada avaliado'))
                  : '')}
            </span>
          </div>
          {modoReprovacao && (
            <div style={{ background: NOS, color: NO, fontSize: 12, padding: '8px 16px', borderLeft: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}` }}>
              Item(ns) crítico(s) reprovado(s) — cadastro não pode ser liberado enquanto não forem corrigidos.
            </div>
          )}
          {!modoReprovacao && modoRestricaoCritica && (
            <div style={{ background: ASO, color: '#8A6A22', fontSize: 12, padding: '8px 16px', borderLeft: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}` }}>
              Item(ns) crítico(s) aprovado(s) com restrição — o parecer já contempla o prazo indicado no checklist.
            </div>
          )}
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderTop: 0, borderRadius: '0 0 10px 10px' }}>
            <div style={{ padding: '12px 12px 0' }}>
              <Field label="Assunto"><input style={{ ...inputStyle, background: '#F7F9FD' }} readOnly value={emailBuilt?.assunto || ''} /></Field>
            </div>
            <div style={{ padding: '12px 12px 0' }}><label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: MU, marginBottom: 5, fontWeight: 600 }}>Corpo</label></div>
            <textarea value={emailCorpo} onChange={e => onEmailChange(e.target.value)} style={{
              width: '100%', border: 0, borderRadius: 0, minHeight: 340, fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 12.5,
              lineHeight: 1.62, padding: '0 12px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }} />
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${LINE}`, flexWrap: 'wrap' }}>
              <Btn variant="pri" small onClick={onCopiar}>📋 Copiar</Btn>
              <Btn small onClick={onEml}>⬇️ Baixar .eml</Btn>
              <Btn small onClick={onMailto}>↗ Abrir no e-mail</Btn>
              <Btn variant="gho" small onClick={onRegerar}>↻ Regerar</Btn>
            </div>
            {anexosSugeridos.length > 0 && (
              <div style={{ padding: 12, borderTop: `1px solid ${LINE}`, background: '#F7F9FD' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: MU, fontWeight: 600, marginBottom: 6 }}>
                  📎 Anexos sugeridos — lembre de anexar ao enviar
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {anexosSugeridos.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                      <Btn small onClick={() => onBaixarAnexo(a.id)}>Baixar</Btn>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
        )}
        </div>
      </div>
    </div>
  )
}

// ─── View: Banco de dados ───────────────────────────────────────────────────

function VBanco({ aba, setAba, q, setQ, contratante, setContratante, status, setStatus, de, setDe, ate, setAte, aberto, setAberto, itemAberto, setItemAberto, lista, catalog, nomeC, nomesContratantes, itensDaAnalise, statusAnalise, relatorioItens, onLimparFiltros, onDelFiltro, onExportCsv, onDel, onReabrir }: {
  aba: 'empresas' | 'relatorio'; setAba: (v: 'empresas' | 'relatorio') => void
  q: string; setQ: (v: string) => void; contratante: string; setContratante: (v: string) => void
  status: string; setStatus: (v: string) => void; de: string; setDe: (v: string) => void; ate: string; setAte: (v: string) => void
  aberto: string | null; setAberto: (v: string | null) => void; itemAberto: string | null; setItemAberto: (v: string | null) => void
  lista: AnaliseRow[]; catalog: Catalog; nomeC: (c?: Contratante) => string; nomesContratantes: (ids: string[]) => string
  itensDaAnalise: (a: AnaliseDados) => ItemDaAnalise[]
  statusAnalise: (r: AnaliseRow) => { t: string; c: 'ok' | 'no' | 'na' | 'acc' | 'default'; k: string }
  relatorioItens: (l: AnaliseRow[]) => { i: ChecklistItem; ok: number; nao: number; na: number; restr: number; tot: number; empresasNao: string[]; empresasOk: string[] }[]
  onLimparFiltros: () => void; onDelFiltro: () => void; onExportCsv: () => void; onDel: (id: string, nome: string) => void; onReabrir: (r: AnaliseRow) => void
}) {
  const tot = lista.length
  const apr = lista.filter(a => statusAnalise(a).k === 'aprovada').length
  const comRestricao = lista.filter(a => statusAnalise(a).k === 'restricao').length
  const comOrientativo = lista.filter(a => statusAnalise(a).k === 'orientativo').length
  const reprovadas = lista.filter(a => statusAnalise(a).k === 'reprovada').length
  const reprovacoesGeradas = lista.reduce((n, a) => n + itensDaAnalise(a.dados).filter(i => i.critico && a.dados.respostas[i.id]?.status === 'nao').length, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13, color: MU }}>Histórico das análises finalizadas.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant={aba === 'empresas' ? 'pri' : 'default'} onClick={() => setAba('empresas')}>🏢 Empresas</Btn>
          <Btn variant={aba === 'relatorio' ? 'pri' : 'default'} onClick={() => setAba('relatorio')}>📊 Relatório por item</Btn>
        </div>
      </div>

      <Card style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <Field label="Buscar empresa / CNPJ"><input style={inputStyle} value={q} onChange={e => setQ(e.target.value)} placeholder="Digite para filtrar…" /></Field>
          <Field label="Contratante">
            <select style={inputStyle} value={contratante} onChange={e => setContratante(e.target.value)}>
              <option value="">Todas</option>
              {catalog.contratantes.map(c => <option key={c.id} value={c.id}>{nomeC(c)}</option>)}
            </select>
          </Field>
          <Field label="De (finalização)"><input style={inputStyle} type="date" value={de} onChange={e => setDe(e.target.value)} /></Field>
          <Field label="Até"><input style={inputStyle} type="date" value={ate} onChange={e => setAte(e.target.value)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 12, alignItems: 'end' }}>
          <Field label="Situação">
            <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Todas</option><option value="aprovada">Aprovadas</option><option value="restricao">Aprovadas com restrição</option><option value="orientativo">Com orientativo</option><option value="reprovada">Reprovadas</option>
            </select>
          </Field>
          <Btn onClick={onLimparFiltros}>Limpar filtros</Btn>
          <Btn variant="gho" onClick={onDelFiltro}>🗑 Excluir os {lista.length} registros filtrados</Btn>
          <div style={{ textAlign: 'right' }}><Btn onClick={onExportCsv}>⬇️ Exportar CSV</Btn></div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { l: 'Análises finalizadas', v: tot, c: TX },
          { l: 'Aprovadas sem apontamento', v: apr, c: OK },
          { l: 'Aprovadas com restrição', v: comRestricao, c: AC },
          { l: 'Com orientativo', v: comOrientativo, c: P },
          { l: 'Reprovadas', v: reprovadas, c: NO },
          { l: 'Reprovações geradas', v: reprovacoesGeradas, c: TX },
        ].map(s => (
          <div key={s.l} style={{ flex: 1, minWidth: 130, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '12px 14px' }}>
            <b style={{ display: 'block', fontSize: 22, lineHeight: 1.2, color: s.c }}>{s.v}</b>
            <span style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em', color: MU }}>{s.l}</span>
          </div>
        ))}
      </div>

      {aba === 'relatorio' ? (
        (() => {
          const linhas = relatorioItens(lista)
          if (!linhas.length) return <Empty title="Sem dados para o relatório" sub="Finalize análises para consolidar os números." />
          return (
            <Card>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>{['Item avaliado', 'Conforme', 'Reprovação', 'Restrição', 'N/A', 'Taxa de conformidade'].map(h => (
                    <th key={h} style={{ fontSize: 11, textTransform: 'uppercase', color: MU, textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {linhas.map(l => {
                      const p = l.tot ? Math.round(l.ok / l.tot * 100) : 0
                      const open = itemAberto === l.i.id
                      return (
                        <Fragment key={l.i.id}>
                          <tr style={{ cursor: 'pointer' }} onClick={() => setItemAberto(open ? null : l.i.id)}>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                              <b>{l.i.titulo}</b> <Tag>{l.i.documento}</Tag> {l.i.escopo === 'especifico' && <Tag tone="acc">específico</Tag>}
                            </td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone="ok">{l.ok}</Tag></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone="no">{l.nao}</Tag></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone="acc">{l.restr}</Tag></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone="na">{l.na}</Tag></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                              <div style={{ height: 6, background: NOS, borderRadius: 99, minWidth: 90, overflow: 'hidden' }}><div style={{ height: '100%', width: p + '%', background: OK }} /></div>
                              <span style={{ color: MU, fontSize: 11.5 }}>{p}% de {l.tot} avaliações</span>
                            </td>
                          </tr>
                          {open && (
                            <tr><td colSpan={6} style={{ padding: '8px 4px', borderBottom: `1px solid ${LINE}` }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div><label style={{ fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600 }}>Reprovações ({l.nao})</label>
                                  {l.empresasNao.length ? l.empresasNao.map((e, i) => <div key={i}>• {e || '(sem nome)'}</div>) : <span style={{ color: MU }}>—</span>}</div>
                                <div><label style={{ fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600 }}>Conformes ({l.ok})</label>
                                  {l.empresasOk.length ? l.empresasOk.map((e, i) => <div key={i}>• {e || '(sem nome)'}</div>) : <span style={{ color: MU }}>—</span>}</div>
                              </div>
                            </td></tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })()
      ) : (
        !lista.length ? <Empty title="Nenhum registro no período" sub="Finalize uma análise para alimentar o histórico." /> : (
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['Empresa', 'Contratante', 'Docs', 'Finalizada', 'Conformidade', 'Situação', ''].map(h => (
                  <th key={h} style={{ fontSize: 11, textTransform: 'uppercase', color: MU, textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${LINE}` }}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {lista.map(a => {
                    const s = statusAnalise(a), itens = itensDaAnalise(a.dados)
                    const itensStatus = itens.filter(i => i.tipo !== 'opcoes')
                    const ok = itensStatus.filter(i => a.dados.respostas[i.id]?.status === 'ok').length
                    const restr = itensStatus.filter(i => a.dados.respostas[i.id]?.status === 'restricao').length
                    const na = itensStatus.filter(i => a.dados.respostas[i.id]?.status === 'na').length
                    const apl = itensStatus.length - na, p = apl ? Math.round((ok + restr) / apl * 100) : 0
                    const open = aberto === a.id
                    return (
                      <Fragment key={a.id}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => setAberto(open ? null : a.id)}>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><b>{a.empresa || '(sem nome)'}</b><div style={{ color: MU, fontSize: 12 }}>{a.cnpj}</div></td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{nomesContratantes(a.dados.contratanteIds)}</td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{(a.dados.documentos || []).map(d => <span key={d} style={{ marginRight: 4 }}><Tag>{d}</Tag></span>)}</td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{fmtD(a.data_final || a.dados.data)}</td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                            <div style={{ height: 6, background: LINE, borderRadius: 99, minWidth: 90, overflow: 'hidden' }}><div style={{ height: '100%', width: p + '%', background: OK }} /></div>
                            <span style={{ color: MU, fontSize: 11.5 }}>{ok}{restr ? '+' + restr : ''}/{apl} · {p}%</span>
                          </td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone={s.c}>{s.t}</Tag></td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}`, textAlign: 'right', color: MU, fontSize: 12 }}>{open ? '▲ fechar' : '▼ detalhes'}</td>
                        </tr>
                        {open && (
                          <tr><td colSpan={7} style={{ padding: '6px 4px 12px', borderBottom: `1px solid ${LINE}` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 10 }}>
                              <div><span style={{ fontSize: 11, color: MU }}>Analista</span><div>{a.dados.responsavel || '—'}</div></div>
                              <div><span style={{ fontSize: 11, color: MU }}>E-mail de destino</span><div>{a.dados.emailDestino || '—'}</div></div>
                              <div><span style={{ fontSize: 11, color: MU }}>Data da análise</span><div>{fmtD(a.dados.data)}</div></div>
                              <div><span style={{ fontSize: 11, color: MU }}>Prazo dado</span><div>{fmtD(a.dados.prazo)}</div></div>
                            </div>
                            <Card>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><tbody>
                                {itens.map(i => {
                                  const r = a.dados.respostas[i.id]
                                  const map: Record<string, ['ok' | 'no' | 'na' | 'acc', string]> = { ok: ['ok', 'Conforme'], nao: ['no', 'Reprovação'], na: ['na', 'Não aplicável'], restricao: ['acc', 'Aprovado com restrição'] }
                                  const m = map[r?.status || ''] || ['na', 'Não avaliado']
                                  return (
                                    <tr key={i.id}>
                                      <td style={{ width: 120, padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone={m[0]}>{m[1]}</Tag></td>
                                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag>{i.documento}</Tag> {i.titulo}
                                        {r?.obs && <div style={{ color: MU, fontSize: 12 }}>Obs.: {r.obs}</div>}</td>
                                    </tr>
                                  )
                                })}
                              </tbody></table>
                            </Card>
                            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                              <Btn small onClick={() => onReabrir(a)}>↺ Reabrir para edição</Btn>
                              <Btn small variant="gho" onClick={() => onDel(a.id, a.empresa)}>🗑 Excluir esta empresa do banco</Btn>
                            </div>
                          </td></tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </div>
  )
}

// ─── View: Contratantes ──────────────────────────────────────────────────────

function VContratantes({ catalog, getI, onNovo, onEditar, onDel }: {
  catalog: Catalog; getI: (id?: string) => ChecklistItem | undefined
  onNovo: () => void; onEditar: (c: Contratante) => void; onDel: (id: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: MU }}>Cada contratante define os itens extras do checklist e os textos vinculados.</div>
        <Btn variant="pri" onClick={onNovo}>✚ Nova contratante</Btn>
      </div>
      {!catalog.contratantes.length ? (
        <Empty title="Nenhuma contratante cadastrada" sub="Cadastre a primeira para liberar o checklist." />
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Contratante', 'Unidade', 'Itens no checklist', 'Exigências específicas', 'Prazo', ''].map(h => (
                <th key={h} style={{ fontSize: 11, textTransform: 'uppercase', color: MU, textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${LINE}` }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {catalog.contratantes.map(c => {
                  const esp = c.itens.map(l => getI(l.itemId)).filter((i): i is ChecklistItem => !!i && i.escopo === 'especifico')
                  return (
                    <tr key={c.id}>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><b>{c.nome}</b></td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{c.unidade || '—'}</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{c.itens.length}</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                        {esp.length ? esp.map(i => <span key={i.id} style={{ marginRight: 4 }}><Tag tone="acc">{i.titulo}</Tag></span>) : <span style={{ color: MU }}>—</span>}
                      </td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{c.prazoDias} dias</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}`, textAlign: 'right' }}>
                        <Btn small onClick={() => onEditar(c)}>Editar</Btn>{' '}
                        <Btn small variant="gho" onClick={() => onDel(c.id)}>Excluir</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function ContratanteModal({ draft, catalog, novo, onChange, onSave, onClose, onCriarItem }: {
  draft: Contratante; catalog: Catalog; novo: boolean
  onChange: (c: Contratante) => void; onSave: () => void; onClose: () => void
  onCriarItem: (titulo: string, documento: DocKey, textoId: string) => void
}) {
  const [q, setQ] = useState('')
  const [niTitulo, setNiTitulo] = useState('')
  const [niDoc, setNiDoc] = useState<DocKey>('PGR')
  const [niTexto, setNiTexto] = useState('')

  function set<K extends keyof Contratante>(k: K, v: Contratante[K]) { onChange({ ...draft, [k]: v }) }
  function toggleItem(itemId: string) {
    const ex = draft.itens.findIndex(x => x.itemId === itemId)
    const itens = ex >= 0 ? draft.itens.filter((_, i) => i !== ex) : [...draft.itens, { itemId, textoId: null }]
    onChange({ ...draft, itens })
  }
  function setTextoOverride(itemId: string, textoId: string) {
    onChange({ ...draft, itens: draft.itens.map(l => (l.itemId === itemId ? { ...l, textoId: textoId || null } : l)) })
  }
  function marcarTodos(escopo: Escopo, v: boolean) {
    const g = catalog.itens.filter(i => i.escopo === escopo)
    let itens = draft.itens
    if (v) g.forEach(i => { if (!itens.some(l => l.itemId === i.id)) itens = [...itens, { itemId: i.id, textoId: null }] })
    else itens = itens.filter(l => !g.some(i => i.id === l.itemId))
    onChange({ ...draft, itens })
  }

  const selT = (campo: 'aberturaId' | 'fechamentoId' | 'aprovadoId' | 'assinaturaId', cat: CategoriaTexto) => (
    <select style={inputStyle} value={draft[campo]} onChange={e => set(campo, e.target.value)}>
      {catalog.textos.filter(t => t.categoria === cat).map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
    </select>
  )

  const bloco = (escopo: Escopo, titulo: string, hint: string) => {
    const g = ordenarPorDocumento(catalog.itens.filter(i => i.escopo === escopo && (!q || (i.titulo + i.descricao + i.documento).toLowerCase().includes(q.toLowerCase()))))
    const marc = g.filter(i => draft.itens.some(l => l.itemId === i.id)).length
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600 }}>{titulo} <Tag>{marc}/{g.length}</Tag></label>
          <div><Btn small onClick={() => marcarTodos(escopo, true)}>Marcar todos</Btn>{' '}<Btn small onClick={() => marcarTodos(escopo, false)}>Desmarcar</Btn></div>
        </div>
        <div style={{ color: MU, fontSize: 12, margin: '4px 0 6px' }}>{hint}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {!g.length ? <tr><td style={{ color: MU, padding: 8 }}>Nenhum item encontrado.</td></tr> : g.map(i => {
              const l = draft.itens.find(x => x.itemId === i.id)
              return (
                <tr key={i.id} style={{ opacity: l ? 1 : 0.55 }}>
                  <td style={{ width: 42, padding: '6px 4px', borderBottom: `1px solid ${LINE}` }}><input type="checkbox" checked={!!l} onChange={() => toggleItem(i.id)} /></td>
                  <td style={{ padding: '6px 4px', borderBottom: `1px solid ${LINE}` }}>
                    <b>{i.titulo}</b> {i.critico && <Tag tone="no">crítico</Tag>} <Tag>{i.documento}</Tag>
                    <div style={{ color: MU, fontSize: 12 }}>{i.descricao}</div>
                  </td>
                  <td style={{ width: 260, padding: '6px 4px', borderBottom: `1px solid ${LINE}` }}>
                    {l ? (
                      <select style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }} value={l.textoId || ''} onChange={e => setTextoOverride(i.id, e.target.value)}>
                        <option value="">Texto padrão: {catalog.textos.find(t => t.id === i.textoId)?.titulo || '—'}</option>
                        {catalog.textos.filter(t => t.categoria === 'apontamento').map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                      </select>
                    ) : <span style={{ color: MU, fontSize: 12 }}>não exigido</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <ModalShell title={novo ? 'Nova contratante' : 'Editar contratante'} onClose={onClose} onSave={onSave} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Nome"><input style={inputStyle} value={draft.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Marcopolo" /></Field>
        <Field label="Unidade"><input style={inputStyle} value={draft.unidade} onChange={e => set('unidade', e.target.value)} placeholder="Ex.: Ana Rech" /></Field>
        <Field label="Prazo padrão (dias)"><input style={inputStyle} value={draft.prazoDias} onChange={e => set('prazoDias', parseInt(e.target.value) || 7)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <Field label="E-mail de cópia (opcional)"><input style={inputStyle} value={draft.email || ''} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Observações internas"><input style={inputStyle} value={draft.obs || ''} onChange={e => set('obs', e.target.value)} /></Field>
      </div>
      <div style={{ height: 1, background: LINE, margin: '14px 0' }} />
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600, marginBottom: 8 }}>Textos de e-mail desta contratante</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div><span style={{ color: MU, fontSize: 12 }}>Abertura</span>{selT('aberturaId', 'abertura')}</div>
        <div><span style={{ color: MU, fontSize: 12 }}>Fechamento</span>{selT('fechamentoId', 'fechamento')}</div>
        <div><span style={{ color: MU, fontSize: 12 }}>Aprovação</span>{selT('aprovadoId', 'aprovacao')}</div>
        <div><span style={{ color: MU, fontSize: 12 }}>Assinatura</span>{selT('assinaturaId', 'assinatura')}</div>
      </div>
      <div style={{ height: 1, background: LINE, margin: '14px 0' }} />
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600, marginBottom: 8 }}>O que esta contratante exige</label>
      <input style={inputStyle} value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar itens por título, descrição ou documento…" />
      {bloco('base', 'Itens base', 'Desmarque o que esta contratante não cobra.')}
      {bloco('especifico', 'Exigências específicas', 'Marque o que só esta contratante cobra.')}
      <div style={{ height: 1, background: LINE, margin: '14px 0' }} />
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600, marginBottom: 8 }}>Criar exigência nova sem sair daqui</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <input style={inputStyle} value={niTitulo} onChange={e => setNiTitulo(e.target.value)} placeholder="Título do item" />
        <select style={inputStyle} value={niDoc} onChange={e => setNiDoc(e.target.value as DocKey)}>{DOC_ORDER.map(d => <option key={d}>{d}</option>)}</select>
        <select style={inputStyle} value={niTexto} onChange={e => setNiTexto(e.target.value)}>
          <option value="">Texto vinculado…</option>
          {catalog.textos.filter(t => t.categoria === 'apontamento').map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
        </select>
        <Btn variant="pri" onClick={() => { if (!niTitulo.trim()) return; onCriarItem(niTitulo.trim(), niDoc, niTexto); setNiTitulo(''); setNiTexto('') }}>✚ Criar e vincular</Btn>
      </div>
    </ModalShell>
  )
}

// ─── View: Itens de checklist ────────────────────────────────────────────────

function TextoCell({ texto, tone, vazio = 'sem texto', onClick }: { texto: { titulo: string } | undefined; tone: 'ok' | 'laranja' | 'no' | 'dourado'; vazio?: string; onClick: () => void }) {
  return (
    <span onClick={onClick} title={texto ? 'Ver texto vinculado' : 'Criar texto para este item'} style={{ cursor: 'pointer' }}>
      {texto ? <Tag tone={tone}>{texto.titulo}</Tag> : <span style={{ color: MU, fontSize: 11.5, textDecoration: 'underline dotted' }}>{vazio}</span>}
    </span>
  )
}

function VItens({ catalog, getT, getR, onNovo, onEditar, onDel, onAbrirTexto }: {
  catalog: Catalog; getT: (id?: string | null) => TextoEmail | undefined; getR: (id?: string | null) => TextoReprovacao | undefined
  onNovo: () => void; onEditar: (i: ChecklistItem) => void; onDel: (id: string) => void
  onAbrirTexto: (item: ChecklistItem, campo: InspectorCampo) => void
}) {
  const [abertos, setAbertos] = useState<Set<DocKey>>(new Set())
  function toggleDoc(d: DocKey) {
    setAbertos(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: MU }}>Catálogo único de verificações. Itens &quot;base&quot; já entram em toda contratante nova.</div>
        <Btn variant="pri" onClick={onNovo}>✚ Novo item</Btn>
      </div>
      {DOC_ORDER.map(d => {
        const g = catalog.itens.filter(i => i.documento === d)
        if (!g.length) return null
        const aberto = abertos.has(d)
        return (
          <Card key={d} style={{ marginBottom: 14 }}>
            <div
              onClick={() => toggleDoc(d)}
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            >
              <div><b>{d}</b> <span style={{ color: MU }}>· {g.length} itens</span></div>
              <span style={{ color: MU, fontSize: 12 }}>{aberto ? '▲ recolher' : '▼ expandir'}</span>
            </div>
            {aberto && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 18px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: MU }}>Item</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: OK }}>Aprovado</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: LARANJA }}>Não conforme</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: NO }}>Reprovado</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: DOURADO }}>Aprov. c/ restrição</th>
                    <th style={{ width: 150 }} />
                  </tr>
                </thead>
                <tbody>
                  {g.map(i => {
                    const statusOpcoes = i.statusOptions?.length ? i.statusOptions : DEFAULT_STATUS_OPTIONS
                    const condItem = i.condicaoItemId ? catalog.itens.find(x => x.id === i.condicaoItemId) : undefined
                    const condLabel = condItem && (condItem.tipo === 'opcoes'
                      ? condItem.opcoes.find(o => o.id === i.condicaoValor)?.label ?? i.condicaoValor
                      : STATUS_LABELS[i.condicaoValor as Exclude<StatusResp, ''>] ?? i.condicaoValor)
                    return (
                      <tr key={i.id}>
                        <td style={{ padding: '10px 18px', borderBottom: `1px solid ${LINE}` }}>
                          <b>{i.titulo}</b> {i.critico && <Tag tone="no">crítico</Tag>} {i.escopo === 'especifico' ? <Tag tone="acc">específico</Tag> : <Tag>base</Tag>}
                          {i.tipo === 'opcoes' ? (
                            <Tag tone="acc">opções de texto · {i.opcoes.length} · {'{{' + (i.variavel || '?') + '}}'}</Tag>
                          ) : (statusOpcoes.length !== DEFAULT_STATUS_OPTIONS.length || statusOpcoes.some(o => !DEFAULT_STATUS_OPTIONS.includes(o))) ? (
                            <Tag>{statusOpcoes.map(o => ALL_DOTS.find(d => d.val === o)?.symbol).join(' ')}</Tag>
                          ) : null}
                          {condItem && <Tag tone="acc">só se &quot;{condItem.titulo}&quot; = {condLabel}</Tag>}
                          <div style={{ color: MU, fontSize: 12 }}>{i.descricao}</div>
                        </td>
                        {i.tipo === 'opcoes' ? (
                          <td colSpan={4} style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                            <span style={{ color: MU, fontSize: 12 }}>{i.multiplaEscolha ? 'múltipla escolha' : 'escolha única'} — {i.opcoes.length} opção(ões)</span>
                          </td>
                        ) : (
                          <>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><TextoCell texto={getT(i.textoAprovadoId)} tone="ok" onClick={() => onAbrirTexto(i, 'textoAprovadoId')} /></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><TextoCell texto={getT(i.textoId)} tone="laranja" onClick={() => onAbrirTexto(i, 'textoId')} /></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{i.critico ? <TextoCell texto={getR(i.textoReprovacaoId)} tone="no" onClick={() => onAbrirTexto(i, 'textoReprovacaoId')} /> : <span style={{ color: MU, fontSize: 11.5 }}>não crítico</span>}</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><TextoCell texto={getT(i.textoRestricaoId)} tone="dourado" onClick={() => onAbrirTexto(i, 'textoRestricaoId')} /></td>
                          </>
                        )}
                        <td style={{ padding: 10, borderBottom: `1px solid ${LINE}`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Btn small onClick={() => onEditar(i)}>Editar</Btn>{' '}<Btn small variant="gho" onClick={() => onDel(i.id)}>Excluir</Btn>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function InspectorPanel({ item, campo, texto, onAbrir, onClose }: {
  item: ChecklistItem; campo: InspectorCampo; texto: { titulo: string; corpo: string } | undefined
  onAbrir: () => void; onClose: () => void
}) {
  const info = CAMPO_INFO[campo]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,28,42,.35)' }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '92vw',
        background: CARD, boxShadow: '-6px 0 24px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: MU, marginBottom: 4 }}>{item.documento} · {item.titulo}</div>
            <Tag tone={info.tone}>{info.label}</Tag>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: MU, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {texto ? (
            <>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: MU, marginBottom: 6 }}>Texto vinculado</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>{texto.titulo}</div>
              <div style={{ fontSize: 13, color: TX, whiteSpace: 'pre-wrap', lineHeight: 1.5, background: PS, borderRadius: 8, padding: 14 }}>{texto.corpo || '(sem conteúdo)'}</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: MU }}>Este item ainda não tem texto vinculado nesta categoria.</div>
          )}
        </div>
        <div style={{ padding: 18, borderTop: `1px solid ${LINE}` }}>
          <Btn variant="pri" onClick={onAbrir}>{texto ? 'Abrir em Textos →' : 'Criar texto em Textos →'}</Btn>
        </div>
      </div>
    </div>
  )
}

function slugifyVar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function ItemModal({ draft, catalog, novo, onChange, onSave, onClose }: {
  draft: ChecklistItem; catalog: Catalog; novo: boolean; onChange: (i: ChecklistItem) => void; onSave: () => void; onClose: () => void
}) {
  function set<K extends keyof ChecklistItem>(k: K, v: ChecklistItem[K]) { onChange({ ...draft, [k]: v }) }
  const condItem = draft.condicaoItemId ? catalog.itens.find(x => x.id === draft.condicaoItemId) : undefined
  return (
    <ModalShell title={novo ? 'Novo item de checklist' : 'Editar item'} onClose={onClose} onSave={onSave}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Título do item"><input style={inputStyle} value={draft.titulo} onChange={e => set('titulo', e.target.value)} placeholder="O que será verificado" /></Field>
        <Field label="Documento">
          <select style={inputStyle} value={draft.documento} onChange={e => set('documento', e.target.value as DocKey)}>
            {DOC_ORDER.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ marginTop: 12 }}>
        <Field label="Descrição / critério de aceite"><input style={inputStyle} value={draft.descricao} onChange={e => set('descricao', e.target.value)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <Field label="Escopo">
          <select style={inputStyle} value={draft.escopo} onChange={e => set('escopo', e.target.value as Escopo)}>
            <option value="base">Base — vale para todas</option>
            <option value="especifico">Específico — só quando a contratante exigir</option>
          </select>
        </Field>
        <Field label="Tipo de item">
          <select style={inputStyle} value={draft.tipo} onChange={e => set('tipo', e.target.value as ChecklistItemTipo)}>
            <option value="status">Bolinhas de status (padrão)</option>
            <option value="opcoes">Opções de texto</option>
          </select>
        </Field>
      </div>

      {draft.tipo === 'status' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label={'Texto "Não conforme" (laranja — orientativo no parecer)'}>
              <select style={inputStyle} value={draft.textoId} onChange={e => set('textoId', e.target.value)}>
                <option value="">— nenhum —</option>
                {catalog.textos.filter(t => t.categoria === 'apontamento').map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            </Field>
            <Field label="Texto de aprovação (verde — destaque no parecer se marcado Conforme)">
              <select style={inputStyle} value={draft.textoAprovadoId} onChange={e => set('textoAprovadoId', e.target.value)}>
                <option value="">— nenhum —</option>
                {catalog.textos.filter(t => t.categoria === 'aprovacao').map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={draft.critico} onChange={e => set('critico', e.target.checked)} />
            <span>Item crítico (bloqueia a liberação)</span>
          </div>
          {draft.critico && (
            <div style={{ marginTop: 12 }}>
              <Field label="Texto de reprovação (vermelho — usado quando este item crítico for marcado assim)">
                <select style={inputStyle} value={draft.textoReprovacaoId} onChange={e => set('textoReprovacaoId', e.target.value)}>
                  <option value="">— nenhum —</option>
                  {catalog.textosReprovacao.filter(r => r.documento === draft.documento || draft.documento === 'GERAL').map(r => (
                    <option key={r.id} value={r.id}>{r.titulo}{r.escopo === 'especifico' ? ' (específico)' : ''}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <div style={{ height: 1, background: LINE, margin: '16px 0' }} />
          <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600, marginBottom: 8 }}>
            Bolinhas deste item <span style={{ fontWeight: 400, textTransform: 'none', color: MU }}>— padrão: Conforme / Reprovação / Não aplicável</span>
          </label>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {ALL_DOTS.map(dd => {
              const checked = draft.statusOptions.includes(dd.val)
              const isLast = checked && draft.statusOptions.length === 1
              return (
                <label key={dd.val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: isLast ? 'not-allowed' : 'pointer', opacity: isLast ? 0.6 : 1 }}>
                  <input
                    type="checkbox" checked={checked} disabled={isLast}
                    onChange={() => set('statusOptions', checked ? draft.statusOptions.filter(o => o !== dd.val) : [...draft.statusOptions, dd.val])}
                  />
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: dd.on, color: dd.onFg, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{dd.symbol}</span>
                  {dd.label.split(' —')[0]}
                </label>
              )
            })}
          </div>
          {draft.statusOptions.includes('restricao') && (
            <div style={{ marginTop: 12 }}>
              <Field label="Texto de restrição (dourado — quando marcado como Aprovado com restrição)">
                <select style={inputStyle} value={draft.textoRestricaoId} onChange={e => set('textoRestricaoId', e.target.value)}>
                  <option value="">— nenhum —</option>
                  {catalog.textos.filter(t => t.categoria === 'restricao').map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                </select>
              </Field>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ height: 1, background: LINE, margin: '16px 0' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input type="checkbox" checked={draft.multiplaEscolha} onChange={e => set('multiplaEscolha', e.target.checked)} />
            <span>Permitir marcar mais de uma opção</span>
          </div>
          <Field label={'Nome da variável — vira {{' + (draft.variavel || 'nome') + '}} para usar em outros textos'}>
            <input style={inputStyle} value={draft.variavel} onChange={e => set('variavel', slugifyVar(e.target.value))} placeholder="ex.: treinamentos" />
          </Field>
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600, marginBottom: 8 }}>Opções</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draft.opcoes.map((o, idx) => (
                <div key={o.id} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 8, alignItems: 'start' }}>
                    <input style={inputStyle} value={o.label} placeholder="Rótulo (ex.: NR-10)"
                      onChange={e => set('opcoes', draft.opcoes.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} />
                    <textarea style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} rows={2} value={o.corpo}
                      placeholder={o.pedirTexto ? `Texto da opção — use {{detalhe}}${o.variavelDetalhe ? ' ou {{' + o.variavelDetalhe + '}}' : ''} onde entra o texto livre digitado` : 'Texto que entra na variável quando esta opção for marcada'}
                      onChange={e => set('opcoes', draft.opcoes.map((x, i) => i === idx ? { ...x, corpo: e.target.value } : x))} />
                    <Btn small variant="gho" onClick={() => set('opcoes', draft.opcoes.filter((_, i) => i !== idx))}>Excluir</Btn>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={o.pedirTexto}
                        onChange={e => set('opcoes', draft.opcoes.map((x, i) => i === idx ? { ...x, pedirTexto: e.target.checked } : x))} />
                      Pedir um detalhe livre ao marcar esta opção (ex.: número da página)
                    </label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }} title="Usada na variável quando nenhuma opção estiver marcada ainda">
                      <input type="radio" name={'padrao-' + draft.id} checked={o.padrao}
                        onChange={() => set('opcoes', draft.opcoes.map((x, i) => ({ ...x, padrao: i === idx })))} />
                      Padrão
                    </label>
                    {o.pedirTexto && (
                      <>
                        <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={o.placeholder} placeholder="Texto de exemplo do campo (ex.: Qual página?)"
                          onChange={e => set('opcoes', draft.opcoes.map((x, i) => i === idx ? { ...x, placeholder: e.target.value } : x))} />
                        <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={o.variavelDetalhe} placeholder="Nome da variável (opcional — padrão é {{detalhe}})"
                          onChange={e => set('opcoes', draft.opcoes.map((x, i) => i === idx ? { ...x, variavelDetalhe: slugifyVar(e.target.value) } : x))} />
                      </>
                    )}
                  </div>
                  {o.pedirTexto && (
                    <div style={{ fontSize: 11, color: MU, marginTop: 4 }}>
                      Use {'{{detalhe}}'}{o.variavelDetalhe ? <> ou <code style={{ background: PS, color: P, padding: '1px 5px', borderRadius: 4 }}>{'{{' + o.variavelDetalhe + '}}'}</code></> : ''} no texto acima para inserir o que for digitado.
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <Btn small onClick={() => set('opcoes', [...draft.opcoes, { id: uid('op'), label: '', corpo: '', pedirTexto: false, placeholder: '', variavelDetalhe: '', padrao: false }])}>✚ Adicionar opção</Btn>
            </div>
          </div>
        </>
      )}

      <div style={{ height: 1, background: LINE, margin: '16px 0' }} />
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600, marginBottom: 8 }}>
        Condição de exibição <span style={{ fontWeight: 400, textTransform: 'none', color: MU }}>— só aparece no checklist se outro item estiver marcado assim</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Depende do item">
          <select style={inputStyle} value={draft.condicaoItemId} onChange={e => { const v = e.target.value; set('condicaoItemId', v); if (!v) set('condicaoValor', '') }}>
            <option value="">— nenhum, sempre aparece —</option>
            {ordenarPorDocumento(catalog.itens.filter(i => i.id !== draft.id)).map(i => (
              <option key={i.id} value={i.id}>{i.documento} — {i.titulo}</option>
            ))}
          </select>
        </Field>
        <Field label="Valor exigido">
          <select style={inputStyle} value={draft.condicaoValor} disabled={!draft.condicaoItemId} onChange={e => set('condicaoValor', e.target.value)}>
            <option value="">— selecione —</option>
            {condItem?.tipo === 'opcoes'
              ? condItem.opcoes.map(o => <option key={o.id} value={o.id}>{o.label || '(sem rótulo)'}</option>)
              : ALL_DOTS.map(dd => <option key={dd.val} value={dd.val}>{STATUS_LABELS[dd.val]}</option>)}
          </select>
        </Field>
      </div>
    </ModalShell>
  )
}

// ─── View: Textos (hub) ─────────────────────────────────────────────────────

function VTextosHub({ catalog, onAbrir }: {
  catalog: Catalog; onAbrir: (k: 'aprovacao' | 'apontamento' | 'restricao' | 'reprovacao' | 'validade' | 'segmento') => void
}) {
  const contar = (cats: CategoriaTexto[]) => catalog.textos.filter(t => cats.includes(t.categoria)).length
  const cards: { k: 'aprovacao' | 'apontamento' | 'restricao' | 'reprovacao' | 'validade' | 'segmento'; titulo: string; desc: string; n: number; icon: string }[] = [
    { k: 'aprovacao', titulo: 'Aprovação', desc: 'Texto base do parecer — usado em toda análise aprovada, com ou sem restrição/orientativo.', n: contar(['aprovacao']), icon: '✅' },
    { k: 'apontamento', titulo: 'Apontamento', desc: 'Texto por item usado como orientativo no parecer quando um item não crítico é marcado como reprovação (bolinha ✕). Assinatura também fica aqui.', n: contar(['abertura', 'apontamento', 'fechamento', 'assinatura']), icon: '✉️' },
    { k: 'restricao', titulo: 'Aprovação com restrição', desc: 'Texto usado quando um item é marcado como aprovado com restrição.', n: contar(['restricao']), icon: '◐' },
    { k: 'reprovacao', titulo: 'Reprovação', desc: 'Texto usado quando um item crítico reprova o cadastro.', n: catalog.textosReprovacao.length, icon: '🚫' },
    { k: 'validade', titulo: 'Validade', desc: 'Observação automática quando PGR/PCMSO/LTCAT ficam anuais ou personalizados até 23 meses.', n: contar(['validade']), icon: '📅' },
    { k: 'segmento', titulo: 'Segmento', desc: 'Observação automática incluída no parecer quando a análise tiver o setor de atuação vinculado (ex.: Transporte).', n: contar(['segmento']), icon: '🏭' },
  ]
  return (
    <div>
      <div style={{ fontSize: 13, color: MU, marginBottom: 14 }}>Escolha a categoria de texto — cada uma liga com itens de checklist.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {cards.map(c => (
          <div key={c.k} onClick={() => onAbrir(c.k)} style={{
            background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: 18, cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(27,36,50,.06), 0 4px 16px rgba(27,36,50,.06)',
          }}>
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>{c.titulo}</div>
            <div style={{ fontSize: 12.5, color: MU, marginTop: 4, minHeight: 32 }}>{c.desc}</div>
            <div style={{ marginTop: 10 }}><Tag>{c.n} texto(s)</Tag></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── View: Textos de e-mail ───────────────────────────────────────────────────

function VTextos({ catalog, CATS, onNovo, onEditar, onDel }: {
  catalog: Catalog; CATS: Partial<Record<CategoriaTexto, string>>
  onNovo: () => void; onEditar: (t: TextoEmail) => void; onDel: (id: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: MU }}>Padronize uma vez e vincule aos itens e contratantes.</div>
        <Btn variant="pri" onClick={onNovo}>✚ Novo texto</Btn>
      </div>
      {(Object.keys(CATS) as CategoriaTexto[]).map(cat => {
        const g = catalog.textos.filter(t => t.categoria === cat)
        if (!g.length) return null
        return (
          <Card key={cat} style={{ marginBottom: 14 }}>
            <div style={{ padding: '14px 18px 0' }}><b>{CATS[cat]}</b> <span style={{ color: MU }}>· {g.length}</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
              <tbody>
                {g.map(t => {
                  const usos = catalog.itens.filter(i => i.textoId === t.id).length + catalog.contratantes.reduce((n, c) => n + c.itens.filter(l => l.textoId === t.id).length, 0)
                  return (
                    <tr key={t.id}>
                      <td style={{ padding: '10px 18px', borderBottom: `1px solid ${LINE}` }}>
                        <b>{t.titulo}</b>
                        {cat === 'segmento' && (t.segmentos ?? []).map(s => <Tag key={s} tone="acc">{s}</Tag>)}
                        <div style={{ color: MU, fontSize: 12, marginTop: 3 }}>{t.corpo.slice(0, 150)}{t.corpo.length > 150 ? '…' : ''}</div>
                      </td>
                      <td style={{ width: 110, padding: 10, borderBottom: `1px solid ${LINE}` }}>{cat !== 'segmento' && <Tag>{usos} uso(s)</Tag>}</td>
                      <td style={{ width: 150, padding: 10, borderBottom: `1px solid ${LINE}`, textAlign: 'right' }}>
                        <Btn small onClick={() => onEditar(t)}>Editar</Btn>{' '}<Btn small variant="gho" onClick={() => onDel(t.id)}>Excluir</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )
      })}
    </div>
  )
}

const VARS = ['empresa', 'cnpj', 'contratante', 'unidade', 'prazo', 'data', 'responsavel', 'documentos', 'reincidencia', 'setoratuacao', 'email']
const VARS_VALIDADE = ['documentosValidade', 'verbo', 'adjetivo', 'meses']

function fmtBytes(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB'
  return (n / (1024 * 1024)).toFixed(1) + ' MB'
}

function TextoModal({ draft, novo, CATS, onChange, onSave, onClose, anexos, onUpload, onDelAnexo, onBaixarAnexo }: {
  draft: TextoEmail; novo: boolean; CATS: Record<CategoriaTexto, string>; onChange: (t: TextoEmail) => void; onSave: () => void; onClose: () => void
  anexos: Anexo[]; onUpload: (textoId: string, file: File) => void; onDelAnexo: (id: string) => void; onBaixarAnexo: (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  function set<K extends keyof TextoEmail>(k: K, v: TextoEmail[K]) { onChange({ ...draft, [k]: v }) }
  async function handleFile(f: File | null) {
    if (!f) return
    setEnviando(true)
    try { await onUpload(draft.id, f) } finally { setEnviando(false); if (fileRef.current) fileRef.current.value = '' }
  }
  return (
    <ModalShell title={novo ? 'Novo texto' : 'Editar texto'} onClose={onClose} onSave={onSave}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Título interno"><input style={inputStyle} value={draft.titulo} onChange={e => set('titulo', e.target.value)} /></Field>
        <Field label="Categoria">
          <select style={inputStyle} value={draft.categoria} onChange={e => set('categoria', e.target.value as CategoriaTexto)}>
            {(Object.entries(CATS) as [CategoriaTexto, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      {draft.categoria === 'segmento' && (
        <div style={{ marginTop: 12 }}>
          <Field label="Setor(es) que disparam este texto no parecer">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '9px 12px', border: `1px solid ${LINE}`, borderRadius: 8 }}>
              {SETORES_ATUACAO.map(s => {
                const sel = (draft.segmentos ?? []).includes(s)
                return (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: TX, cursor: 'pointer' }}>
                    <input type="checkbox" checked={sel}
                      onChange={() => set('segmentos', sel ? (draft.segmentos ?? []).filter(x => x !== s) : [...(draft.segmentos ?? []), s])} />
                    {s}
                  </label>
                )
              })}
            </div>
          </Field>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Field label="Texto"><textarea rows={12} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} value={draft.corpo} onChange={e => set('corpo', e.target.value)} /></Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={{ color: MU, fontSize: 12 }}>Variáveis (clique para copiar): </span>
        {[...VARS, ...(draft.categoria === 'validade' ? VARS_VALIDADE : [])].map(v => (
          <code key={v} onClick={() => navigator.clipboard.writeText(`{{${v}}}`)}
            style={{ background: PS, color: P, padding: '1px 6px', borderRadius: 5, fontSize: 11.5, marginRight: 5, display: 'inline-block', cursor: 'pointer' }}>
            {`{{${v}}}`}
          </code>
        ))}
        {draft.categoria === 'validade' && (
          <div style={{ fontSize: 11.5, color: MU, marginTop: 6 }}>
            {'{{documentosValidade}}'} = &quot;o PGR e o PCMSO&quot; · {'{{verbo}}'} = está/estão · {'{{adjetivo}}'} = anual/anuais (só no texto Anual) · {'{{meses}}'} = quantidade de meses (só no texto Personalizada)
          </div>
        )}
      </div>

      <div style={{ height: 1, background: LINE, margin: '16px 0' }} />
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600, marginBottom: 8 }}>
        Anexos <span style={{ fontWeight: 400, textTransform: 'none' }}>— sugeridos automaticamente quando este texto entrar num e-mail</span>
      </label>
      {novo ? (
        <div style={{ fontSize: 12.5, color: MU }}>Salve o texto para poder anexar arquivos.</div>
      ) : (
        <>
          {anexos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {anexos.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${LINE}`, borderRadius: 7, fontSize: 12.5 }}>
                  <span>📎</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  <span style={{ color: MU, fontSize: 11 }}>{fmtBytes(a.size_bytes)}</span>
                  <Btn small onClick={() => onBaixarAnexo(a.id)}>Baixar</Btn>
                  <Btn small variant="gho" onClick={() => onDelAnexo(a.id)}>Excluir</Btn>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0] ?? null)} />
          <Btn small disabled={enviando} onClick={() => fileRef.current?.click()}>{enviando ? 'Enviando…' : '📎 Adicionar anexo'}</Btn>
        </>
      )}
    </ModalShell>
  )
}

// ─── View: Textos de reprovação ────────────────────────────────────────────────

function VReprovacao({ catalog, onNovo, onEditar, onDel }: {
  catalog: Catalog; onNovo: () => void; onEditar: (r: TextoReprovacao) => void; onDel: (id: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: MU, maxWidth: 640 }}>
          Textos usados quando um item <b>crítico</b> é marcado como reprovação (bolinha ✕) — nesse caso, o painel &quot;E-mail em construção&quot;
          vira &quot;Reprovação em construção&quot; e monta a mensagem a partir destes textos, vinculados por item em Itens de checklist.
          Base importada do módulo Observações (guia PGR &amp; PCMSO &amp; LTCAT).
        </div>
        <Btn variant="pri" onClick={onNovo}>✚ Novo texto de reprovação</Btn>
      </div>
      {!catalog.textosReprovacao.length ? (
        <Empty title="Nenhum texto de reprovação cadastrado" sub="Cadastre o primeiro para vincular a um item crítico." />
      ) : DOC_ORDER.map(d => {
        const g = catalog.textosReprovacao.filter(r => r.documento === d)
        if (!g.length) return null
        return (
          <Card key={d} style={{ marginBottom: 14 }}>
            <div style={{ padding: '14px 18px 0' }}><b>{d}</b> <span style={{ color: MU }}>· {g.length}</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
              <tbody>
                {g.map(r => {
                  const usos = catalog.itens.filter(i => i.textoReprovacaoId === r.id).length
                  return (
                    <tr key={r.id}>
                      <td style={{ padding: '10px 18px', borderBottom: `1px solid ${LINE}` }}>
                        <b>{r.titulo}</b> {r.escopo === 'especifico' && <Tag tone="acc">específico</Tag>}
                        <div style={{ color: MU, fontSize: 12, marginTop: 3 }}>{r.corpo.slice(0, 150)}{r.corpo.length > 150 ? '…' : ''}</div>
                      </td>
                      <td style={{ width: 110, padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone={usos ? 'no' : 'default'}>{usos} item(ns)</Tag></td>
                      <td style={{ width: 150, padding: 10, borderBottom: `1px solid ${LINE}`, textAlign: 'right' }}>
                        <Btn small onClick={() => onEditar(r)}>Editar</Btn>{' '}<Btn small variant="gho" onClick={() => onDel(r.id)}>Excluir</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )
      })}
    </div>
  )
}

function ReprovacaoModal({ draft, novo, onChange, onSave, onClose }: {
  draft: TextoReprovacao; novo: boolean; onChange: (r: TextoReprovacao) => void; onSave: () => void; onClose: () => void
}) {
  function set<K extends keyof TextoReprovacao>(k: K, v: TextoReprovacao[K]) { onChange({ ...draft, [k]: v }) }
  return (
    <ModalShell title={novo ? 'Novo texto de reprovação' : 'Editar texto de reprovação'} onClose={onClose} onSave={onSave}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Título interno"><input style={inputStyle} value={draft.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: Validade" /></Field>
        <Field label="Documento">
          <select style={inputStyle} value={draft.documento} onChange={e => set('documento', e.target.value as DocKey)}>
            {DOC_ORDER.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Escopo">
          <select style={inputStyle} value={draft.escopo} onChange={e => set('escopo', e.target.value as Escopo)}>
            <option value="base">Base</option>
            <option value="especifico">Específico</option>
          </select>
        </Field>
      </div>
      <div style={{ marginTop: 12 }}>
        <Field label="Texto"><textarea rows={12} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} value={draft.corpo} onChange={e => set('corpo', e.target.value)} /></Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={{ color: MU, fontSize: 12 }}>Variáveis (clique para copiar): </span>
        {VARS.map(v => (
          <code key={v} onClick={() => navigator.clipboard.writeText(`{{${v}}}`)}
            style={{ background: PS, color: P, padding: '1px 6px', borderRadius: 5, fontSize: 11.5, marginRight: 5, display: 'inline-block', cursor: 'pointer' }}>
            {`{{${v}}}`}
          </code>
        ))}
      </div>
    </ModalShell>
  )
}

// ─── View: Configurações ─────────────────────────────────────────────────────

function VConfig({ config, textos, onSalvar }: { config: CatalogConfig; textos: TextoEmail[]; onSalvar: (patch: Partial<CatalogConfig>) => void }) {
  const [prazoDias, setPrazoDias] = useState(config.prazoDias)
  const [assunto, setAssunto] = useState(config.assunto)
  const [validadeAnualId, setValidadeAnualId] = useState(config.validadeAnualId)
  const [validadePersonalizadaId, setValidadePersonalizadaId] = useState(config.validadePersonalizadaId)
  const [camposObrigatorios, setCamposObrigatorios] = useState<string[]>(config.camposObrigatorios ?? [])
  const textosValidade = textos.filter(t => t.categoria === 'validade')

  function toggleCampoObrigatorio(key: string) {
    const next = camposObrigatorios.includes(key) ? camposObrigatorios.filter(k => k !== key) : [...camposObrigatorios, key]
    setCamposObrigatorios(next)
    onSalvar({ camposObrigatorios: next })
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: MU, marginBottom: 14 }}>Padrões gerais usados como base para novas análises e novas contratantes.</div>
      <Card style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: MU, background: PS, border: `1px solid ${LINE}`, borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
          O campo &quot;Analista&quot; de cada análise agora é preenchido automaticamente com o nome de quem está logado — não é mais um valor fixo aqui.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prazo padrão (dias)"><input style={inputStyle} value={prazoDias} onChange={e => setPrazoDias(parseInt(e.target.value) || 7)} /></Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Btn variant="pri" onClick={() => onSalvar({ prazoDias, assunto, validadeAnualId, validadePersonalizadaId })}>Salvar padrões</Btn>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Assunto do e-mail"><input style={inputStyle} value={assunto} onChange={e => setAssunto(e.target.value)} /></Field>
        </div>
      </Card>
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Observação automática de validade</div>
        <div style={{ fontSize: 12.5, color: MU, marginBottom: 12 }}>
          Textos usados quando um PGR/PCMSO/LTCAT é marcado como Anual ou Personalizada até 23 meses na análise aprovada.
          Edite o conteúdo em Textos → Validade.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Texto — Validade Anual">
            <select style={inputStyle} value={validadeAnualId} onChange={e => setValidadeAnualId(e.target.value)}>
              <option value="">— nenhum, não indica nada —</option>
              {textosValidade.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          </Field>
          <Field label="Texto — Validade Personalizada (até 23 meses)">
            <select style={inputStyle} value={validadePersonalizadaId} onChange={e => setValidadePersonalizadaId(e.target.value)}>
              <option value="">— nenhum, não indica nada —</option>
              {textosValidade.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          </Field>
        </div>
      </Card>
      <Card style={{ padding: '16px 18px', marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Campos obrigatórios em Nova análise</div>
        <div style={{ fontSize: 12.5, color: MU, marginBottom: 12 }}>
          O checklist só libera depois de uma contratante selecionada e destes campos preenchidos — eles ficam destacados em vermelho enquanto vazios.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
          {CAMPOS_ANALISE.map(c => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={camposObrigatorios.includes(c.key)} onChange={() => toggleCampoObrigatorio(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}
