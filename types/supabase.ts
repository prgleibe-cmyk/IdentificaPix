
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_config: {
        Row: {
          id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          updated_at?: string
        }
      }
      banks: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string
          created_at: string
          id: string
          logoUrl: string
          name: string
          pastor: string
          user_id: string | null
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          logoUrl: string
          name: string
          pastor: string
          user_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          logoUrl?: string
          name?: string
          pastor?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "churches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidated_transactions: {
        Row: {
          id: string
          created_at: string
          transaction_date: string
          amount: number
          description: string
          type: 'income' | 'expense'
          pix_key: string | null
          source: 'file' | 'gmail'
          user_id: string
          status: 'pending' | 'identified' | 'resolved'
          bank_id: string | null // NOVO CAMPO
        }
        Insert: {
          id?: string
          created_at?: string
          transaction_date: string
          amount: number
          description: string
          type: 'income' | 'expense'
          pix_key?: string | null
          source: 'file' | 'gmail'
          user_id: string
          status?: 'pending' | 'identified' | 'resolved'
          bank_id?: string | null // NOVO CAMPO
        }
        Update: {
          id?: string
          created_at?: string
          transaction_date?: string
          amount?: number
          description?: string
          type?: 'income' | 'expense'
          pix_key?: string | null
          source?: 'file' | 'gmail'
          user_id?: string
          status?: 'pending' | 'identified' | 'resolved'
          bank_id?: string | null // NOVO CAMPO
        }
        Relationships: [
          {
            foreignKeyName: "consolidated_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidated_transactions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          }
        ]
      }
      file_models: {
        Row: {
          id: string
          created_at: string
          name: string
          user_id: string
          version: number
          lineage_id: string
          is_active: boolean
          status: 'draft' | 'approved'
          approved_by: string | null
          approved_at: string | null
          fingerprint: Json
          mapping: Json
          parsing_rules: Json
          snippet: string | null
          last_used_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          user_id: string
          version: number
          lineage_id: string
          is_active?: boolean
          status?: 'draft' | 'approved'
          approved_by?: string | null
          approved_at?: string | null
          fingerprint: Json
          mapping: Json
          parsing_rules: Json
          snippet?: string | null
          last_used_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          user_id?: string
          version?: number
          lineage_id?: string
          is_active?: boolean
          status?: 'draft' | 'approved'
          approved_by?: string | null
          approved_at?: string | null
          fingerprint?: Json
          mapping?: Json
          parsing_rules?: Json
          snippet?: string | null
          last_used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      learned_associations: {
        Row: {
          id: string
          created_at: string
          user_id: string
          normalized_description: string
          contributor_normalized_name: string
          church_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          normalized_description: string
          contributor_normalized_name: string
          church_id: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          normalized_description?: string
          contributor_normalized_name?: string
          church_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learned_associations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learned_associations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          }
        ]
      }
      saved_reports: {
        Row: {
          created_at: string
          data: Json
          id: string
          name: string
          record_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          name: string
          record_count: number
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          name?: string
          record_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          name: string | null
          subscription_status: 'trial' | 'active' | 'expired' | 'lifetime'
          trial_ends_at: string | null
          subscription_ends_at: string | null
          is_blocked: boolean
          is_lifetime: boolean
          created_at: string
          custom_price: number | null
          limit_ai: number | null
          usage_ai: number
          max_churches: number | null
          max_banks: number | null
        }
        Insert: {
          id: string
          email?: string | null
          name?: string | null
          subscription_status?: 'trial' | 'active' | 'expired' | 'lifetime'
          trial_ends_at?: string | null
          subscription_ends_at?: string | null
          is_blocked?: boolean
          is_lifetime?: boolean
          created_at?: string
          custom_price?: number | null
          limit_ai?: number | null
          usage_ai?: number
          max_churches?: number | null
          max_banks?: number | null
        }
        Update: {
          id?: string
          email?: string | null
          name?: string | null
          subscription_status?: 'trial' | 'active' | 'expired' | 'lifetime'
          trial_ends_at?: string | null
          subscription_ends_at?: string | null
          is_blocked?: boolean
          is_lifetime?: boolean
          created_at?: string
          custom_price?: number | null
          limit_ai?: number | null
          usage_ai?: number
          max_churches?: number | null
          max_banks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      payments: {
        Row: {
          id: string
          user_id: string
          amount: number
          status: 'pending' | 'approved' | 'rejected'
          receipt_url: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          status?: 'pending' | 'approved' | 'rejected'
          receipt_url?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          status?: 'pending' | 'approved' | 'rejected'
          receipt_url?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_pending_transactions: {
        Args: {
          target_bank_id?: string
        }
        Returns: void
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
