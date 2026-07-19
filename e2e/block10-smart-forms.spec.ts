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
const ANON = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = ENV.SUPABASE_SERVICE_ROLE_KEY
const USER_A = { email: ENV.E2E_USER_A_EMAIL, password: ENV.E2E_USER_A_PASSWORD } // Anbieter
const USER_B = { email: ENV.E2E_USER_B_EMAIL, password: ENV.E2E_USER_B_PASSWORD } // Gesuch/Kaeufer

const RUN = Date.now()
const OFFER_1 = `E2E-B10 Roter Wollpullover Groesse M ${RUN}`
const DRAFT_1 = `E2E-B10 Entwurf ${RUN}`
const OFFER_DRAFT = `E2E-B10 Roter Wollpullover Nachschub ${RUN}`
const GESUCH_1 = `E2E-B10 Suche roten Wollpullover ${RUN}`
const FREE_1 = `E2E-B10 Gratis 1 ${RUN}`
const FREE_2 = `E2E-B10 Gratis 2 ${RUN}`
const MULTI_1 = `E2E-B10 Sofa mehrere Gemeinden ${RUN}`

// ─── Service-Role-REST (umgeht RLS) ──────────────────────────────────────────
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
async function readCredits(profileId: string): Promise<number> {
  const r = await rest(`profiles?id=eq.${profileId}&select=credits`)
  const rows: { credits: number | null }[] = r.ok ? await r.json() : []
  return rows[0]?.credits ?? 0
}
async function setCredits(profileId: string, rappen: number) {
  await rest(`profiles?id=eq.${profileId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ credits: rappen }),
  })
}
async function findListingIdByTitle(title: string): Promise<string | null> {
  const r = await rest(`listings?title=eq.${encodeURIComponent(title)}&select=id`)
  const rows: { id: string }[] = r.ok ? await r.json() : []
  return rows[0]?.id ?? null
}

/**
 * Alle E2E-B10-Daten restlos entfernen (vor UND nach dem Lauf).
 * Reihenfolge: abhaengige Zeilen zuerst (smart_matches, notifications,
 * transactions), dann die Listings (inkl. Entwuerfe — LIKE deckt sie ab).
 */
async function cleanupE2EData() {
  const res = await rest('listings?title=like.E2E-B10%25&select=id')
  const rows: { id: string }[] = res.ok ? await res.json() : []
  if (rows.length > 0) {
    const ids = `(${rows.map((r) => r.id).join(',')})`
    await rest(`smart_matches?or=(gesuch_id.in.${ids},matched_listing_id.in.${ids})`, { method: 'DELETE' })
    await rest(`notifications?listing_id=in.${ids}`, { method: 'DELETE' })
    await rest(`transactions?listing_id=in.${ids}`, { method: 'DELETE' })
    await rest('listings?title=like.E2E-B10%25', { method: 'DELETE' })
  }
}

// ─── UI-Helfer ───────────────────────────────────────────────────────────────
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

async function openCreate(page: Page, tab: 'Angebot' | 'Gesuch'): Promise<Locator> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Inserat erstellen' }).click()
  const modal = page.locator('.animate-slide-up')
  await modal.getByRole('button', { name: new RegExp(`${tab}$`) }).click()
  return modal
}

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

async function openMyListings(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: /Meine Inserate/ }).click()
}
async function openSales(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: /Meine Verkäufe/ }).click()
}
const saleCardByTitle = (page: Page, title: string): Locator =>
  page.locator('.rounded-2xl').filter({ hasText: title })

async function openListingDetail(page: Page, title: string) {
  await page.goto('/')
  const heading = page.getByRole('heading', { name: title })
  await expect(heading.first()).toBeVisible({ timeout: 10_000 })
  await heading.first().click()
}

/** Gratis-Angebot ueber das neue Chamaeleon-Formular. */
async function createFreeAngebot(page: Page, title: string, gemeinde = 'Altdorf') {
  const modal = await openCreate(page, 'Angebot')
  await modal.locator('#field-title input').fill(title)
  await setCategory(modal, 'sonstiges')
  await modal.getByRole('button', { name: /Gratis/ }).click()
  await ensureGemeinde(modal, gemeinde, true)
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
  await expect(page.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()
}

async function buyOffer(page: Page, title: string) {
  await openListingDetail(page, title)
  await page.getByRole('button', { name: /^🛒 Kaufen$/ }).click()
  const buyModal = page.locator('.animate-slide-up', { hasText: 'Kaufabsicht bestätigen' }).last()
  await expect(buyModal).toBeVisible()
  await buyModal.getByPlaceholder('z.B. Max, 079 123 45 67').fill('E2E Käufer, 079 000 00 00')
  await buyModal.getByRole('checkbox').check()
  await buyModal.getByRole('button', { name: /Kaufabsicht senden/ }).click()
  await expect(page.getByText('Kaufabsicht bestätigen')).toBeHidden()
}

// Match-Helfer (wie Block 9)
async function openGesuchDetail(page: Page, gesuchTitle: string) {
  const heading = page.getByRole('heading', { name: gesuchTitle })
  await expect(async () => {
    await page.goto('/')
    await page.getByRole('button', { name: /Gesuche/ }).click()
    await expect(heading.first()).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await heading.first().click()
  await expect(page.getByTestId('gesuch-matches')).toBeVisible()
}
async function waitForMatchCard(page: Page, gesuchTitle: string, offerTitle: string) {
  const deadline = Date.now() + 30_000
  for (;;) {
    await openGesuchDetail(page, gesuchTitle)
    const card = page.getByTestId('match-card').filter({ hasText: offerTitle })
    try {
      await expect(card.first()).toBeVisible({ timeout: 5_000 })
      return
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`Match-Karte fuer "${offerTitle}" erschien nicht innert 30s`)
      }
    }
  }
}
async function expectNotification(page: Page, textPattern: RegExp) {
  const deadline = Date.now() + 30_000
  for (;;) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Benachrichtigungen' }).click()
    try {
      await expect(page.getByText(textPattern).first()).toBeVisible({ timeout: 5_000 })
      return
    } catch {
      if (Date.now() > deadline) throw new Error(`Notification "${textPattern}" erschien nicht innert 30s`)
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────
test.describe.serial('Block 10: Smarte Formulare + Entwuerfe', () => {
  let ctxA: BrowserContext
  let ctxB: BrowserContext
  let pageA: Page
  let pageB: Page
  let AID: string

  test.beforeAll(async ({ browser }) => {
    // Preflight (Lektion 14): benoetigte Env + Testkonten pruefen.
    for (const [k, v] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: SB_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
      E2E_USER_A_EMAIL: USER_A.email,
      E2E_USER_A_PASSWORD: USER_A.password,
      E2E_USER_B_EMAIL: USER_B.email,
      E2E_USER_B_PASSWORD: USER_B.password,
    })) {
      if (!v) throw new Error(`FEHLT: ${k} — so beheben: in .env.local setzen`)
    }
    AID = await getProfileId(USER_A.email, USER_A.password)
    if (!AID) throw new Error('FEHLT: Profil-ID von USER_A — so beheben: E2E_USER_A-Login pruefen')
    // Guthaben von A garantieren (Test 4 spendet 100 Rappen und prueft exakt −1.00).
    await setCredits(AID, 1000)

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

  test('Test 1: Chamaeleon — Kategorie erkannt, Chip → smart_data-Grid', async () => {
    const modal = await openCreate(pageA, 'Angebot')
    await modal.locator('#field-title input').fill(OFFER_1)
    // Lokale Erkennung: „wollpullover" → kleider
    await expect(modal.getByText(/Erkannt: Kleider & Mode/)).toBeVisible()
    // Stufe-2-Chip antippen (Farbe „Rot")
    await modal.getByRole('button', { name: 'Rot', exact: true }).click()
    await modal.locator('input[placeholder="Preis in CHF"]').fill('20')
    await ensureGemeinde(modal, 'Altdorf', true)
    await modal.getByRole('checkbox').check()
    await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
    await expect(pageA.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()

    await openListingDetail(pageA, OFFER_1)
    await expect(pageA.getByTestId('smart-data-grid')).toBeVisible()
    await expect(pageA.getByTestId('smart-data-grid').getByText('Rot')).toBeVisible()
  })

  test('Test 2: Entwurf-Sicherheit — nur fuer Eigentuemer sichtbar (RLS)', async () => {
    const modal = await openCreate(pageA, 'Angebot')
    await modal.locator('#field-title input').fill(DRAFT_1)
    await modal.getByRole('button', { name: 'Als Entwurf speichern' }).click()
    await expect(pageA.getByText(/Als Entwurf gespeichert/)).toBeVisible()

    // A sieht den Entwurf im Entwuerfe-Tab
    await openMyListings(pageA)
    await pageA.getByRole('button', { name: /Entwürfe/ }).click()
    await expect(pageA.getByTestId('draft-row').filter({ hasText: DRAFT_1 })).toBeVisible()

    // B sieht ihn NICHT im Feed …
    await pageB.goto('/')
    await expect(pageB.getByRole('heading', { name: DRAFT_1 })).toHaveCount(0)
    // … und die Direkt-URL zeigt keinen Inhalt (RLS-Beweis).
    const draftId = await findListingIdByTitle(DRAFT_1)
    expect(draftId, 'Entwurf-ID sollte per Service-Role auffindbar sein').toBeTruthy()
    await pageB.goto(`/l/${draftId}`)
    await expect(pageB.getByText(DRAFT_1)).toHaveCount(0)
  })

  test('Test 3: Entwurf → Veroeffentlichen → Match (Lektion 1 + Function v5)', async () => {
    // B legt ein aktives Gesuch an (kleider, Budget 50, Altdorf)
    const gModal = await openCreate(pageB, 'Gesuch')
    await gModal.locator('#field-title input').fill(GESUCH_1)
    await gModal.locator('input[placeholder="z.B. 50"]').fill('50')
    await ensureGemeinde(gModal, 'Altdorf', true)
    await gModal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
    await expect(pageB.getByText('Gesuch erstellt! Wir suchen passende Angebote. 🎯')).toBeVisible()

    // A legt einen passenden Entwurf an (kleider durch Titel-Erkennung) …
    const modal = await openCreate(pageA, 'Angebot')
    await modal.locator('#field-title input').fill(OFFER_DRAFT)
    await expect(modal.getByText(/Erkannt: Kleider & Mode/)).toBeVisible()
    await modal.locator('input[placeholder="Preis in CHF"]').fill('20')
    await ensureGemeinde(modal, 'Altdorf', true)
    await modal.getByRole('button', { name: 'Als Entwurf speichern' }).click()
    await expect(pageA.getByText(/Als Entwurf gespeichert/)).toBeVisible()

    // … und veroeffentlicht ihn aus dem Entwuerfe-Tab (neuer Codepfad → Matches).
    await openMyListings(pageA)
    await pageA.getByRole('button', { name: /Entwürfe/ }).click()
    const row = pageA.getByTestId('draft-row').filter({ hasText: OFFER_DRAFT })
    await row.getByTestId('draft-publish-btn').click()
    await expect(pageA.getByText('Entwurf veröffentlicht! 🎉')).toBeVisible()

    // B erhaelt match-Notification + Match-Karte auf dem Gesuch-Detail
    await expectNotification(pageB, /Perfekter Match gefunden|Das könnte dir gefallen/)
    await waitForMatchCard(pageB, GESUCH_1, OFFER_DRAFT)
  })

  test('Test 4: Gratis + Kaffee im Deal-Flow (Nein-danke vs. CHF 1)', async () => {
    // Veroeffentlichen eines Gratis-Inserats zeigt KEIN Kaffee-Modal.
    await createFreeAngebot(pageA, FREE_1)
    await expect(pageA.getByTestId('coffee-modal')).toHaveCount(0)

    // B kauft, A nimmt an → Kaffee-Modal → „Nein danke" → Guthaben unveraendert.
    await buyOffer(pageB, FREE_1)
    const before1 = await readCredits(AID)
    await openSales(pageA)
    await saleCardByTitle(pageA, FREE_1).getByRole('button', { name: 'Bestätigen' }).click()
    await expect(pageA.getByTestId('coffee-modal')).toBeVisible()
    await pageA.getByTestId('coffee-no-thanks').click()
    await expect(pageA.getByTestId('coffee-modal')).toHaveCount(0)
    expect(await readCredits(AID)).toBe(before1)

    // Zweiter Durchlauf: CHF 1 spenden → Guthaben exakt −100 Rappen.
    await createFreeAngebot(pageA, FREE_2)
    await buyOffer(pageB, FREE_2)
    const before2 = await readCredits(AID)
    await openSales(pageA)
    await saleCardByTitle(pageA, FREE_2).getByRole('button', { name: 'Bestätigen' }).click()
    await expect(pageA.getByTestId('coffee-modal')).toBeVisible()
    await pageA.getByTestId('coffee-donate-1').click()
    await expect(pageA.getByTestId('coffee-modal')).toHaveCount(0)
    expect(await readCredits(AID)).toBe(before2 - 100)
  })

  test('Test 5: Mehrere Gemeinden — beide auf dem Detail sichtbar', async () => {
    const modal = await openCreate(pageA, 'Angebot')
    await modal.locator('#field-title input').fill(MULTI_1)
    await setCategory(modal, 'moebel')
    await modal.locator('input[placeholder="Preis in CHF"]').fill('30')
    await ensureGemeinde(modal, 'Altdorf', true)
    await ensureGemeinde(modal, 'Flüelen', true)
    await modal.getByRole('checkbox').check()
    await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
    await expect(pageA.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()

    await openListingDetail(pageA, MULTI_1)
    await expect(pageA.getByTestId('detail-gemeinde').filter({ hasText: 'Altdorf' })).toBeVisible()
    await expect(pageA.getByTestId('detail-gemeinde').filter({ hasText: 'Flüelen' })).toBeVisible()
  })
})
