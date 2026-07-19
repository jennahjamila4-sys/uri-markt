import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MODEL_FAST = Deno.env.get('CLAUDE_MODEL_FAST') ?? 'claude-haiku-4-5'

const STORE_MIN = 40
const NOTIFY_MIN = 50
const STRONG_MIN = 75

const COLS = 'id,user_id,title,description,price,max_budget,category,gemeinde,gemeinden,type,status,smart_data'

interface L {
  id: string; user_id: string; title: string; description: string | null
  price: number | null; max_budget: number | null; category: string | null
  gemeinde: string | null; gemeinden: string[] | null; type: string; status: string
  smart_data: Record<string, unknown> | null
}

let lastAiStatus = 'not_called'

Deno.serve(async (req) => {
  try {
    lastAiStatus = ANTHROPIC_KEY ? 'key_set_not_called' : 'no_key'
    const { listing_id } = await req.json()
    if (!listing_id) return json({ error: 'listing_id fehlt' }, 400)

    const { data: base, error } = await supabase
      .from('listings').select(COLS).eq('id', listing_id).single()
    if (error || !base) return json({ error: 'Listing nicht gefunden' }, 404)
    if (base.status !== 'active') return json({ processed: 0, reason: 'not_active' })

    let pairs: { gesuch: L; offer: L }[] = []
    if (base.type === 'Gesuch') {
      const { data } = await supabase.from('listings').select(COLS)
        .eq('type', 'Angebot').eq('status', 'active')
        .eq('category', base.category).neq('user_id', base.user_id).limit(20)
      pairs = (data ?? []).map((o) => ({ gesuch: base as L, offer: o as L }))
    } else if (base.type === 'Angebot') {
      const { data } = await supabase.from('listings').select(COLS)
        .eq('type', 'Gesuch').eq('status', 'active')
        .eq('category', base.category).neq('user_id', base.user_id).limit(20)
      pairs = (data ?? []).map((g) => ({ gesuch: g as L, offer: base as L }))
    } else {
      return json({ processed: 0, reason: 'type_not_matchable' })
    }

    let notified = 0
    for (const { gesuch, offer } of pairs) {
      const score = await calcScore(gesuch, offer)
      if (score < STORE_MIN) continue

      const { data: existing } = await supabase.from('smart_matches').select('id')
        .eq('gesuch_id', gesuch.id).eq('matched_listing_id', offer.id).maybeSingle()

      const { error: upErr } = await supabase.from('smart_matches').upsert(
        { gesuch_id: gesuch.id, matched_listing_id: offer.id, user_id: gesuch.user_id, score },
        { onConflict: 'gesuch_id,matched_listing_id' }
      )
      if (upErr) { console.error('[smart-matches upsert]', upErr); continue }

      if (!existing && score >= NOTIFY_MIN) {
        const strong = score >= STRONG_MIN
        const title = strong ? '\u{1F3AF} Perfekter Match gefunden!' : '✨ Das könnte dir gefallen'
        const message = strong
          ? `„${offer.title}“ passt zu ${score}% zu deinem Gesuch „${gesuch.title}“ — schau es dir an, bevor es weg ist!`
          : `Wir haben etwas entdeckt, das zu deinem Gesuch „${gesuch.title}“ passen könnte: „${offer.title}“ (${score}% Match).`
        const { error: nErr } = await supabase.rpc('send_notification', {
          p_recipient_id: gesuch.user_id,
          p_title: title,
          p_message: message,
          p_type: 'match',
          p_listing_id: offer.id,
        })
        if (nErr) console.error('[send_notification]', nErr)
        else notified++
      }
    }
    return json({ processed: pairs.length, notified, ai: lastAiStatus })
  } catch (e) {
    console.error('[calculate-smart-matches]', e)
    return json({ error: 'Server-Fehler' }, 500)
  }
})

// smart_data kompakt als Text (fuer KI-Prompt und Heuristik). Fehler senken nie den Score.
function smartText(l: L): string {
  if (!l.smart_data) return ''
  try {
    return Object.entries(l.smart_data)
      .filter(([, v]) => v !== null && v !== '' && v !== false && v !== undefined)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('/') : String(v)}`)
      .join(', ').slice(0, 200)
  } catch { return '' }
}

function fullText(l: L): string {
  return `${l.title} ${l.description ?? ''} ${smartText(l)}`
}

function tokens(l: L): Set<string> {
  return new Set(
    fullText(l)
      .toLowerCase().normalize('NFKD')
      .replace(/[^a-zà-ÿ0-9\s]/gi, ' ')
      .split(/\s+/).filter((w) => w.length >= 4)
  )
}

function gemeindenOf(l: L): string[] {
  const arr = l.gemeinden && l.gemeinden.length > 0 ? l.gemeinden : [l.gemeinde]
  return arr.filter((g): g is string => !!g)
}

async function calcScore(gesuch: L, offer: L): Promise<number> {
  let semantic: number
  const ai = ANTHROPIC_KEY
    ? await scoreWithAI(fullText(gesuch), fullText(offer))
    : null
  if (ai !== null) {
    semantic = ai
  } else {
    const g = tokens(gesuch)
    let shared = 0
    for (const t of tokens(offer)) if (g.has(t)) shared++
    semantic = shared > 0 ? 50 + Math.min(shared * 8, 30) : 35
  }

  let score = Math.round(semantic * 0.7)
  if (gesuch.max_budget != null && offer.price != null) {
    const p = Number(offer.price), b = Number(gesuch.max_budget)
    if (p <= b) score += 20
    else if (p <= b * 2) score += 10
  } else {
    score += 10
  }
  const gGem = gemeindenOf(gesuch), oGem = gemeindenOf(offer)
  if (gGem.some((g) => oGem.includes(g))) score += 10
  return Math.min(score, 100)
}

async function scoreWithAI(gesuch: string, angebot: string): Promise<number | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_FAST,
        max_tokens: 5,
        messages: [{
          role: 'user',
          content: `Wie gut passt dieses Angebot zu diesem Gesuch auf einem Secondhand-Marktplatz? Beruecksichtige Synonyme und Sprachen (Handy=Phone=Smartphone=Natel). Strukturierte Details (z.B. groesse, marke, zustand) sind starke Signale: Uebereinstimmung erhoeht die Zahl, klarer Widerspruch (z.B. Groesse S vs. XL) senkt sie. Antworte NUR mit einer Zahl 0-100.\nGesuch: ${gesuch.slice(0, 300)}\nAngebot: ${angebot.slice(0, 300)}`,
        }],
      }),
    })
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300)
      lastAiStatus = `http_${res.status}: ${body}`
      console.error('[scoreWithAI]', lastAiStatus)
      return null
    }
    const data = await res.json()
    const block = (data.content ?? []).find((b: { type: string }) => b.type === 'text')
    const n = parseInt(String(block?.text ?? '').trim(), 10)
    if (Number.isNaN(n)) { lastAiStatus = 'parse_error'; return null }
    lastAiStatus = 'ok'
    return Math.min(100, Math.max(0, n))
  } catch (e) {
    lastAiStatus = 'exception: ' + String(e).slice(0, 200)
    console.error('[scoreWithAI]', lastAiStatus)
    return null
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
