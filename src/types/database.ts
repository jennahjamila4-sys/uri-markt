export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      event_bookings: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string | null
          seats: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id?: string | null
          seats?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string | null
          seats?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          boost_expires_at: string | null
          category: string
          created_at: string | null
          description: string | null
          fomo_expires_at: string | null
          gemeinde: string
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_boosted: boolean | null
          price: number | null
          price_type: string
          status: string
          title: string
          type: string
          user_id: string
          views: number | null
        }
        Insert: {
          boost_expires_at?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          fomo_expires_at?: string | null
          gemeinde: string
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_boosted?: boolean | null
          price?: number | null
          price_type: string
          status?: string
          title: string
          type: string
          user_id: string
          views?: number | null
        }
        Update: {
          boost_expires_at?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          fomo_expires_at?: string | null
          gemeinde?: string
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_boosted?: boolean | null
          price?: number | null
          price_type?: string
          status?: string
          title?: string
          type?: string
          user_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          read: boolean | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          read?: boolean | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          read?: boolean | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          avg_rating: number | null
          can_buy: boolean | null
          created_at: string | null
          credits: number | null
          full_name: string | null
          gemeinde: string | null
          id: string
          is_banned: boolean | null
          level: string | null
          pioneer_badge: boolean | null
          preferred_categories: string[] | null
          referral_code: string | null
          review_count: number | null
          strikes: number | null
          username: string
          xp_points: number | null
        }
        Insert: {
          avatar_url?: string | null
          avg_rating?: number | null
          can_buy?: boolean | null
          created_at?: string | null
          credits?: number | null
          full_name?: string | null
          gemeinde?: string | null
          id?: string
          is_banned?: boolean | null
          level?: string | null
          pioneer_badge?: boolean | null
          preferred_categories?: string[] | null
          referral_code?: string | null
          review_count?: number | null
          strikes?: number | null
          username: string
          xp_points?: number | null
        }
        Update: {
          avatar_url?: string | null
          avg_rating?: number | null
          can_buy?: boolean | null
          created_at?: string | null
          credits?: number | null
          full_name?: string | null
          gemeinde?: string | null
          id?: string
          is_banned?: boolean | null
          level?: string | null
          pioneer_badge?: boolean | null
          preferred_categories?: string[] | null
          referral_code?: string | null
          review_count?: number | null
          strikes?: number | null
          username?: string
          xp_points?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          listing_id: string | null
          rating: number | null
          reviewee_id: string | null
          reviewer_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          rating?: number | null
          reviewee_id?: string | null
          reviewer_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          rating?: number | null
          reviewee_id?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number | null
          buyer_id: string | null
          created_at: string | null
          id: string
          listing_id: string | null
          seller_id: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          seller_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          seller_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_log: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          idempotency_key: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_xp: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      process_transaction_commission: {
        Args: { p_tx_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
