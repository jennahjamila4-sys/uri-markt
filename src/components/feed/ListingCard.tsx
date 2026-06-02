'use client'
import Image from 'next/image'
import { Clock, MapPin } from 'lucide-react'
import type { ListingWithProfile } from '@/types'

interface ListingCardProps {
  listing: ListingWithProfile
  onClick?: () => void
}

export function ListingCard({ listing, onClick }: ListingCardProps) {
  const isSold = listing.status === 'sold'
  const price =
    listing.price_type === 'free'
      ? 'Gratis'
      : `CHF ${(listing.price || 0).toLocaleString('de-CH')}`

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-glass-border bg-obsidian-3 transition duration-300 hover:border-glass-strong"
    >
      <div className="relative aspect-video overflow-hidden bg-obsidian-4">
        {listing.image_url ? (
          <Image
            src={listing.image_url}
            alt={listing.title}
            fill
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">
            📦
          </div>
        )}
        {listing.is_boosted && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-gold px-2 py-1 text-[10px] font-display font-bold text-obsidian">
            ⚡ BOOST
          </div>
        )}
        {isSold && (
          <div className="absolute inset-0 flex items-center justify-center bg-uri-fomo/75 backdrop-blur-sm">
            <div className="text-center text-white">
              <div className="text-3xl mb-2">❌</div>
              <div className="text-sm font-bold">VERKAUFT</div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-display text-xl font-bold text-gold line-clamp-1">
              {price}
            </h3>
            <p className="line-clamp-2 text-sm text-white/80">{listing.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/60">
          <MapPin size={12} />
          <span>{listing.gemeinde}</span>
          <Clock size={12} className="ml-auto" />
          <span>
            {listing.created_at
              ? new Date(listing.created_at).toLocaleDateString('de-CH')
              : '-'}
          </span>
        </div>

        <div className="flex items-center gap-2 border-t border-glass-border pt-3">
          {listing.profiles?.avatar_url && (
            <Image
              src={listing.profiles.avatar_url}
              alt={listing.profiles.username}
              width={24}
              height={24}
              className="rounded-full"
            />
          )}
          <div className="flex-1">
            <p className="text-xs font-body text-white/80">
              {listing.profiles?.username}
            </p>
            {listing.profiles?.level && (
              <p className="text-xs text-gold font-display font-bold">
                {listing.profiles.level}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
