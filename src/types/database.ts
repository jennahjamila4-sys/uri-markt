export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          gemeinde?: string | null
          xp_points?: number | null
          level?: string | null
          credits?: number | null
          avg_rating?: number | null
          review_count?: number | null
          pioneer_badge?: boolean | null
          strikes?: number | null
          is_banned?: boolean | null
          can_buy?: boolean | null
          referral_code?: string | null
          preferred_categories?: string[] | null
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          gemeinde?: string | null
          xp_points?: number | null
          level?: string | null
          credits?: number | null
          avg_rating?: number | null
          review_count?: number | null
          pioneer_badge?: boolean | null
          strikes?: number | null
          is_banned?: boolean | null
          can_buy?: boolean | null
          referral_code?: string | null
          preferred_categories?: string[] | null
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          gemeinde?: string | null
          xp_points?: number | null
          level?: string | null
          credits?: number | null
          avg_rating?: number | null
          review_count?: number | null
          pioneer_badge?: boolean | null
          strikes?: number | null
          is_banned?: boolean | null
          can_buy?: boolean | null
          referral_code?: string | null
          preferred_categories?: string[] | null
        }
      }
      listings: {
        Row: {
          id: string
          title: string
          description?: string | null
          type: string
          status: string
          price?: number | null
          price_type: string
          category: string
          gemeinde: string
          image_url?: string | null
          image_urls?: string[] | null
          is_boosted?: boolean | null
          boost_expires_at?: string | null
          fomo_expires_at?: string | null
          views?: number | null
          created_at?: string | null
          user_id: string
          condition?: string | null
          pickup_available?: boolean | null
          shipping_available?: boolean | null
          shipping_cost?: number | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          type: string
          status?: string
          price?: number | null
          price_type: string
          category: string
          gemeinde: string
          image_url?: string | null
          image_urls?: string[] | null
          is_boosted?: boolean | null
          boost_expires_at?: string | null
          fomo_expires_at?: string | null
          views?: number | null
          created_at?: string | null
          user_id: string
          condition?: string | null
          pickup_available?: boolean | null
          shipping_available?: boolean | null
          shipping_cost?: number | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          type?: string
          status?: string
          price?: number | null
          price_type?: string
          category?: string
          gemeinde?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_boosted?: boolean | null
          boost_expires_at?: string | null
          fomo_expires_at?: string | null
          views?: number | null
          created_at?: string | null
          user_id?: string
          condition?: string | null
          pickup_available?: boolean | null
          shipping_available?: boolean | null
          shipping_cost?: number | null
        }
      }
      transactions: { Row: { id: string } }
      event_bookings: { Row: { id: string } }
      notifications: { Row: { id: string } }
      wallet_transactions: { Row: { id: string } }
      smart_matches: { Row: { id: string } }
      reviews: { Row: { id: string } }
    }
  }
}
