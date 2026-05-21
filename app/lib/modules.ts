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
    id: 'cadastro',
    label: 'Cadastro Contratantes',
    color: '#27AE60',
    path: '/cadastro-contratantes',
    description: 'Tabela e ficha com campos editáveis inline',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'emails',
    label: 'E-mails Padrão',
    color: '#9B59B6',
    path: '/emails',
    description: 'Templates com preview HTML e download .eml',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'manuais',
    label: 'Manuais',
    color: '#E67E22',
    path: '/manuais',
    description: 'Documentos com seções editáveis',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
  },
  {
    id: 'sugestoes',
    label: 'Sugestões',
    color: '#059669',
    path: '/sugestoes',
    description: 'Caixa de sugestões anônimas',
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
  // ── Trainee, Gestor e Admin ─────────────────────────────────
  {
    id: 'revisoes-trainee',
    label: 'Revisões Trainee',
    color: '#10B981',
    path: '/revisoes-trainee',
    description: 'Acompanhamento diário de documentos por trainee',
    allowedRoles: ['trainee', 'gestor', 'admin'],
  },
  // ── Todos na sidebar; só Gestor e Admin no Dashboard ────────
  {
    id: 'prioridades',
    label: 'Prioridades',
    color: '#F97316',
    path: '/prioridades',
    description: 'Empresas em análise prioritária de documentação',
    allowedRoles: ['colaborador', 'trainee', 'gestor', 'admin'],
    dashboardRoles: ['gestor', 'admin'],
  },
  // ── Gestor e Admin na sidebar; só Admin no Dashboard ────────
  {
    id: 'homeoffice',
    label: 'Home Office',
    color: '#1ABC9C',
    path: '/home-office',
    description: 'Tabela mensal de dias por colaborador',
    allowedRoles: ['gestor', 'admin'],
    dashboardRoles: ['admin'],
  },
  {
    id: 'revisao',
    label: 'Revisões BSA',
    color: '#E74C3C',
    path: '/controle-revisao',
    description: 'Registro de inconsistências e escala de revisores',
    allowedRoles: ['gestor', 'admin'],
    dashboardRoles: ['admin'],
  },
  {
    id: 'atas',
    label: 'Atas',
    color: '#5B8DEF',
    path: '/atas',
    description: 'Atas por hierarquia Ano › Mês › Data',
    allowedRoles: ['gestor', 'admin'],
    dashboardRoles: ['admin'],
  },
  // ── Exclusivos do Admin (sidebar + Dashboard) ────────────────
  {
    id: 'notificacoes',
    label: 'Notificações',
    color: '#EF4444',
    path: '/notificacoes',
    description: 'Configuração de alertas por módulo',
    allowedRoles: ['admin'],
  },
  {
    id: 'logins',
    label: 'Usuários',
    color: '#EC4899',
    path: '/logins',
    description: 'Gestão de usuários e acessos',
    allowedRoles: ['admin'],
  },
  {
    id: 'aniversarios',
    label: 'Aniversários',
    color: '#F472B6',
    path: '/aniversarios',
    description: 'Calendário de aniversários dos colaboradores',
    allowedRoles: ['admin'],
  },
  {
    id: 'ramais',
    label: 'Ramais',
    color: '#0EA5E9',
    path: '/ramais',
    description: 'Lista de ramais internos da GT3',
    allowedRoles: ['admin'],
  },
  {
    id: 'frases',
    label: 'Frases Diárias',
    color: '#8B5CF6',
    path: '/frases-diarias',
    description: 'Gestão de frases motivacionais diárias',
    allowedRoles: ['admin'],
  },
]
