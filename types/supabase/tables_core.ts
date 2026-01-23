import { Json } from './base';

export interface AdminConfigTable {
  Row: { id: string; key: string; value: Json; updated_at: string }
  Insert: { id?: string; key: string; value: Json; updated_at?: string }
  Update: { id?: string; key?: string; value?: Json; updated_at?: string }
}

export interface BanksTable {
  Row: { created_at: string; id: string; name: string; user_id: string | null }
  Insert: { created_at?: string; id?: string; name: string; user_id?: string | null }
  Update: { created_at?: string; id?: string; name?: string; user_id?: string | null }
  Relationships: [{
    foreignKeyName: "banks_user_id_fkey"
    columns: ["user_id"]
    isOneToOne: false
    referencedRelation: "users"
    referencedColumns: ["id"]
  }]
}

export interface ChurchesTable {
  Row: { address: string; created_at: string; id: string; logoUrl: string; name: string; pastor: string; user_id: string | null }
  Insert: { address: string; created_at?: string; id?: string; logoUrl: string; name: string; pastor: string; user_id?: string | null }
  Update: { address?: string; created_at?: string; id?: string; logoUrl?: string; name?: string; pastor?: string; user_id?: string | null }
  Relationships: [{
    foreignKeyName: "churches_user_id_fkey"
    columns: ["user_id"]
    isOneToOne: false
    referencedRelation: "users"
    referencedColumns: ["id"]
  }]
}

export interface ProfilesTable {
  Row: {
    id: string; email: string | null; name: string | null; created_at: string;
    subscription_status: 'trial' | 'active' | 'expired' | 'lifetime';
    trial_ends_at: string | null; subscription_ends_at: string | null;
    is_blocked: boolean; is_lifetime: boolean; custom_price: number | null;
    limit_ai: number | null; usage_ai: number; max_churches: number | null; max_banks: number | null;
  }
  Insert: {
    id: string; email?: string | null; name?: string | null; created_at?: string;
    subscription_status?: 'trial' | 'active' | 'expired' | 'lifetime';
    trial_ends_at?: string | null; subscription_ends_at?: string | null;
    is_blocked?: boolean; is_lifetime?: boolean; custom_price?: number | null;
    limit_ai?: number | null; usage_ai?: number; max_churches?: number | null; max_banks?: number | null;
  }
  Update: {
    id?: string; email?: string | null; name?: string | null; created_at?: string;
    subscription_status?: 'trial' | 'active' | 'expired' | 'lifetime';
    trial_ends_at?: string | null; subscription_ends_at?: string | null;
    is_blocked?: boolean; is_lifetime?: boolean; custom_price?: number | null;
    limit_ai?: number | null; usage_ai?: number; max_churches?: number | null; max_banks?: number | null;
  }
  Relationships: [{
    foreignKeyName: "profiles_id_fkey"
    columns: ["id"]
    isOneToOne: true
    referencedRelation: "users"
    referencedColumns: ["id"]
  }]
}
