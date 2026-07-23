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
const SERVICE = ENV.SUPABASE_SERVICE_ROLE_KEY

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

// Bei Signup legt der DB-Trigger sofort ein profiles-Row an (auch vor
// E-Mail-Bestaetigung). Aufraeumen: Profil per Username finden, zugehoerigen
// Auth-User via Admin-API loeschen.
async function deleteUserByUsername(username: string) {
  const r = await rest(`profiles?username=eq.${username}&select=id`)
  const rows = await r.json().catch(() => [])
  const id = Array.isArray(rows) && rows[0]?.id
  if (id) {
    await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: svcHeaders,
    }).catch(() => {})
    await rest(`profiles?id=eq.${id}`, { method: 'DELETE' }).catch(() => {})
  }
}

const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

const TS = Date.now()
const NEW_USERNAME = `e2eb7_${TS}`
const NEW_EMAIL = `e2e-b7-${TS}@example.com`
const NEW_PASSWORD = 'Test1234!'

test.afterAll(async () => {
  await deleteUserByUsername(NEW_USERNAME)
})

// ============================================================================
// Onboarding-Startguthaben (ohne Skip -> neues 2-Screen-Onboarding durchklicken)
// Block 12: Das alte 5-Screen-Onboarding (Jetzt starten/Weiter/Später + der
// Confetti-Screen mit „Uri-Taler Guthaben") existiert nicht mehr. Das
// Startguthaben (5 Uri-Taler, faktisch = handle_new_user 500 Rappen) steht jetzt
// als Geschenk-Teaser auf Screen 2. Die Pruefung „5 Taler, nicht 100" bleibt.
// ============================================================================
test('Onboarding-Startguthaben zeigt 5 Taler (nicht 100)', async ({ page }) => {
  await page.goto('/')

  // Screen 1 (Hook + Persona-Karten) -> Karte antippen -> Screen 2 (Smart-Match-
  // Story + Geschenk-Teaser).
  await expect(page.getByText('Gold wert')).toBeVisible()
  await page.getByTestId('onboarding-persona-verkaufen').click()

  // Screen 2: Der Geschenk-Teaser MUSS das Startguthaben mit 5 Uri-Taler zeigen.
  await expect(page.getByTestId('onboarding-herzstueck')).toBeVisible()
  const gift = page.getByTestId('onboarding-gift')
  await expect(gift).toBeVisible()
  await expect(gift).toContainText('5 Uri-Taler')
  // Regressionsschutz: frueher faelschlich 100 — darf als Startguthaben nirgends
  // im Geschenk-Teaser auftauchen.
  await expect(gift).not.toContainText('100')
  await expect(page.getByTestId('onboarding-cta-start')).toBeVisible()
})

// ============================================================================
// Rechtsseiten + Footer + Signup (mit uebersprungenem Onboarding)
// ============================================================================
test.describe('mit uebersprungenem Onboarding', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.addInitScript(skipOnboarding)
  })

  const PAGES: { path: string; heading: RegExp }[] = [
    { path: '/impressum', heading: /Impressum/ },
    { path: '/datenschutz', heading: /Datenschutzerklärung/ },
    { path: '/agb', heading: /Allgemeine Geschäftsbedingungen/ },
  ]

  for (const p of PAGES) {
    test(`Rechtsseite ${p.path} liefert 200 und zeigt Inhalt + Footer`, async ({ page }) => {
      const resp = await page.goto(p.path)
      expect(resp?.status(), `HTTP-Status ${p.path}`).toBe(200)
      await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible()
      await expect(page.getByTestId('site-footer')).toBeVisible()
    })
  }

  test('AGB enthaelt die Taler-Klausel (kein Zahlungsmittel, kein Auszahlungsanspruch, 10%, 48h)', async ({
    page,
  }) => {
    await page.goto('/agb')
    await expect(page.getByText(/kein gesetzliches Zahlungsmittel/)).toBeVisible()
    await expect(page.getByText(/kein Anspruch auf Auszahlung/)).toBeVisible()
    await expect(page.getByText(/10 %/)).toBeVisible()
    await expect(page.getByText(/48 Stunden/)).toBeVisible()
  })

  test('Footer-Links auf der Startseite vorhanden und navigierbar', async ({ page }) => {
    await page.goto('/')
    const footer = page.getByTestId('site-footer')
    await expect(footer).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Impressum' })).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Datenschutz' })).toBeVisible()
    await expect(footer.getByRole('link', { name: 'AGB' })).toBeVisible()

    await footer.getByRole('link', { name: 'Impressum' }).click()
    await expect(page).toHaveURL(/\/impressum$/)
    await expect(page.getByRole('heading', { level: 1, name: /Impressum/ })).toBeVisible()
  })

  // --- Signup: ohne Zustimmung blockiert, mit Zustimmung erfolgreich ---
  async function openRegisterForm(page: Page) {
    await page.goto('/?auth=required')
    await page.getByRole('button', { name: 'Registrieren' }).click() // Tab
    const form = page.locator('form')
    await expect(form.getByTestId('register-terms')).toBeVisible()
    return form
  }

  async function fillRegister(form: ReturnType<Page['locator']>) {
    await form.getByPlaceholder('E-Mail').fill(NEW_EMAIL)
    await form.getByPlaceholder('Username').fill(NEW_USERNAME)
    await form.locator('select').selectOption({ index: 1 })
    await form.getByPlaceholder('Passwort (Min. 8 Zeichen)').fill(NEW_PASSWORD)
  }

  test('Registrierung ohne Zustimmung ist blockiert mit sichtbarer Meldung', async ({ page }) => {
    const form = await openRegisterForm(page)
    await fillRegister(form)
    // Checkbox NICHT anhaken.
    // Block 13: Der Submit ist ohne Haekchen jetzt DISABLED (kein stiller Klick,
    // Lektion 6) — der sichtbare Grund steht im Hinweistext daneben.
    await expect(page.getByTestId('register-terms-hint')).toBeVisible()
    await expect(page.getByTestId('register-terms-hint')).toContainText('Häkchen')
    await expect(form.getByRole('button', { name: 'Registrieren' })).toBeDisabled()

    // Kein Konto angelegt (Trigger haette Profil geschrieben).
    await page.waitForTimeout(800)
    const r = await rest(`profiles?username=eq.${NEW_USERNAME}&select=id`)
    const rows = await r.json()
    expect(Array.isArray(rows) ? rows.length : 0).toBe(0)
  })

  test('Registrierung mit Zustimmung wird abgeschickt (Gate offen)', async ({ page }) => {
    // Block-7-Verantwortung ist ausschliesslich das Zustimmungs-Gate: MIT
    // Haekchen darf die Registrierung nicht mehr blockiert werden, d.h. die App
    // sendet den Signup-Request wirklich ab. Ob der Auth-Server den Signup
    // danach annimmt, haengt von der Testumgebung ab (E-Mail-Bestaetigung /
    // Ratelimit) und ist NICHT Teil von Block 7 -> daher hier deterministisch
    // am gesendeten Request festgemacht, nicht am E-Mail-Erfolg.
    const form = await openRegisterForm(page)
    await fillRegister(form)
    await form.getByTestId('register-terms').check()

    // POST auf den Auth-Signup-Endpoint abfangen (nicht den CORS-Preflight).
    const signupPromise = page.waitForResponse(
      (r) => r.url().includes('/auth/v1/signup') && r.request().method() === 'POST',
      { timeout: 20_000 }
    )
    await form.getByRole('button', { name: 'Registrieren' }).click()

    // Gate offen: keine Zustimmungs-Fehlermeldung.
    await expect(page.getByTestId('register-terms-error')).toHaveCount(0)

    // Beweis: Der Signup-Request wird tatsaechlich gesendet (Gate laesst durch).
    const resp = await signupPromise
    const status = resp.status()
    // Messung (D1) im Lauf-Log sichtbar machen.
    console.log('[block7] signup HTTP status =', status)

    if (status === 200) {
      // Auth-Server hat angenommen: App wechselt auf Login + Konto liegt in DB.
      await expect(page.getByPlaceholder('Username')).toBeHidden()
      await expect
        .poll(
          async () => {
            const r = await rest(`profiles?username=eq.${NEW_USERNAME}&select=id`)
            const rows = await r.json()
            return Array.isArray(rows) ? rows.length : 0
          },
          { timeout: 15_000 }
        )
        .toBeGreaterThan(0)
    } else {
      // Auth-Server hat abgelehnt (z.B. E-Mail-Ratelimit der Testumgebung).
      // Kein halbes Konto darf entstehen (Lektion 7: keine verschluckten
      // Teilzustaende).
      await page.waitForTimeout(800)
      const r = await rest(`profiles?username=eq.${NEW_USERNAME}&select=id`)
      const rows = await r.json()
      expect(Array.isArray(rows) ? rows.length : 0).toBe(0)
    }
  })
})
