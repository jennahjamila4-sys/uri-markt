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
  const supabase = createServerClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  // Validate input
  const validated = BuyIntentSchema.safeParse(rawData)
  if (!validated.success) {
    throw new Error(`Ungültige Eingabe: ${validated.error.message}`)
  }

  const { listing_id, payment_method, buyer_contact } = validated.data

  try {
    // Call RPC to create buy intent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('create_buy_intent', {
      p_buyer_id: user.id,
      p_listing_id: listing_id,
      p_payment_method: payment_method,
      p_buyer_contact: buyer_contact,
    })

    if (error || !data?.success) {
      throw new Error(data?.error ?? 'Kaufanfrage fehlgeschlagen')
    }

    revalidatePath('/')
    revalidatePath('/profile')

    return { success: true, transaction_id: data.transaction_id }
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
  const supabase = createServerClient()

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
 * Käufer/Verkäufer markiert Transaktion als abgeschlossen
 * Vergabe von XP und automatische Benachrichtigungen
 */
export async function completeTransactionAction(transaction_id: string) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht angemeldet')
  }

  try {
    // Get transaction
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('id, buyer_id, seller_id, listing_id, amount, status')
      .eq('id', transaction_id)
      .single()

    if (txError || !tx) {
      throw new Error('Transaktion nicht gefunden')
    }

    if (tx.seller_id !== user.id && tx.buyer_id !== user.id) {
      throw new Error('Nicht berechtigt')
    }

    // Mark as completed
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', transaction_id)

    if (updateError) throw updateError

    // Mark listing as sold and set fomo_expires_at
    await supabase
      .from('listings')
      .update({
        status: 'sold',
        fomo_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', tx.listing_id)

    // Award XP for seller
    await supabase.rpc('award_xp', {
      p_user_id: tx.seller_id,
      p_amount: 50,
      p_reason: 'Verkauf abgeschlossen',
      p_idempotency_key: `listing_sold_${transaction_id}`,
    })

    // Award XP for buyer
    await supabase.rpc('award_xp', {
      p_user_id: tx.buyer_id,
      p_amount: 10,
      p_reason: 'Kauf abgeschlossen',
      p_idempotency_key: `listing_bought_${transaction_id}`,
    })

    // Notify both parties
    await supabase.rpc('send_notification', {
      p_recipient_id: tx.buyer_id,
      p_title: '🏆 Deal abgeschlossen!',
      p_message: 'Bitte bewerte den Verkäufer.',
      p_type: 'tx_completed',
      p_listing_id: tx.listing_id,
    })

    await supabase.rpc('send_notification', {
      p_recipient_id: tx.seller_id,
      p_title: '🏆 Deal abgeschlossen!',
      p_message: 'Danke für den Verkauf. XP verdient!',
      p_type: 'tx_completed',
      p_listing_id: tx.listing_id,
    })

    revalidatePath('/profile')
    revalidatePath('/')

    return { success: true }
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
  const supabase = createServerClient()

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
  const supabase = createServerClient()

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
  const supabase = createServerClient()

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
