import { readFileSync } from 'node:fs'

/**
 * Preflight (Lektion 14): prueft VOR jedem E2E-Lauf, dass alle benoetigten
 * Env-Variablen in .env.local gesetzt (und nicht leer) sind. Fehlt etwas, stoppt
 * der Lauf SOFORT mit einer klaren "FEHLT: X - so beheben: Y"-Meldung, statt
 * mitten im Test rot zu werden. So muss .env.local nie manuell geprueft werden.
 */
function loadEnv(): Record<string, string> {
  const map: Record<string, string> = {}
  const txt = readFileSync('.env.local', 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0) map[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return map
}

const REQUIRED: { key: string; fix: string }[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', fix: 'Supabase-Projekt-URL in .env.local eintragen.' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', fix: 'Anon-Key (Supabase > Settings > API) in .env.local.' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', fix: 'Service-Role-Key (Supabase > Settings > API) in .env.local.' },
  { key: 'STRIPE_SECRET_KEY', fix: 'Stripe Secret Key (sk_test_...) in .env.local.' },
  { key: 'STRIPE_WEBHOOK_SECRET', fix: '"Uri-Markt Stripe Webhook" starten, den whsec_-Wert in .env.local eintragen.' },
  { key: 'E2E_USER_A_EMAIL', fix: 'Test-Konto A E-Mail in .env.local.' },
  { key: 'E2E_USER_A_PASSWORD', fix: 'Test-Konto A Passwort in .env.local.' },
  { key: 'E2E_USER_B_EMAIL', fix: 'Test-Konto B E-Mail in .env.local.' },
  { key: 'E2E_USER_B_PASSWORD', fix: 'Test-Konto B Passwort in .env.local.' },
]

/** Login-Probe: existiert das Konto und stimmt das Passwort? (Lektion 14) */
async function probeLogin(
  env: Record<string, string>,
  label: string,
  email: string,
  password: string
): Promise<string | null> {
  const r = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    }
  )
  if (r.ok) return null
  return `  FEHLT: ${label}-Login (${email}) schlaegt fehl (HTTP ${r.status}) - so beheben: node e2e/setup-users.mjs ausfuehren bzw. Zugangsdaten in .env.local korrigieren.`
}

export default async function globalSetup(): Promise<void> {
  let env: Record<string, string>
  try {
    env = loadEnv()
  } catch {
    throw new Error(
      '\n\n=== PREFLIGHT ABGEBROCHEN ===\n' +
        '  FEHLT: .env.local - so beheben: Datei im Projekt-Root anlegen und die noetigen Werte eintragen.\n'
    )
  }

  const missing = REQUIRED.filter((r) => !env[r.key] || env[r.key].trim() === '')
  if (missing.length > 0) {
    const lines = missing.map((m) => `  FEHLT: ${m.key} - so beheben: ${m.fix}`).join('\n')
    throw new Error(
      '\n\n=== PREFLIGHT ABGEBROCHEN: .env.local unvollstaendig ===\n' +
        lines +
        '\n\nBitte die genannten Werte in .env.local ergaenzen und Verify erneut starten.\n'
    )
  }
  // E2E-Konten: Existenz + Login wirklich proben, nicht nur Env-Werte lesen
  const loginErrors = (
    await Promise.all([
      probeLogin(env, 'E2E_USER_A', env.E2E_USER_A_EMAIL, env.E2E_USER_A_PASSWORD),
      probeLogin(env, 'E2E_USER_B', env.E2E_USER_B_EMAIL, env.E2E_USER_B_PASSWORD),
    ])
  ).filter((e): e is string => e !== null)
  if (loginErrors.length > 0) {
    throw new Error(
      '\n\n=== PREFLIGHT ABGEBROCHEN: E2E-Konten nicht nutzbar ===\n' +
        loginErrors.join('\n') +
        '\n'
    )
  }

  console.log('[preflight] Env-Variablen vorhanden, E2E-Konten-Login geprueft.')
}
