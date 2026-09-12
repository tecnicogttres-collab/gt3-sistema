import { NextRequest } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase-admin'
import { createClient } from '../../../../lib/supabase-server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: ata_id } = await params
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('papel').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 403 })
  if (profile.papel !== 'gestor' && profile.papel !== 'admin') {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const [{ data: leituras }, { data: todos }, { data: { users: authUsers } }] = await Promise.all([
    admin.from('atas_contratantes_leituras')
      .select('user_id, lido_em, leitor:profiles!user_id(nome)')
      .eq('ata_id', ata_id),
    admin.from('profiles').select('id, nome').in('papel', ['colaborador', 'trainee']),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  // Conta desativada (ex.: colaborador que saiu) não entra em "pendente de leitura" —
  // o histórico de quem já leu antes de sair permanece intacto, só some da cobrança.
  const bannedSet = new Set(
    authUsers
      .filter(u => { const b = (u as unknown as { banned_until?: string }).banned_until; return b ? new Date(b) > new Date() : false })
      .map(u => u.id)
  )

  const lidoSet = new Set((leituras ?? []).map((l: { user_id: string }) => l.user_id))
  const leram = (leituras ?? []).map((l: { user_id: string; lido_em: string; leitor: unknown }) => ({
    user_id: l.user_id,
    lido_em: l.lido_em,
    nome: (l.leitor as { nome: string } | null)?.nome ?? '—',
  }))
  const naoLeram = (todos ?? [])
    .filter((p: { id: string }) => !lidoSet.has(p.id) && p.id !== user.id && !bannedSet.has(p.id))
    .map((p: { id: string; nome: string }) => ({ user_id: p.id, nome: p.nome }))

  return Response.json({ leram, naoLeram })
}
