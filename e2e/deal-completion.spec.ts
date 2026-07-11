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
const SELLER = { email: ENV.E2E_USER_A_EMAIL, password: ENV.E2E_USER_A_PASSWORD }
const BUYER = { email: ENV.E2E_USER_B_EMAIL, password: ENV.E2E_USER_B_PASSWORD }

// ─── REST-Helfer (Service-Role fuer Setup/Cleanup, Anon fuer Login-Token) ────
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

async function deleteE2EListings() {
  // Alle Test-Inserate frueherer Laeufe entfernen (FKs SET NULL) → sauberer Feed.
  await rest('listings?title=like.E2E-TEST%25', { method: 'DELETE' })
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

// ─── UI-Login (über das Auth-Modal) ─────────────────────────────────────────
async function login(page: Page, email: string, password: string) {
  await page.goto('/?auth=required')
  const form = page.locator('form')
  await form.getByPlaceholder('E-Mail').fill(email)
  await form.getByPlaceholder('Passwort').fill(password)
  await form.getByRole('button', { name: 'Anmelden' }).click()
  // Erfolg: Modal schliesst (Passwort-Feld weg) UND Header zeigt eingeloggt.
  await expect(page.getByPlaceholder('Passwort')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Anmelden' })).toHaveCount(0)
}

async function createFreeListing(page: Page, title: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Inserat erstellen' }).click()
  // Alle Klicks im Create-Modal scopen (Feed hat eigene „Sonstiges"/„Weiter"-Elemente)
  const modal = page.locator('.animate-slide-up')
  // Step 1: Kategorie
  await modal.getByRole('button', { name: /Sonstiges/ }).click()
  await modal.getByRole('button', { name: 'Weiter' }).click()
  // Step 2: Titel
  await modal.getByPlaceholder('Was verkaufst du?').fill(title)
  await modal.getByRole('button', { name: 'Weiter' }).click()
  // Step 3: Gratis + Gemeinde
  await modal.getByRole('button', { name: 'Gratis' }).click()
  await modal.getByRole('combobox').selectOption('Altdorf')
  await modal.getByRole('button', { name: 'Weiter' }).click()
  // Step 4: Rechts-Checkbox + Veroeffentlichen
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Veröffentlichen' }).click()
  await expect(page.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()
}

async function buyListing(page: Page, title: string) {
  await page.goto('/')
  await expect(page.getByText(title).first()).toBeVisible()
  await page.getByText(title).first().click()
  // Listing-Detail: Kaufen
  await page.getByRole('button', { name: /^🛒 Kaufen$/ }).click()
  // Kaufabsicht-Modal ist IM Listing-Detail verschachtelt → innerstes nehmen.
  const buyModal = page.locator('.animate-slide-up', { hasText: 'Kaufabsicht bestätigen' }).last()
  await expect(buyModal).toBeVisible()
  await buyModal.getByPlaceholder('z.B. Max, 079 123 45 67').fill('E2E Käufer, 079 000 00 00')
  await buyModal.getByRole('checkbox').check()
  await buyModal.getByRole('button', { name: /Kaufabsicht senden/ }).click()
  // Erfolg: Modal schliesst.
  await expect(page.getByText('Kaufabsicht bestätigen')).toBeHidden()
}

function cardByTitle(page: Page, title: string) {
  return page.locator('.rounded-2xl').filter({ hasText: title })
}

async function openSales(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: /Meine Verkäufe/ }).click()
}

async function openPurchases(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: /Meine Käufe/ }).click()
}

// ─── Test ─────────────────────────────────────────────────────────────────────
test.beforeAll(async () => {
  expect(SELLER.email, 'E2E_USER_A_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  expect(BUYER.email, 'E2E_USER_B_EMAIL fehlt (setup-users.mjs laufen lassen)').toBeTruthy()
  await deleteE2EListings()
})

test.afterAll(async () => {
  await deleteE2EListings()
})

test('beidseitiger Deal-Flow: Kauf → Bestätigung → beidseitiger Abschluss → Bewertung 1×', async ({ browser }) => {
  const title = `E2E-TEST bitte ignorieren ${Date.now()}`

  const sellerCtx = await browser.newContext()
  const buyerCtx = await browser.newContext()
  // Onboarding-Overlay ueberspringen (zustand-persist, Key uri-markt-v1) –
  // sonst blockiert es das Login-Modal.
  const skipOnboarding = () =>
    localStorage.setItem(
      'uri-markt-v1',
      JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
    )
  await sellerCtx.addInitScript(skipOnboarding)
  await buyerCtx.addInitScript(skipOnboarding)

  const seller = await sellerCtx.newPage()
  const buyer = await buyerCtx.newPage()

  // 1) Beide einloggen (UI-Modal)
  await login(seller, SELLER.email, SELLER.password)
  await login(buyer, BUYER.email, BUYER.password)

  // 2) Verkäufer erstellt Gratis-Inserat (Gratis → Provision 0, kein Taler nötig)
  await createFreeListing(seller, title)

  // 3) Käufer kauft
  await buyListing(buyer, title)

  // 4) Verkäufer bestätigt die Kaufanfrage → Reservierung + Kontaktfreigabe
  await openSales(seller)
  const saleCard = cardByTitle(seller, title)
  await expect(saleCard).toBeVisible()
  await saleCard.getByRole('button', { name: 'Bestätigen' }).click()
  await expect(seller.getByText(/Verkauf bestätigt/)).toBeVisible()

  // 5) Käufer sieht confirmed-Zustand: Kontakt-Sektion + Übergabe-Button
  await openPurchases(buyer)
  const buyCard = cardByTitle(buyer, title)
  await expect(buyCard.getByRole('button', { name: 'Übergabe bestätigen' })).toBeVisible()
  // Verkäufer sieht Käufer-Kontakt (Kontakt NUR bei confirmed sichtbar)
  await openSales(seller)
  await expect(cardByTitle(seller, title).getByText('E2E Käufer, 079 000 00 00')).toBeVisible()

  // 6) Käufer bestätigt Übergabe zuerst → „Wartet auf Gegenseite" (F5-fest)
  await openPurchases(buyer)
  await cardByTitle(buyer, title).getByRole('button', { name: 'Übergabe bestätigen' }).click()
  await expect(buyer.getByText(/Deine Bestätigung ist da/)).toBeVisible()
  await openPurchases(buyer) // Reload: Zustand hält
  await expect(cardByTitle(buyer, title).getByText(/Wartet auf Bestätigung der Gegenseite/)).toBeVisible()

  // 7) Verkäufer bestätigt Übergabe → completed + Bewertungs-Modal öffnet sich
  await openSales(seller)
  await cardByTitle(seller, title).getByRole('button', { name: 'Übergabe bestätigen' }).click()
  await expect(seller.getByText(/Übergabe abgeschlossen/)).toBeVisible()
  // Verkäufer bewertet direkt im automatisch geöffneten Modal
  await expect(seller.getByText('Wie war der Deal?')).toBeVisible()
  await seller.getByRole('button', { name: '5 Sterne' }).click()
  await seller.getByRole('button', { name: 'Bewertung abgeben' }).click()
  await expect(seller.getByText(/Danke für deine Bewertung/)).toBeVisible()

  // 8) Käufer sieht Abschluss + bewertet genau 1×
  await openPurchases(buyer)
  const doneCard = cardByTitle(buyer, title)
  await expect(doneCard.getByText(/Abgeschlossen/)).toBeVisible()
  await doneCard.getByRole('button', { name: /Jetzt bewerten/ }).click()
  await expect(buyer.getByText('Wie war der Deal?')).toBeVisible()
  await buyer.getByRole('button', { name: '5 Sterne' }).click()
  await buyer.getByRole('button', { name: 'Bewertung abgeben' }).click()
  await expect(buyer.getByText(/Danke für deine Bewertung/)).toBeVisible()

  // 9) Bewertung ist einmalig: nach Reload kein Bewerten-Button mehr, „Bewertet"
  await openPurchases(buyer)
  const reviewedCard = cardByTitle(buyer, title)
  await expect(reviewedCard.getByText(/Bewertet – merci/)).toBeVisible()
  await expect(reviewedCard.getByRole('button', { name: /Jetzt bewerten/ })).toHaveCount(0)

  // 10) Zweiter Bewertungsversuch wird DB-seitig abgelehnt (unique) – direkter
  //     Insert mit Käufer-JWT muss scheitern (Backstop hinter dem App-Precheck).
  const listRes = await rest(`listings?title=eq.${encodeURIComponent(title)}&select=id`)
  const [listingRow] = await listRes.json()
  expect(listingRow?.id).toBeTruthy()
  const txRes = await rest(`transactions?listing_id=eq.${listingRow.id}&select=id,buyer_id,seller_id`)
  const [tx] = await txRes.json()
  expect(tx?.id).toBeTruthy()

  const buyerToken = await getAccessToken(BUYER.email, BUYER.password)
  const dup = await fetch(`${SB_URL}/rest/v1/reviews`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${buyerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reviewer_id: tx.buyer_id,
      reviewee_id: tx.seller_id,
      listing_id: listingRow.id,
      transaction_id: tx.id,
      rating: 3,
    }),
  })
  expect(dup.ok, 'zweite Bewertung derselben Transaktion muss abgelehnt werden').toBeFalsy()

  await sellerCtx.close()
  await buyerCtx.close()
})
