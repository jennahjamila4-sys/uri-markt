import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { CONSENT_VERSION } from '../src/lib/consent'

// Env aus .env.local laden (Playwright-Runner laedt sie nicht selbst).
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

const ENV = loadEnv()
const SB_URL = ENV.NEXT_PUBLIC_SUPABASE_URL
const ANON = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = ENV.SUPABASE_SERVICE_ROLE_KEY
const A = { email: ENV.E2E_USER_A_EMAIL, password: ENV.E2E_USER_A_PASSWORD }
const B = { email: ENV.E2E_USER_B_EMAIL, password: ENV.E2E_USER_B_PASSWORD }

const svcHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}
const anonHeaders = { apikey: ANON, 'Content-Type': 'application/json' }

// Service-Role-REST (umgeht RLS/Grants) – nur fuer Seeds/Cleanup/Beweise.
async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...svcHeaders, ...(init.headers ?? {}) },
  })
}

async function adminAuth(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/auth/v1/admin/${path}`, {
    ...init,
    headers: { ...svcHeaders, ...(init.headers ?? {}) },
  })
}

async function passwordLogin(email: string, password: string) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: anonHeaders,
    body: JSON.stringify({ email, password }),
  })
  const body = await r.json().catch(() => ({}))
  return { ok: r.status === 200 && !!body.access_token, body }
}

async function getToken(email: string, password: string): Promise<string> {
  const l = await passwordLogin(email, password)
  return l.body.access_token as string
}

async function getProfileId(email: string, password: string): Promise<string> {
  const l = await passwordLogin(email, password)
  const ur = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${l.body.access_token}` },
  })
  const u = await ur.json()
  return u.id as string
}

// REST als konkreter Nutzer (RLS greift) – fuer den Leak-Beweis.
async function restAs(token: string, path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

const TS = Date.now()
// Test 1 (ohne Haekchen): dieser Username darf NIE in der DB landen.
const NOACC_USERNAME = `e2eb13_noacc_${TS}`
const NOACC_EMAIL = `e2e-b13-noacc-${TS}@example.com`
// Test 3 (DB-Trigger via Admin-API): Wegwerf-User.
const TRIG_EMAIL = `e2e-b13-trig-${TS}@example.com`
const TRIG_USERNAME = `e2eb13_trig_${randomBytes(3).toString('hex')}`
// Test 4 (RLS): eindeutiger Versions-Marker, damit der Seed exakt aufraeumbar ist.
const RLS_VERSION = `e2e-b13-rls-${TS}`
const PW = 'Test1234!'

let AID = ''
let BID = ''
let TRIG_ID = ''

async function cleanup() {
  // Test-1-Konto darf nie existieren, aber sicherheitshalber aufraeumen.
  const p = await rest(`profiles?username=eq.${NOACC_USERNAME}&select=id`)
  const prows = await p.json().catch(() => [])
  if (Array.isArray(prows) && prows[0]?.id) {
    await adminAuth(`users/${prows[0].id}`, { method: 'DELETE' }).catch(() => {})
    await rest(`profiles?id=eq.${prows[0].id}`, { method: 'DELETE' }).catch(() => {})
  }
  // Test-3-Wegwerf-User (Admin-Delete cascadet user_consents via FK).
  if (TRIG_ID) {
    await adminAuth(`users/${TRIG_ID}`, { method: 'DELETE' }).catch(() => {})
    await rest(`profiles?id=eq.${TRIG_ID}`, { method: 'DELETE' }).catch(() => {})
  }
  // Test-4-RLS-Seed (nur der markierte Versionsstring).
  await rest(`user_consents?version=eq.${RLS_VERSION}`, { method: 'DELETE' }).catch(() => {})
}

test.beforeAll(async () => {
  expect(A.email, 'E2E_USER_A_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  expect(B.email, 'E2E_USER_B_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  AID = await getProfileId(A.email, A.password)
  BID = await getProfileId(B.email, B.password)
  expect(AID, 'Profil-ID A nicht aufgeloest').toBeTruthy()
  expect(BID, 'Profil-ID B nicht aufgeloest').toBeTruthy()
  await cleanup()
})

test.afterAll(async () => {
  await cleanup()
})

async function openRegisterForm(page: Page) {
  await page.addInitScript(skipOnboarding)
  await page.goto('/?auth=required')
  await page.getByRole('button', { name: 'Registrieren' }).click() // Tab
  const form = page.locator('form')
  await expect(form.getByTestId('register-terms')).toBeVisible()
  return form
}

// ============================================================================
// (a) Ohne Haekchen -> Submit blockiert mit sichtbarem Grund, kein Konto.
// ============================================================================
test('Ohne Zustimmungs-Haekchen ist die Registrierung blockiert (Button disabled + sichtbarer Grund)', async ({
  page,
}) => {
  const form = await openRegisterForm(page)
  await form.getByPlaceholder('E-Mail').fill(NOACC_EMAIL)
  await form.getByPlaceholder('Username').fill(NOACC_USERNAME)
  await form.locator('select').selectOption({ index: 1 })
  await form.getByPlaceholder('Passwort (Min. 8 Zeichen)').fill(PW)
  // Checkbox bewusst NICHT anhaken.

  // Der Grund ist SICHTBAR (Lektion 6: blockierte Aktion nie stumm) …
  await expect(page.getByTestId('register-terms-hint')).toBeVisible()
  await expect(page.getByTestId('register-terms-hint')).toContainText('Häkchen')
  // … und der Submit ist wirklich gesperrt.
  const submit = form.getByRole('button', { name: 'Registrieren' })
  await expect(submit).toBeDisabled()

  // Gegenprobe: Anhaken schaltet frei, Weghaken sperrt wieder.
  await form.getByTestId('register-terms').check()
  await expect(submit).toBeEnabled()
  await expect(page.getByTestId('register-terms-hint')).toHaveCount(0)
  await form.getByTestId('register-terms').uncheck()
  await expect(submit).toBeDisabled()

  // Kein Konto entstanden (der Trigger haette sonst ein Profil geschrieben).
  await page.waitForTimeout(500)
  const r = await rest(`profiles?username=eq.${NOACC_USERNAME}&select=id`)
  const rows = await r.json()
  expect(Array.isArray(rows) ? rows.length : 0).toBe(0)
})

// ============================================================================
// (b1) Mit Haekchen -> die App schickt consent_version in der Signup-Metadata.
//      Deterministisch am gesendeten Request festgemacht (unabhaengig davon, ob
//      der Auth-Server den Signup wegen E-Mail-Ratelimit annimmt).
// ============================================================================
test('Mit Haekchen sendet der Signup consent_version = CONSENT_VERSION in der Metadata', async ({
  page,
}) => {
  const form = await openRegisterForm(page)
  await form.getByPlaceholder('E-Mail').fill(`e2e-b13-meta-${TS}@example.com`)
  await form.getByPlaceholder('Username').fill(`e2eb13_meta_${TS}`)
  await form.locator('select').selectOption({ index: 1 })
  await form.getByPlaceholder('Passwort (Min. 8 Zeichen)').fill(PW)
  await form.getByTestId('register-terms').check()

  const signupPromise = page.waitForRequest(
    (r) => r.url().includes('/auth/v1/signup') && r.method() === 'POST',
    { timeout: 20_000 }
  )
  await form.getByRole('button', { name: 'Registrieren' }).click()
  await expect(page.getByTestId('register-terms-error')).toHaveCount(0)

  const req = await signupPromise
  const body = JSON.parse(req.postData() ?? '{}')
  // supabase-js legt options.data unter "data" ab.
  expect(body?.data?.consent_version, 'consent_version fehlt in der Signup-Metadata').toBe(
    CONSENT_VERSION
  )

  // Aufraeumen, falls der Auth-Server den Signup doch angenommen hat.
  const pr = await rest(`profiles?username=eq.e2eb13_meta_${TS}&select=id`)
  const prows = await pr.json().catch(() => [])
  if (Array.isArray(prows) && prows[0]?.id) {
    await adminAuth(`users/${prows[0].id}`, { method: 'DELETE' }).catch(() => {})
    await rest(`profiles?id=eq.${prows[0].id}`, { method: 'DELETE' }).catch(() => {})
  }
})

// ============================================================================
// (b2) Der DB-Trigger handle_new_user schreibt aus consent_version genau 2
//      Zeilen (agb + datenschutz) mit Version UND Zeitstempel. Deterministisch
//      per Admin-API (email_confirm) angelegt, per Service-Role geprueft.
// ============================================================================
test('DB-Trigger schreibt 2 user_consents (agb + datenschutz) mit Version und Zeitstempel', async () => {
  const c = await adminAuth('users', {
    method: 'POST',
    body: JSON.stringify({
      email: TRIG_EMAIL,
      password: PW,
      email_confirm: true,
      user_metadata: {
        username: TRIG_USERNAME,
        gemeinde: 'Altdorf',
        consent_version: CONSENT_VERSION,
      },
    }),
  })
  expect(c.status, `Wegwerf-User-Anlage fehlgeschlagen HTTP ${c.status}`).toBeLessThan(300)
  TRIG_ID = (await c.json()).id
  expect(TRIG_ID, 'Wegwerf-User-ID fehlt').toBeTruthy()

  // Trigger laeuft synchron im Signup, aber Service-Role-Sicht kann minimal
  // nachlaufen -> pollen bis 2 Zeilen sichtbar sind.
  await expect
    .poll(
      async () => {
        const r = await rest(
          `user_consents?user_id=eq.${TRIG_ID}&select=doc_type,version,accepted_at`
        )
        const rows = await r.json().catch(() => [])
        return Array.isArray(rows) ? rows.length : 0
      },
      { timeout: 15_000 }
    )
    .toBe(2)

  const r = await rest(
    `user_consents?user_id=eq.${TRIG_ID}&select=doc_type,version,accepted_at&order=doc_type`
  )
  const rows: Array<{ doc_type: string; version: string; accepted_at: string }> = await r.json()

  // Genau die zwei Dokumenttypen.
  expect(rows.map((x) => x.doc_type).sort()).toEqual(['agb', 'datenschutz'])
  // Beide tragen die eine Quell-Version.
  expect(rows.every((x) => x.version === CONSENT_VERSION)).toBeTruthy()
  // Beide tragen einen echten Zeitstempel.
  for (const row of rows) {
    expect(row.accepted_at, 'accepted_at fehlt').toBeTruthy()
    expect(Number.isNaN(Date.parse(row.accepted_at)), 'accepted_at kein Zeitstempel').toBeFalsy()
  }
})

// ============================================================================
// (c) RLS: User B sieht die Consents von User A NICHT (Gegenprobe: A sieht sie).
// ============================================================================
test('RLS: User B sieht die Consents von User A nicht (Gegenprobe: A sieht eigene)', async () => {
  // Seed via Service-Role (umgeht Grants/RLS): ein Consent von A mit Marker-Version.
  await rest(`user_consents?version=eq.${RLS_VERSION}`, { method: 'DELETE' }).catch(() => {})
  const seed = await rest('user_consents', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: AID, doc_type: 'agb', version: RLS_VERSION }),
  })
  expect(seed.ok, `Consent-Seed (A) fehlgeschlagen HTTP ${seed.status}`).toBeTruthy()

  const tokenA = await getToken(A.email, A.password)
  const tokenB = await getToken(B.email, B.password)

  // B liest ALLE fuer ihn sichtbaren Consents: keiner gehoert A.
  const allB = await restAs(tokenB, 'user_consents?select=user_id')
  const rowsB: Array<{ user_id: string }> = await allB.json()
  expect(Array.isArray(rowsB)).toBeTruthy()
  expect(rowsB.every((x) => x.user_id === BID)).toBeTruthy()

  // Gezielter Leak-Test: B fragt explizit nach As Consent -> 0 Zeilen (RLS).
  const leak = await restAs(tokenB, `user_consents?user_id=eq.${AID}&version=eq.${RLS_VERSION}&select=id`)
  const leakRows = await leak.json()
  expect(Array.isArray(leakRows) ? leakRows.length : -1).toBe(0)

  // Gegenprobe: A selbst sieht seinen Consent sehr wohl.
  const own = await restAs(tokenA, `user_consents?user_id=eq.${AID}&version=eq.${RLS_VERSION}&select=id`)
  expect((await own.json()).length).toBe(1)

  await rest(`user_consents?version=eq.${RLS_VERSION}`, { method: 'DELETE' }).catch(() => {})
})
