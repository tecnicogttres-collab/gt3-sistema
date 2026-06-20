export type Role = 'colaborador' | 'gestor' | 'admin' | 'trainee'

export type Module = {
  id: string
  label: string
  color: string
  path: string
  description: string
  /** Quem vê o módulo na sidebar */
  allowedRoles: Role[]
  /**
   * Quem vê o card no Dashboard. Se omitido, usa allowedRoles.
   * Use para restringir a dashboard a um subconjunto dos perfis da sidebar.
   */
  dashboardRoles?: Role[]
}

export const MODULES: Module[] = [
  // ── Visíveis para todos na sidebar e no Dashboard ───────────
  {
    id: 'observacoes',
    label: 'Observações',
    color: '#4A90D9',
    path: '/observacoes',
    description: 'Categorias e subcategorias com cards copiáveis',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'terceiras',
    label: 'Cadastro Terceiras',
    color: '#4A90D9',
    path: '/cadastro-terceiras',
    description: 'Acompanhamento por etapas do cadastro de empresas terceiras',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'cadastro',
    label: 'Cadastro Contratantes',
    color: '#4A90D9',
    path: '/cadastro-contratantes',
    description: 'Tabela e ficha com campos editáveis inline',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'emails',
    label: 'E-mails Padrão',
    color: '#4A90D9',
    path: '/emails',
    description: 'Templates com preview HTML e download .eml',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'pgr-pcmso-ltcat',
    label: 'PGR / PCMSO / LTCAT',
    color: '#4A90D9',
    path: '/pgr-pcmso-ltcat',
    description: 'Construtor de e-mails de parecer SSO com configuração por contratante',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'manuais',
    label: 'Manuais',
    color: '#4A90D9',
    path: '/manuais',
    description: 'Documentos com seções editáveis',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'sugestoes',
    label: 'Sugestões',
    color: '#4A90D9',
    path: '/sugestoes',
    description: 'Caixa de sugestões anônimas',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'enquetes',
    label: 'Enquetes',
    color: '#4A90D9',
    path: '/enquetes',
    description: 'Pesquisas e votações internas',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'lembretes',
    label: 'Lembretes',
    color: '#4A90D9',
    path: '/lembretes',
    description: 'Lembretes recorrentes e únicos da equipe',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'pdi',
    label: 'PDI',
    color: '#D1AE6E',
    path: '/pdi',
    description: 'Plano de Desenvolvimento Individual',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'anotacoes-cic',
    label: 'Anotações CIC',
    color: '#4A90D9',
    path: '/anotacoes-cic',
    description: 'Registros de exceções, concessões e pendências de contratantes por feira',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'legislacoes',
    label: 'Legislações',
    color: '#4A90D9',
    path: '/legislacoes',
    description: 'Atualizações normativas direcionadas à equipe',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'revisoes-docs',
    label: 'Revisões Documentos',
    color: '#4A90D9',
    path: '/revisoes-docs',
    description: 'Checklists de pendências por revisão com campos configuráveis',
    allowedRoles: ['colaborador', 'gestor', 'admin'],
  },
  // ── Trainee, Gestor e Admin ─────────────────────────────────
  {
    id: 'revisoes-trainee',
    label: 'Revisões Trainee',
    color: '#4A90D9',
    path: '/revisoes-trainee',
    description: 'Acompanhamento diário de documentos por trainee',
    allowedRoles: ['trainee', 'gestor', 'admin'],
  },
  // ── Todos na sidebar; só Gestor e Admin no Dashboard ────────
  {
    id: 'prioridades',
    label: 'Prioridades',
    color: '#4A90D9',
    path: '/prioridades',
    description: 'Empresas em análise prioritária de documentação',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
    dashboardRoles: ['gestor', 'admin'],
  },
  // ── Gestor e Admin na sidebar; só Admin no Dashboard ────────
  {
    id: 'homeoffice',
    label: 'Home Office',
    color: '#4A90D9',
    path: '/home-office',
    description: 'Tabela mensal de dias por colaborador',
    allowedRoles: ['gestor', 'admin'],
    dashboardRoles: ['admin'],
  },
  {
    id: 'ferias',
    label: 'Calendário de Férias',
    color: '#4A90D9',
    path: '/calendario-ferias',
    description: 'Registro e visualização de férias por colaborador',
    allowedRoles: ['gestor', 'admin'],
    dashboardRoles: ['admin'],
  },
  {
    id: 'revisao',
    label: 'Revisões BSA',
    color: '#4A90D9',
    path: '/controle-revisao',
    description: 'Registro de inconsistências e escala de revisores',
    allowedRoles: ['gestor', 'admin'],
    dashboardRoles: ['admin'],
  },
  {
    id: 'atas',
    label: 'Atas GT3',
    color: '#4A90D9',
    path: '/atas',
    description: 'Atas internas GT3 — Ano › Mês › Data',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
    dashboardRoles: ['admin'],
  },
  {
    id: 'atas-contratantes',
    label: 'Atas Contratantes',
    color: '#4A90D9',
    path: '/atas-contratantes',
    description: 'Atas de reunião com contratantes',
    allowedRoles: ['gestor', 'admin'],
    dashboardRoles: ['admin'],
  },
  {
    id: 'repositorio-modelos',
    label: 'Repositório de Modelos',
    color: '#4A90D9',
    path: '/repositorio-modelos',
    description: 'Armazenamento de arquivos modelo para as contratantes',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
    dashboardRoles: ['gestor', 'admin'],
  },
  // ── Exclusivos do Admin (sidebar + Dashboard) ────────────────
  {
    id: 'notificacoes',
    label: 'Notificações',
    color: '#4A90D9',
    path: '/notificacoes',
    description: 'Configuração de alertas por módulo',
    allowedRoles: ['admin'],
  },
  {
    id: 'logins',
    label: 'Usuários',
    color: '#4A90D9',
    path: '/logins',
    description: 'Gestão de usuários e acessos',
    allowedRoles: ['admin', 'gestor'],
  },
  {
    id: 'aniversarios',
    label: 'Aniversários',
    color: '#4A90D9',
    path: '/aniversarios',
    description: 'Calendário de aniversários dos colaboradores',
    allowedRoles: ['admin'],
  },
  {
    id: 'ramais',
    label: 'Ramais',
    color: '#4A90D9',
    path: '/ramais',
    description: 'Lista de ramais internos da GT3',
    allowedRoles: ['admin'],
  },
  {
    id: 'frases',
    label: 'Frases Diárias',
    color: '#4A90D9',
    path: '/frases-diarias',
    description: 'Gestão de frases motivacionais diárias',
    allowedRoles: ['admin'],
  },
]
