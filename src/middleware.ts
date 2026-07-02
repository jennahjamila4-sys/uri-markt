import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * MUSS in `src/` liegen: Next.js lädt Middleware nur aus demselben
 * Wurzelverzeichnis wie `app/`. Im Projekt-Root wird sie stillschweigend
 * ignoriert – dann wird die Session nie refresht und der Login bricht weg.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresht bei Bedarf das Auth-Token; die neuen Cookies landen via setAll
  // sowohl im Request (für nachfolgende Server Components) als auch in der
  // Response (für den Browser). Ohne diesen Aufruf läuft die Session ab.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
