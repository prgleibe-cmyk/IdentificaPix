
export type Language = 'pt' | 'en' | 'es';
export type Theme = 'light' | 'dark';
export type ViewType = 'dashboard' | 'upload' | 'cadastro' | 'reports' | 'search' | 'savedReports' | 'settings' | 'admin' | 'smart_analysis';
export type SettingsTab = 'params' | 'associations' | 'preferences' | 'automation';
export type MatchMethod = 'AUTOMATIC' | 'MANUAL' | 'LEARNED' | 'AI' | 'TEMPLATE';
export type ComparisonType = 'income' | 'expenses' | 'both';

export interface Bank {
  id: string;
  name: string;
}

export interface Church {
  id: string;
  name: string;
  address: string;
  logoUrl: string;
  pastor: string;
}

export interface ChurchFormData {
  name: string;
  address: string;
  pastor: string;
  logoUrl: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  originalAmount?: string;
  cleanedDescription?: string;
  contributionType?: string;
}

export interface Contributor {
  id?: string;
  name: string;
  cleanedName?: string;
  normalizedName?: string;
  amount: number;
  date?: string;
  originalAmount?: string;
  contributionType?: string;
}

export interface MatchResult {
  transaction: Transaction;
  contributor: Contributor | null;
  status: 'IDENTIFICADO' | 'NÃO IDENTIFICADO' | 'PENDENTE';
  church: Church;
  matchMethod?: MatchMethod;
  similarity?: number;
  contributorAmount?: number;
  contributionType?: string;
  divergence?: {
    expectedChurch: Church;
    actualChurch: Church;
  };
  suggestion?: Contributor; // Sugestão de melhor match (mesmo abaixo do threshold)
}

export interface ContributorFile {
  church: Church;
  contributors: Contributor[];
}

export interface GroupedReportData {
  [churchId: string]: MatchResult[];
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

export interface SavedReport {
  id: string;
  name: string;
  createdAt: string;
  recordCount: number;
  user_id: string;
  data: {
    results: MatchResult[];
    sourceFiles: any[];
    bankStatementFile: any;
  } | null;
}

export interface SavingReportState {
  type: 'global' | 'group' | 'search';
  results: MatchResult[];
  groupName: string;
}

export interface LearnedAssociation {
  id?: string;
  normalizedDescription: string;
  contributorNormalizedName: string;
  churchId: string;
  user_id: string;
}

export interface DeletingItem {
  type: 'bank' | 'church' | 'report-saved' | 'report-row' | 'report-group' | 'uploaded-files' | 'match-results' | 'learned-associations' | 'all-data';
  id: string;
  name: string;
  meta?: any;
}

export interface SubscriptionStatus {
  plan: 'trial' | 'active' | 'expired' | 'lifetime';
  daysRemaining: number;
  totalDays: number;
  isExpired: boolean;
  isBlocked: boolean;
  isLifetime: boolean;
  aiLimit: number;
  aiUsage: number;
  maxChurches: number;
  maxBanks: number;
  customPrice?: number;
}

export interface ReceiptAnalysisResult {
  isValid: boolean;
  amount?: number;
  date?: string;
  recipient?: string;
  sender?: string;
  reason?: string;
}

export interface FileModel {
  id: string;
  name: string;
  user_id: string;
  version: number;
  lineage_id: string;
  is_active: boolean;
  
  fingerprint: {
    columnCount: number;
    delimiter: string;
    headerHash: string | null;
    dataTopology: string;      
  };
  
  mapping: {
    dateColumnIndex: number;
    descriptionColumnIndex: number;
    amountColumnIndex: number;
    typeColumnIndex?: number;
    skipRowsStart: number;
    skipRowsEnd: number;
    decimalSeparator: ',' | '.';
    thousandsSeparator: '.' | ',' | '';
  };

  parsingRules: {
    ignoredKeywords: string[]; 
    rowFilters: string[];      
    dateFormat?: string;
  };
  
  snippet?: string; // Novo campo para armazenar as primeiras linhas do arquivo
  createdAt: string;
  lastUsedAt?: string;
}
