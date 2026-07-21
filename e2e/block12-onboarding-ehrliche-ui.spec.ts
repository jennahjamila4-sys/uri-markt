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

// Service-Role-REST (umgeht RLS) – nur fuer Seeds/Cleanup/Beweise.
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

// UI-Login ueber das Auth-Modal (identisch zu den anderen Specs).
async function login(page: Page, email: string, password: string) {
  await page.goto('/?auth=required')
  const form = page.locator('form')
  await form.getByPlaceholder('E-Mail').fill(email)
  await form.getByPlaceholder('Passwort').fill(password)
  await form.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByPlaceholder('Passwort')).toBeHidden()
}

async function commentCount(listingId: string): Promise<number> {
  const r = await rest(`listings?id=eq.${listingId}&select=comment_count`)
  const rows = await r.json()
  return Array.isArray(rows) && rows[0] ? Number(rows[0].comment_count) : -1
}

// Onboarding fuer die meisten Tests ueberspringen (nur der Onboarding-Test
// laesst es sichtbar).
const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

const TS = Date.now()
const LISTING_TITLE = `E2E-B12 Listing ${TS}`

let AID = ''
let BID = ''
let LID = ''

async function cleanup() {
  if (LID) {
    await rest(`favorites?listing_id=eq.${LID}`, { method: 'DELETE' }).catch(() => {})
    await rest(`comments?listing_id=eq.${LID}`, { method: 'DELETE' }).catch(() => {})
    await rest(`notifications?listing_id=eq.${LID}`, { method: 'DELETE' }).catch(() => {})
  }
  await rest('listings?title=like.E2E-B12%25', { method: 'DELETE' }).catch(() => {})
}

test.beforeAll(async () => {
  expect(A.email, 'E2E_USER_A_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  expect(B.email, 'E2E_USER_B_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  AID = await getProfileId(A.email, A.password)
  BID = await getProfileId(B.email, B.password)
  expect(AID, 'Profil-ID A nicht aufgeloest').toBeTruthy()
  expect(BID, 'Profil-ID B nicht aufgeloest').toBeTruthy()

  await cleanup()

  // Listing von B seeden (A favorisiert/kommentiert es).
  const l = await rest('listings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: BID,
      title: LISTING_TITLE,
      description: 'E2E Block 12 ehrliche UI',
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
})

test.afterAll(async () => {
  await cleanup()
})

test('Kommentar-Zaehler: Kommentar anlegen -> comment_count +1, loeschen -> -1 (beide Trigger-Zweige)', async ({
  page,
}) => {
  // Startwert (frisch geseedetes Listing) = 0.
  expect(await commentCount(LID)).toBe(0)

  // Kommentar per Service-Role anlegen -> Trigger INSERT-Zweig erhoeht auf 1.
  const c = await rest('comments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ listing_id: LID, user_id: AID, content: `E2E-B12 Kommentar ${TS}` }),
  })
  expect(c.ok, `Kommentar-Insert fehlgeschlagen HTTP ${c.status}`).toBeTruthy()
  const commentId = (await c.json())[0].id

  await expect.poll(() => commentCount(LID), { timeout: 15_000 }).toBe(1)

  // Feed-Badge zeigt den Zaehler (aus listings.comment_count, keine eigene Query).
  await page.addInitScript(skipOnboarding)
  await page.goto('/')
  const card = page.getByTestId('listing-card').filter({ hasText: LISTING_TITLE })
  await expect(card).toBeVisible()
  await expect(card.getByTestId('comment-count-badge')).toContainText('1')

  // Kommentar loeschen -> Trigger DELETE-Zweig senkt auf 0.
  const d = await rest(`comments?id=eq.${commentId}`, { method: 'DELETE' })
  expect(d.ok, `Kommentar-Delete fehlgeschlagen HTTP ${d.status}`).toBeTruthy()

  await expect.poll(() => commentCount(LID), { timeout: 15_000 }).toBe(0)
})

test('Herz ehrlich: favorisieren persistiert (Reload) + erscheint im Favoriten-Tab + Toggle entfernt', async ({
  page,
}) => {
  // Sauberer Startzustand: kein Favorit von A auf diesem Listing.
  await rest(`favorites?listing_id=eq.${LID}&user_id=eq.${AID}`, { method: 'DELETE' })

  await page.addInitScript(skipOnboarding)
  await login(page, A.email, A.password)
  await page.goto('/')

  const card = page.getByTestId('listing-card').filter({ hasText: LISTING_TITLE })
  await expect(card).toBeVisible()
  const heart = card.getByTestId('favorite-btn')

  // Favorisieren -> Herz gefuellt (aria-pressed=true).
  await heart.click()
  await expect(heart).toHaveAttribute('aria-pressed', 'true')

  // DB-Beweis: genau eine favorites-Zeile fuer A+LID.
  await expect
    .poll(
      async () => {
        const r = await rest(`favorites?listing_id=eq.${LID}&user_id=eq.${AID}&select=id`)
        return (await r.json()).length
      },
      { timeout: 15_000 }
    )
    .toBe(1)

  // Persistenz: nach Reload laedt der Feed den Herz-Zustand aus favorites.
  await page.goto('/')
  const cardR = page.getByTestId('listing-card').filter({ hasText: LISTING_TITLE })
  await expect(cardR).toBeVisible()
  await expect(cardR.getByTestId('favorite-btn')).toHaveAttribute('aria-pressed', 'true')

  // Favoriten-Tab im Profil listet das Inserat mit Status-Sticker.
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Favoriten' }).click()
  const favRow = page.getByTestId('favorite-row').filter({ hasText: LISTING_TITLE })
  await expect(favRow).toBeVisible()

  // Toggle entfernt den Favoriten wieder (Herz aus der Favoriten-Liste).
  await favRow.getByTestId('favorite-remove-btn').click()
  await expect(page.getByTestId('favorite-row').filter({ hasText: LISTING_TITLE })).toHaveCount(0)

  await expect
    .poll(
      async () => {
        const r = await rest(`favorites?listing_id=eq.${LID}&user_id=eq.${AID}&select=id`)
        return (await r.json()).length
      },
      { timeout: 15_000 }
    )
    .toBe(0)
})

test('RLS-Leak-Beweis: User B sieht As Favoriten NICHT', async () => {
  // A favorisiert das Listing (als A, RLS erlaubt nur user_id = auth.uid()).
  const tokenA = await getToken(A.email, A.password)
  const tokenB = await getToken(B.email, B.password)

  await rest(`favorites?listing_id=eq.${LID}&user_id=eq.${AID}`, { method: 'DELETE' })
  const ins = await restAs(tokenA, 'favorites', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: AID, listing_id: LID }),
  })
  expect(ins.ok, `Favorit-Insert (A) fehlgeschlagen HTTP ${ins.status}`).toBeTruthy()

  // B liest ALLE fuer ihn sichtbaren Favoriten: keiner gehoert A.
  const allB = await restAs(tokenB, 'favorites?select=user_id,listing_id')
  const rowsB: Array<{ user_id: string; listing_id: string }> = await allB.json()
  expect(Array.isArray(rowsB)).toBeTruthy()
  expect(rowsB.every((r) => r.user_id === BID)).toBeTruthy()

  // Gezielter Leak-Test: B fragt explizit nach As Favoriten -> 0 Zeilen (RLS).
  const leak = await restAs(tokenB, `favorites?user_id=eq.${AID}&listing_id=eq.${LID}&select=id`)
  const leakRows = await leak.json()
  expect(Array.isArray(leakRows) ? leakRows.length : -1).toBe(0)

  // Gegenprobe: A selbst sieht seinen Favoriten sehr wohl.
  const own = await restAs(tokenA, `favorites?user_id=eq.${AID}&listing_id=eq.${LID}&select=id`)
  expect((await own.json()).length).toBe(1)

  await rest(`favorites?listing_id=eq.${LID}&user_id=eq.${AID}`, { method: 'DELETE' })
})

test('Onboarding: genau 2 Screens, kein Interessen-/Benachrichtigungs-Screen, keine Events-Karte', async ({
  page,
}) => {
  // KEIN skipOnboarding -> Flow ist sichtbar (frischer Kontext, leerer Store).
  await page.goto('/')

  // Screen 1: Hook + zwei Persona-Karten.
  await expect(page.getByText('Gold wert')).toBeVisible()
  await expect(page.getByTestId('onboarding-persona-verkaufen')).toBeVisible()
  await expect(page.getByTestId('onboarding-persona-suchen')).toBeVisible()

  // Ausgeschlossen: Interessen-Screen, Events/Firmen-Karte, In-Onboarding-Benachrichtigung.
  await expect(page.getByText('Was interessiert dich')).toHaveCount(0)
  await expect(page.getByText(/Firmen|Vereine/)).toHaveCount(0)
  await expect(page.getByTestId('notification-enable-btn')).toHaveCount(0)

  // Persona 'suchen' waehlen -> Screen 2 (Herzstueck + Geschenk + CTA).
  await page.getByTestId('onboarding-persona-suchen').click()
  await expect(page.getByTestId('onboarding-herzstueck')).toBeVisible()
  await expect(page.getByText('5 Uri-Taler geschenkt')).toBeVisible()
  await expect(page.getByText('Beispiel')).toBeVisible()
  // Persona-abhaengige Gratulation (suchen-Variante).
  await expect(page.getByText(/Sag noch heute, was du suchst/)).toBeVisible()

  // CTA „Los geht's" -> Onboarding zu, Registrierung offen (register-only Felder).
  await page.getByTestId('onboarding-cta-start').click()
  await expect(page.getByTestId('onboarding-cta-start')).toHaveCount(0)
  await expect(page.getByPlaceholder('Username')).toBeVisible()
  await expect(page.getByTestId('register-terms')).toBeVisible()
})
