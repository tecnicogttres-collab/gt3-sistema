import { type NextRequest } from 'next/server'
import { createAdminClient } from '../../../lib/supabase-admin'
import type { Pergunta } from '../../../questionarios/types'

type Params = { params: Promise<{ token: string }> }

/* Rota PÚBLICA (sem login) — o token do convite é a única credencial. Só expõe o que o
   respondente precisa ver: título, empresa e perguntas. Nada de outros convites/respostas. */

const TOKEN_RE = /^[a-f0-9]{16,64}$/

async function carregar(token: string) {
  if (!TOKEN_RE.test(token)) return null
  const admin = createAdminClient()
  const { data: conv } = await admin
    .from('questionario_convites')
    .select('id, questionario_id, nome, empresa, vinculo, status')
    .eq('token', token)
    .maybeSingle()
  if (!conv) return null
  const { data: qn } = await admin
    .from('questionarios')
    .select('titulo, status, perguntas')
    .eq('id', conv.questionario_id)
    .single()
  if (!qn) return null
  return { conv, qn: qn as { titulo: string; status: string; perguntas: Pergunta[] } }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const r = await carregar(token)
  if (!r) return Response.json({ error: 'Link inválido' }, { status: 404 })
  return Response.json({
    titulo: r.qn.titulo,
    empresa: r.conv.empresa,
    vinculo: r.conv.vinculo,
    disponivel: r.qn.status === 'ativo',
    respondido: r.conv.status === 'respondido',
    perguntas: r.qn.status === 'ativo' && r.conv.status !== 'respondido' ? r.qn.perguntas : [],
    total_perguntas: r.qn.perguntas.length,
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  const r = await carregar(token)
  if (!r) return Response.json({ error: 'Link inválido' }, { status: 404 })
  if (r.qn.status !== 'ativo') return Response.json({ error: 'Este questionário não está recebendo respostas no momento.' }, { status: 400 })
  if (r.conv.status === 'respondido') return Response.json({ error: 'Este link já foi utilizado.' }, { status: 409 })

  const body = await req.json().catch(() => ({})) as { respostas?: Record<string, unknown> }
  const recebidas = body.respostas ?? {}
  const respostas: Record<string, string | number> = {}

  for (const q of r.qn.perguntas) {
    const v = recebidas[q.id]
    if (q.type === 'escala') {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 5) return Response.json({ error: 'Responda todas as perguntas de nota e de múltipla escolha.' }, { status: 400 })
      respostas[q.id] = n
    } else if (q.type === 'multipla') {
      if (typeof v !== 'string' || !(q.options ?? []).includes(v)) return Response.json({ error: 'Responda todas as perguntas de nota e de múltipla escolha.' }, { status: 400 })
      respostas[q.id] = v
    } else if (typeof v === 'string' && v.trim()) {
      respostas[q.id] = v.trim().slice(0, 5000)
    }
  }

  // Condição no status garante uma única resposta mesmo com dois envios simultâneos
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('questionario_convites')
    .update({ respostas, status: 'respondido', respondido_em: new Date().toISOString() })
    .eq('id', r.conv.id)
    .neq('status', 'respondido')
    .select('id')
  if (error) return Response.json({ error: 'Erro ao registrar a resposta.' }, { status: 500 })
  if (!data?.length) return Response.json({ error: 'Este link já foi utilizado.' }, { status: 409 })

  return Response.json({ ok: true, empresa: r.conv.empresa, vinculo: r.conv.vinculo })
}
