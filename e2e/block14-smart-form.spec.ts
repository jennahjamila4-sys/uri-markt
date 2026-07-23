import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test'
import { readFileSync } from 'node:fs'

// ─── Env aus .env.local laden ────────────────────────────────────────────────
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
const USER_A = { email: ENV.E2E_USER_A_EMAIL, password: ENV.E2E_USER_A_PASSWORD } // Verkaeufer
const USER_B = { email: ENV.E2E_USER_B_EMAIL, password: ENV.E2E_USER_B_PASSWORD } // Kaeufer

const RUN = Date.now()
const P = 'E2E-B14'
const T_SHOE = `${P} Kinderschuhe ${RUN}`
const T_DEFEKT = `${P} Defekt Geraet ${RUN}`
const T_SMART = `${P} Smart Default ${RUN}`
const T_INVALID = `${P} Sofa Invalid ${RUN}`
const T_AUTOSAVE = `${P} Wollpullover Autosave ${RUN}`
const T_ON = `${P} AutoRelease AN ${RUN}`
const T_OFF = `${P} AutoRelease AUS ${RUN}`
const T_LEGACY = `${P} Legacy Good ${RUN}`

// ─── Service-Role-REST ───────────────────────────────────────────────────────
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
async function restRpc(name: string, body: Record<string, unknown> = {}) {
  const r = await rest(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`RPC ${name} fehlgeschlagen: ${r.status} ${await r.text()}`)
  return r.json().catch(() => ({}))
}
async function getAccessToken(email: string, password: string): Promise<string> {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return (await r.json()).access_token
}
async function getProfileId(email: string, password: string): Promise<string> {
  const token = await getAccessToken(email, password)
  const ur = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  })
  return (await ur.json()).id as string
}
async function findListingIdByTitle(title: string): Promise<string> {
  const r = await rest(`listings?title=eq.${encodeURIComponent(title)}&select=id`)
  const rows: { id: string }[] = r.ok ? await r.json() : []
  if (!rows[0]) throw new Error(`Listing "${title}" nicht gefunden`)
  return rows[0].id
}
async function readListing(id: string, cols: string): Promise<Record<string, unknown>> {
  const r = await rest(`listings?id=eq.${id}&select=${cols}`)
  const rows: Record<string, unknown>[] = r.ok ? await r.json() : []
  return rows[0] ?? {}
}
async function cleanupE2EData() {
  const res = await rest(`listings?title=like.${P}%25&select=id`)
  const rows: { id: string }[] = res.ok ? await res.json() : []
  if (rows.length > 0) {
    const ids = `(${rows.map((r) => r.id).join(',')})`
    await rest(`smart_matches?or=(gesuch_id.in.${ids},matched_listing_id.in.${ids})`, { method: 'DELETE' })
    await rest(`notifications?listing_id=in.${ids}`, { method: 'DELETE' })
    await rest(`transactions?listing_id=in.${ids}`, { method: 'DELETE' })
    await rest(`listings?title=like.${P}%25`, { method: 'DELETE' })
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
async function openCreate(page: Page): Promise<Locator> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Inserat erstellen' }).click()
  const modal = page.locator('.animate-slide-up')
  await modal.getByRole('button', { name: /Angebot$/ }).click()
  return modal
}
async function setCategory(modal: Locator, value: string) {
  const change = modal.getByText('ändern')
  if (await change.count()) await change.first().click()
  await modal.locator('#field-category select').selectOption(value)
}
async function ensureGemeinde(modal: Locator, name: string, want = true) {
  const chip = modal.locator('#field-gemeinde').getByRole('button', { name, exact: true })
  const cls = (await chip.getAttribute('class')) ?? ''
  const active = cls.includes('bg-gold')
  if (active !== want) await chip.click()
}
async function gotoPriceCard(modal: Locator) {
  const priceField = modal.locator('#field-price')
  for (let i = 0; i < 4; i++) {
    if (await priceField.isVisible().catch(() => false)) return
    await modal.getByTestId('cardflow-next').click()
  }
}
async function confirmPublish(page: Page, modal: Locator, opts: { autoRelease?: boolean } = {}) {
  await modal.getByTestId('cardflow-next').click() // Preis → Zusammenfassung
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
  const m = modal.getByTestId('publish-48h-modal')
  await expect(m).toBeVisible()
  if (opts.autoRelease === false) {
    await m.getByTestId('auto-release-toggle').click()
  }
  await m.getByRole('button', { name: /Alles klar/ }).click()
  await expect(page.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()
}
async function openListingDetail(page: Page, title: string) {
  await page.goto('/')
  const heading = page.getByRole('heading', { name: title })
  await expect(heading.first()).toBeVisible({ timeout: 10_000 })
  await heading.first().click()
}
async function buyOffer(page: Page, title: string) {
  await openListingDetail(page, title)
  await page.getByRole('button', { name: /^🛒 Kaufen$/ }).click()
  const buyModal = page.locator('.animate-slide-up', { hasText: 'Kaufabsicht bestätigen' }).last()
  await expect(buyModal).toBeVisible()
  const contactField = buyModal.getByPlaceholder('z.B. Max, 079 123 45 67')
  if (!(await contactField.inputValue())) await contactField.fill('E2E Käufer, 079 000 00 00')
  await buyModal.getByTestId('agree-intent').check()
  await buyModal.getByRole('button', { name: /Kaufabsicht senden/ }).click()
  await expect(page.getByText('Kaufabsicht bestätigen')).toBeHidden()
}

/** KI-Endpoint mit einem kontrollierten Ergebnis (oder null) belegen. */
async function routeAi(page: Page, result: unknown) {
  await page.unroute('**/api/analyze-listing')
  await page.route('**/api/analyze-listing', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result }) })
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────
test.describe.serial('Block 14: Smart Form 2.0', () => {
  let ctxA: BrowserContext
  let ctxB: BrowserContext
  let pageA: Page
  let pageB: Page
  let AID: string

  test.beforeAll(async ({ browser }) => {
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
    if (!AID) throw new Error('FEHLT: Profil-ID USER_A — E2E_USER_A-Login pruefen')

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

  test('T1: KI-Felder — Zahlen-Skala 18–48 statt Kleidergroesse (deterministisch)', async () => {
    await routeAi(pageA, {
      feed_kategorie: 'kleider',
      artikel_typ: 'Kinderschuhe',
      titel_vorschlag: T_SHOE,
      beschreibung_vorschlag: 'Getragene Kinderschuhe.',
      felder: [{ key: 'g-groesse', label: 'Grösse', typ: 'zahlen_skala', min: 18, max: 48, schritt: 1 }],
      zustand_optionen: ['sehr_gut', 'gut', 'gebrauchsspuren'],
      zustand_vorschlag: null,
      gereinigt_sinnvoll: true,
    })
    const modal = await openCreate(pageA)
    await modal.locator('#field-title input').fill(T_SHOE)
    // KI-Banner erscheint (Erkennung) …
    await expect(modal.getByTestId('ai-banner')).toBeVisible({ timeout: 10_000 })
    await modal.getByTestId('cardflow-next').click() // → Details
    // Zahlen-Band ist da, KEIN „XL"-Chip (das Kleider-Fallback-Feld darf nicht rendern).
    await expect(modal.getByTestId('ai-scale-g-groesse')).toBeVisible()
    await expect(modal.getByText('XL', { exact: true })).toHaveCount(0)
    await modal.getByTestId('ai-scale-g-groesse').getByRole('button', { name: '38', exact: true }).click()
    await gotoPriceCard(modal)
    await modal.locator('input[placeholder="Preis in CHF"]').fill('20')
    await ensureGemeinde(modal, 'Altdorf', true)
    await confirmPublish(pageA, modal)

    await openListingDetail(pageA, T_SHOE)
    const grid = pageA.getByTestId('smart-data-grid')
    await expect(grid).toBeVisible()
    await expect(grid.getByText('38')).toBeVisible()
  })

  test('T2: Zustand „Defekt" verlangt Pflicht-Beschreibung (sichtbarer Fehler)', async () => {
    await routeAi(pageA, null) // Fallback-Pfad (lokale Anwendbarkeit)
    const modal = await openCreate(pageA)
    await modal.locator('#field-title input').fill(T_DEFEKT)
    await setCategory(modal, 'elektronik') // elektronik erlaubt „defekt"
    await modal.getByTestId('cardflow-next').click() // → Details
    await modal.getByTestId('cardflow-next').click() // → Zustand
    await modal.getByTestId('condition-defekt').click()
    // Ohne Text: Weiter blockiert mit sichtbarem Fehler (Lektion 6).
    await modal.getByTestId('cardflow-next').click()
    await expect(modal.getByTestId('condition-detail-error')).toBeVisible()
    await modal.getByTestId('condition-detail').fill('Akku defekt, laedt nicht mehr')
    await gotoPriceCard(modal)
    await modal.locator('input[placeholder="Preis in CHF"]').fill('10')
    await ensureGemeinde(modal, 'Altdorf', true)
    await confirmPublish(pageA, modal)

    await openListingDetail(pageA, T_DEFEKT)
    await expect(pageA.getByTestId('detail-condition')).toContainText('Defekt / Bastlerartikel')
  })

  test('T3: Smart Default — Vorschlag vorgewaehlt, ein Tap bestaetigt', async () => {
    await routeAi(pageA, {
      feed_kategorie: 'kleider',
      artikel_typ: 'Jacke',
      titel_vorschlag: T_SMART,
      beschreibung_vorschlag: 'Kaum getragen.',
      felder: [],
      zustand_optionen: ['sehr_gut', 'gut', 'gebrauchsspuren'],
      zustand_vorschlag: 'sehr_gut',
      gereinigt_sinnvoll: true,
    })
    const modal = await openCreate(pageA)
    await modal.locator('#field-title input').fill(T_SMART)
    await expect(modal.getByTestId('ai-banner')).toBeVisible({ timeout: 10_000 })
    await modal.getByTestId('cardflow-next').click() // → Details
    await modal.getByTestId('cardflow-next').click() // → Zustand
    // Vorschlag „sehr_gut" ist vorgewaehlt (aktiv markiert) …
    await expect(modal.getByTestId('condition-sehr_gut')).toHaveClass(/bg-gold/)
    await modal.getByTestId('condition-sehr_gut').click() // … ein Tap bestaetigt
    await gotoPriceCard(modal)
    await modal.locator('input[placeholder="Preis in CHF"]').fill('40')
    await ensureGemeinde(modal, 'Altdorf', true)
    await confirmPublish(pageA, modal)

    await openListingDetail(pageA, T_SMART)
    await expect(pageA.getByTestId('detail-condition')).toContainText('sehr guter Zustand')
  })

  test('T4: Ungueltige KI-Antwort wird verworfen → Fallback, kein Crash', async () => {
    await routeAi(pageA, {
      feed_kategorie: 'gibt_es_nicht',
      artikel_typ: 'X',
      titel_vorschlag: T_INVALID,
      beschreibung_vorschlag: '',
      felder: [{ key: 'x', label: 'X', typ: 'unbekannt' }],
      zustand_optionen: ['sehr_gut'],
      zustand_vorschlag: null,
      gereinigt_sinnvoll: false,
    })
    const modal = await openCreate(pageA)
    await modal.locator('#field-title input').fill(T_INVALID)
    await setCategory(modal, 'moebel')
    // Ungueltige Antwort → kein KI-Banner (client-seitig verworfen).
    await expect(modal.getByTestId('ai-banner')).toHaveCount(0)
    await gotoPriceCard(modal)
    await modal.locator('input[placeholder="Preis in CHF"]').fill('15')
    await ensureGemeinde(modal, 'Altdorf', true)
    await confirmPublish(pageA, modal)
    // Kein Crash: Inserat existiert.
    await openListingDetail(pageA, T_INVALID)
    await expect(pageA.getByRole('heading', { name: T_INVALID })).toBeVisible()
  })

  test('T5: Autosave — nach hartem Reload Recovery-Banner → alles wieder da', async () => {
    await routeAi(pageA, null)
    const modal = await openCreate(pageA)
    await modal.locator('#field-title input').fill(T_AUTOSAVE) // „Wollpullover" → kleider
    await expect(modal.getByText(/Erkannt: Kleider & Mode/)).toBeVisible()
    await modal.getByTestId('cardflow-next').click() // → Details
    await modal.getByRole('button', { name: 'Rot', exact: true }).click()
    // kurz warten, damit der Autosave-Effekt in localStorage schreibt
    await pageA.waitForTimeout(300)

    await pageA.reload()
    await pageA.getByRole('button', { name: 'Inserat erstellen' }).click()
    const modal2 = pageA.locator('.animate-slide-up')
    await modal2.getByRole('button', { name: /Angebot$/ }).click()
    await expect(modal2.getByTestId('draft-recovery')).toBeVisible()
    await modal2.getByRole('button', { name: 'Weitermachen' }).click()
    // Titel wieder da …
    await expect(modal2.locator('#field-title input')).toHaveValue(T_AUTOSAVE)
    // … und der Chip auf Card 2 ebenfalls (aktiv markiert).
    await modal2.getByTestId('cardflow-next').click()
    await expect(modal2.getByRole('button', { name: 'Rot', exact: true })).toHaveClass(/bg-gold/)
  })

  test('T6a: 48h-Automatik AN → Kaufanfrage setzt Countdown', async () => {
    await routeAi(pageA, null)
    const modal = await openCreate(pageA)
    await modal.locator('#field-title input').fill(T_ON)
    await setCategory(modal, 'sonstiges')
    await gotoPriceCard(modal)
    await modal.locator('input[placeholder="Preis in CHF"]').fill('20')
    await ensureGemeinde(modal, 'Altdorf', true)
    await confirmPublish(pageA, modal, { autoRelease: true })

    await buyOffer(pageB, T_ON)
    const lid = await findListingIdByTitle(T_ON)
    const l = await readListing(lid, 'status,reserved_until,auto_release')
    expect(l.status).toBe('reserved')
    expect(l.auto_release).toBe(true)
    expect(l.reserved_until).toBeTruthy()

    // Feed-Karte zeigt Countdown mit „Std.".
    await pageB.goto('/')
    const card = pageB.getByTestId('listing-card').filter({ hasText: T_ON })
    await expect(card.getByTestId('reserved-badge')).toContainText(/Std\./, { timeout: 20_000 })
  })

  test('T6b: 48h-Automatik AUS → reserved ohne Countdown, expire laesst es reserved', async () => {
    await routeAi(pageA, null)
    const modal = await openCreate(pageA)
    await modal.locator('#field-title input').fill(T_OFF)
    await setCategory(modal, 'sonstiges')
    await gotoPriceCard(modal)
    await modal.locator('input[placeholder="Preis in CHF"]').fill('20')
    await ensureGemeinde(modal, 'Altdorf', true)
    await confirmPublish(pageA, modal, { autoRelease: false })

    await buyOffer(pageB, T_OFF)
    const lid = await findListingIdByTitle(T_OFF)
    const l = await readListing(lid, 'status,reserved_until,auto_release')
    expect(l.status).toBe('reserved')
    expect(l.auto_release).toBe(false)
    expect(l.reserved_until).toBeNull()

    // Karte: „Reserviert" OHNE Countdown (kein „Std.").
    await pageB.goto('/')
    const badge = pageB.getByTestId('listing-card').filter({ hasText: T_OFF }).getByTestId('reserved-badge')
    await expect(badge).toBeVisible({ timeout: 20_000 })
    await expect(badge).not.toContainText('Std.')

    // expire_stale_reservations ueberspringt auto_release=false → bleibt reserved.
    await restRpc('expire_stale_reservations')
    const after = await readListing(lid, 'status')
    expect(after.status).toBe('reserved')
  })

  test('T7: Regression — Altwert condition=good zeigt „Guter Zustand"', async () => {
    const insert = await rest('listings', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: AID,
        title: T_LEGACY,
        type: 'Angebot',
        status: 'active',
        category: 'moebel',
        gemeinde: 'Altdorf',
        gemeinden: ['Altdorf'],
        price_type: 'fixed',
        price: 10,
        condition: 'good',
      }),
    })
    if (!insert.ok) throw new Error(`Seed fehlgeschlagen: ${insert.status} ${await insert.text()}`)

    await openListingDetail(pageA, T_LEGACY)
    await expect(pageA.getByTestId('detail-condition')).toContainText('Guter Zustand')
  })
})
