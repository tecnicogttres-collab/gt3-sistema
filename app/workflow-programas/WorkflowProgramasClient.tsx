'use client'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { useUser, displayName } from '../components/UserContext'

// ─── Types ──────────────────────────────────────────────────────────────────

type StatusResp = 'ok' | 'nao' | 'na' | ''
type Resposta = { status: StatusResp; obs: string }
type DocKey = 'PGR' | 'PCMSO' | 'LTCAT' | 'GERAL'
type Escopo = 'base' | 'especifico'
type CategoriaTexto = 'abertura' | 'apontamento' | 'fechamento' | 'assinatura'

type ChecklistItem = {
  id: string; titulo: string; documento: DocKey; descricao: string
  escopo: Escopo; textoId: string; critico: boolean; textoReprovacaoId: string
}
type TextoEmail = { id: string; titulo: string; categoria: CategoriaTexto; corpo: string }
type TextoReprovacao = { id: string; titulo: string; documento: DocKey; escopo: Escopo; corpo: string }
type ItemLink = { itemId: string; textoId: string | null }
type Contratante = {
  id: string; nome: string; unidade: string; email: string; prazoDias: number
  aberturaId: string; fechamentoId: string; assinaturaId: string; aprovadoId: string
  obs: string; itens: ItemLink[]
}
type CatalogConfig = {
  responsavel: string; assunto: string
  aberturaId: string; fechamentoId: string; assinaturaId: string; aprovadoId: string
  prazoDias: number
}
type Catalog = { contratantes: Contratante[]; itens: ChecklistItem[]; textos: TextoEmail[]; textosReprovacao: TextoReprovacao[]; config: CatalogConfig }

type AnaliseDados = {
  contratanteId: string; documentos: DocKey[]
  empresa: string; cnpj: string; emailDestino: string
  data: string; prazo: string; responsavel: string
  respostas: Record<string, Resposta>
}
type AnaliseRow = {
  id: string; empresa: string; cnpj: string
  finalizada: boolean; data_final: string | null
  criado_por: string; criado_por_nome: string | null
  created_at: string; updated_at: string
  dados: AnaliseDados
  minha?: boolean
}

type View = 'analises' | 'nova' | 'banco' | 'contratantes' | 'itens' | 'textos' | 'reprovacao' | 'config'

const DOC_TYPES: DocKey[] = ['PGR', 'PCMSO', 'LTCAT']
const DOC_ORDER: DocKey[] = ['PGR', 'PCMSO', 'LTCAT', 'GERAL']

// ─── Theme ────────────────────────────────────────────────────────────────────

const P = '#2A4F96', PS = '#E8EEF9'
const AC = '#D1AE6E', ASO = '#FBF4E6'
const CARD = '#ffffff', LINE = '#E2E8F2'
const TX = '#1B2432', MU = '#6B7A90'
const OK = '#1E9E6A', OKS = '#E6F6EF'
const NO = '#D64545', NOS = '#FCEBEB'
const NA = '#94A3B8', NAS = '#EEF1F5'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(p: string) { return p + '_' + Math.random().toString(36).slice(2, 9) }
function hoje() { return new Date().toISOString().slice(0, 10) }
function addDias(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function fmtD(s?: string | null) { return s ? s.split('-').reverse().join('/') : '' }
function aplicaVars(txt: string, ctx: Record<string, string>) {
  return (txt || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (ctx[k] !== undefined ? ctx[k] : m))
}

// ─── Seed (base padrão GT3) ────────────────────────────────────────────────────

function seedCatalog(): Catalog {
  const T = (id: string, titulo: string, categoria: CategoriaTexto, corpo: string): TextoEmail => ({ id, titulo, categoria, corpo })
  const textos: TextoEmail[] = [
    T('t_abertura', 'Abertura padrão', 'abertura', 'Prezados, bom dia.\n\nRealizamos a análise da documentação de Saúde e Segurança do Trabalho da empresa {{empresa}} (CNPJ {{cnpj}}), referente à prestação de serviços para {{contratante}}.\n\nPara liberação do cadastro, seguem os apontamentos que precisam de ajuste ou complementação:'),
    T('t_fechamento', 'Fechamento padrão', 'fechamento', 'Solicitamos o reenvio dos documentos corrigidos até {{prazo}}, respondendo a este mesmo e-mail.\n\nEnquanto os apontamentos acima não forem sanados, a documentação permanece pendente e a liberação da frente de trabalho fica condicionada à regularização.'),
    T('t_aprovado', 'Documentação aprovada', 'fechamento', 'Prezados, bom dia.\n\nInformamos que a documentação de SST da empresa {{empresa}} (CNPJ {{cnpj}}), referente à prestação de serviços para {{contratante}}, foi analisada em {{data}} e encontra-se APROVADA, sem apontamentos.\n\nLembramos que qualquer alteração de escopo, função ou frente de trabalho exige nova análise documental.'),
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
  ]

  const I = (id: string, titulo: string, documento: DocKey, descricao: string, escopo: Escopo, textoId: string, critico: boolean, textoReprovacaoId = ''): ChecklistItem =>
    ({ id, titulo, documento, descricao, escopo, textoId, critico, textoReprovacaoId })
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
      prazoDias: 7,
    },
  }
}

/** Preenche catálogos salvos antes da existência de "Textos de reprovação" (upgrade in-place). */
function upgradeCatalog(raw: Catalog): { catalog: Catalog; changed: boolean } {
  const precisaUpgrade = !Array.isArray(raw.textosReprovacao) || raw.itens.some(i => typeof i.textoReprovacaoId !== 'string')
  if (!precisaUpgrade) return { catalog: raw, changed: false }
  const seed = seedCatalog()
  const defaultLink: Record<string, string> = { i_pgr_val: 'r_pgr_validade', i_pcm_val: 'r_pcm_validade' }
  const itens = raw.itens.map(i => ({
    ...i,
    textoReprovacaoId: typeof i.textoReprovacaoId === 'string' ? i.textoReprovacaoId : (defaultLink[i.id] || ''),
  }))
  const textosReprovacao = Array.isArray(raw.textosReprovacao) && raw.textosReprovacao.length ? raw.textosReprovacao : seed.textosReprovacao
  return { catalog: { ...raw, itens, textosReprovacao }, changed: true }
}

// ─── Small UI atoms ─────────────────────────────────────────────────────────────

function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'acc' | 'ok' | 'no' | 'na' }) {
  const map: Record<string, { bg: string; fg: string }> = {
    default: { bg: PS, fg: P }, acc: { bg: ASO, fg: '#8A6A22' },
    ok: { bg: OKS, fg: OK }, no: { bg: NOS, fg: NO }, na: { bg: NAS, fg: '#54617A' },
  }
  const c = map[tone]
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>
      {children}
    </span>
  )
}

function Btn({ children, onClick, variant = 'default', small = false, disabled = false, title }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'default' | 'pri' | 'acc' | 'gho'; small?: boolean; disabled?: boolean; title?: string
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: '#fff', border: `1px solid ${LINE}`, color: TX },
    pri: { background: P, border: `1px solid ${P}`, color: '#fff' },
    acc: { background: AC, border: `1px solid ${AC}`, color: '#3A2E14', fontWeight: 600 },
    gho: { background: 'transparent', border: '1px solid transparent', color: MU },
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
  const [view, setView] = useState<View>('analises')
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

  function showToast(m: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(m)
    toastTimer.current = setTimeout(() => setToast(''), 2400)
  }

  // ── load ──
  useEffect(() => {
    let alive = true
    async function load() {
      const [cfgRes, listRes] = await Promise.all([
        fetch('/api/workflow-programas/config').then(r => r.json()).catch(() => ({ dados: null })),
        fetch('/api/workflow-programas').then(r => r.json()).catch(() => []),
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
      setAnalises(Array.isArray(listRes) ? listRes : [])
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

  function itensDaAnalise(a: AnaliseDados): (ChecklistItem & { textoLink: string })[] {
    if (!catalog) return []
    const c = getC(a.contratanteId)
    if (!c) return []
    const docs = a.documentos?.length ? a.documentos : (['PGR', 'PCMSO'] as DocKey[])
    return c.itens
      .map(l => { const i = getI(l.itemId); return i ? { ...i, textoLink: l.textoId || i.textoId } : null })
      .filter((i): i is ChecklistItem & { textoLink: string } => i !== null && (i.documento === 'GERAL' || docs.includes(i.documento)))
      .sort((x, y) => DOC_ORDER.indexOf(x.documento) - DOC_ORDER.indexOf(y.documento))
  }

  function ctxDe(a: AnaliseDados) {
    const c = getC(a.contratanteId)
    return {
      empresa: a.empresa || '[EMPRESA]', cnpj: a.cnpj || '[CNPJ]',
      contratante: nomeC(c) || '[CONTRATANTE]', prazo: fmtD(a.prazo) || '[PRAZO]',
      data: fmtD(a.data), responsavel: a.responsavel || catalog?.config.responsavel || '',
      unidade: c?.unidade || '',
    }
  }

  function buildEmail(a: AnaliseDados) {
    const c = getC(a.contratanteId)
    const ctx = ctxDe(a)
    const itens = itensDaAnalise(a)
    const pend = itens.filter(i => a.respostas[i.id]?.status === 'nao')
    const marcados = itens.filter(i => a.respostas[i.id]?.status)
    const partes: string[] = []
    if (pend.length === 0 && marcados.length > 0) {
      partes.push(aplicaVars(getT(c?.aprovadoId || catalog?.config.aprovadoId)?.corpo || '', ctx))
    } else {
      partes.push(aplicaVars(getT(c?.aberturaId || catalog?.config.aberturaId)?.corpo || '', ctx))
      pend.forEach((i, n) => {
        const t = getT(i.textoLink)
        const obs = a.respostas[i.id]?.obs
        let bloco = (n + 1) + ') ' + i.documento + ' — ' + i.titulo.toUpperCase() + '\n' +
          aplicaVars(t ? t.corpo : '(sem texto vinculado — cadastre na Biblioteca de textos)', ctx)
        if (obs) bloco += '\nObservação: ' + obs
        partes.push(bloco)
      })
      if (pend.length) partes.push(aplicaVars(getT(c?.fechamentoId || catalog?.config.fechamentoId)?.corpo || '', ctx))
    }
    partes.push(aplicaVars(getT(c?.assinaturaId || catalog?.config.assinaturaId)?.corpo || '', ctx))
    return {
      assunto: aplicaVars(catalog?.config.assunto || '', ctx),
      corpo: partes.filter(Boolean).join('\n\n'),
      pend: pend.length, total: itens.length, marcados: marcados.length,
    }
  }

  function buildReprovacao(a: AnaliseDados, criticosReprovados: (ChecklistItem & { textoLink: string })[]) {
    const c = getC(a.contratanteId)
    const ctx = ctxDe(a)
    const partes: string[] = []
    partes.push(aplicaVars('Prezados, bom dia.\n\nApós análise da documentação de Saúde e Segurança do Trabalho da empresa {{empresa}} (CNPJ {{cnpj}}), referente à prestação de serviços para {{contratante}}, identificamos item(ns) crítico(s) que resultam na reprovação do cadastro:', ctx))
    criticosReprovados.forEach((i, n) => {
      const t = getR(i.textoReprovacaoId)
      const bloco = (n + 1) + ') ' + i.documento + ' — ' + i.titulo.toUpperCase() + '\n' +
        aplicaVars(t ? t.corpo : '(sem texto de reprovação vinculado — cadastre em Textos de reprovação)', ctx)
      partes.push(bloco)
    })
    partes.push(aplicaVars(getT(c?.assinaturaId || catalog?.config.assinaturaId)?.corpo || '', ctx))
    return {
      assunto: 'GT3 · Reprovação de cadastro — ' + ctx.empresa + ' — ' + ctx.contratante,
      corpo: partes.filter(Boolean).join('\n\n'),
      pend: criticosReprovados.length, total: criticosReprovados.length, marcados: criticosReprovados.length,
    }
  }

  const criticosReprovados = useMemo(
    () => (draft ? itensDaAnalise(draft).filter(i => i.critico && draft.respostas[i.id]?.status === 'nao') : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, catalog],
  )
  const modoReprovacao = criticosReprovados.length > 0
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
      contratanteId: catalog.contratantes[0]?.id || '',
      documentos: ['PGR', 'PCMSO'],
      empresa: '', cnpj: '', emailDestino: '',
      data: hoje(), prazo: addDias(catalog.config.prazoDias || 7),
      responsavel: displayName(profile, catalog.config.responsavel || ''),
      respostas: {},
    })
    setEmailEditado(false)
  }

  function go(v: View) {
    if (v === 'nova' && !draft) novaAnalise()
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
    setBancoAberto(row.id)
    setBancoAba('empresas')
    novaAnalise()
    setView('banco')
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

  function toggleDot(itemId: string, val: StatusResp) {
    setDraft(prev => {
      if (!prev) return prev
      const cur = prev.respostas[itemId]?.status
      const status: StatusResp = cur === val ? '' : val
      return { ...prev, respostas: { ...prev.respostas, [itemId]: { status, obs: prev.respostas[itemId]?.obs || '' } } }
    })
    setEmailEditado(false)
  }

  function setObs(itemId: string, obs: string) {
    setDraft(prev => {
      if (!prev) return prev
      return { ...prev, respostas: { ...prev.respostas, [itemId]: { status: prev.respostas[itemId]?.status || '', obs } } }
    })
    setEmailEditado(false)
  }

  function setDraftField<K extends keyof AnaliseDados>(k: K, v: AnaliseDados[K]) {
    setDraft(prev => (prev ? { ...prev, [k]: v } : prev))
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
  function statusAnalise(row: AnaliseRow): { t: string; c: 'ok' | 'no' | 'na'; k: string } {
    const itens = itensDaAnalise(row.dados)
    const nao = itens.filter(i => row.dados.respostas[i.id]?.status === 'nao').length
    const marc = itens.filter(i => row.dados.respostas[i.id]?.status).length
    if (!marc) return { t: 'Em análise', c: 'na', k: 'analise' }
    if (nao) return { t: nao + ' pendência(s)', c: 'no', k: 'pendencias' }
    return { t: 'Aprovada', c: 'ok', k: 'aprovada' }
  }

  const finalizadas = useMemo(() => analises.filter(a => a.finalizada), [analises])
  const emAndamento = useMemo(() => analises.filter(a => !a.finalizada), [analises])

  const bancoFiltrado = useMemo(() => {
    const q = bancoQ.toLowerCase()
    return finalizadas.filter(a => {
      const d = a.data_final || a.dados.data
      if (q && !((a.empresa || '') + ' ' + (a.cnpj || '')).toLowerCase().includes(q)) return false
      if (bancoContratante && a.dados.contratanteId !== bancoContratante) return false
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
      let ok = 0, nao = 0, na = 0
      const empresasNao: string[] = [], empresasOk: string[] = []
      lista.forEach(a => {
        const r = a.dados.respostas[i.id]?.status
        if (!r) return
        if (!itensDaAnalise(a.dados).some(x => x.id === i.id)) return
        if (r === 'ok') { ok++; empresasOk.push(a.empresa) }
        else if (r === 'nao') { nao++; empresasNao.push(a.empresa) }
        else na++
      })
      return { i, ok, nao, na, tot: ok + nao, empresasNao, empresasOk }
    }).filter(l => l.tot + l.na > 0).sort((a, b) => b.nao - a.nao)
  }

  function exportarCsv() {
    const lista = bancoFiltrado
    const linhas: string[][] = [['Empresa', 'CNPJ', 'Contratante', 'Documentos', 'Data análise', 'Finalizada', 'Item', 'Documento', 'Resultado', 'Observação']]
    lista.forEach(a => {
      const c = getC(a.dados.contratanteId)
      itensDaAnalise(a.dados).forEach(i => {
        const r = a.dados.respostas[i.id]
        linhas.push([
          a.empresa, a.cnpj, nomeC(c), (a.dados.documentos || []).join(' '), fmtD(a.dados.data), fmtD(a.data_final || a.dados.data),
          i.titulo, i.documento, ({ ok: 'Conforme', nao: 'Não conforme', na: 'Não aplicável' } as Record<string, string>)[r?.status || ''] || 'Não avaliado', r?.obs || '',
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
    const novo: ChecklistItem = { id: uid('i'), titulo, documento, descricao: 'Exigência específica da contratante.', escopo: 'especifico', textoId, critico: false, textoReprovacaoId: '' }
    const nextCatalog = { ...catalog, itens: [...catalog.itens, novo] }
    setCatalog(nextCatalog)
    fetch('/api/workflow-programas/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dados: nextCatalog }) }).catch(() => {})
    setModalContratante(prev => (prev ? { ...prev, itens: [...prev.itens, { itemId: novo.id, textoId: null }] } : prev))
    showToast('Item criado e vinculado')
  }

  // ── catálogo: itens ──
  function novoItemModal() { setModalItemNovo(true); setModalItemEdit({ id: uid('i'), titulo: '', documento: 'PGR', descricao: '', escopo: 'base', textoId: '', critico: false, textoReprovacaoId: '' }) }
  function editarItemModal(i: ChecklistItem) { setModalItemNovo(false); setModalItemEdit({ ...i }) }
  function salvarItemModal() {
    if (!catalog || !modalItemEdit) return
    if (!modalItemEdit.titulo.trim()) { showToast('Informe o título do item'); return }
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
  const CATS: Record<CategoriaTexto, string> = { abertura: 'Abertura', apontamento: 'Apontamento', fechamento: 'Fechamento', assinatura: 'Assinatura' }
  function novoTextoModal() { setModalTextoNovo(true); setModalTextoEdit({ id: uid('t'), titulo: '', categoria: 'apontamento', corpo: '' }) }
  function editarTextoModal(t: TextoEmail) { setModalTextoNovo(false); setModalTextoEdit({ ...t }) }
  function salvarTextoModal() {
    if (!catalog || !modalTextoEdit) return
    if (!modalTextoEdit.titulo.trim()) { showToast('Informe o título'); return }
    const next = { ...catalog }
    next.textos = modalTextoNovo ? [...catalog.textos, modalTextoEdit] : catalog.textos.map(t => (t.id === modalTextoEdit.id ? modalTextoEdit : t))
    persistCatalog(next)
    setModalTextoEdit(null)
    showToast('Texto salvo')
  }
  function delTexto(id: string) {
    if (!catalog || !confirm('Excluir texto?')) return
    persistCatalog({ ...catalog, textos: catalog.textos.filter(t => t.id !== id) })
  }

  // ── catálogo: textos de reprovação ──
  function novoReprovacaoModal() { setModalReprovacaoNovo(true); setModalReprovacaoEdit({ id: uid('r'), titulo: '', documento: 'PGR', escopo: 'base', corpo: '' }) }
  function editarReprovacaoModal(r: TextoReprovacao) { setModalReprovacaoNovo(false); setModalReprovacaoEdit({ ...r }) }
  function salvarReprovacaoModal() {
    if (!catalog || !modalReprovacaoEdit) return
    if (!modalReprovacaoEdit.titulo.trim()) { showToast('Informe o título'); return }
    const next = { ...catalog }
    next.textosReprovacao = modalReprovacaoNovo
      ? [...catalog.textosReprovacao, modalReprovacaoEdit]
      : catalog.textosReprovacao.map(r => (r.id === modalReprovacaoEdit.id ? modalReprovacaoEdit : r))
    persistCatalog(next)
    setModalReprovacaoEdit(null)
    showToast('Texto de reprovação salvo')
  }
  function delReprovacao(id: string) {
    if (!catalog || !confirm('Excluir texto de reprovação? Itens críticos vinculados a ele ficarão sem texto.')) return
    persistCatalog({
      ...catalog,
      textosReprovacao: catalog.textosReprovacao.filter(r => r.id !== id),
      itens: catalog.itens.map(i => (i.textoReprovacaoId === id ? { ...i, textoReprovacaoId: '' } : i)),
    })
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
    { k: 'textos', t: 'Textos de e-mail', i: '✉️' },
    { k: 'reprovacao', t: 'Textos de reprovação', i: '🚫' },
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
        <VAnalises lista={emAndamento} getC={getC} nomeC={nomeC} statusAnalise={statusAnalise} onNova={() => go('nova')} onAbrir={abrirAnalise} onDel={delAnalise} />
      )}

      {view === 'nova' && draft && (
        <VAnalise
          draft={draft} draftId={draftId} catalog={catalog} emailCorpo={emailCorpo} emailBuilt={emailBuilt} modoReprovacao={modoReprovacao}
          itensDaAnalise={itensDaAnalise} getT={getT} getR={getR} nomeC={nomeC}
          onField={setDraftField} onToggleDoc={toggleDoc} onDot={toggleDot} onObs={setObs}
          onLimpar={limparRespostas} onSalvar={salvarAnalise} onFinalizar={finalizarAnalise}
          onEmailChange={(v) => { setEmailOverride(v); setEmailEditado(true) }}
          onCopiar={() => { navigator.clipboard.writeText(emailCorpo); showToast('E-mail copiado') }}
          onEml={baixarEml} onMailto={abrirMailto}
          onRegerar={() => { setEmailEditado(false); showToast('E-mail regerado') }}
        />
      )}

      {view === 'banco' && (
        <VBanco
          aba={bancoAba} setAba={setBancoAba} q={bancoQ} setQ={setBancoQ}
          contratante={bancoContratante} setContratante={setBancoContratante}
          status={bancoStatus} setStatus={setBancoStatus} de={bancoDe} setDe={setBancoDe} ate={bancoAte} setAte={setBancoAte}
          aberto={bancoAberto} setAberto={setBancoAberto} itemAberto={bancoItem} setItemAberto={setBancoItem}
          lista={bancoFiltrado} catalog={catalog} getC={getC} nomeC={nomeC} itensDaAnalise={itensDaAnalise}
          statusAnalise={statusAnalise} relatorioItens={relatorioItens}
          onLimparFiltros={() => { setBancoQ(''); setBancoContratante(''); setBancoStatus(''); setBancoDe(''); setBancoAte('') }}
          onDelFiltro={bDelFiltro} onExportCsv={exportarCsv} onDel={bDel} onReabrir={bReabrir}
        />
      )}

      {view === 'contratantes' && (
        <VContratantes catalog={catalog} getI={getI} onNovo={novaContratanteModal} onEditar={editarContratanteModal} onDel={delContratante} />
      )}

      {view === 'itens' && (
        <VItens catalog={catalog} getT={getT} onNovo={novoItemModal} onEditar={editarItemModal} onDel={delItem} />
      )}

      {view === 'textos' && (
        <VTextos catalog={catalog} CATS={CATS} onNovo={novoTextoModal} onEditar={editarTextoModal} onDel={delTexto} />
      )}

      {view === 'reprovacao' && (
        <VReprovacao catalog={catalog} onNovo={novoReprovacaoModal} onEditar={editarReprovacaoModal} onDel={delReprovacao} />
      )}

      {view === 'config' && (
        <VConfig config={catalog.config} onSalvar={salvarConfig} />
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
        <TextoModal draft={modalTextoEdit} CATS={CATS} onChange={setModalTextoEdit} onSave={salvarTextoModal} onClose={() => setModalTextoEdit(null)} />
      )}

      {modalReprovacaoEdit && (
        <ReprovacaoModal draft={modalReprovacaoEdit} novo={modalReprovacaoNovo} onChange={setModalReprovacaoEdit} onSave={salvarReprovacaoModal} onClose={() => setModalReprovacaoEdit(null)} />
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

function VAnalises({ lista, getC, nomeC, statusAnalise, onNova, onAbrir, onDel }: {
  lista: AnaliseRow[]; getC: (id?: string) => Contratante | undefined; nomeC: (c?: Contratante) => string
  statusAnalise: (r: AnaliseRow) => { t: string; c: 'ok' | 'no' | 'na'; k: string }
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
                  const s = statusAnalise(a), c = getC(a.dados.contratanteId)
                  return (
                    <tr key={a.id}>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                        <b>{a.empresa || '(sem nome)'}</b>
                        <div style={{ color: MU, fontSize: 12 }}>{a.cnpj}</div>
                      </td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{nomeC(c)}</td>
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

function VAnalise({ draft, catalog, emailCorpo, emailBuilt, modoReprovacao, itensDaAnalise, getT, getR, nomeC, onField, onToggleDoc, onDot, onObs, onLimpar, onSalvar, onFinalizar, onEmailChange, onCopiar, onEml, onMailto, onRegerar }: {
  draft: AnaliseDados; draftId: string | null; catalog: Catalog
  emailCorpo: string; emailBuilt: { assunto: string; corpo: string; pend: number; total: number; marcados: number } | null; modoReprovacao: boolean
  itensDaAnalise: (a: AnaliseDados) => (ChecklistItem & { textoLink: string })[]
  getT: (id?: string | null) => TextoEmail | undefined; getR: (id?: string | null) => TextoReprovacao | undefined; nomeC: (c?: Contratante) => string
  onField: <K extends keyof AnaliseDados>(k: K, v: AnaliseDados[K]) => void
  onToggleDoc: (d: DocKey) => void; onDot: (itemId: string, val: StatusResp) => void; onObs: (itemId: string, obs: string) => void
  onLimpar: () => void; onSalvar: () => void; onFinalizar: () => void
  onEmailChange: (v: string) => void; onCopiar: () => void; onEml: () => void; onMailto: () => void; onRegerar: () => void
}) {
  const itens = itensDaAnalise(draft)
  const grupos = DOC_ORDER.filter(d => itens.some(i => i.documento === d))
  const ok = itens.filter(i => draft.respostas[i.id]?.status === 'ok').length
  const na = itens.filter(i => draft.respostas[i.id]?.status === 'na').length
  const apl = itens.length - na
  const pct = apl ? Math.round(ok / apl * 100) : 0

  const dotDefs: { val: StatusResp; label: string; symbol: string; on: string; onFg: string }[] = [
    { val: 'ok', label: 'Conforme', symbol: '✓', on: OK, onFg: '#fff' },
    { val: 'nao', label: 'Não conforme — entra no e-mail', symbol: '✕', on: NO, onFg: '#fff' },
    { val: 'na', label: 'Não aplicável', symbol: '–', on: NA, onFg: '#fff' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: MU }}>Marque cada item — as não conformidades montam o e-mail automaticamente.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="gho" onClick={onLimpar}>Limpar respostas</Btn>
          <Btn onClick={onSalvar}>💾 Salvar rascunho</Btn>
          <Btn variant="acc" onClick={onFinalizar}>✔ Finalizar análise</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 430px', gap: 16, alignItems: 'start' }}>
        <div>
          <Card style={{ padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Empresa prestadora"><input style={inputStyle} value={draft.empresa} onChange={e => onField('empresa', e.target.value)} placeholder="Razão social" /></Field>
              <Field label="CNPJ"><input style={inputStyle} value={draft.cnpj} onChange={e => onField('cnpj', e.target.value)} placeholder="00.000.000/0001-00" /></Field>
              <Field label="Contratante">
                <select style={inputStyle} value={draft.contratanteId} onChange={e => onField('contratanteId', e.target.value)}>
                  {catalog.contratantes.length === 0 && <option value="">Cadastre uma contratante</option>}
                  {catalog.contratantes.map(c => <option key={c.id} value={c.id}>{nomeC(c)}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 12 }}>
              <Field label="E-mail de destino"><input style={inputStyle} type="email" value={draft.emailDestino} onChange={e => onField('emailDestino', e.target.value)} placeholder="contato@empresa.com.br" /></Field>
              <Field label="Data da análise"><input style={inputStyle} type="date" value={draft.data} onChange={e => onField('data', e.target.value)} /></Field>
              <Field label="Prazo de retorno"><input style={inputStyle} type="date" value={draft.prazo} onChange={e => onField('prazo', e.target.value)} /></Field>
              <Field label="Analista"><input style={inputStyle} value={draft.responsavel} onChange={e => onField('responsavel', e.target.value)} /></Field>
            </div>
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
            <div style={{ color: MU, fontSize: 12, marginTop: 6 }}>{ok} de {apl} itens conformes ({pct}%) · {na} não aplicáveis</div>
          </Card>

          {!itens.length ? (
            <Empty title="Nenhum item vinculado" sub="Cadastre a contratante e selecione os itens de checklist aplicáveis." />
          ) : grupos.map(d => {
            const g = itens.filter(i => i.documento === d)
            const okG = g.filter(i => draft.respostas[i.id]?.status === 'ok').length
            return (
              <div key={d} style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#fff' }}>
                <div style={{ background: '#F7F9FD', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${LINE}` }}>
                  <b style={{ fontSize: 13, letterSpacing: '.02em' }}>{d}</b>
                  <span style={{ color: MU, fontSize: 12 }}>{okG}/{g.length} conformes</span>
                </div>
                {g.map((i, idx) => {
                  const r = draft.respostas[i.id] || { status: '' as StatusResp, obs: '' }
                  const t = getT(i.textoLink)
                  const bg = r.status === 'nao' ? '#FEF8F8' : r.status === 'ok' ? '#F8FDFA' : undefined
                  return (
                    <div key={i.id} style={{ display: 'flex', gap: 14, padding: '12px 14px', borderBottom: idx < g.length - 1 ? '1px solid #F0F3F8' : undefined, alignItems: 'flex-start', background: bg }}>
                      <div style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
                        {dotDefs.map(dd => {
                          const on = r.status === dd.val
                          return (
                            <button key={dd.val} title={dd.label} onClick={() => onDot(i.id, dd.val)} style={{
                              width: 26, height: 26, borderRadius: '50%', border: `2px solid ${on ? dd.on : P}`, background: on ? dd.on : '#fff',
                              cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: on ? dd.onFg : '#A8B7D2',
                              boxShadow: on ? `0 0 0 3px ${dd.val === 'ok' ? OKS : dd.val === 'nao' ? NOS : NAS}` : '0 1px 2px rgba(42,79,150,.14)',
                            }}>{dd.symbol}</button>
                          )
                        })}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {i.titulo}
                          {i.critico && <Tag tone="no">crítico</Tag>}
                          {i.escopo === 'especifico' && <Tag tone="acc">exigência da contratante</Tag>}
                          {!t && <Tag tone="no">sem texto vinculado</Tag>}
                        </div>
                        <div style={{ fontSize: 12.5, color: MU, marginTop: 2 }}>{i.descricao}</div>
                        {r.status === 'nao' && i.critico && (
                          <div style={{ marginTop: 6, fontSize: 12, color: NO }}>
                            🚫 Reprovação: {getR(i.textoReprovacaoId)?.titulo || 'sem texto de reprovação vinculado — cadastre em Textos de reprovação'}
                          </div>
                        )}
                        {r.status === 'nao' && (
                          <input style={{ ...inputStyle, marginTop: 8, fontSize: 12.5, padding: '6px 9px' }} placeholder="Observação específica (entra no e-mail abaixo do texto padrão)"
                            value={r.obs} onChange={e => onObs(i.id, e.target.value)} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ background: modoReprovacao ? NO : P, color: '#fff', padding: '12px 16px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 13.5 }}>{modoReprovacao ? '🚫 Reprovação em construção' : '✉️ E-mail em construção'}</b>
            <span style={{ fontSize: 12 }}>
              {modoReprovacao
                ? (emailBuilt ? emailBuilt.pend + ' item(ns) crítico(s)' : '')
                : (emailBuilt ? (emailBuilt.pend ? emailBuilt.pend + ' pendência(s)' : (emailBuilt.marcados ? 'Sem pendências' : 'Nada avaliado')) : '')}
            </span>
          </div>
          {modoReprovacao && (
            <div style={{ background: NOS, color: NO, fontSize: 12, padding: '8px 16px', borderLeft: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}` }}>
              Item(ns) crítico(s) reprovado(s) — cadastro não pode ser liberado enquanto não forem corrigidos.
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
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── View: Banco de dados ───────────────────────────────────────────────────

function VBanco({ aba, setAba, q, setQ, contratante, setContratante, status, setStatus, de, setDe, ate, setAte, aberto, setAberto, itemAberto, setItemAberto, lista, catalog, getC, nomeC, itensDaAnalise, statusAnalise, relatorioItens, onLimparFiltros, onDelFiltro, onExportCsv, onDel, onReabrir }: {
  aba: 'empresas' | 'relatorio'; setAba: (v: 'empresas' | 'relatorio') => void
  q: string; setQ: (v: string) => void; contratante: string; setContratante: (v: string) => void
  status: string; setStatus: (v: string) => void; de: string; setDe: (v: string) => void; ate: string; setAte: (v: string) => void
  aberto: string | null; setAberto: (v: string | null) => void; itemAberto: string | null; setItemAberto: (v: string | null) => void
  lista: AnaliseRow[]; catalog: Catalog; getC: (id?: string) => Contratante | undefined; nomeC: (c?: Contratante) => string
  itensDaAnalise: (a: AnaliseDados) => (ChecklistItem & { textoLink: string })[]
  statusAnalise: (r: AnaliseRow) => { t: string; c: 'ok' | 'no' | 'na'; k: string }
  relatorioItens: (l: AnaliseRow[]) => { i: ChecklistItem; ok: number; nao: number; na: number; tot: number; empresasNao: string[]; empresasOk: string[] }[]
  onLimparFiltros: () => void; onDelFiltro: () => void; onExportCsv: () => void; onDel: (id: string, nome: string) => void; onReabrir: (r: AnaliseRow) => void
}) {
  const tot = lista.length
  const apr = lista.filter(a => statusAnalise(a).k === 'aprovada').length
  const naos = lista.reduce((n, a) => n + itensDaAnalise(a.dados).filter(i => a.dados.respostas[i.id]?.status === 'nao').length, 0)

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
              <option value="">Todas</option><option value="aprovada">Aprovadas</option><option value="pendencias">Com pendências</option>
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
          { l: 'Com pendências', v: tot - apr, c: NO },
          { l: 'Apontamentos gerados', v: naos, c: TX },
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
                  <thead><tr>{['Item avaliado', 'Conforme', 'Não conforme', 'N/A', 'Taxa de conformidade'].map(h => (
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
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag tone="na">{l.na}</Tag></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                              <div style={{ height: 6, background: NOS, borderRadius: 99, minWidth: 90, overflow: 'hidden' }}><div style={{ height: '100%', width: p + '%', background: OK }} /></div>
                              <span style={{ color: MU, fontSize: 11.5 }}>{p}% de {l.tot} avaliações</span>
                            </td>
                          </tr>
                          {open && (
                            <tr><td colSpan={5} style={{ padding: '8px 4px', borderBottom: `1px solid ${LINE}` }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div><label style={{ fontSize: 11, textTransform: 'uppercase', color: MU, fontWeight: 600 }}>Não conformes ({l.nao})</label>
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
                    const s = statusAnalise(a), c = getC(a.dados.contratanteId), itens = itensDaAnalise(a.dados)
                    const ok = itens.filter(i => a.dados.respostas[i.id]?.status === 'ok').length
                    const na = itens.filter(i => a.dados.respostas[i.id]?.status === 'na').length
                    const apl = itens.length - na, p = apl ? Math.round(ok / apl * 100) : 0
                    const open = aberto === a.id
                    return (
                      <Fragment key={a.id}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => setAberto(open ? null : a.id)}>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}><b>{a.empresa || '(sem nome)'}</b><div style={{ color: MU, fontSize: 12 }}>{a.cnpj}</div></td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{nomeC(c)}</td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{(a.dados.documentos || []).map(d => <span key={d} style={{ marginRight: 4 }}><Tag>{d}</Tag></span>)}</td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>{fmtD(a.data_final || a.dados.data)}</td>
                          <td style={{ padding: 10, borderBottom: `1px solid ${LINE}` }}>
                            <div style={{ height: 6, background: LINE, borderRadius: 99, minWidth: 90, overflow: 'hidden' }}><div style={{ height: '100%', width: p + '%', background: OK }} /></div>
                            <span style={{ color: MU, fontSize: 11.5 }}>{ok}/{apl} · {p}%</span>
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
                                  const map: Record<string, ['ok' | 'no' | 'na', string]> = { ok: ['ok', 'Conforme'], nao: ['no', 'Não conforme'], na: ['na', 'Não aplicável'] }
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
    const g = catalog.itens.filter(i => i.escopo === escopo && (!q || (i.titulo + i.descricao + i.documento).toLowerCase().includes(q.toLowerCase())))
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
        <div><span style={{ color: MU, fontSize: 12 }}>Aprovação</span>{selT('aprovadoId', 'fechamento')}</div>
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

function VItens({ catalog, getT, onNovo, onEditar, onDel }: {
  catalog: Catalog; getT: (id?: string | null) => TextoEmail | undefined
  onNovo: () => void; onEditar: (i: ChecklistItem) => void; onDel: (id: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: MU }}>Catálogo único de verificações. Itens &quot;base&quot; já entram em toda contratante nova.</div>
        <Btn variant="pri" onClick={onNovo}>✚ Novo item</Btn>
      </div>
      {DOC_ORDER.map(d => {
        const g = catalog.itens.filter(i => i.documento === d)
        if (!g.length) return null
        return (
          <Card key={d} style={{ marginBottom: 14 }}>
            <div style={{ padding: '14px 18px 0' }}><b>{d}</b> <span style={{ color: MU }}>· {g.length} itens</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
              <tbody>
                {g.map(i => (
                  <tr key={i.id}>
                    <td style={{ padding: '10px 18px', borderBottom: `1px solid ${LINE}` }}>
                      <b>{i.titulo}</b> {i.critico && <Tag tone="no">crítico</Tag>} {i.escopo === 'especifico' ? <Tag tone="acc">específico</Tag> : <Tag>base</Tag>}
                      <div style={{ color: MU, fontSize: 12 }}>{i.descricao}</div>
                    </td>
                    <td style={{ width: 200, padding: 10, borderBottom: `1px solid ${LINE}` }}>
                      {getT(i.textoId) ? <Tag tone="acc">{getT(i.textoId)!.titulo}</Tag> : <Tag tone="no">sem texto</Tag>}
                    </td>
                    <td style={{ width: 150, padding: 10, borderBottom: `1px solid ${LINE}`, textAlign: 'right' }}>
                      <Btn small onClick={() => onEditar(i)}>Editar</Btn>{' '}<Btn small variant="gho" onClick={() => onDel(i.id)}>Excluir</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      })}
    </div>
  )
}

function ItemModal({ draft, catalog, novo, onChange, onSave, onClose }: {
  draft: ChecklistItem; catalog: Catalog; novo: boolean; onChange: (i: ChecklistItem) => void; onSave: () => void; onClose: () => void
}) {
  function set<K extends keyof ChecklistItem>(k: K, v: ChecklistItem[K]) { onChange({ ...draft, [k]: v }) }
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
        <Field label={'Texto vinculado ao "não conforme"'}>
          <select style={inputStyle} value={draft.textoId} onChange={e => set('textoId', e.target.value)}>
            <option value="">— nenhum —</option>
            {catalog.textos.filter(t => t.categoria === 'apontamento').map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={draft.critico} onChange={e => set('critico', e.target.checked)} />
        <span>Item crítico (bloqueia a liberação)</span>
      </div>
      {draft.critico && (
        <div style={{ marginTop: 12 }}>
          <Field label="Texto de reprovação (quando este item crítico for marcado como não conforme)">
            <select style={inputStyle} value={draft.textoReprovacaoId} onChange={e => set('textoReprovacaoId', e.target.value)}>
              <option value="">— nenhum —</option>
              {catalog.textosReprovacao.filter(r => r.documento === draft.documento || draft.documento === 'GERAL').map(r => (
                <option key={r.id} value={r.id}>{r.titulo}{r.escopo === 'especifico' ? ' (específico)' : ''}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </ModalShell>
  )
}

// ─── View: Textos de e-mail ───────────────────────────────────────────────────

function VTextos({ catalog, CATS, onNovo, onEditar, onDel }: {
  catalog: Catalog; CATS: Record<CategoriaTexto, string>
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
                        <div style={{ color: MU, fontSize: 12, marginTop: 3 }}>{t.corpo.slice(0, 150)}{t.corpo.length > 150 ? '…' : ''}</div>
                      </td>
                      <td style={{ width: 110, padding: 10, borderBottom: `1px solid ${LINE}` }}><Tag>{usos} uso(s)</Tag></td>
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

const VARS = ['empresa', 'cnpj', 'contratante', 'unidade', 'prazo', 'data', 'responsavel']

function TextoModal({ draft, CATS, onChange, onSave, onClose }: {
  draft: TextoEmail; CATS: Record<CategoriaTexto, string>; onChange: (t: TextoEmail) => void; onSave: () => void; onClose: () => void
}) {
  function set<K extends keyof TextoEmail>(k: K, v: TextoEmail[K]) { onChange({ ...draft, [k]: v }) }
  return (
    <ModalShell title={draft.titulo ? 'Editar texto' : 'Novo texto'} onClose={onClose} onSave={onSave}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Título interno"><input style={inputStyle} value={draft.titulo} onChange={e => set('titulo', e.target.value)} /></Field>
        <Field label="Categoria">
          <select style={inputStyle} value={draft.categoria} onChange={e => set('categoria', e.target.value as CategoriaTexto)}>
            {(Object.entries(CATS) as [CategoriaTexto, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

// ─── View: Textos de reprovação ────────────────────────────────────────────────

function VReprovacao({ catalog, onNovo, onEditar, onDel }: {
  catalog: Catalog; onNovo: () => void; onEditar: (r: TextoReprovacao) => void; onDel: (id: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: MU, maxWidth: 640 }}>
          Textos usados quando um item <b>crítico</b> é marcado como não conforme — nesse caso, o painel &quot;E-mail em construção&quot;
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

function VConfig({ config, onSalvar }: { config: CatalogConfig; onSalvar: (patch: Partial<CatalogConfig>) => void }) {
  const [prazoDias, setPrazoDias] = useState(config.prazoDias)
  const [assunto, setAssunto] = useState(config.assunto)

  return (
    <div>
      <div style={{ fontSize: 13, color: MU, marginBottom: 14 }}>Padrões gerais usados como base para novas análises e novas contratantes.</div>
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 12, color: MU, background: PS, border: `1px solid ${LINE}`, borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
          O campo &quot;Analista&quot; de cada análise agora é preenchido automaticamente com o nome de quem está logado — não é mais um valor fixo aqui.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prazo padrão (dias)"><input style={inputStyle} value={prazoDias} onChange={e => setPrazoDias(parseInt(e.target.value) || 7)} /></Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Btn variant="pri" onClick={() => onSalvar({ prazoDias, assunto })}>Salvar padrões</Btn>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Assunto do e-mail"><input style={inputStyle} value={assunto} onChange={e => setAssunto(e.target.value)} /></Field>
        </div>
      </Card>
    </div>
  )
}
