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
      comments: {
        Row: {
          censored_text: string | null
          created_at: string | null
          id: string
          listing_id: string
          text: string
          user_id: string
        }
        Insert: {
          censored_text?: string | null
          created_at?: string | null
          id?: string
          listing_id: string
          text: string
          user_id: string
        }
        Update: {
          censored_text?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          event_date: string | null
          event_location: string | null
          max_capacity: number | null
          current_bookings: number | null
          ticket_price: number | null
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
          event_date?: string | null
          event_location?: string | null
          max_capacity?: number | null
          current_bookings?: number | null
          ticket_price?: number | null
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
          event_date?: string | null
          event_location?: string | null
          max_capacity?: number | null
          current_bookings?: number | null
          ticket_price?: number | null
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
      profiles_private: {
        Row: {
          id: string
          iban: string | null
          twint_phone: string | null
          phone: string | null
          address: string | null
          show_iban: boolean
          show_twint: boolean
          show_phone: boolean
          show_address: boolean
        }
        Insert: {
          id: string
          iban?: string | null
          twint_phone?: string | null
          phone?: string | null
          address?: string | null
          show_iban?: boolean
          show_twint?: boolean
          show_phone?: boolean
          show_address?: boolean
        }
        Update: {
          id?: string
          iban?: string | null
          twint_phone?: string | null
          phone?: string | null
          address?: string | null
          show_iban?: boolean
          show_twint?: boolean
          show_phone?: boolean
          show_address?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          transaction_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          rating?: number | null
          reviewee_id?: string | null
          reviewer_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          rating?: number | null
          reviewee_id?: string | null
          reviewer_id?: string | null
          transaction_id?: string | null
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
      smart_matches: {
        Row: {
          created_at: string | null
          dismissed: boolean | null
          dismissed_at: string | null
          gesuch_id: string
          id: string
          matched_listing_id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dismissed?: boolean | null
          dismissed_at?: string | null
          gesuch_id: string
          id?: string
          matched_listing_id: string
          score?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          dismissed?: boolean | null
          dismissed_at?: string | null
          gesuch_id?: string
          id?: string
          matched_listing_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_matches_gesuch_id_fkey"
            columns: ["gesuch_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_matches_matched_listing_id_fkey"
            columns: ["matched_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          buyer_contact: string | null
          buyer_id: string
          commission: number
          completed_at: string | null
          confirmed_at: string | null
          created_at: string | null
          id: string
          listing_id: string
          no_show_reported_at: string | null
          payment_method: string | null
          seller_contact: string | null
          seller_id: string
          seller_completed_at: string | null
          buyer_completed_at: string | null
          status: string
        }
        Insert: {
          amount: number
          buyer_contact?: string | null
          buyer_id: string
          commission?: number
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          listing_id: string
          no_show_reported_at?: string | null
          payment_method?: string | null
          seller_contact?: string | null
          seller_id: string
          seller_completed_at?: string | null
          buyer_completed_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          buyer_contact?: string | null
          buyer_id?: string
          commission?: number
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string
          no_show_reported_at?: string | null
          payment_method?: string | null
          seller_contact?: string | null
          seller_id?: string
          seller_completed_at?: string | null
          buyer_completed_at?: string | null
          status?: string
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
        Returns: Json
      }
      calculate_level: {
        Args: { p_xp_points: number }
        Returns: string
      }
      create_buy_intent: {
        Args: {
          p_buyer_contact: string
          p_listing_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      complete_transaction: {
        Args: { p_transaction_id: string }
        Returns: {
          success: boolean
          status?: string
          buyer_completed?: boolean
          seller_completed?: boolean
          buyer_id?: string
          listing_id?: string
          error?: string
        }
      }
      escalate_no_show: {
        Args: { p_seller_id: string; p_transaction_id: string }
        Returns: { success: boolean; error?: string; message?: string }
      }
      get_transaction_contact: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      process_transaction_commission: {
        Args: { p_seller_id: string; p_transaction_id: string }
        Returns: {
          success: boolean
          error?: string
          message?: string
          amount?: number
          commission?: number
          balance?: number
          needed?: number
        }
      }
      send_notification: {
        Args: {
          p_listing_id?: string
          p_message: string
          p_recipient_id: string
          p_title: string
          p_type: string
        }
        Returns: Json
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
