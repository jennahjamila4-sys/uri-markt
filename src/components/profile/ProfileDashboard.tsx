'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { LevelBadge } from '@/components/gamification/LevelBadge'
import { XPBar } from './XPBar'
import { SmartMatchList, type MatchItem } from './SmartMatchList'
import { MyListings, type MyListingItem } from './MyListings'
import {
  SellerDashboard,
  type SellerTransaction,
} from '@/components/listing/SellerDashboard'
import { BuyerDashboard, type BuyerTransaction } from './BuyerDashboard'
import { PaymentInfoForm, type PaymentInfo } from './PaymentInfoForm'
import { TalerHistory, type WalletTxItem } from './TalerHistory'
import { EditProfileForm } from './EditProfileForm'
import { DeleteAccountSection } from './DeleteAccountSection'
import type { Profile, UserLevel } from '@/types'

interface Props {
  profile: Profile
  myListings: MyListingItem[]
  matches: MatchItem[]
  sellerTransactions: SellerTransaction[]
  buyerTransactions: BuyerTransaction[]
  paymentInfo: PaymentInfo | null
  walletTransactions: WalletTxItem[]
  /** Transaktions-IDs, die der Nutzer bereits bewertet hat */
  reviewedTxIds: string[]
}

type View =
  | 'overview'
  | 'matches'
  | 'listings'
  | 'sales'
  | 'purchases'
  | 'payment'
  | 'wallet'
  | 'account'

export function ProfileDashboard({
  profile,
  myListings,
  matches,
  sellerTransactions,
  buyerTransactions,
  paymentInfo,
  walletTransactions,
  reviewedTxIds,
}: Props) {
  const [view, setView] = useState<View>('overview')

  const activeCount = myListings.filter((l) => l.status === 'active').length
  const dealsCount = sellerTransactions.filter(
    (t) => t.status === 'confirmed'
  ).length
  const pendingSales = sellerTransactions.filter(
    (t) => t.status === 'pending'
  ).length
  const activePurchases = buyerTransactions.filter(
    (t) => t.status === 'pending' || t.status === 'confirmed'
  ).length

  const copyReferral = async () => {
    if (!profile.referral_code) return
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/?ref=${profile.referral_code}`
    await navigator.clipboard.writeText(url)
    toast.success('Einladungs-Link kopiert! 🎁')
  }

  const tiles: { key: View; emoji: string; label: string; badge?: number }[] = [
    { key: 'matches', emoji: '🎯', label: 'Smart Matches', badge: matches.length },
    { key: 'listings', emoji: '📦', label: 'Meine Inserate' },
    { key: 'purchases', emoji: '🛒', label: 'Meine Käufe', badge: activePurchases },
    { key: 'sales', emoji: '💰', label: 'Meine Verkäufe', badge: pendingSales },
    { key: 'payment', emoji: '💳', label: 'Zahlungen' },
    { key: 'wallet', emoji: '🪙', label: 'Taler-Historie' },
    { key: 'account', emoji: '⚙️', label: 'Konto' },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-obsidian-4">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.username}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">
              👤
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold text-white">
            {profile.full_name || profile.username}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
            <span>⭐ {(profile.avg_rating ?? 0).toFixed(1)}</span>
            <span>·</span>
            <span>{profile.review_count ?? 0} Bewertungen</span>
          </div>
        </div>
        <LevelBadge
          level={profile.level as UserLevel | null}
          xp={profile.xp_points ?? 0}
        />
      </div>

      {/* XP-Fortschritt */}
      <div className="rounded-2xl border border-glass-border bg-obsidian-3 p-4">
        <XPBar xp={profile.xp_points ?? 0} />
      </div>

      {/* Pioneer-Badge */}
      {profile.pioneer_badge && (
        <div className="rounded-2xl border border-gold/60 bg-gold/10 p-4 text-center shadow-gold">
          <p className="font-display font-bold text-gold">
            🏆 Pionier der ersten Stunde
          </p>
        </div>
      )}

      {/* Stats-Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* credits ist in Rappen (1 Taler = 100) → für Anzeige in Taler umrechnen */}
        <Stat label="Uri-Taler" value={((profile.credits ?? 0) / 100).toFixed(2)} />
        <Stat label="Deals" value={String(dealsCount)} />
        <Stat label="Aktive Inserate" value={String(activeCount)} />
      </div>

      {/* Quick-Actions */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            onClick={() => setView(tile.key)}
            className={`relative rounded-2xl border p-4 text-left transition ${
              view === tile.key
                ? 'border-gold/50 bg-gold/10'
                : 'border-glass-border bg-obsidian-3 hover:border-white/20'
            }`}
          >
            <div className="text-2xl">{tile.emoji}</div>
            <p className="mt-1 font-display font-bold text-white">{tile.label}</p>
            {tile.badge ? (
              <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-obsidian">
                {tile.badge}
              </span>
            ) : null}
          </button>
        ))}
        <button
          onClick={copyReferral}
          className="rounded-2xl border border-glass-border bg-obsidian-3 p-4 text-left transition hover:border-white/20"
        >
          <div className="text-2xl">🎁</div>
          <p className="mt-1 font-display font-bold text-white">
            Freunde einladen
          </p>
        </button>
      </div>

      {/* Detail-Ansichten */}
      {view !== 'overview' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">
              {view === 'matches' && '🎯 Smart Matches'}
              {view === 'listings' && '📦 Meine Inserate'}
              {view === 'purchases' && '🛒 Meine Käufe'}
              {view === 'sales' && '💰 Meine Verkäufe'}
              {view === 'payment' && '💳 Zahlungen'}
              {view === 'wallet' && '🪙 Taler-Historie'}
              {view === 'account' && '⚙️ Konto'}
            </h2>
            <button
              onClick={() => setView('overview')}
              className="text-sm text-white/50 hover:text-white"
            >
              Schliessen
            </button>
          </div>

          {view === 'matches' && <SmartMatchList matches={matches} />}
          {view === 'listings' && <MyListings listings={myListings} />}
          {view === 'purchases' && (
            <BuyerDashboard
              transactions={buyerTransactions}
              reviewedTxIds={reviewedTxIds}
            />
          )}
          {view === 'sales' && (
            <SellerDashboard
              transactions={sellerTransactions}
              credits={profile.credits ?? 0}
              reviewedTxIds={reviewedTxIds}
            />
          )}
          {view === 'payment' && <PaymentInfoForm initial={paymentInfo} />}
          {view === 'wallet' && <TalerHistory items={walletTransactions} />}
          {view === 'account' && (
            <div className="space-y-6">
              <EditProfileForm profile={profile} />
              <DeleteAccountSection />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-glass-border bg-obsidian-3 p-4 text-center">
      <p className="font-display text-2xl font-bold text-gold">{value}</p>
      <p className="mt-1 text-xs text-white/60">{label}</p>
    </div>
  )
}
