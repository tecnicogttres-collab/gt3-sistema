export type Role = 'colaborador' | 'gestor' | 'admin' | 'trainee'

export type Module = {
  id: string
  label: string
  color: string
  path: string
  description: string
  allowedRoles: Role[]
}

export const MODULES: Module[] = [
  {
    id: 'observacoes',
    label: 'Observações',
    color: '#4A90D9',
    path: '/observacoes',
    description: 'Categorias e subcategorias com cards copiáveis',
    allowedRoles: ['colaborador', 'gestor', 'admin', 'trainee'],
  },
  {
    id: 'cadastro',
    label: 'Cadastro Contratantes',
    color: '#27AE60',
    path: '/cadastro-contratantes',
    description: 'Tabela e ficha com campos editáveis inline',
    allowedRoles: ['gestor', 'admin'],
  },
  {
    id: 'emails',
    label: 'E-mails Padrão',
    color: '#9B59B6',
    path: '/emails',
    description: 'Templates com preview HTML e download .eml',
    allowedRoles: ['colaborador', 'gestor', 'admin', 'trainee'],
  },
  {
    id: 'manuais',
    label: 'Manuais',
    color: '#E67E22',
    path: '/manuais',
    description: 'Documentos com seções editáveis',
    allowedRoles: ['colaborador', 'gestor', 'admin', 'trainee'],
  },
  {
    id: 'homeoffice',
    label: 'Home Office',
    color: '#1ABC9C',
    path: '/home-office',
    description: 'Tabela mensal de dias por colaborador',
    allowedRoles: ['gestor', 'admin'],
  },
  {
    id: 'revisao',
    label: 'Revisões BSA',
    color: '#E74C3C',
    path: '/controle-revisao',
    description: 'Registro de inconsistências e escala de revisores',
    allowedRoles: ['gestor', 'admin'],
  },
  {
    id: 'atas',
    label: 'Atas',
    color: '#5B8DEF',
    path: '/atas',
    description: 'Atas por hierarquia Ano › Mês › Data',
    allowedRoles: ['colaborador', 'gestor', 'admin'],
  },
  {
    id: 'pdi',
    label: 'PDI',
    color: '#D1AE6E',
    path: '/pdi',
    description: 'Plano de Desenvolvimento Individual',
    allowedRoles: ['colaborador', 'gestor', 'admin'],
  },
  {
    id: 'logins',
    label: 'Usuários',
    color: '#EC4899',
    path: '/logins',
    description: 'Gestão de usuários e acessos',
    allowedRoles: ['admin', 'gestor'],
  },
  {
    id: 'aniversarios',
    label: 'Aniversários',
    color: '#F472B6',
    path: '/aniversarios',
    description: 'Calendário de aniversários dos colaboradores',
    allowedRoles: ['colaborador', 'gestor', 'admin'],
  },
  {
    id: 'prioridades',
    label: 'Prioridades',
    color: '#F97316',
    path: '/prioridades',
    description: 'Empresas em análise prioritária de documentação',
    allowedRoles: ['colaborador', 'gestor', 'admin'],
  },
  {
    id: 'revisoes-trainee',
    label: 'Revisões Trainee',
    color: '#10B981',
    path: '/revisoes-trainee',
    description: 'Acompanhamento diário de documentos por trainee',
    allowedRoles: ['colaborador', 'gestor', 'admin', 'trainee'],
  },
]
