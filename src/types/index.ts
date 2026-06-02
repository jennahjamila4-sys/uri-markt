export type { Database } from './database'
import type { Database } from './database'

type T<N extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][N]['Row']

export type Profile = T<'profiles'>
export type Listing = T<'listings'>
export type Transaction = T<'transactions'>
export type EventBooking = T<'event_bookings'>
export type Notification = T<'notifications'>
export type WalletTransaction = T<'wallet_transactions'>
export type SmartMatch = T<'smart_matches'>
export type Review = T<'reviews'>

export type ListingWithProfile = Listing & {
  profiles: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'avg_rating' | 'level'>
}

export type ListingType = 'Angebot' | 'Gesuch' | 'Event'
export type ListingStatus = 'active' | 'reserved' | 'sold' | 'draft' | 'cancelled'
export type UserLevel = 'Beobachter' | 'Dorf-Händler' | 'Lokal-Matador' | 'Kantons-Legende' | 'Gotthard-Titan'
export type CommitmentType = 'waitlist' | 'reservation' | 'deposit' | 'ticket'

export const GEMEINDEN = [
  'Altdorf','Bürglen','Schattdorf','Attinghausen','Erstfeld',
  'Silenen','Amsteg','Gurtnellen','Wassen','Göschenen',
  'Andermatt','Realp','Hospental','Seedorf','Bauen',
  'Isenthal','Seelisberg','Isleten','Flüelen','Sisikon',
] as const

export const CATEGORIES = [
  { id: 'elektronik', label: 'Elektronik', emoji: '📱' },
  { id: 'moebel', label: 'Möbel & Wohnen', emoji: '🛋️' },
  { id: 'sport', label: 'Sport & Outdoor', emoji: '⛷️' },
  { id: 'kleider', label: 'Kleider & Mode', emoji: '👗' },
  { id: 'fahrzeuge', label: 'Fahrzeuge', emoji: '🚗' },
  { id: 'garten', label: 'Garten & Pflanzen', emoji: '🌱' },
  { id: 'kindersachen', label: 'Kinder & Baby', emoji: '🧸' },
  { id: 'buecher', label: 'Bücher & Medien', emoji: '📚' },
  { id: 'werkzeug', label: 'Werkzeug & Maschinen', emoji: '🔧' },
  { id: 'dienstleistungen', label: 'Dienstleistungen', emoji: '🔨' },
  { id: 'immobilien', label: 'Immobilien', emoji: '🏠' },
  { id: 'lebensmittel', label: 'Lebensmittel & Regional', emoji: '🧀' },
  { id: 'events', label: 'Events & Tickets', emoji: '🎟️' },
  { id: 'jobs', label: 'Jobs & Stellen', emoji: '💼' },
  { id: 'haustiere', label: 'Haustiere', emoji: '🐾' },
  { id: 'sonstiges', label: 'Sonstiges', emoji: '📦' },
] as const

export type GemeindeValue = typeof GEMEINDEN[number]
export type CategoryId = typeof CATEGORIES[number]['id']
