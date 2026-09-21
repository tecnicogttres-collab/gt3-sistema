import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { getCaller } from '../../lib/api-helpers'

const SELECT = 'id, empresa, contratante, setores, documentos, situacao_id, responsaveis, motivo, data_verificacao, tratativa, ciencia_por, retorno_recebido, retorno_em, criado_por, created_at, updated_at'

export async function GET() {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('designacoes')
    .select(SELECT)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const caller = await getCaller()
  if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const {
    empresa, data_verificacao, setores, documentos, situacao_id, responsaveis, motivo,
  } = body

  if (!empresa?.trim()) return Response.json({ error: 'Empresa obrigatória' }, { status: 400 })
  if (!Array.isArray(setores) || setores.length === 0) {
    return Response.json({ error: 'Selecione ao menos um setor' }, { status: 400 })
  }
  if (!Array.isArray(documentos) || documentos.length === 0) {
    return Response.json({ error: 'Selecione ao menos um documento' }, { status: 400 })
  }
  if (!situacao_id) return Response.json({ error: 'Status do documento obrigatório' }, { status: 400 })
  if (!Array.isArray(responsaveis) || responsaveis.length === 0) {
    return Response.json({ error: 'Selecione ao menos um responsável' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Empresa cadastrada? usa o contratante dela; senão salva como texto livre.
  const { data: empresasMatch } = await admin
    .from('desig_empresas')
    .select('nome, contratante')
    .ilike('nome', empresa.trim())

  const empresaCad = (empresasMatch ?? []).find(
    (e: { nome: string }) => e.nome.trim().toLowerCase() === empresa.trim().toLowerCase()
  ) as { nome: string; contratante: string } | undefined

  const { data, error } = await admin
    .from('designacoes')
    .insert({
      empresa: empresa.trim(),
      contratante: empresaCad?.contratante ?? '',
      setores,
      documentos,
      situacao_id,
      responsaveis,
      motivo: motivo?.trim() || '',
      data_verificacao: data_verificacao || new Date().toISOString().slice(0, 10),
      tratativa: 'aguardando',
      ciencia_por: [],
      criado_por: caller.user.id,
    })
    .select(SELECT)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Histórico + notificações — best-effort, não bloqueia a resposta
  try {
    await admin.from('designacoes_historico').insert({
      designacao_id: data.id,
      por: caller.user.id,
      acao: 'Designação criada',
    })

    const targetIds: string[] = [...new Set(responsaveis as string[])]
    if (targetIds.length > 0) {
      await admin.from('notificacoes_usuario').insert(
        targetIds.map(uid => ({ usuario_id: uid, modulo: 'designacao_reprovados', visto: false }))
      )
    }
  } catch { /* não bloqueia a resposta */ }

  return Response.json(data)
}
