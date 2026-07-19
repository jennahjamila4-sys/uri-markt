import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test'
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
const SERVICE = ENV.SUPABASE_SERVICE_ROLE_KEY
const USER_A = { email: ENV.E2E_USER_A_EMAIL, password: ENV.E2E_USER_A_PASSWORD } // Anbieter
const USER_B = { email: ENV.E2E_USER_B_EMAIL, password: ENV.E2E_USER_B_PASSWORD } // Gesuch-Besitzer

// Eindeutige Titel pro Lauf, alle mit E2E-B9-Praefix fuer sauberes Aufraeumen
const RUN = Date.now()
const OFFER_1 = `E2E-B9 Roter Wollpullover Groesse M ${RUN}`
const GESUCH_1 = `E2E-B9 Suche roten Wollpullover Groesse M ${RUN}`
const OFFER_2 = `E2E-B9 Roter Wollpullover Groesse M Nachschub ${RUN}`
const OFFER_TX = `E2E-B9 Uebergabe-Testartikel ${RUN}`

// ─── Service-Role-REST fuer Cleanup (umgeht RLS) ─────────────────────────────
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

/**
 * Test-Daten restlos entfernen, damit der Feed sauber bleibt.
 * Reihenfolge: erst abhaengige Zeilen (smart_matches, notifications,
 * transactions), dann die Listings selbst — unabhaengig vom FK-Verhalten.
 */
async function cleanupE2EData() {
  const res = await rest('listings?title=like.E2E-B9%25&select=id')
  const rows: { id: string }[] = res.ok ? await res.json() : []
  if (rows.length > 0) {
    const ids = `(${rows.map((r) => r.id).join(',')})`
    await rest(`smart_matches?or=(gesuch_id.in.${ids},matched_listing_id.in.${ids})`, { method: 'DELETE' })
    await rest(`notifications?listing_id=in.${ids}`, { method: 'DELETE' })
    await rest(`transactions?listing_id=in.${ids}`, { method: 'DELETE' })
    await rest('listings?title=like.E2E-B9%25', { method: 'DELETE' })
  }
}

// ─── UI-Helfer (gleiche Muster wie deal-completion.spec.ts) ──────────────────
const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

async function login(page: Page, email: string, password: string) {
  await page.goto('/?auth=required')
  const form = page.locator('form')
  await form.getByPlaceholder('E-Mail').fill(email)
  await form.getByPlaceholder('Passwort').fill(password)
  await form.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByPlaceholder('Passwort')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Anmelden' })).toHaveCount(0)
}

// ─── Create-Helfer: Single-Screen-Chamaeleon-Formular (Block 10) ─────────────
// Referenz: e2e/block10-smart-forms.spec.ts. Kein Wizard/„Weiter" mehr; Kategorie
// per Fallback-Select (deterministisch), Gemeinde per Chip, Publish = „Veröffentlichen".

/** Kategorie explizit ueber das Fallback-Select setzen (Banner ggf. aufklappen). */
async function setCategory(modal: Locator, value: string) {
  const change = modal.getByText('ändern')
  if (await change.count()) await change.first().click()
  await modal.locator('#field-category select').selectOption(value)
}

/** Gemeinde-Chip in den gewuenschten Zustand bringen (robust gegen Vorbefuellung). */
async function ensureGemeinde(modal: Locator, name: string, want = true) {
  const chip = modal.locator('#field-gemeinde').getByRole('button', { name, exact: true })
  const cls = (await chip.getAttribute('class')) ?? ''
  const active = cls.includes('bg-gold')
  if (active !== want) await chip.click()
}

/** Angebot erstellen: Kategorie Kleider & Mode, Festpreis, Gemeinde Altdorf */
async function createAngebot(page: Page, title: string, price: number) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Inserat erstellen' }).click()
  const modal = page.locator('.animate-slide-up')
  await modal.getByRole('button', { name: /Angebot$/ }).click()
  await modal.locator('#field-title input').fill(title)
  await setCategory(modal, 'kleider')
  await modal.locator('input[placeholder="Preis in CHF"]').fill(String(price))
  await ensureGemeinde(modal, 'Altdorf', true)
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
  await expect(page.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()
}

/** Gratis-Angebot (Kategorie Sonstiges) — fuer den tx_pending-Test */
async function createFreeAngebot(page: Page, title: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Inserat erstellen' }).click()
  const modal = page.locator('.animate-slide-up')
  await modal.getByRole('button', { name: /Angebot$/ }).click()
  await modal.locator('#field-title input').fill(title)
  await setCategory(modal, 'sonstiges')
  await modal.getByRole('button', { name: /Gratis/ }).click()
  await ensureGemeinde(modal, 'Altdorf', true)
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
  await expect(page.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()
}

/** Gesuch erstellen: Kategorie Kleider & Mode, Budget, Gemeinde Altdorf */
async function createGesuch(page: Page, title: string, budget: number) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Inserat erstellen' }).click()
  const modal = page.locator('.animate-slide-up')
  await modal.getByRole('button', { name: /Gesuch$/ }).click()
  await modal.locator('#field-title input').fill(title)
  await setCategory(modal, 'kleider')
  await modal.locator('input[placeholder="z.B. 50"]').fill(String(budget))
  await ensureGemeinde(modal, 'Altdorf', true)
  await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
  await expect(page.getByText('Gesuch erstellt! Wir suchen passende Angebote. 🎯')).toBeVisible()
}

/** Detail des eigenen Gesuchs oeffnen (Feed → Tab Gesuche → Karte) */
async function openGesuchDetail(page: Page, gesuchTitle: string) {
  await page.goto('/')
  // Tab-Klick kann vor React-Hydration verpuffen → klicken und kurz auf die
  // Karten-Ueberschrift warten, sonst erneut klicken (Timing-Robustheit).
  // Karten-Ueberschrift (h3) gezielt treffen — Notification-Toast/-Panel
  // enthalten den Gesuch-Titel ebenfalls als <p> (Selektor-Robustheit).
  const heading = page.getByRole('heading', { name: gesuchTitle })
  await expect(async () => {
    await page.getByRole('button', { name: /Gesuche/ }).click()
    await expect(heading.first()).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await heading.first().click()
  await expect(page.getByTestId('gesuch-matches')).toBeVisible()
}

/**
 * Edge Function arbeitet asynchron: Detail so lange neu laden (max ~30s),
 * bis die Match-Karte mit dem erwarteten Angebot sichtbar ist.
 */
async function waitForMatchCard(page: Page, gesuchTitle: string, offerTitle: string) {
  const deadline = Date.now() + 30_000
  for (;;) {
    await openGesuchDetail(page, gesuchTitle)
    const card = page
      .getByTestId('match-card')
      .filter({ hasText: offerTitle })
    try {
      await expect(card.first()).toBeVisible({ timeout: 5_000 })
      return
    } catch {
      if (Date.now() > deadline) {
        throw new Error(
          `Match-Karte fuer "${offerTitle}" erschien nicht innert 30s auf dem Gesuch-Detail`
        )
      }
    }
  }
}

/** Glocke oeffnen und Eintrag mit Text erwarten (Notification kann nachlaufen) */
async function expectNotification(page: Page, textPattern: RegExp) {
  const deadline = Date.now() + 30_000
  for (;;) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Benachrichtigungen' }).click()
    try {
      await expect(page.getByText(textPattern).first()).toBeVisible({ timeout: 5_000 })
      return
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`Notification "${textPattern}" erschien nicht innert 30s`)
      }
    }
  }
}

// ─── Tests (serial: bauen aufeinander auf, 1 Worker laut Config) ─────────────
test.describe.serial('Block 9: Smart-Match-System', () => {
  let ctxA: BrowserContext
  let ctxB: BrowserContext
  let pageA: Page
  let pageB: Page

  test.beforeAll(async ({ browser }) => {
    await cleanupE2EData()
    ctxA = await browser.newContext()
    ctxB = await browser.newContext()
    await ctxA.addInitScript(skipOnboarding)
    await ctxB.addInitScript(skipOnboarding)
    pageA = await ctxA.newPage()
    pageB = await ctxB.newPage()
    await login(pageA, USER_A.email, USER_A.password)
    await login(pageB, USER_B.email, USER_B.password)
  })

  test.afterAll(async () => {
    await cleanupE2EData()
    await ctxA?.close()
    await ctxB?.close()
  })

  test('Test 1: Gesuch findet bestehendes Angebot + match-Notification', async () => {
    // A erstellt das Angebot ZUERST, dann erstellt B das Gesuch → Trigger laeuft beim Gesuch
    await createAngebot(pageA, OFFER_1, 20)
    await createGesuch(pageB, GESUCH_1, 50)

    // Match-Karte auf Bs Gesuch-Detail (asynchron, Polling bis 30s)
    await waitForMatchCard(pageB, GESUCH_1, OFFER_1)

    // Glocke: match-Notification sichtbar (Titel je nach Score-Stufe)
    await expectNotification(pageB, /Perfekter Match gefunden|Das könnte dir gefallen/)
  })

  test('Test 2: Neues Angebot findet bestehendes Gesuch', async () => {
    // B hat das aktive Gesuch aus Test 1; A erstellt danach ein passendes Angebot
    await createAngebot(pageA, OFFER_2, 25)

    // B erhaelt eine neue match-Notification, deren Text das neue Angebot nennt
    await expectNotification(pageB, new RegExp(`Nachschub ${RUN}`))

    // Match erscheint auch auf Bs Gesuch-Detail
    await waitForMatchCard(pageB, GESUCH_1, OFFER_2)
  })

  test('Test 3: Ausblenden entfernt Match dauerhaft', async () => {
    await openGesuchDetail(pageB, GESUCH_1)
    const card = pageB.getByTestId('match-card').filter({ hasText: OFFER_2 })
    await expect(card.first()).toBeVisible()
    await card.first().getByRole('button', { name: 'Ausblenden' }).click()
    await expect(card).toHaveCount(0)

    // Bleibt nach Reload weg (dismissed=true in DB)
    await openGesuchDetail(pageB, GESUCH_1)
    await expect(
      pageB.getByTestId('match-card').filter({ hasText: OFFER_2 })
    ).toHaveCount(0)
  })

  test('Test 4: Kaufanfrage → Verkaeufer sieht tx_pending in der Glocke', async () => {
    // A erstellt Gratis-Angebot (keine Taler noetig), B stellt Kaufanfrage
    await createFreeAngebot(pageA, OFFER_TX)

    await pageB.goto('/')
    const offerHeading = pageB.getByRole('heading', { name: OFFER_TX })
    await expect(offerHeading.first()).toBeVisible()
    await offerHeading.first().click()
    await pageB.getByRole('button', { name: /^🛒 Kaufen$/ }).click()
    const buyModal = pageB
      .locator('.animate-slide-up', { hasText: 'Kaufabsicht bestätigen' })
      .last()
    await expect(buyModal).toBeVisible()
    await buyModal.getByPlaceholder('z.B. Max, 079 123 45 67').fill('E2E Käufer, 079 000 00 00')
    await buyModal.getByRole('checkbox').check()
    await buyModal.getByRole('button', { name: /Kaufabsicht senden/ }).click()
    await expect(pageB.getByText('Kaufabsicht bestätigen')).toBeHidden()

    // A: tx_pending-Notification in der Glocke
    await expectNotification(pageA, /Kaufanfrage|Kaufabsicht/)
  })
})
