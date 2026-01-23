import { Json } from './supabase/base';
import * as Core from './supabase/tables_core';
import * as App from './supabase/tables_app';

export type { Json };

export type Database = {
  public: {
    Tables: {
      admin_config: Core.AdminConfigTable;
      automation_macros: App.AutomationMacrosTable;
      banks: Core.BanksTable;
      churches: Core.ChurchesTable;
      consolidated_transactions: App.ConsolidatedTransactionsTable;
      file_models: App.FileModelsTable;
      learned_associations: App.LearnedAssociationsTable;
      saved_reports: App.SavedReportsTable;
      profiles: Core.ProfilesTable;
      payments: App.PaymentsTable;
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
