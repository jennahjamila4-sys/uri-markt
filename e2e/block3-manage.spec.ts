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

const svcHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...svcHeaders, ...(init.headers ?? {}) },
  })
}

async function getAccessToken(email: string, password: string): Promise<string> {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const b = await r.json()
  return b.access_token
}

async function getProfileId(email: string, password: string): Promise<string> {
  const token = await getAccessToken(email, password)
  const ur = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  })
  const u = await ur.json()
  return u.id as string
}

// UI-Login ueber das Auth-Modal (identisch zur Deal-Flow-Spec).
async function login(page: Page, email: string, password: string) {
  await page.goto('/?auth=required')
  const form = page.locator('form')
  await form.getByPlaceholder('E-Mail').fill(email)
  await form.getByPlaceholder('Passwort').fill(password)
  await form.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByPlaceholder('Passwort')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Anmelden' })).toHaveCount(0)
}

async function openMyListings(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: /Meine Inserate/ }).click()
}

// Zeile in "Meine Inserate" per Titel finden (Aktionen sind pro Zeile gescopt).
const row = (page: Page, title: string) =>
  page.getByTestId('my-listing-row').filter({ hasText: title })

const TS = Date.now()
const T_EDIT = `E2E-BLOCK3-EDIT ${TS}`
const T_EDITED = `E2E-BLOCK3-EDITED ${TS}`
const T_TOGGLE = `E2E-BLOCK3-TOGGLE ${TS}`
const T_DELETE = `E2E-BLOCK3-DELETE ${TS}`
const T_RESERVED = `E2E-BLOCK3-RESERVED ${TS}`

let AID = ''

async function cleanup() {
  await rest('listings?title=like.E2E-BLOCK3%25', { method: 'DELETE' })
}

async function seedListing(title: string, status: string) {
  const r = await rest('listings', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: AID,
      title,
      description: 'E2E Block 3',
      category: 'sonstiges',
      gemeinde: 'Altdorf',
      type: 'Angebot',
      price_type: 'free',
      price: 0,
      status,
    }),
  })
  expect(r.ok, `Seed "${title}" fehlgeschlagen HTTP ${r.status}`).toBeTruthy()
}

const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

test.beforeAll(async () => {
  expect(A.email, 'E2E_USER_A_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  AID = await getProfileId(A.email, A.password)
  expect(AID, 'Profil-ID A nicht aufgeloest').toBeTruthy()

  await cleanup()
  await seedListing(T_EDIT, 'active')
  await seedListing(T_TOGGLE, 'active')
  await seedListing(T_DELETE, 'active')
  await seedListing(T_RESERVED, 'reserved')
})

test.afterAll(async () => {
  await cleanup()
})

test.beforeEach(async ({ page }: { page: Page }) => {
  await page.addInitScript(skipOnboarding)
})

test('Bearbeiten: Titel eines aktiven Inserats aendern (UI + DB)', async ({ page }) => {
  await login(page, A.email, A.password)
  await openMyListings(page)

  const r = row(page, T_EDIT)
  await expect(r).toBeVisible()
  await r.getByTestId('listing-edit-btn').click()

  const modal = page.getByTestId('edit-listing-modal')
  await expect(modal).toBeVisible()
  await modal.getByTestId('edit-title').fill(T_EDITED)
  await modal.getByTestId('edit-save').click()

  // Modal schliesst, Zeile traegt den neuen Titel.
  await expect(modal).toBeHidden()
  await expect(row(page, T_EDITED)).toBeVisible()

  // Beweis in der DB (nicht nur im UI-State).
  const res = await rest(
    `listings?title=eq.${encodeURIComponent(T_EDITED)}&select=id,title,status`
  )
  const rowsDb = await res.json()
  expect(rowsDb.length, 'Editiertes Listing nicht in DB gefunden').toBe(1)
  expect(rowsDb[0].status).toBe('active')
})

test('Deaktivieren dann Reaktivieren; deaktiviert verschwindet aus dem Feed', async ({ page }) => {
  await login(page, A.email, A.password)
  await openMyListings(page)

  // Deaktivieren (aktiver Tab, Zeile vorhanden).
  await row(page, T_TOGGLE).getByTestId('listing-toggle-active-btn').click()
  // Aus dem aktiven Tab verschwunden.
  await expect(row(page, T_TOGGLE)).toHaveCount(0)

  // Im Tab "Deaktiviert" sichtbar.
  await page.getByRole('button', { name: 'Deaktiviert', exact: true }).click()
  await expect(row(page, T_TOGGLE)).toBeVisible()

  // Nicht im oeffentlichen Feed (Server zeigt nur active/reserved).
  await page.goto('/')
  await expect(page.getByText(T_TOGGLE)).toHaveCount(0)

  // Reaktivieren, wieder im aktiven Tab.
  await openMyListings(page)
  await page.getByRole('button', { name: 'Deaktiviert', exact: true }).click()
  await row(page, T_TOGGLE).getByTestId('listing-toggle-active-btn').click()
  await page.getByRole('button', { name: 'Aktiv', exact: true }).click()
  await expect(row(page, T_TOGGLE)).toBeVisible()
})

test('Loeschen mit Bestaetigungsdialog (UI + DB)', async ({ page }) => {
  await login(page, A.email, A.password)
  await openMyListings(page)

  const r = row(page, T_DELETE)
  await expect(r).toBeVisible()
  await r.getByTestId('listing-delete-btn').click()
  // Erst nach Bestaetigung wird geloescht.
  await r.getByTestId('listing-delete-confirm-btn').click()

  await expect(row(page, T_DELETE)).toHaveCount(0)

  const res = await rest(
    `listings?title=eq.${encodeURIComponent(T_DELETE)}&select=id`
  )
  const rowsDb = await res.json()
  expect(rowsDb.length, 'Geloeschtes Listing noch in DB').toBe(0)
})

test('Reserviert: Bearbeiten/Loeschen gesperrt, Grund sichtbar', async ({ page }) => {
  await login(page, A.email, A.password)
  await openMyListings(page)

  await page.getByRole('button', { name: 'Reserviert', exact: true }).click()
  const r = row(page, T_RESERVED)
  await expect(r).toBeVisible()

  // Keine Verwaltungs-Buttons, aber sichtbarer Sperr-Grund (Lektion 6).
  await expect(r.getByTestId('listing-edit-btn')).toHaveCount(0)
  await expect(r.getByTestId('listing-delete-btn')).toHaveCount(0)
  await expect(r.getByTestId('listing-toggle-active-btn')).toHaveCount(0)
  await expect(r.getByTestId('listing-blocked-reason')).toBeVisible()
  // Grund nennt den Status konkret (Lektion 6): gezielt auf die Reason-Testid,
  // nicht per /Reserviert/ (das auch das Status-Badge matcht = mehrdeutig).
  await expect(r.getByTestId('listing-blocked-reason')).toContainText('Reserviert')
})
