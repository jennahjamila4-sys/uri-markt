import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Service-Role-Client – NUR im Server-Kontext (Server Actions / Route Handler)
 * verwenden. Umgeht RLS und darf deshalb NIE in Client-Code importiert werden.
 * Wird ausschliesslich von Server Actions importiert, damit der Service-Role-Key
 * nie ins Browser-Bundle gelangt.
 *
 * Aktuell genutzt für die Konto-Löschung (`auth.admin.deleteUser`), die
 * Admin-Rechte braucht.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Service-Role-Konfiguration fehlt (SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
