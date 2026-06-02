import { createServerClient as _create, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export function createServerClient() {
  const store = cookies()
  return _create<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => store.get(n)?.value,
        set: (n, v, o: CookieOptions) => {
          try {
            store.set({ name: n, value: v, ...o })
          } catch {}
        },
        remove: (n, o: CookieOptions) => {
          try {
            store.set({ name: n, value: '', ...o })
          } catch {}
        },
      },
    }
  )
}
