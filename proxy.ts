import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Internals do Next.js, API routes e arquivos estáticos: passa sem checar auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    // Link público do questionário (respondente externo, sem login)
    pathname.startsWith('/questionario/') ||
    /\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|otf|eot|mp4|pdf)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() valida a assinatura do token localmente (chave ECC do projeto) e só vai
  // ao Supabase quando o token precisa ser renovado — antes, getUser() consultava o Auth
  // em toda navegação/prefetch de página.
  let user: string | null = null
  try {
    const { data } = await supabase.auth.getClaims()
    user = data?.claims?.sub ?? null
  } catch {
    return supabaseResponse
  }

  const isLoginPage = pathname === '/login'

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/(.*)'],
}
