export type Module = {
  id: string
  label: string
  color: string
  path: string
  description: string
}

export const MODULES: Module[] = [
  {
    id: 'observacoes',
    label: 'Observações',
    color: '#4A90D9',
    path: '/observacoes',
    description: 'Categorias e subcategorias com cards copiáveis',
  },
  {
    id: 'cadastro',
    label: 'Cadastro Contratantes',
    color: '#27AE60',
    path: '/cadastro-contratantes',
    description: 'Tabela e ficha com campos editáveis inline',
  },
  {
    id: 'emails',
    label: 'E-mails Padrão',
    color: '#9B59B6',
    path: '/emails',
    description: 'Templates com preview HTML e download .eml',
  },
  {
    id: 'manuais',
    label: 'Manuais',
    color: '#E67E22',
    path: '/manuais',
    description: 'Documentos com seções editáveis',
  },
  {
    id: 'homeoffice',
    label: 'Home Office',
    color: '#1ABC9C',
    path: '/home-office',
    description: 'Tabela mensal de dias por colaborador',
  },
  {
    id: 'revisao',
    label: 'Controle de Revisão',
    color: '#E74C3C',
    path: '/controle-revisao',
    description: 'Registro de inconsistências e escala de revisores',
  },
  {
    id: 'atas',
    label: 'Atas',
    color: '#5B8DEF',
    path: '/atas',
    description: 'Atas por hierarquia Ano › Mês › Data',
  },
  {
    id: 'pdi',
    label: 'PDI',
    color: '#D1AE6E',
    path: '/pdi',
    description: 'Plano de Desenvolvimento Individual',
  },
]
