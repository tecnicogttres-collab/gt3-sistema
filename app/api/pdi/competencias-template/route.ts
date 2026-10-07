import { createAdminClient } from '../../../lib/supabase-admin'
import * as allPdis from '../../../../data/pdis/index'
import type { PdiColaborador } from '../../../../data/pdis/types'
import { getAuthUser } from '../../../lib/api-helpers'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json([], { status: 401 })

  const admin = createAdminClient()

  // Return competências from the most recently created DB PDI that has them defined
  const { data } = await admin
    .from('pdis')
    .select('competencias')
    .not('competencias', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const comps = data?.competencias as string[] | null
  if (comps && Array.isArray(comps) && comps.length > 0) {
    return Response.json(comps)
  }

  // Fallback: use the standard competências from static PDIs
  const first = Object.values(allPdis)[0] as PdiColaborador
  const staticComps = first?.matrizAvaliacao?.competencias ?? []
  return Response.json(staticComps)
}
