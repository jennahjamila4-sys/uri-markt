'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { BuyIntentSchema, ReviewSchema, CommentSchema } from '@/lib/validations/transaction'
import { censorText } from '@/lib/censor'

/**
 * Erstelle Kaufabsicht für ein Inserat
 * SECURITY: user_id kommt vom Server via getUser()
 */
export async function createBuyIntentAction(rawData: unknown) {
  const supabase = await createServerClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  // Validate input – erste Fehlermeldung lesbar an den Nutzer geben (kein Zod-JSON)
  const validated = BuyIntentSchema.safeParse(rawData)
  if (!validated.success) {
    const firstMsg = validated.error.issues[0]?.message ?? 'Bitte Eingaben prüfen'
    throw new Error(firstMsg)
  }

  const { listing_id, payment_method, buyer_contact } = validated.data

  try {
    // RPC create_buy_intent (SECURITY DEFINER): setzt buyer_id serverseitig via
    // auth.uid(), berechnet amount/commission selbst und reserviert das Inserat
    // atomar. Der Client übergibt NIE user_id/Betrag/Provision – nur die 3
    // Live-Argumente (listing_id, payment_method, buyer_contact).
    const { data, error } = await supabase.rpc('create_buy_intent', {
      p_listing_id: listing_id,
      p_payment_method: payment_method,
      p_buyer_contact: buyer_contact,
    })

    if (error) throw error

    const result = data as {
      success: boolean
      transaction_id?: string
      error?: string
    }
    if (result.success === false) {
      throw new Error(result.error ?? 'Kaufanfrage fehlgeschlagen')
    }

    revalidatePath('/')
    revalidatePath('/profile')

    return { success: true, transaction_id: result.transaction_id }
  } catch (err) {
    console.error('[createBuyIntent]', err)
    throw err
  }
}

/**
 * Verkäufer bestätigt Kauf und zahlt Provision
 * SECURITY: user_id vom Server, RPC ist SECURITY DEFINER
 */
export async function confirmSaleAction(transaction_id: string) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  try {
    // Verify seller ownership (optional, RPC prüft auch)
    const { data: tx } = await supabase
      .from('transactions')
      .select('seller_id, listing_id, buyer_id, amount, commission')
      .eq('id', transaction_id)
      .single()

    if (!tx || tx.seller_id !== user.id) {
      throw new Error('Nicht berechtigt')
    }

    // Call RPC: process commission
    const { data: result, error } = await supabase.rpc(
      'process_transaction_commission',
      {
        p_transaction_id: transaction_id,
        p_seller_id: user.id,
      }
    )

    if (error || !result?.success) {
      throw new Error(result?.error ?? 'Bestätigung fehlgeschlagen')
    }

    // Notify buyer
    await supabase.rpc('send_notification', {
      p_recipient_id: tx.buyer_id,
      p_title: '✅ Verkäufer hat bestätigt!',
      p_message: 'Kontaktdaten wurden freigeschaltet. Macht einen Termin aus.',
      p_type: 'tx_confirmed',
      p_listing_id: tx.listing_id,
    })

    revalidatePath('/profile')
    revalidatePath('/')

    return { ...result, success: true }
  } catch (err) {
    console.error('[confirmSale]', err)
    throw err
  }
}

/**
 * Verkäufer lehnt eine ausstehende Kaufanfrage ab
 * Transaktion wird storniert, Inserat wieder aktiv geschaltet
 */
export async function rejectTransactionAction(transaction_id: string) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  try {
    const { data: tx } = await supabase
      .from('transactions')
      .select('seller_id, buyer_id, listing_id, status')
      .eq('id', transaction_id)
      .single()

    if (!tx || tx.seller_id !== user.id) {
      throw new Error('Nicht berechtigt')
    }
    if (tx.status !== 'pending') {
      throw new Error('Anfrage kann nicht mehr abgelehnt werden')
    }

    // Transaktion stornieren
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ status: 'cancelled' })
      .eq('id', transaction_id)

    if (updateError) throw updateError

    // Inserat wieder aktiv schalten
    await supabase
      .from('listings')
      .update({ status: 'active' })
      .eq('id', tx.listing_id)

    // Käufer benachrichtigen
    await supabase.rpc('send_notification', {
      p_recipient_id: tx.buyer_id,
      p_title: 'Kaufanfrage abgelehnt',
      p_message: 'Der Verkäufer hat deine Kaufanfrage leider abgelehnt.',
      p_type: 'tx_rejected',
      p_listing_id: tx.listing_id,
    })

    revalidatePath('/profile')
    revalidatePath('/')

    return { success: true }
  } catch (err) {
    console.error('[rejectTransaction]', err)
    throw err
  }
}

/**
 * Käufer/Verkäufer markiert Transaktion als abgeschlossen
 * Vergabe von XP und automatische Benachrichtigungen
 */
export async function completeTransactionAction(transaction_id: string) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  try {
    // Transaktion laden, um den Aufrufer zu autorisieren und der RPC die
    // korrekte seller_id zu übergeben (der Abschluss darf von Käufer ODER
    // Verkäufer ausgelöst werden).
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('seller_id, buyer_id')
      .eq('id', transaction_id)
      .single()

    if (txError || !tx) {
      throw new Error('Transaktion nicht gefunden')
    }

    if (tx.seller_id !== user.id && tx.buyer_id !== user.id) {
      throw new Error('Nicht berechtigt')
    }

    // Deal atomar abschliessen: Status, FOMO, XP und Benachrichtigungen laufen
    // in der DB-Funktion in EINER Transaktion. Ersetzt die frühere manuelle
    // 4-Schritt-Version, die halb-fertig hängen bleiben konnte.
    const { data: result, error } = await supabase.rpc('complete_transaction', {
      p_transaction_id: transaction_id,
      p_seller_id: tx.seller_id,
    })

    if (error || !result?.success) {
      throw new Error(result?.error ?? 'Deal konnte nicht abgeschlossen werden')
    }

    revalidatePath('/profile')
    revalidatePath('/')

    return { ...result, success: true }
  } catch (err) {
    console.error('[completeTransaction]', err)
    throw err
  }
}

/**
 * Verkäufer meldet No-Show (Käufer kam nicht)
 * Provision wird zurück, Käufer bekommt Strike
 */
export async function reportNoShowAction(transaction_id: string) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  try {
    // Verify seller ownership
    const { data: tx } = await supabase
      .from('transactions')
      .select('seller_id, buyer_id, listing_id')
      .eq('id', transaction_id)
      .single()

    if (!tx || tx.seller_id !== user.id) {
      throw new Error('Nicht berechtigt')
    }

    // Call RPC: escalate no-show
    const { data: result, error } = await supabase.rpc('escalate_no_show', {
      p_transaction_id: transaction_id,
      p_seller_id: user.id,
    })

    if (error || !result?.success) {
      throw new Error(result?.error ?? 'Eskalation fehlgeschlagen')
    }

    // Notify buyer
    await supabase.rpc('send_notification', {
      p_recipient_id: tx.buyer_id,
      p_title: '⚠️ No-Show gemeldet',
      p_message: 'Der Verkäufer hat einen No-Show gemeldet. Dir wurde ein Strike hinzugefügt.',
      p_type: 'no_show',
      p_listing_id: tx.listing_id,
    })

    revalidatePath('/profile')

    return { success: true }
  } catch (err) {
    console.error('[reportNoShow]', err)
    throw err
  }
}

/**
 * Submit review für abgeschlossene Transaktion
 */
export async function submitReviewAction(rawData: unknown) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  const validated = ReviewSchema.safeParse(rawData)
  if (!validated.success) {
    throw new Error(`Ungültige Bewertung: ${validated.error.message}`)
  }

  const { transaction_id, rating, comment } = validated.data

  try {
    // Get transaction to find reviewee
    const { data: tx } = await supabase
      .from('transactions')
      .select('seller_id, buyer_id, listing_id, status')
      .eq('id', transaction_id)
      .single()

    if (!tx || tx.status !== 'completed') {
      throw new Error('Transaktion nicht abgeschlossen')
    }

    // Determine reviewee (opposite party)
    const reviewee_id = tx.seller_id === user.id ? tx.buyer_id : tx.seller_id

    // Insert review
    const { error: reviewError } = await supabase
      .from('reviews')
      .insert({
        reviewer_id: user.id,
        reviewee_id,
        listing_id: tx.listing_id,
        rating,
        comment: comment || null,
      })

    if (reviewError) throw reviewError

    // Award XP for reviewing
    await supabase.rpc('award_xp', {
      p_user_id: user.id,
      p_amount: 5,
      p_reason: 'Bewertung abgegeben',
      p_idempotency_key: `review_given_${transaction_id}`,
    })

    // Update avg_rating for reviewee (done via trigger ideally, but can be RPC)
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', reviewee_id)

    if (reviews && reviews.length > 0) {
      const avgRating =
        reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
      await supabase
        .from('profiles')
        .update({
          avg_rating: parseFloat(avgRating.toFixed(2)),
          review_count: reviews.length,
        })
        .eq('id', reviewee_id)
    }

    revalidatePath('/profile')

    return { success: true }
  } catch (err) {
    console.error('[submitReview]', err)
    throw err
  }
}

/**
 * Post comment on listing
 * Text wird zensiert, bevor in DB gespeichert
 */
export async function submitCommentAction(rawData: unknown) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  const validated = CommentSchema.safeParse(rawData)
  if (!validated.success) {
    throw new Error(`Ungültiger Kommentar: ${validated.error.message}`)
  }

  const { listing_id, text } = validated.data

  try {
    // Verify listing exists
    const { data: listing } = await supabase
      .from('listings')
      .select('id')
      .eq('id', listing_id)
      .single()

    if (!listing) {
      throw new Error('Inserat nicht gefunden')
    }

    // Censor text
    const censored_text = censorText(text)

    // Insert comment
    const { error } = await supabase.from('comments').insert({
      listing_id,
      user_id: user.id,
      text,
      censored_text,
    })

    if (error) throw error

    // Award XP for commenting
    await supabase.rpc('award_xp', {
      p_user_id: user.id,
      p_amount: 5,
      p_reason: 'Kommentar hinterlassen',
      p_idempotency_key: `comment_${listing_id}_${user.id}_${Date.now()}`,
    })

    revalidatePath(`/listing/${listing_id}`)

    return { success: true }
  } catch (err) {
    console.error('[submitComment]', err)
    throw err
  }
}
