'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Each dynamic() call returns a stable component type — never recreated.
// TabContentCache uses React.createElement(Comp) once per path, so the
// exact same element object sits in the hidden div forever → React never
// reconciles it → component instance + all state are preserved.

const DynDashboard        = dynamic(() => import('../page'),                                            { ssr: false })
const DynObservacoes      = dynamic(() => import('../observacoes/ObservacoesClient'),                   { ssr: false })
const DynCadastro         = dynamic(() => import('../cadastro-contratantes/CadastroClient'),            { ssr: false })
const DynTerceiras        = dynamic(() => import('../cadastro-terceiras/CadastroTerceirasClient'),      { ssr: false })
const DynEmails           = dynamic(() => import('../emails/EmailsClient'),                             { ssr: false })
const DynManuais          = dynamic(() => import('../manuais/ManuaisClient'),                          { ssr: false })
const DynHomeOffice       = dynamic(() => import('../home-office/HomeOfficeClient'),                    { ssr: false })
const DynCafe             = dynamic(() => import('../cafe/CafeClient'),                                  { ssr: false })
const DynControleRevisao  = dynamic(() => import('../controle-revisao/ControleRevisaoClient'),          { ssr: false })
const DynRevisoesTrainee  = dynamic(() => import('../revisoes-trainee/RevisoesTraineeClient'),          { ssr: false })
const DynPgrPcmso         = dynamic(() => import('../pgr-pcmso-ltcat/PgrPcmsoClient'),                   { ssr: false })
const DynWorkflowProgramas = dynamic(() => import('../workflow-programas/WorkflowProgramasClient'),      { ssr: false })
const DynSugestoes        = dynamic(() => import('../sugestoes/SugestoesClient'),                       { ssr: false })
const DynEnquetes         = dynamic(() => import('../enquetes/EnquetesClient'),                        { ssr: false })
const DynLembretes        = dynamic(() => import('../lembretes/LembretesClient'),                      { ssr: false })
const DynPrioridades      = dynamic(() => import('../prioridades/PrioridadesClient'),                  { ssr: false })
const DynCalendario       = dynamic(() => import('../calendario-ferias/CalendarioFeriasClient'),        { ssr: false })
const DynLogins           = dynamic(() => import('../logins/LoginsClient'),                            { ssr: false })
const DynAniversarios     = dynamic(() => import('../aniversarios/AniversariosClient'),                { ssr: false })
const DynRamais           = dynamic(() => import('../ramais/RamaisClient'),                            { ssr: false })
const DynFrases           = dynamic(() => import('../frases-diarias/FrasesClient'),                   { ssr: false })
const DynNotificacoes     = dynamic(() => import('../notificacoes/NotificacoesClient'),                { ssr: false })
const DynPerfil           = dynamic(() => import('../perfil/PerfilClient'),                            { ssr: false })
const DynCoisasAFazer     = dynamic(() => import('../coisas-a-fazer/CoisasAFazerClient'),              { ssr: false })

// AtasClient calls useSearchParams() — must live inside a Suspense boundary.
const DynAtas = dynamic(() => import('../atas/AtasClient'), { ssr: false })
function AtasWithSuspense() {
  return <Suspense fallback={null}><DynAtas /></Suspense>
}

const DynAtasContratantes   = dynamic(() => import('../atas-contratantes/AtasContratantesClient'), { ssr: false })
const DynRepositorioModelos = dynamic(() => import('../repositorio-modelos/RepositorioClient'),    { ssr: false })
const DynRevisaoNR          = dynamic(() => import('../revisao-nr/RevisaoNRClient'),                { ssr: false })
function AtasContratantesWithSuspense() {
  return <Suspense fallback={null}><DynAtasContratantes /></Suspense>
}

export const MODULE_COMPONENT_MAP: Record<string, React.ComponentType> = {
  '/':                   DynDashboard,
  '/observacoes':        DynObservacoes,
  '/cadastro-contratantes': DynCadastro,
  '/cadastro-terceiras': DynTerceiras,
  '/emails':             DynEmails,
  '/manuais':            DynManuais,
  '/home-office':        DynHomeOffice,
  '/cafe':               DynCafe,
  '/controle-revisao':   DynControleRevisao,
  '/revisoes-trainee':   DynRevisoesTrainee,
  '/sugestoes':          DynSugestoes,
  '/enquetes':           DynEnquetes,
  '/lembretes':          DynLembretes,
  '/prioridades':        DynPrioridades,
  '/calendario-ferias':  DynCalendario,
  '/atas':               AtasWithSuspense,
  '/atas-contratantes':  AtasContratantesWithSuspense,
  '/logins':             DynLogins,
  '/aniversarios':       DynAniversarios,
  '/ramais':             DynRamais,
  '/frases-diarias':     DynFrases,
  '/notificacoes':       DynNotificacoes,
  '/perfil':             DynPerfil,
  '/coisas-a-fazer':     DynCoisasAFazer,
  '/pgr-pcmso-ltcat':       DynPgrPcmso,
  '/workflow-programas':    DynWorkflowProgramas,
  '/repositorio-modelos':   DynRepositorioModelos,
  '/revisao-nr':            DynRevisaoNR,
}
