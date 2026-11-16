import { cookies } from 'next/headers'

/* "Ver como" no servidor. O admin marca um perfil no topo do sistema (UserContext grava o cookie
   gt3_ver_como) e as rotas que usam este helper passam a responder como aquele perfil, para ele
   enxergar exatamente o que a pessoa vê, inclusive os dados.

   Seguro por construção: o cookie só vale quando o papel REAL (lido do banco) é admin, e o admin
   já tem acesso a tudo, então o cookie só pode REDUZIR permissões, nunca aumentar. Para qualquer
   outro usuário o cookie é ignorado. */

export const COOKIE_VER_COMO = 'gt3_ver_como'
const PAPEIS = ['gestor', 'colaborador', 'trainee'] as const

/** Papel a usar na checagem de acesso: o real, ou o do "Ver como" se o real for admin. */
export async function papelEfetivo<T extends string | null | undefined>(papelReal: T): Promise<T | (typeof PAPEIS)[number]> {
  if (papelReal !== 'admin') return papelReal
  try {
    const v = (await cookies()).get(COOKIE_VER_COMO)?.value
    if (v && (PAPEIS as readonly string[]).includes(v)) return v as (typeof PAPEIS)[number]
  } catch { /* fora de request (build): segue com o papel real */ }
  return papelReal
}
