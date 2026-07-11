// Legt die zwei E2E-Test-Accounts an (echter Signup-Flow) und schreibt die
// Credentials nach .env.local (E2E_USER_A/B_EMAIL/PASSWORD). Idempotent:
// sind die Creds schon in .env.local, wird nur der Login verifiziert.
//
// Passwörter werden generiert und NUR in .env.local geschrieben – NIE geloggt.
// Wenn ein Account wegen E-Mail-Bestätigung nicht einloggen kann, bricht das
// Skript mit Exit-Code 2 ab (Marker "NEEDS_EMAIL_CONFIRMATION") → JJ / DB-Seite.
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
  // 24 Zeichen base64url + garantierte Komplexität
  return randomBytes(18).toString('base64url') + 'Aa1!'
}

const raw = readFileSync(ENV_PATH, 'utf8')
const env = parseEnv(raw)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL || !ANON) {
  console.error('FEHLT: NEXT_PUBLIC_SUPABASE_URL / ANON_KEY in .env.local')
  process.exit(1)
}

const H = { apikey: ANON, 'Content-Type': 'application/json' }

async function signup(email, password, username) {
  const r = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      email,
      password,
      data: { username, gemeinde: 'Altdorf' },
    }),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

async function login(email, password) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email, password }),
  })
  const body = await r.json().catch(() => ({}))
  return { ok: r.status === 200 && !!body.access_token, status: r.status, body }
}

const accounts = [
  { key: 'A', email: 'e2e-a@uri-markt-e2e.com' },
  { key: 'B', email: 'e2e-b@uri-markt-e2e.com' },
]

async function main() {
  const toWrite = {}
  let needConfirm = false

  for (const acc of accounts) {
    const eKey = `E2E_USER_${acc.key}_EMAIL`
    const pKey = `E2E_USER_${acc.key}_PASSWORD`
    const email = env[eKey] || acc.email
    let password = env[pKey]

    if (password) {
      const l = await login(email, password)
      console.log(`Account ${acc.key} (${email}): vorhanden, Login ${l.ok ? 'OK' : 'FEHLT (' + (l.body.error_code || l.status) + ')'}`)
      if (!l.ok && l.body.error_code === 'email_not_confirmed') needConfirm = true
      continue
    }

    password = strongPassword()
    const username = `e2e_${acc.key.toLowerCase()}_${randomBytes(3).toString('hex')}`
    const s = await signup(email, password, username)

    if (s.status >= 400 && (s.body.error_code === 'user_already_exists' || /already/i.test(s.body.msg || ''))) {
      console.error(`Account ${acc.key} existiert bereits, aber kein Passwort in .env.local → manuell klären.`)
      return 1
    }
    if (s.status >= 400) {
      console.error(`Signup ${acc.key} fehlgeschlagen: HTTP ${s.status} ${s.body.msg || s.body.error_code || ''}`)
      return 1
    }

    const l = await login(email, password)
    console.log(`Account ${acc.key} (${email}): angelegt (username ${username}), Login ${l.ok ? 'OK' : 'FEHLT (' + (l.body.error_code || l.status) + ')'}`)
    if (!l.ok) {
      if (l.body.error_code === 'email_not_confirmed') needConfirm = true
      else { console.error('Login nach Signup unerwartet fehlgeschlagen:', l.body.error_code || l.status); return 1 }
    }
    toWrite[eKey] = email
    toWrite[pKey] = password
  }

  if (needConfirm) {
    console.error('\nNEEDS_EMAIL_CONFIRMATION: Accounts brauchen E-Mail-Bestätigung → STOPP, an JJ (DB-Seite).')
    return 2
  }

  const keys = Object.keys(toWrite)
  if (keys.length) {
    const block = '\n# E2E-Test-Accounts (automatisch angelegt, nicht committen)\n' +
      keys.map((k) => `${k}=${toWrite[k]}`).join('\n') + '\n'
    writeFileSync(ENV_PATH, raw.replace(/\s*$/, '') + '\n' + block)
    console.log(`\n.env.local ergänzt: ${keys.join(', ')} (Passwörter nur in der Datei, nicht hier).`)
  } else {
    console.log('\nKeine neuen Credentials zu schreiben.')
  }
  console.log('SETUP_OK')
  return 0
}

main().then((code) => { process.exitCode = code })
