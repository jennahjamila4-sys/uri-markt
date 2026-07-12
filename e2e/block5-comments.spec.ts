import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

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

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
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
}

// Feed oeffnen und das Test-Listing per Titel anklicken -> Detail-Modal mit
// Kommentar-Sektion. Funktioniert eingeloggt UND anonym (anon darf lesen).
async function openListing(page: Page, title: string) {
  await page.goto('/')
  await expect(page.getByText(title).first()).toBeVisible()
  await page.getByText(title).first().click()
  await expect(page.getByTestId('comment-section')).toBeVisible()
}

async function commentCount(listingId: string): Promise<number> {
  const r = await rest(`comments?listing_id=eq.${listingId}&select=id`)
  const rows = await r.json()
  return Array.isArray(rows) ? rows.length : 0
}

const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

const TS = Date.now()
const LISTING_TITLE = `E2E-B5 Listing ${TS}`
const B_COMMENT_TEXT = `E2E-B5 B-Kommentar ${TS}`

let AID = ''
let BID = ''
let LID = ''

async function cleanup() {
  if (LID) {
    await rest(`comments?listing_id=eq.${LID}`, { method: 'DELETE' }).catch(() => {})
    await rest(`notifications?recipient_id=eq.${BID}&listing_id=eq.${LID}`, { method: 'DELETE' }).catch(() => {})
  }
  await rest('listings?title=like.E2E-B5%25', { method: 'DELETE' }).catch(() => {})
}

test.beforeAll(async () => {
  expect(A.email, 'E2E_USER_A_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  expect(B.email, 'E2E_USER_B_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  AID = await getProfileId(A.email, A.password)
  BID = await getProfileId(B.email, B.password)
  expect(AID, 'Profil-ID A nicht aufgeloest').toBeTruthy()
  expect(BID, 'Profil-ID B nicht aufgeloest').toBeTruthy()

  // Reste eines frueheren Laufs entfernen.
  await rest('listings?title=like.E2E-B5%25', { method: 'DELETE' })

  // Listing von B seeden (A kommentiert es -> B ist Eigentuemer -> Trigger notifies B).
  const l = await rest('listings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: BID,
      title: LISTING_TITLE,
      description: 'E2E Block 5 Kommentar-Test',
      category: 'sonstiges',
      gemeinde: 'Altdorf',
      type: 'Angebot',
      price_type: 'free',
      price: 0,
      status: 'active',
    }),
  })
  expect(l.ok, `Listing-Seed fehlgeschlagen HTTP ${l.status}`).toBeTruthy()
  LID = (await l.json())[0].id

  // Fremd-Kommentar von B auf seinem eigenen Listing seeden (fuer den
  // "kein Loeschen-Button bei fremdem Kommentar"-Fall). Trigger notifiziert
  // hier NICHT (Eigentuemer == Kommentierender).
  const c = await rest('comments', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ listing_id: LID, user_id: BID, content: B_COMMENT_TEXT }),
  })
  expect(c.ok, `Kommentar-Seed (B) fehlgeschlagen HTTP ${c.status}`).toBeTruthy()
})

test.afterAll(async () => {
  await cleanup()
})

test.beforeEach(async ({ page }: { page: Page }) => {
  await page.addInitScript(skipOnboarding)
})

test('A kommentiert Bs Listing -> erscheint sofort -> B bekommt + sieht Benachrichtigung', async ({ page, browser }) => {
  await login(page, A.email, A.password)
  await openListing(page, LISTING_TITLE)

  const txt = `E2E-B5 A-Kommentar ${TS}`
  await page.getByTestId('comment-input').fill(txt)
  await page.getByTestId('comment-submit').click()

  // Erscheint sofort in der Liste.
  await expect(page.getByTestId('comment-item').filter({ hasText: txt })).toBeVisible()

  // DB-Beweis: der Trigger hat B eine comment_new-Benachrichtigung geschrieben.
  await expect
    .poll(
      async () => {
        const r = await rest(
          `notifications?recipient_id=eq.${BID}&type=eq.comment_new&listing_id=eq.${LID}&select=id`
        )
        const rows = await r.json()
        return Array.isArray(rows) ? rows.length : 0
      },
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)

  // B sieht die Benachrichtigung in der UI (frischer Kontext, sauberer Login).
  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await pageB.addInitScript(skipOnboarding)
  await login(pageB, B.email, B.password)
  await pageB.goto('/')
  await pageB.getByRole('button', { name: 'Benachrichtigungen' }).click()
  await expect(pageB.getByText('Neuer Kommentar').first()).toBeVisible()
  await ctxB.close()
})

test('Leerer / Nur-Leerzeichen-Kommentar -> Fehlermeldung sichtbar, kein Insert', async ({ page }) => {
  await login(page, A.email, A.password)
  await openListing(page, LISTING_TITLE)

  const before = await commentCount(LID)

  // Ganz leer.
  await page.getByTestId('comment-submit').click()
  await expect(page.getByTestId('comment-error')).toContainText('leer')

  // Nur Leerzeichen.
  await page.getByTestId('comment-input').fill('    ')
  await page.getByTestId('comment-submit').click()
  await expect(page.getByTestId('comment-error')).toContainText('leer')

  // Kein Insert passiert.
  await page.waitForTimeout(500)
  expect(await commentCount(LID)).toBe(before)
})

test('Kommentar > 1000 Zeichen -> blockiert (Zaehler + Meldung), kein Insert', async ({ page }) => {
  await login(page, A.email, A.password)
  await openListing(page, LISTING_TITLE)

  const before = await commentCount(LID)
  const long = 'x'.repeat(1001)
  await page.getByTestId('comment-input').fill(long)

  // Zeichenzaehler zeigt Ueberlaenge.
  await expect(page.getByTestId('comment-char-count')).toContainText('1001/1000')

  await page.getByTestId('comment-submit').click()
  await expect(page.getByTestId('comment-error')).toContainText('1000')

  await page.waitForTimeout(500)
  expect(await commentCount(LID)).toBe(before)
})

test('A loescht eigenen Kommentar -> weg; fremder Kommentar hat keinen Loeschen-Button', async ({ page }) => {
  await login(page, A.email, A.password)
  await openListing(page, LISTING_TITLE)

  const txt = `E2E-B5 A-Loesch ${TS}`
  await page.getByTestId('comment-input').fill(txt)
  await page.getByTestId('comment-submit').click()

  const own = page.getByTestId('comment-item').filter({ hasText: txt })
  await expect(own).toBeVisible()

  // Eigener Kommentar: Loeschen mit Bestaetigung.
  await own.getByTestId('comment-delete-btn').click()
  await own.getByTestId('comment-delete-confirm-btn').click()
  await expect(page.getByTestId('comment-item').filter({ hasText: txt })).toHaveCount(0)

  // DB-Beweis: Zeile wirklich weg.
  await expect
    .poll(
      async () => {
        const r = await rest(
          `comments?listing_id=eq.${LID}&content=eq.${encodeURIComponent(txt)}&select=id`
        )
        return (await r.json()).length
      },
      { timeout: 15_000 }
    )
    .toBe(0)

  // Fremder Kommentar (von B): sichtbar, aber KEIN Loeschen-Button.
  const foreign = page.getByTestId('comment-item').filter({ hasText: B_COMMENT_TEXT })
  await expect(foreign).toBeVisible()
  await expect(foreign.getByTestId('comment-delete-btn')).toHaveCount(0)
})

test('Nicht eingeloggt: Kommentare sichtbar, Formular nicht (Login-Hinweis)', async ({ page }) => {
  // Kein Login.
  await openListing(page, LISTING_TITLE)

  // Bestehender Kommentar ist sichtbar.
  await expect(page.getByTestId('comment-item').filter({ hasText: B_COMMENT_TEXT })).toBeVisible()

  // Formular fehlt, stattdessen Login-Hinweis + Login-Link.
  await expect(page.getByTestId('comment-input')).toHaveCount(0)
  await expect(page.getByTestId('comment-login-hint')).toBeVisible()
  await expect(page.getByTestId('comment-login-btn')).toBeVisible()
})
