import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProfileDashboard } from '@/components/profile/ProfileDashboard'
import type { Profile } from '@/types'
import type { MatchItem } from '@/components/profile/SmartMatchList'
import type { MyListingItem } from '@/components/profile/MyListings'
import type { SellerTransaction } from '@/components/listing/SellerDashboard'
import type { BuyerTransaction } from '@/components/profile/BuyerDashboard'
import type { PaymentInfo } from '@/components/profile/PaymentInfoForm'

export default async function ProfilePage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/?auth=required')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id,username,full_name,avatar_url,gemeinde,xp_points,level,credits,avg_rating,review_count,pioneer_badge,strikes,can_buy,is_banned,referral_code,preferred_categories,created_at'
    )
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/?auth=required')

  const { data: myListings } = await supabase
    .from('listings')
    .select('id,title,status,price,type,created_at,image_url,views')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: matches } = await supabase
    .from('smart_matches')
    .select(
      'id,score,listing:listings!smart_matches_matched_listing_id_fkey(id,title,price,image_url,category)'
    )
    .eq('user_id', user.id)
    .eq('dismissed', false)
    .order('score', { ascending: false })
    .limit(20)

  const { data: sellerTransactions } = await supabase
    .from('transactions')
    .select(
      'id,status,amount,commission,payment_method,created_at,listing:listings!transactions_listing_id_fkey(id,title,image_url)'
    )
    .eq('seller_id', user.id)
    .in('status', ['pending', 'confirmed', 'completed'])
    .order('created_at', { ascending: false })
    .limit(30)

  // Käufer-Sicht: eigene Käufe mit Status (pending → confirmed → completed).
  // Kontaktdaten werden NICHT hier geladen, sondern erst im Client via
  // get_transaction_contact-RPC (nur bei confirmed, nur an Beteiligte).
  const { data: buyerTransactions } = await supabase
    .from('transactions')
    .select(
      'id,status,amount,payment_method,created_at,listing:listings!transactions_listing_id_fkey(id,title,image_url)'
    )
    .eq('buyer_id', user.id)
    .in('status', ['pending', 'confirmed', 'completed'])
    .order('created_at', { ascending: false })
    .limit(30)

  // Eigene Zahlungs-/Kontaktdaten (RLS: nur Eigentümer). Zeile kann fehlen,
  // wenn noch nichts hinterlegt wurde → maybeSingle() liefert dann null.
  const { data: paymentInfo } = await supabase
    .from('profiles_private')
    .select(
      'iban,twint_phone,phone,address,show_iban,show_twint,show_phone,show_address'
    )
    .eq('id', user.id)
    .maybeSingle()

  return (
    <>
      <Header />
      <main className="pb-24">
        <ProfileDashboard
          profile={profile as Profile}
          myListings={(myListings ?? []) as MyListingItem[]}
          matches={(matches ?? []) as unknown as MatchItem[]}
          sellerTransactions={
            (sellerTransactions ?? []) as unknown as SellerTransaction[]
          }
          buyerTransactions={
            (buyerTransactions ?? []) as unknown as BuyerTransaction[]
          }
          paymentInfo={(paymentInfo ?? null) as PaymentInfo | null}
        />
      </main>
      <BottomNav />
    </>
  )
}
