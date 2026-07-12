import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

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

// Bestaetigungswort exakt wie in DeleteAccountSection (CONFIRM_WORD).
const CONFIRM_WORD = 'LÖSCHEN'

const svcHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}
const anonHeaders = { apikey: ANON, 'Content-Type': 'application/json' }

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

async function getProfileId(email: string, password: string): Promise<string> {
  const l = await passwordLogin(email, password)
  const ur = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${l.body.access_token}` },
  })
  const u = await ur.json()
  return u.id as string
}

// UI-Login ueber das Auth-Modal (identisch zu den anderen Specs).
async function login(page: Page, email: string, password: string) {
  await page.goto('/?auth=required')
  const form = page.locator('form')
  await form.getByPlaceholder('E-Mail').fill(email)
  await form.getByPlaceholder('Passwort').fill(password)
  await form.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByPlaceholder('Passwort')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Anmelden' })).toHaveCount(0)
}

async function openTile(page: Page, name: RegExp) {
  await page.goto('/profile')
  await page.getByRole('button', { name }).first().click()
}

const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

const TS = Date.now()
const NEW_NAME = `E2E-B4 Name ${TS}`
const WALLET_DESC = `E2E-B4 Provision ${TS}`
const DEAL_TITLE = `E2E-B4-DEAL ${TS}`
const TMP_EMAIL = `jennahjamila4+e2edel${TS}@gmail.com`
const TMP_PW = randomBytes(18).toString('base64url') + 'Aa1!'

let AID = ''
let BID = ''
let ORIG_NAME: string | null = null
let DEAL_LISTING_ID = ''
let TMP_ID = ''

async function cleanup() {
  await rest(`transactions?listing_id=eq.${DEAL_LISTING_ID}`, { method: 'DELETE' }).catch(() => {})
  await rest('listings?title=like.E2E-B4%25', { method: 'DELETE' }).catch(() => {})
  await rest('wallet_transactions?description=like.E2E-B4%25', { method: 'DELETE' }).catch(() => {})
  // A wieder auf den urspruenglichen Namen zuruecksetzen.
  await rest(`profiles?id=eq.${AID}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ full_name: ORIG_NAME }),
  }).catch(() => {})
  // Wegwerf-User sicher entfernen, falls der Loesch-Test ihn nicht selbst entfernt hat.
  if (TMP_ID) await adminAuth(`users/${TMP_ID}`, { method: 'DELETE' }).catch(() => {})
}

test.beforeAll(async () => {
  expect(A.email, 'E2E_USER_A_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  expect(B.email, 'E2E_USER_B_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  AID = await getProfileId(A.email, A.password)
  BID = await getProfileId(B.email, B.password)
  expect(AID, 'Profil-ID A nicht aufgeloest').toBeTruthy()
  expect(BID, 'Profil-ID B nicht aufgeloest').toBeTruthy()

  // Urspruenglichen Namen von A sichern (fuer Restore).
  const pr = await rest(`profiles?id=eq.${AID}&select=full_name`)
  ORIG_NAME = (await pr.json())[0]?.full_name ?? null

  // Reste eines frueheren Laufs entfernen.
  await rest('listings?title=like.E2E-B4%25', { method: 'DELETE' })
  await rest('wallet_transactions?description=like.E2E-B4%25', { method: 'DELETE' })

  // Seed Taler-Bewegung fuer A (Provision -5 Taler).
  const w = await rest('wallet_transactions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: AID,
      amount: -500,
      type: 'commission',
      description: WALLET_DESC,
    }),
  })
  expect(w.ok, `Wallet-Seed fehlgeschlagen HTTP ${w.status}`).toBeTruthy()

  // Seed offenen Deal: reserviertes Listing von A + pending-Transaktion (B kauft).
  const l = await rest('listings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: AID,
      title: DEAL_TITLE,
      description: 'E2E Block 4 offener Deal',
      category: 'sonstiges',
      gemeinde: 'Altdorf',
      type: 'Angebot',
      price_type: 'free',
      price: 0,
      status: 'reserved',
    }),
  })
  expect(l.ok, `Listing-Seed fehlgeschlagen HTTP ${l.status}`).toBeTruthy()
  DEAL_LISTING_ID = (await l.json())[0].id

  const tx = await rest('transactions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      buyer_id: BID,
      seller_id: AID,
      listing_id: DEAL_LISTING_ID,
      amount: 0,
      status: 'pending',
    }),
  })
  expect(tx.ok, `Transaktions-Seed fehlgeschlagen HTTP ${tx.status}`).toBeTruthy()
})

test.afterAll(async () => {
  await cleanup()
})

test.beforeEach(async ({ page }: { page: Page }) => {
  await page.addInitScript(skipOnboarding)
})

test('Profil bearbeiten: Name aendern persistiert (UI + DB + F5)', async ({ page }) => {
  await login(page, A.email, A.password)
  await openTile(page, /Konto/)

  const nameInput = page.getByTestId('profile-edit-name')
  await expect(nameInput).toBeVisible()
  await nameInput.fill(NEW_NAME)
  await page.getByTestId('profile-edit-save').click()

  // Beweis in der DB (nicht nur UI-State).
  await expect
    .poll(
      async () => {
        const r = await rest(`profiles?id=eq.${AID}&select=full_name`)
        return (await r.json())[0]?.full_name
      },
      { timeout: 15_000 }
    )
    .toBe(NEW_NAME)

  // F5-fest: nach Reload traegt das Feld den neuen Namen.
  await openTile(page, /Konto/)
  await expect(page.getByTestId('profile-edit-name')).toHaveValue(NEW_NAME)
})

test('Taler-Historie zeigt gebuchte Bewegung mit Vorzeichen', async ({ page }) => {
  await login(page, A.email, A.password)
  await openTile(page, /Taler-Historie/)

  const item = page.getByTestId('taler-history-item').filter({ hasText: WALLET_DESC })
  await expect(item).toBeVisible()
  await expect(item).toContainText('-5.00 Taler')
})

test('Konto-Loeschung blockiert bei offenem Deal (Grund sichtbar, Konto bleibt)', async ({ page }) => {
  await login(page, A.email, A.password)
  await openTile(page, /Konto/)

  await page.getByTestId('account-delete-open').click()
  await page.getByTestId('account-delete-confirm-input').fill(CONFIRM_WORD)
  await page.getByTestId('account-delete-confirm-btn').click()

  const reason = page.getByTestId('account-delete-blocked-reason')
  await expect(reason).toBeVisible()
  await expect(reason).toContainText('offene')

  // Konto von A existiert weiterhin.
  const r = await rest(`profiles?id=eq.${AID}&select=id`)
  expect((await r.json()).length, 'Konto A darf nicht geloescht sein').toBe(1)
})

test('Konto-Loeschung erfolgreich fuer Wegwerf-User (Redirect + wirklich weg)', async ({ page }) => {
  // Wegwerf-User per Admin anlegen (bestaetigt) -> Profil-Trigger legt profiles-Zeile an.
  const c = await adminAuth('users', {
    method: 'POST',
    body: JSON.stringify({
      email: TMP_EMAIL,
      password: TMP_PW,
      email_confirm: true,
      user_metadata: { username: `e2e_del_${randomBytes(3).toString('hex')}`, gemeinde: 'Altdorf' },
    }),
  })
  expect(c.status, `Wegwerf-User-Anlage fehlgeschlagen HTTP ${c.status}`).toBeLessThan(300)
  TMP_ID = (await c.json()).id
  expect(TMP_ID, 'Wegwerf-User-ID fehlt').toBeTruthy()

  // Profil-Zeile abwarten (Trigger).
  await expect
    .poll(
      async () => {
        const r = await rest(`profiles?id=eq.${TMP_ID}&select=id`)
        return (await r.json()).length
      },
      { timeout: 15_000 }
    )
    .toBe(1)

  await login(page, TMP_EMAIL, TMP_PW)
  await openTile(page, /Konto/)
  await page.getByTestId('account-delete-open').click()
  await page.getByTestId('account-delete-confirm-input').fill(CONFIRM_WORD)
  await page.getByTestId('account-delete-confirm-btn').click()

  // Nach Erfolg: Redirect auf die Startseite (window.location -> '/').
  await page.waitForURL(/localhost:3100\/(\?.*)?$/, { timeout: 20_000 })

  // Ausgeloggt: /profile ist geschuetzt -> Redirect auf die Startseite mit
  // geoeffnetem Login-Modal. AppChrome konsumiert ?auth=required und bereinigt
  // die URL per replaceState wieder auf '/', daher NICHT die auth=required-Query
  // pruefen (transient/Race), sondern das offene Login-Modal + das Verlassen von /profile.
  await page.goto('/profile')
  await expect(page.getByPlaceholder('Passwort')).toBeVisible()
  await expect(page).not.toHaveURL(/\/profile$/)

  // Wirklich weg: Profil-Zeile entfernt UND Passwort-Login schlaegt fehl.
  const pr = await rest(`profiles?id=eq.${TMP_ID}&select=id`)
  expect((await pr.json()).length, 'Profil des Wegwerf-Users noch vorhanden').toBe(0)
  const relogin = await passwordLogin(TMP_EMAIL, TMP_PW)
  expect(relogin.ok, 'Wegwerf-User kann sich noch einloggen (nicht geloescht)').toBeFalsy()

  TMP_ID = '' // erfolgreich geloescht -> kein Cleanup noetig
})
