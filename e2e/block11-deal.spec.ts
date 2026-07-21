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
const USER_A = { email: ENV.E2E_USER_A_EMAIL, password: ENV.E2E_USER_A_PASSWORD } // Verkaeufer
const USER_B = { email: ENV.E2E_USER_B_EMAIL, password: ENV.E2E_USER_B_PASSWORD } // Kaeufer

const RUN = Date.now()
const P = `E2E-B11`
const OFFER_PREFILL = `${P} Prefill Offer ${RUN}`
const OFFER_CD = `${P} Countdown Offer ${RUN}`
const OFFER_RELIST = `${P} Relist Offer ${RUN}`
const OFFER_WARN = `${P} Warn Offer ${RUN}`
const OFFER_PHOTO = `${P} Photo Offer ${RUN}`
const OFFER_REJECT = `${P} Reject Offer ${RUN}`
const DRAFT_1 = `${P} Entwurf ${RUN}`

// 1x1-PNG (gueltig) als Upload-Fixture fuer Test 6.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

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
/** SECURITY-DEFINER-RPC als service_role aufrufen (Client darf sie nicht). */
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
async function findListingIdByTitle(title: string): Promise<string> {
  const r = await rest(`listings?title=eq.${encodeURIComponent(title)}&select=id`)
  const rows: { id: string }[] = r.ok ? await r.json() : []
  if (!rows[0]) throw new Error(`Listing "${title}" nicht gefunden`)
  return rows[0].id
}
async function readListing(id: string, cols: string) {
  const r = await rest(`listings?id=eq.${id}&select=${cols}`)
  const rows: Record<string, unknown>[] = r.ok ? await r.json() : []
  return rows[0] ?? {}
}
async function pendingTxByListing(listingId: string): Promise<string> {
  const r = await rest(
    `transactions?listing_id=eq.${listingId}&status=eq.pending&select=id&order=created_at.desc`
  )
  const rows: { id: string }[] = r.ok ? await r.json() : []
  if (!rows[0]) throw new Error(`Keine pending-Transaktion fuer Listing ${listingId}`)
  return rows[0].id
}
async function backdateTx(txId: string, iso: string) {
  const r = await rest(`transactions?id=eq.${txId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ created_at: iso }),
  })
  if (!r.ok) throw new Error(`backdateTx fehlgeschlagen: ${r.status} ${await r.text()}`)
}
async function upsertPrivate(id: string, patch: Record<string, unknown>) {
  const r = await rest('profiles_private', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, ...patch }),
  })
  if (!r.ok) throw new Error(`upsertPrivate fehlgeschlagen: ${r.status} ${await r.text()}`)
}
async function readPrivatePhone(id: string): Promise<string | null> {
  const r = await rest(`profiles_private?id=eq.${id}&select=phone`)
  const rows: { phone: string | null }[] = r.ok ? await r.json() : []
  return rows[0]?.phone ?? null
}
async function countNotifications(recipientId: string, type: string, listingId: string): Promise<number> {
  const r = await rest(
    `notifications?recipient_id=eq.${recipientId}&type=eq.${type}&listing_id=eq.${listingId}&select=id`
  )
  const rows: unknown[] = r.ok ? await r.json() : []
  return rows.length
}

/** Alle E2E-B11-Daten restlos entfernen (vor UND nach dem Lauf). */
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

async function openCreate(page: Page, tab: 'Angebot' | 'Gesuch'): Promise<Locator> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Inserat erstellen' }).click()
  const modal = page.locator('.animate-slide-up')
  await modal.getByRole('button', { name: new RegExp(`${tab}$`) }).click()
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

async function createAngebot(page: Page, title: string, price = '20', gemeinde = 'Altdorf') {
  const modal = await openCreate(page, 'Angebot')
  await modal.locator('#field-title input').fill(title)
  await setCategory(modal, 'sonstiges')
  await modal.locator('input[placeholder="Preis in CHF"]').fill(price)
  await ensureGemeinde(modal, gemeinde, true)
  await modal.getByRole('checkbox').check() // Rechts-Bestaetigung (einzige Checkbox im Create-Modal)
  await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
  await expect(page.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()
}

async function openListingDetail(page: Page, title: string) {
  await page.goto('/')
  const heading = page.getByRole('heading', { name: title })
  await expect(heading.first()).toBeVisible({ timeout: 10_000 })
  await heading.first().click()
}

/** Kaufanfrage stellen. `expectPrefill` prueft das vorbefuellte Kontaktfeld;
 *  `contact` ueberschreibt es; `remember` setzt „💾 merken". */
async function buyOffer(
  page: Page,
  title: string,
  opts: { expectPrefill?: string; contact?: string; remember?: boolean } = {}
) {
  await openListingDetail(page, title)
  await page.getByRole('button', { name: /^🛒 Kaufen$/ }).click()
  const buyModal = page.locator('.animate-slide-up', { hasText: 'Kaufabsicht bestätigen' }).last()
  await expect(buyModal).toBeVisible()
  const contactField = buyModal.getByPlaceholder('z.B. Max, 079 123 45 67')
  if (opts.expectPrefill !== undefined) {
    await expect(contactField).toHaveValue(opts.expectPrefill)
  }
  if (opts.contact !== undefined) {
    await contactField.fill(opts.contact)
  } else if (!(await contactField.inputValue())) {
    await contactField.fill('E2E Käufer, 079 000 00 00')
  }
  if (opts.remember) await buyModal.getByTestId('remember-contact').check()
  await buyModal.getByTestId('agree-intent').check()
  await buyModal.getByRole('button', { name: /Kaufabsicht senden/ }).click()
  await expect(page.getByText('Kaufabsicht bestätigen')).toBeHidden()
}

async function openSales(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: /Meine Verkäufe/ }).click()
}
const saleCardByTitle = (page: Page, title: string): Locator =>
  page.locator('.rounded-2xl').filter({ hasText: title })

/** Glocke oeffnen und auf einen Notification-Text warten (mit Reload-Retry). */
async function expectNotificationText(page: Page, textPattern: RegExp) {
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
test.describe.serial('Block 11: Reibungsloser Deal', () => {
  let ctxA: BrowserContext
  let ctxB: BrowserContext
  let pageA: Page
  let pageB: Page
  let AID: string
  let BID: string

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
    BID = await getProfileId(USER_B.email, USER_B.password)
    if (!AID || !BID) throw new Error('FEHLT: Profil-ID(s) — so beheben: E2E_USER-Logins pruefen')

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

  test('Test 1: Prefill — Kaufformular vorbefuellt + „merken" schreibt zurueck', async () => {
    // B hinterlegt Telefon in profiles_private (Service-Role-Seed).
    await upsertPrivate(BID, { phone: '079 111 11 11' })
    await createAngebot(pageA, OFFER_PREFILL)

    // Feld ist vorbefuellt; B aendert den Wert + „merken".
    await buyOffer(pageB, OFFER_PREFILL, {
      expectPrefill: '079 111 11 11',
      contact: '079 222 22 22',
      remember: true,
    })

    // profiles_private ist aktualisiert.
    await expect(async () => {
      expect(await readPrivatePhone(BID)).toBe('079 222 22 22')
    }).toPass({ timeout: 10_000 })
  })

  test('Test 2: Zahlungen — Test-IBAN gueltig, Fantasie-IBAN blockiert sichtbar', async () => {
    await pageA.goto('/profile')
    await pageA.getByRole('button', { name: /Zahlungen/ }).click()
    const iban = pageA.getByPlaceholder('CH.. .... .... .... ....')

    // Gueltige Schweizer Test-IBAN wird akzeptiert und gespeichert.
    await iban.fill('CH9300762011623852957')
    await pageA.getByRole('button', { name: /Speichern/ }).click()
    await expect(pageA.getByText('Zahlungs-Infos gespeichert! 💪')).toBeVisible()

    // Fantasie-IBAN: exakte Fehlermeldung, Speichern blockiert (Lektion 6).
    await iban.fill('CH00INVALID')
    await iban.blur()
    await expect(
      pageA.getByText('Bitte eine Schweizer IBAN: beginnt mit CH und hat 21 Zeichen (CH + 19).')
    ).toBeVisible()
    await pageA.getByRole('button', { name: /Speichern/ }).click()
    await expect(pageA.getByText('Bitte kurz die markierten Felder prüfen 👀')).toBeVisible()
    await expect(pageA.getByText('Zahlungs-Infos gespeichert! 💪')).toHaveCount(0)
  })

  test('Test 3: Countdown im Feed — anon sieht „Reserviert — noch 48 Std."', async ({ browser }) => {
    await createAngebot(pageA, OFFER_CD)
    await buyOffer(pageB, OFFER_CD) // reserviert (reserved_until = now+48h)

    // Ausgeloggter (anon) Kontext: reserved_until ist oeffentlich lesbar.
    const anonCtx = await browser.newContext()
    await anonCtx.addInitScript(skipOnboarding)
    const anon = await anonCtx.newPage()
    await anon.goto('/')
    const card = anon.getByTestId('listing-card').filter({ hasText: OFFER_CD })
    await expect(card.getByTestId('reserved-badge')).toHaveText(/noch (47|48) Std\./, {
      timeout: 20_000,
    })
    await anonCtx.close()
  })

  test('Test 4: Wieder erhaeltlich — Expiry reaktiviert + Sticker + kaufbar', async () => {
    await createAngebot(pageA, OFFER_RELIST)
    await buyOffer(pageB, OFFER_RELIST)
    const lid = await findListingIdByTitle(OFFER_RELIST)
    const tx = await pendingTxByListing(lid)

    // Auf 49h Alter zuruecksetzen und Expiry-RPC (service_role) ausloesen.
    await backdateTx(tx, new Date(Date.now() - 49 * 3600 * 1000).toISOString())
    await restRpc('expire_stale_reservations')

    const l = await readListing(lid, 'status,reserved_until,relisted_at')
    expect(l.status).toBe('active')
    expect(l.reserved_until).toBeNull()
    expect(l.relisted_at).toBeTruthy()

    // Karte (B = Nicht-Eigentuemer) zeigt „🔄 Wieder erhaeltlich!"; Detail kaufbar.
    // Der Sticker haengt am reaktivierten relisted_at und wird erst nach dem
    // Client-Mount (useMinuteTick) sichtbar; gegen einen transienten Feed-/
    // Realtime-Zustand mit Reload-Retry absichern (Muster wie expectNotificationText).
    // Assertion unveraendert — der Sticker MUSS erscheinen.
    const relistDeadline = Date.now() + 30_000
    for (;;) {
      await pageB.goto('/')
      const card = pageB.getByTestId('listing-card').filter({ hasText: OFFER_RELIST })
      try {
        await expect(card.getByTestId('relisted-badge')).toBeVisible({ timeout: 8_000 })
        break
      } catch {
        if (Date.now() > relistDeadline)
          throw new Error('relisted-badge erschien nicht innert 30s')
      }
    }
    await openListingDetail(pageB, OFFER_RELIST)
    await expect(pageB.getByRole('button', { name: /^🛒 Kaufen$/ })).toBeVisible()
  })

  test('Test 5: Vorwarnung — tx_expiring an Verkaeufer, Glocke verlinkt, idempotent', async () => {
    await createAngebot(pageA, OFFER_WARN)
    await buyOffer(pageB, OFFER_WARN)
    const lid = await findListingIdByTitle(OFFER_WARN)
    const tx = await pendingTxByListing(lid)

    // In das Vorwarn-Fenster (42–48h) ruecken und Warn-RPC ausloesen.
    await backdateTx(tx, new Date(Date.now() - 43 * 3600 * 1000).toISOString())
    await restRpc('warn_expiring_reservations')

    expect(await countNotifications(AID, 'tx_expiring', lid)).toBe(1)

    // Glocke: A sieht die Vorwarnung und der Klick verlinkt aufs Inserat.
    await expectNotificationText(pageA, /Nur noch 6 Stunden/)
    await pageA.getByRole('button').filter({ hasText: 'Nur noch 6 Stunden' }).first().click()
    await expect(pageA.getByRole('heading', { name: OFFER_WARN })).toBeVisible()

    // Idempotenz: zweiter Aufruf erzeugt KEINE zweite Notification.
    await restRpc('warn_expiring_reservations')
    expect(await countNotifications(AID, 'tx_expiring', lid)).toBe(1)
  })

  test('Test 6: Foto-Upload — Bild landet auf dem Detail', async () => {
    const modal = await openCreate(pageA, 'Angebot')
    await modal.locator('#field-title input').fill(OFFER_PHOTO)
    await setCategory(modal, 'sonstiges')
    await modal.locator('input[placeholder="Preis in CHF"]').fill('25')
    await ensureGemeinde(modal, 'Altdorf', true)
    await modal.getByRole('button', { name: /Mehr Details/ }).click()
    await modal.locator('input[type="file"]').setInputFiles({
      name: 'e2e.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })
    await expect(pageA.getByText('Bild hochgeladen')).toBeVisible({ timeout: 20_000 })
    await modal.getByRole('checkbox').check()
    await modal.getByRole('button', { name: 'Veröffentlichen', exact: true }).click()
    await expect(pageA.getByText('Inserat erfolgreich erstellt! 🎉')).toBeVisible()

    await openListingDetail(pageA, OFFER_PHOTO)
    await expect(pageA.locator('.snap-center img').first()).toBeVisible()
  })

  test('Test 7: Entwuerfe-Schnellzugriff — ein Klick direkt in den Entwuerfe-Tab', async () => {
    const modal = await openCreate(pageA, 'Angebot')
    await modal.locator('#field-title input').fill(DRAFT_1)
    await modal.getByRole('button', { name: 'Als Entwurf speichern' }).click()
    await expect(pageA.getByText(/Als Entwurf gespeichert/)).toBeVisible()

    await pageA.goto('/profile')
    const btn = pageA.getByTestId('drafts-quick-btn')
    await expect(btn).toBeVisible()
    await expect(btn).toContainText(/📝 Entwürfe \(\d+\)/)
    await btn.click()
    // draft-row wird nur im Entwuerfe-Tab gerendert → Sichtbarkeit beweist Tab-Vorwahl.
    await expect(pageA.getByTestId('draft-row').filter({ hasText: DRAFT_1 })).toBeVisible()
  })

  test('Test 8: Ablehnen — Inserat wieder aktiv, Sticker, Kaeufer bekommt tx_rejected', async () => {
    await createAngebot(pageA, OFFER_REJECT)
    await buyOffer(pageB, OFFER_REJECT)
    const lid = await findListingIdByTitle(OFFER_REJECT)

    // A lehnt die Anfrage ab (RPC reject_buy_intent).
    await openSales(pageA)
    await saleCardByTitle(pageA, OFFER_REJECT).getByRole('button', { name: /Ablehnen/ }).click()
    await expect(pageA.getByText('Anfrage abgelehnt')).toBeVisible()

    // Inserat wieder aktiv + „Wieder erhaeltlich"-Marker.
    const l = await readListing(lid, 'status,reserved_until,relisted_at')
    expect(l.status).toBe('active')
    expect(l.reserved_until).toBeNull()
    expect(l.relisted_at).toBeTruthy()

    // Kaeufer B: tx_rejected-Notification, Glocke verlinkt aufs Inserat.
    expect(await countNotifications(BID, 'tx_rejected', lid)).toBe(1)
    await expectNotificationText(pageB, /Kaufanfrage nicht angenommen/)
    await pageB.getByRole('button').filter({ hasText: 'Kaufanfrage nicht angenommen' }).first().click()
    await expect(pageB.getByRole('heading', { name: OFFER_REJECT })).toBeVisible()

    // Karte zeigt „🔄 Wieder erhaeltlich!".
    await pageB.goto('/')
    const card = pageB.getByTestId('listing-card').filter({ hasText: OFFER_REJECT })
    await expect(card.getByTestId('relisted-badge')).toBeVisible({ timeout: 20_000 })
  })
})
