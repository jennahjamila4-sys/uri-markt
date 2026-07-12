import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

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
const STRIPE_SECRET = ENV.STRIPE_SECRET_KEY
const WEBHOOK_SECRET = ENV.STRIPE_WEBHOOK_SECRET
const A = { email: ENV.E2E_USER_A_EMAIL, password: ENV.E2E_USER_A_PASSWORD }

const stripe = new Stripe(STRIPE_SECRET)

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

async function login(page: Page, email: string, password: string) {
  await page.goto('/?auth=required')
  const form = page.locator('form')
  await form.getByPlaceholder('E-Mail').fill(email)
  await form.getByPlaceholder('Passwort').fill(password)
  await form.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByPlaceholder('Passwort')).toBeHidden()
}

async function getCredits(userId: string): Promise<number> {
  const r = await rest(`profiles?id=eq.${userId}&select=credits`)
  const rows = (await r.json()) as { credits: number | null }[]
  return Number(rows[0]?.credits ?? 0)
}

async function deleteWalletTx(pi: string) {
  await rest(`wallet_transactions?stripe_payment_intent_id=eq.${pi}`, {
    method: 'DELETE',
  })
}

async function setCredits(userId: string, credits: number) {
  await rest(`profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ credits }),
  })
}

const skipOnboarding = () =>
  localStorage.setItem(
    'uri-markt-v1',
    JSON.stringify({ state: { onboardingCompleted: true }, version: 0 })
  )

test.describe('Block 6 – Taler-Kauf (Stripe)', () => {
  let userAId: string
  let baseline: number
  const testPI = `pi_e2e_block6_${Date.now()}`

  test.beforeAll(async () => {
    userAId = await getProfileId(A.email, A.password)
    baseline = await getCredits(userAId)
    await deleteWalletTx(testPI)
  })

  test.afterAll(async () => {
    // Vom Test gutgeschriebene Taler + Test-Buchung wieder entfernen (Baseline).
    await deleteWalletTx(testPI)
    await setCredits(userAId, baseline)
  })

  // Onboarding-Overlay ueberspringen (sonst faengt es Klicks auf dem Login ab).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(skipOnboarding)
  })

  test('A: Checkout-Session korrekt erzeugt (Betrag, Waehrung, Metadaten)', async ({
    page,
  }) => {
    await login(page, A.email, A.password)
    await page.goto('/profile')
    await page.getByRole('button', { name: /Taler kaufen/i }).click()
    await expect(page.getByTestId('taler-purchase')).toBeVisible()
    await expect(page.getByTestId('taler-balance')).toBeVisible()

    await page.getByTestId('taler-buy-taler_10').click()
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 })

    const csId = page.url().match(/cs_(test|live)_[A-Za-z0-9]+/)?.[0]
    expect(csId, 'Checkout-Session-ID in der URL').toBeTruthy()

    const session = await stripe.checkout.sessions.retrieve(csId as string)
    expect(session.mode).toBe('payment')
    expect(session.currency).toBe('chf')
    expect(session.amount_total).toBe(1000) // 10 Taler = CHF 10.00 = 1000 Rappen
    expect(session.metadata?.user_id).toBe(userAId)
    expect(session.metadata?.amount_rappen).toBe('1000')
  })

  test('B: signierter Webhook schreibt genau einmal gut (idempotent)', async ({
    request,
  }) => {
    const before = await getCredits(userAId)
    const payload = JSON.stringify({
      id: `evt_e2e_${Date.now()}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_test_e2e_${Date.now()}`,
          object: 'checkout.session',
          payment_status: 'paid',
          payment_intent: testPI,
          metadata: {
            user_id: userAId,
            amount_rappen: '500',
            package_id: 'taler_5',
          },
        },
      },
    })
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    })
    const headers = { 'stripe-signature': header, 'content-type': 'application/json' }

    // 1. Zustellung -> 200, Guthaben +500 (credit_taler ist synchron)
    const r1 = await request.post('/api/webhooks/stripe', { headers, data: payload })
    expect(r1.status()).toBe(200)
    await expect.poll(async () => await getCredits(userAId)).toBe(before + 500)

    // 2. Zustellung desselben Events -> KEINE Doppelgutschrift (Idempotenz)
    const r2 = await request.post('/api/webhooks/stripe', { headers, data: payload })
    expect(r2.status()).toBe(200)
    await new Promise((res) => setTimeout(res, 800))
    expect(await getCredits(userAId)).toBe(before + 500)

    // Genau EINE wallet_transactions-Zeile mit dieser payment_intent
    const rows = (await (
      await rest(
        `wallet_transactions?stripe_payment_intent_id=eq.${testPI}&select=id,amount`
      )
    ).json()) as { id: string; amount: number }[]
    expect(rows.length).toBe(1)
    expect(Number(rows[0].amount)).toBe(500)
  })

  test('C: ungueltige Signatur -> 400, keine Gutschrift', async ({ request }) => {
    const before = await getCredits(userAId)
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: {} },
    })
    const r = await request.post('/api/webhooks/stripe', {
      headers: { 'stripe-signature': 't=1,v1=deadbeef', 'content-type': 'application/json' },
      data: payload,
    })
    expect(r.status()).toBe(400)
    expect(await getCredits(userAId)).toBe(before)
  })
})
