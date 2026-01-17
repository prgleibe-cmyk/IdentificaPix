
import { MatchResult, Transaction } from './domain';

export type ViewType = 'dashboard' | 'upload' | 'cadastro' | 'reports' | 'search' | 'savedReports' | 'settings' | 'admin' | 'smart_analysis' | 'lancamentoAutomatico';
export type Theme = 'light' | 'dark';
export type Language = 'pt' | 'en' | 'es';

// Added to fix "Module 'types' has no exported member 'SettingsTab'"
export type SettingsTab = 'params' | 'associations' | 'preferences' | 'automation';

export interface DeletingItem {
  type: 'bank' | 'church' | 'report-saved' | 'report-row' | 'report-group' | 'uploaded-files' | 'match-results' | 'learned-associations' | 'all-data';
  id: string;
  name: string;
  meta?: any;
}

export interface SavingReportState {
  type: 'global' | 'group' | 'search' | 'spreadsheet';
  results: MatchResult[];
  groupName: string;
  spreadsheetData?: any;
}

export interface SearchFilters {
  dateRange: { start: string | null; end: string | null };
  valueFilter: { operator: 'any' | 'exact' | 'gt' | 'lt' | 'between'; value1: number | null; value2: number | null };
  transactionType: 'all' | 'income' | 'expenses';
  reconciliationStatus: 'all' | 'confirmed_any' | 'confirmed_auto' | 'confirmed_manual' | 'unconfirmed';
  filterBy: 'none' | 'church' | 'contributor';
  churchIds: string[];
  contributorName: string;
  reportId: string | null;
}
