import { createServerClient as _create } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Next.js 15: `cookies()` ist async und MUSS awaited werden.
 * Deshalb ist diese Factory async – alle Aufrufer nutzen `await createServerClient()`.
 * Ohne await werden Session-Cookies beim Code-Exchange nicht geschrieben → Login bricht weg.
 */
export async function createServerClient() {
  const store = await cookies()
  return _create<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            )
          } catch (error) {
            // Cookie-Writes sind in Server Components nicht erlaubt – Next.js wirft
            // dort einen bekannten Fehler. Das ist unkritisch, weil die Middleware
            // die Session bei jedem Request auffrischt. Jeder ANDERE Fehler wird geworfen.
            if (!isReadonlyCookiesError(error)) throw error
          }
        },
      },
    }
  )
}

/**
 * Trifft nur den Fall zu, dass Cookies aus einer Server Component heraus
 * geschrieben werden sollen (dort read-only). Alles andere ist ein echter Fehler.
 */
function isReadonlyCookiesError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Server Action or Route Handler/i.test(error.message)
  )
}
