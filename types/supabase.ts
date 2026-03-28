import { Json } from './supabase/base';
import { AdminConfigTable, BanksTable, ChurchesTable, ProfilesTable } from './supabase/tables_core';
import { AutomationMacrosTable, ConsolidatedTransactionsTable, FileModelsTable, LearnedAssociationsTable, SavedReportsTable, PaymentsTable } from './supabase/tables_app';

export type { Json };

export type Database = {
  public: {
    Tables: {
      admin_config: AdminConfigTable;
      automation_macros: AutomationMacrosTable;
      banks: BanksTable;
      churches: ChurchesTable;
      consolidated_transactions: ConsolidatedTransactionsTable;
      file_models: FileModelsTable;
      learned_associations: LearnedAssociationsTable;
      saved_reports: SavedReportsTable;
      profiles: ProfilesTable;
      payments: PaymentsTable;
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_pending_transactions: {
        Args: { target_bank_id?: string }
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
