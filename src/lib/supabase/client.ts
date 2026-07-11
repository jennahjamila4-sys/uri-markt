import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Genau EIN Browser-Client pro Tab (Singleton). Mehrere Instanzen erzeugen
 * mehrere GoTrue-Clients, die beim Seitenaufbau parallel denselben Refresh-Token
 * rotieren wollen → Race → „refresh token already used" → getUser() schlägt fehl
 * → der Nutzer wirkt nach einer Navigation ausgeloggt. Supabase warnt explizit vor
 * mehreren GoTrueClient-Instanzen. Deshalb wird der Client modulweit gecacht.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}
