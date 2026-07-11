import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// ─── Env aus .env.local laden (Playwright-Runner laedt sie nicht selbst) ─────
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

// Profil (id + username) ueber den eingeloggten Auth-User aufloesen.
async function getProfile(email: string, password: string): Promise<{ id: string; username: string }> {
  const token = await getAccessToken(email, password)
  const ur = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  })
  const u = await ur.json()
  const pr = await rest(`profiles?id=eq.${u.id}&select=id,username`)
  const [p] = await pr.json()
  return { id: p.id, username: p.username }
}

const MARKER = `E2E-REVIEWS-${Date.now()}`
let AID = '', AUSER = '', BID = '', BUSER = ''

// Onboarding-Overlay ueberspringen (sonst blockiert es Klicks/Sicht auf '/').
const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

async function cleanup() {
  await rest('reviews?comment=like.E2E-REVIEWS%25', { method: 'DELETE' })
  await rest('listings?title=like.E2E-TEST-REVIEWS%25', { method: 'DELETE' })
}

test.beforeAll(async () => {
  expect(A.email, 'E2E_USER_A_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  expect(B.email, 'E2E_USER_B_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()

  const pa = await getProfile(A.email, A.password)
  const pb = await getProfile(B.email, B.password)
  AID = pa.id; AUSER = pa.username; BID = pb.id; BUSER = pb.username
  expect(AUSER, 'Username A nicht aufgeloest').toBeTruthy()
  expect(BUSER, 'Username B nicht aufgeloest').toBeTruthy()

  await cleanup()

  // A (reviewee) bekommt zwei oeffentliche Einzelbewertungen:
  //  - eine von B (gueltiger Reviewer)
  //  - eine mit reviewer_id = null  -> muss als "Geloeschter Nutzer" rendern
  const seed = await rest('reviews', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([
      { reviewee_id: AID, reviewer_id: BID, rating: 4, comment: `${MARKER} von B` },
      { reviewee_id: AID, reviewer_id: null, rating: 5, comment: `${MARKER} anon` },
    ]),
  })
  expect(seed.ok, `Seed-Reviews fehlgeschlagen HTTP ${seed.status}`).toBeTruthy()

  // B (reviewee) bewusst OHNE Bewertungen -> Leerzustand testen.
  await rest(`reviews?reviewee_id=eq.${BID}`, { method: 'DELETE' })

  // Aktives Angebot von A fuer den Listing-Detail-Test (Verkaeufer = A).
  const lst = await rest('listings', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: AID,
      title: `E2E-TEST-REVIEWS ${Date.now()}`,
      description: 'E2E Listing fuer Verkaeufer-Rating',
      category: 'sonstiges',
      gemeinde: 'Altdorf',
      type: 'Angebot',
      price_type: 'free',
      price: 0,
      status: 'active',
    }),
  })
  expect(lst.ok, `Seed-Listing fehlgeschlagen HTTP ${lst.status}`).toBeTruthy()
})

test.afterAll(async () => {
  await cleanup()
})

test.beforeEach(async ({ page }: { page: Page }) => {
  await page.addInitScript(skipOnboarding)
})

test('oeffentliches Profil: Durchschnitt + Anzahl + Einzelbewertungen inkl. Geloeschter Nutzer', async ({ page }) => {
  await page.goto(`/profile/${AUSER}`)

  // Durchschnitt (Element vorhanden, keine erfundene Zahl noetig) + Anzahl-Label.
  await expect(page.getByTestId('profile-avg-rating')).toBeVisible()
  await expect(page.getByText(/Bewertungen/).first()).toBeVisible()

  // Einzelbewertungen-Liste mit mindestens den zwei Seeds.
  await expect(page.getByTestId('reviews-list')).toBeVisible()
  await expect(page.getByTestId('review-item').first()).toBeVisible()

  // Gueltiger Reviewer (Username B) UND geloeschter Reviewer.
  await expect(page.getByText(BUSER).first()).toBeVisible()
  await expect(page.getByText('Gelöschter Nutzer').first()).toBeVisible()
  await expect(page.getByText(`${MARKER} von B`)).toBeVisible()
})

test('oeffentliches Profil ohne Bewertungen: sauberer Leerzustand', async ({ page }) => {
  await page.goto(`/profile/${BUSER}`)
  await expect(page.getByTestId('reviews-empty')).toBeVisible()
  await expect(page.getByTestId('review-item')).toHaveCount(0)
})

test('Listing-Detail zeigt Verkaeufer-Bewertung', async ({ page }) => {
  await page.goto('/')
  const card = page.getByText(/E2E-TEST-REVIEWS/).first()
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.getByTestId('seller-rating')).toBeVisible()
})
