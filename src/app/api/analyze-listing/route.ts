import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { CLAUDE_MODEL_FAST } from '@/lib/ai'
import { CATEGORIES } from '@/types'
import { CONDITION_GRADES } from '@/lib/conditionConfig'
import { validateAnalyzeResult } from '@/lib/analyzeListing'

/**
 * BLOCK 14 — KI-Feld-Engine (server-seitig, API-Key bleibt geheim).
 *
 * POST /api/analyze-listing  { imageUrls?: string[]; text?: string }
 *   → { result: AnalyzeResult | null }
 *
 * Als Route-Handler (statt Server Action) umgesetzt, damit der Client sie per
 * `fetch` aufruft und die E2E sie deterministisch per `page.route` mocken kann
 * (Plan 4/Punkt 9, T1/T3/T4). NIE blockierend: jeder Fehler → { result: null },
 * geloggt (Lektion 7). Die Antwort wird strikt validiert (Whitelist).
 */

const CATEGORY_IDS = CATEGORIES.map((c) => c.id)
const CONDITION_SLUGS = CONDITION_GRADES.map((g) => g.slug)
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function buildPrompt(text: string): string {
  const cats = CATEGORIES.map((c) => `${c.id} = ${c.label}`).join('\n')
  const conds = CONDITION_GRADES.map((g) => `${g.slug} = ${g.label}`).join('\n')
  return `Du hilfst beim Erstellen eines Marktplatz-Inserats im Kanton Uri (Schweiz, Deutsch).
Analysiere den Artikel aus Foto(s) und/oder diesem Freitext des Nutzers: "${text}".

Antworte AUSSCHLIESSLICH mit gültigem JSON (kein Markdown, kein Fliesstext) nach diesem Schema:
{
  "feed_kategorie": <genau EINE dieser Kategorie-IDs>,
  "artikel_typ": <kurzer Freitext, was es wirklich ist, z.B. "Kinderschuhe", "Rennvelo">,
  "titel_vorschlag": <kurzer, ehrlicher Titel auf Deutsch, max 80 Zeichen>,
  "beschreibung_vorschlag": <freundliche, faktische Beschreibung auf Deutsch, keine erfundenen Fakten>,
  "felder": [ { "key": <slug>, "label": <deutsch>, "typ": <"chips"|"zahlen_skala"|"toggle"|"text">, "optionen"?: [<strings, nur bei chips>], "min"?: <zahl>, "max"?: <zahl>, "schritt"?: <zahl> } ],
  "zustand_optionen": [<Teilmenge der Zustands-Slugs, die zu DIESEM Artikel passt>],
  "zustand_vorschlag": <ein Slug aus zustand_optionen oder null>,
  "gereinigt_sinnvoll": <true nur bei Kleidung/Schuhen/Kindersachen>
}

Kategorie-IDs (nur diese, nie neue erfinden):
${cats}

Zustands-Slugs (nur diese):
${conds}

Regeln:
- Wähle für DIESEN Artikel die wirklich sinnvollen Eingaben. Für Schuhe z.B. eine "zahlen_skala" 18 bis 48 (Schritt 1) statt Kleidergrössen S/M/L.
- Höchstens 8 Felder. Nutze für Standardfälle diese bestehenden Keys: g-groesse (Grösse), g-marke (Marke), g-farbe (Farbe), g-geschlecht (Für wen?). Neues darfst du frei benennen (kleingeschrieben, keine Leerzeichen).
- "toggle" für Ja/Nein-Fragen (z.B. "Voll funktionsfähig?"), "text" nur für Kurzangaben.
- Erfinde keine Zahlen, keine Marken, die du nicht siehst. Bei Unsicherheit weniger Felder.`
}

async function urlToImageBlock(url: string): Promise<
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | null
> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // Grosse Bilder überspringen (Prompt-Grösse begrenzen).
    if (buf.byteLength > 5 * 1024 * 1024) return null
    return {
      type: 'image',
      source: { type: 'base64', media_type: contentType, data: buf.toString('base64') },
    }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ result: null }, { status: 401 })
  }

  let body: { imageUrls?: unknown; text?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ result: null })
  }

  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 400) : ''
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u): u is string => typeof u === 'string').slice(0, 5)
    : []

  if (!text && imageUrls.length === 0) {
    return NextResponse.json({ result: null })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[analyzeListing] ANTHROPIC_API_KEY fehlt')
    return NextResponse.json({ result: null })
  }

  try {
    const imageBlocks = (await Promise.all(imageUrls.map(urlToImageBlock))).filter(
      (b): b is NonNullable<typeof b> => b !== null
    )
    const content: unknown[] = [...imageBlocks, { type: 'text', text: buildPrompt(text) }]

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL_FAST,
        max_tokens: 1024,
        messages: [{ role: 'user', content }],
      }),
    })
    if (!res.ok) {
      console.error('[analyzeListing] http', res.status)
      return NextResponse.json({ result: null })
    }
    const data = await res.json()
    const block = (data.content ?? []).find((b: { type: string }) => b.type === 'text')
    const rawText = String(block?.text ?? '').trim()
    // Erstes JSON-Objekt aus der Antwort extrahieren.
    const start = rawText.indexOf('{')
    const end = rawText.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return NextResponse.json({ result: null })
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText.slice(start, end + 1))
    } catch {
      return NextResponse.json({ result: null })
    }
    const result = validateAnalyzeResult(parsed, CATEGORY_IDS, CONDITION_SLUGS)
    return NextResponse.json({ result })
  } catch (err) {
    console.error('[analyzeListing]', err)
    return NextResponse.json({ result: null })
  }
}
