import { NextRequest } from 'next/server'
import { createAdminClient } from '../../lib/supabase-admin'
import { renderAtaHtml } from '../../lib/ata-html'
import type { Participante, Topico } from '../../atas/AtasEditor'

type Params = { params: Promise<{ token: string }> }

function parseTopicos(val: string | null): Topico[] {
  if (!val?.trim()) return []
  try { const t = JSON.parse(val); if (Array.isArray(t)) return t } catch {}
  return []
}

function parseParticipantes(val: string | null): Participante[] {
  if (!val?.trim()) return []
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p } catch {}
  return val.split(/[,;]/).map(s => ({ nome: s.trim(), empresa: '' })).filter(p => p.nome)
}

function notFoundPage(): Response {
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Ata não disponível</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:80px auto;padding:0 24px;color:#1a1f2e;text-align:center}</style>
</head><body>
<div style="font-size:48px;margin-bottom:8px">🔒</div>
<div style="font-size:18px;font-weight:700;color:#2A4F96;margin-bottom:8px">Ata não disponível</div>
<div style="font-size:14px;color:#5a6178;line-height:1.6">Este link não existe, expirou ou o compartilhamento foi desativado.<br>Solicite um novo link a quem te enviou.</div>
</body></html>`
  return new Response(html, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  // Token é o segredo de acesso (URL de capacidade). Sem token válido, nada é exposto.
  if (!token || token.length < 16) return notFoundPage()

  const admin = createAdminClient()
  const { data: ata, error } = await admin
    .from('atas_contratantes')
    .select('titulo, data, cliente, local_reuniao, numero_ata, status, conteudo, participantes, share_enabled')
    .eq('share_token', token)
    .maybeSingle()

  // 404 se: não achou, erro, ou compartilhamento desativado. Mesma resposta p/ não vazar existência.
  if (error || !ata || !ata.share_enabled) return notFoundPage()

  const html = renderAtaHtml(
    {
      titulo: ata.titulo,
      data: ata.data,
      cliente: ata.cliente,
      local_reuniao: ata.local_reuniao,
      numero_ata: ata.numero_ata,
      status: ata.status,
    },
    parseTopicos(ata.conteudo),
    parseParticipantes(ata.participantes),
  )

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  })
}
