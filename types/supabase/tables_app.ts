import { Json } from './base';

export interface AutomationMacrosTable {
  Row: { id: string; user_id: string; bank_id: string | null; name: string; steps: Json; target_url: string | null; created_at: string }
  Insert: { id?: string; user_id: string; bank_id?: string | null; name: string; steps: Json; target_url?: string | null; created_at?: string }
  Update: { id?: string; user_id?: string; bank_id?: string | null; name?: string; steps?: Json; target_url?: string | null; created_at?: string }
}

export interface ConsolidatedTransactionsTable {
  Row: { id: string; created_at: string; transaction_date: string; amount: number; description: string; type: 'income' | 'expense'; pix_key: string | null; source: 'file' | 'gmail'; user_id: string; status: 'pending' | 'identified' | 'resolved'; bank_id: string | null; row_hash: string | null; is_confirmed: boolean }
  Insert: { id?: string; created_at?: string; transaction_date: string; amount: number; description: string; type: 'income' | 'expense'; pix_key?: string | null; source?: 'file' | 'gmail'; user_id: string; status?: 'pending' | 'identified' | 'resolved'; bank_id?: string | null; row_hash?: string | null; is_confirmed?: boolean }
  Update: { id?: string; created_at?: string; transaction_date?: string; amount?: number; description?: string; type?: 'income' | 'expense'; pix_key?: string | null; source?: 'file' | 'gmail'; user_id?: string | null; status?: 'pending' | 'identified' | 'resolved'; bank_id?: string | null; row_hash?: string | null; is_confirmed?: boolean }
  Relationships: [
    { foreignKeyName: "consolidated_transactions_user_id_fkey", columns: ["user_id"], isOneToOne: false, referencedRelation: "users", referencedColumns: ["id"] },
    { foreignKeyName: "consolidated_transactions_bank_id_fkey", columns: ["bank_id"], isOneToOne: false, referencedRelation: "banks", referencedColumns: ["id"] }
  ]
}

export interface FileModelsTable {
  Row: { id: string; created_at: string; name: string; user_id: string; version: number; lineage_id: string; is_active: boolean; status: 'draft' | 'approved'; approved_by: string | null; approved_at: string | null; fingerprint: Json; mapping: Json; parsing_rules: Json; snippet: string | null; last_used_at: string | null }
  Insert: { id?: string; created_at?: string; name: string; user_id: string; version: number; lineage_id: string; is_active?: boolean; status?: 'draft' | 'approved'; approved_by?: string | null; approved_at?: string | null; fingerprint: Json; mapping: Json; parsing_rules: Json; snippet?: string | null; last_used_at?: string | null }
  Update: { id?: string; created_at?: string; name?: string; user_id?: string; version?: number; lineage_id?: string; is_active?: boolean; status?: 'draft' | 'approved'; approved_by?: string | null; approved_at?: string | null; fingerprint?: Json; mapping?: Json; parsing_rules?: Json; snippet?: string | null; last_used_at?: string | null }
  Relationships: [{ foreignKeyName: "file_models_user_id_fkey", columns: ["user_id"], isOneToOne: false, referencedRelation: "users", referencedColumns: ["id"] }]
}

export interface LearnedAssociationsTable {
  Row: { id: string; created_at: string; user_id: string; normalized_description: string; contributor_normalized_name: string; church_id: string }
  Insert: { id?: string; created_at?: string; user_id: string; normalized_description: string; contributor_normalized_name: string; church_id: string }
  Update: { id?: string; created_at?: string; user_id?: string; normalized_description?: string; contributor_normalized_name?: string; church_id?: string }
  Relationships: [
    { foreignKeyName: "learned_associations_user_id_fkey", columns: ["user_id"], isOneToOne: false, referencedRelation: "users", referencedColumns: ["id"] },
    { foreignKeyName: "learned_associations_church_id_fkey", columns: ["church_id"], isOneToOne: false, referencedRelation: "churches", referencedColumns: ["id"] }
  ]
}

export interface SavedReportsTable {
  Row: { created_at: string; data: Json; id: string; name: string; record_count: number; user_id: string }
  Insert: { created_at?: string; data: Json; id?: string; name: string; record_count: number; user_id: string }
  Update: { created_at?: string; data?: Json; id?: string; name?: string; record_count?: number; user_id?: string }
  Relationships: [{ foreignKeyName: "saved_reports_user_id_fkey", columns: ["user_id"], isOneToOne: false, referencedRelation: "users", referencedColumns: ["id"] }]
}

export interface PaymentsTable {
  Row: { id: string; user_id: string; amount: number; status: 'pending' | 'approved' | 'rejected' | 'confirmed'; receipt_url: string | null; notes: string | null; created_at: string }
  Insert: { id?: string; user_id: string; amount: number; status?: 'pending' | 'approved' | 'rejected' | 'confirmed'; receipt_url?: string | null; notes?: string | null; created_at?: string }
  Update: { id?: string; user_id?: string; amount?: number; status?: 'pending' | 'approved' | 'rejected' | 'confirmed'; receipt_url?: string | null; notes?: string | null; created_at?: string }
  Relationships: [{ foreignKeyName: "payments_user_id_fkey", columns: ["user_id"], isOneToOne: false, referencedRelation: "users", referencedColumns: ["id"] }]
}