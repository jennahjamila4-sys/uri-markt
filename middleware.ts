import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => request.cookies.get(n)?.value,
        set: (n, v, o: CookieOptions) => {
          request.cookies.set({ name: n, value: v, ...o })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name: n, value: v, ...o })
        },
        remove: (n, o: CookieOptions) => {
          request.cookies.set({ name: n, value: '', ...o })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name: n, value: '', ...o })
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
