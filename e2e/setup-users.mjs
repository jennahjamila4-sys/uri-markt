// Legt die zwei E2E-Test-Accounts an und schreibt die Credentials nach
// .env.local (E2E_USER_A/B_EMAIL/PASSWORD). Idempotent: sind die Creds schon in
// .env.local und der Login klappt, wird nichts geaendert.
//
// Diese Accounts werden ueber die Supabase-Admin-API mit `email_confirm: true`
// angelegt (bzw. bestehende bestaetigt + Passwort gesetzt). Damit ist keine
// Bestaetigungsmail noetig (E-Mail-Bestaetigung ist im Projekt aktiv) und das
// E-Mail-Rate-Limit greift nicht. Der SERVICE_ROLE_KEY wird NUR hier lokal
// (Server-Kontext) genutzt und NIE geloggt. Passwoerter stehen nur in .env.local.
//
// Exit-Codes: 0 = OK, 1 = harter Fehler, 2 = NEEDS_EMAIL_CONFIRMATION (nur falls
// wider Erwarten kein Service-Role-Key vorhanden ist und Login-Bestaetigung fehlt).
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const ENV_PATH = '.env.local'

function parseEnv(txt) {
  const map = {}
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0) map[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return map
}

function strongPassword() {
  return randomBytes(18).toString('base64url') + 'Aa1!'
}

const raw = readFileSync(ENV_PATH, 'utf8')
const env = parseEnv(raw)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON) {
  console.error('FEHLT: NEXT_PUBLIC_SUPABASE_URL / ANON_KEY in .env.local')
  process.exit(1)
}
if (!SERVICE) {
  console.error('FEHLT: SUPABASE_SERVICE_ROLE_KEY in .env.local (fuer Admin-Anlage der E2E-Accounts)')
  process.exit(1)
}

const ADMIN_H = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}
const ANON_H = { apikey: ANON, 'Content-Type': 'application/json' }

async function findUserByEmail(email) {
  // GoTrue Admin: Filter per Query (neuere Versionen) – fallback auf Liste.
  const r = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: ADMIN_H })
  const body = await r.json().catch(() => ({}))
  const users = body.users || []
  return users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null
}

async function adminCreate(email, password, username) {
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: ADMIN_H,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, gemeinde: 'Altdorf' },
    }),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

async function adminUpdate(id, password) {
  const r = await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: ADMIN_H,
    body: JSON.stringify({ password, email_confirm: true }),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

async function login(email, password) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: ANON_H,
    body: JSON.stringify({ email, password }),
  })
  const body = await r.json().catch(() => ({}))
  return { ok: r.status === 200 && !!body.access_token, status: r.status, body }
}

const accounts = [
  { key: 'A', email: 'jennahjamila4+e2ea@gmail.com' },
  { key: 'B', email: 'jennahjamila4+e2eb@gmail.com' },
]

// Schreibt/aktualisiert einen Key in .env.local (in-memory `current`, dann Datei).
function upsertEnvLines(current, updates) {
  let txt = current
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, 'm')
    if (re.test(txt)) txt = txt.replace(re, `${k}=${v}`)
    else txt = txt.replace(/\s*$/, '') + `\n${k}=${v}`
  }
  return txt
}

async function main() {
  let envText = raw

  for (const acc of accounts) {
    const eKey = `E2E_USER_${acc.key}_EMAIL`
    const pKey = `E2E_USER_${acc.key}_PASSWORD`
    const email = env[eKey] || acc.email
    const existingPw = env[pKey]

    // 1) Schon eingerichtet + Login OK → nichts tun.
    if (existingPw) {
      const l = await login(email, existingPw)
      if (l.ok) {
        console.log(`Account ${acc.key} (${email}): vorhanden, Login OK`)
        continue
      }
      console.log(`Account ${acc.key} (${email}): Passwort vorhanden aber Login FEHLT (${l.body.error_code || l.status}) → wird per Admin neu gesetzt`)
    }

    // 2) Account per Admin sicherstellen (neu anlegen oder Passwort setzen).
    const password = strongPassword()
    const username = `e2e_${acc.key.toLowerCase()}_${randomBytes(3).toString('hex')}`

    const c = await adminCreate(email, password, username)
    if (c.status >= 200 && c.status < 300) {
      console.log(`Account ${acc.key} (${email}): per Admin angelegt (bestaetigt)`)
    } else if (c.status === 422 || c.status === 409 || /already|exists|registered/i.test(c.body.msg || c.body.error_code || c.body.error_description || '')) {
      // Existiert bereits → finden und Passwort setzen + bestaetigen.
      const u = await findUserByEmail(email)
      if (!u) {
        console.error(`Account ${acc.key}: existiert laut Create, aber via Admin-Liste nicht gefunden.`)
        return 1
      }
      const up = await adminUpdate(u.id, password)
      if (up.status < 200 || up.status >= 300) {
        console.error(`Account ${acc.key}: Passwort setzen fehlgeschlagen HTTP ${up.status} ${up.body.msg || ''}`)
        return 1
      }
      console.log(`Account ${acc.key} (${email}): vorhanden, Passwort per Admin neu gesetzt + bestaetigt`)
    } else {
      console.error(`Account ${acc.key}: Admin-Anlage fehlgeschlagen HTTP ${c.status} ${c.body.msg || c.body.error_code || ''}`)
      return 1
    }

    // 3) Credentials SOFORT persistieren (kein Verlust bei spaeterem Abbruch).
    envText = upsertEnvLines(envText, { [eKey]: email, [pKey]: password })
    writeFileSync(ENV_PATH, envText)

    // 4) Login verifizieren.
    const l = await login(email, password)
    if (!l.ok) {
      console.error(`Account ${acc.key}: Login nach Admin-Setup fehlgeschlagen (${l.body.error_code || l.status}).`)
      return 1
    }
    console.log(`Account ${acc.key} (${email}): Login OK`)
  }

  console.log('\n.env.local ist aktuell (Passwoerter nur in der Datei, nicht hier).')
  console.log('SETUP_OK')
  return 0
}

main().then((code) => { process.exitCode = code })
