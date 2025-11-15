// --- Core Data Structures ---

export interface Contributor {
  id?: string; // Unique identifier for each contributor row
  name: string; // Nome_original
  cleanedName?: string; // Nome_limpo (for display)
  normalizedName?: string; // Nome_normalizado (for matching)
  cpf?: string;
  date?: string;
  amount?: number;
}

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

export interface Transaction {
  date: string;
  description: string;
  cleanedDescription?: string;
  amount: number;
  id: string;
}

export interface ContributorFile {
    church: Church;
    contributors: Contributor[];
}

export interface LearnedAssociation {
  id?: string;
  normalizedDescription: string;
  contributorNormalizedName: string;
  churchId: string;
  user_id?: string;
}

export interface SourceFile {
    churchId: string;
    content: string;
    fileName: string;
}

export interface SavedReport {
    id: string;
    name: string;
    createdAt: string;
    recordCount: number;
    data: {
        results: MatchResult[];
        sourceFiles: SourceFile[];
        bankStatementFile?: { bankId: string, content: string, fileName: string } | null;
    };
    user_id: string;
}

// --- Reconciliation and Matching ---

export type MatchMethod = 'AUTOMATIC' | 'MANUAL' | 'LEARNED' | 'AI';

export interface MatchResult {
  transaction: Transaction;
  contributor: Contributor | null;
  status: 'IDENTIFICADO' | 'NÃO IDENTIFICADO';
  church: Church;
  matchMethod?: MatchMethod;
  similarity?: number;
  contributorAmount?: number;
  divergence?: {
    type: 'CHURCH_MISMATCH';
    expectedChurch: Church;
    actualChurch: Church;
  };
}

// --- Application UI State Types ---

export type ViewType = 'dashboard' | 'upload' | 'reports' | 'settings' | 'cadastro' | 'search' | 'savedReports';

export type Theme = 'light' | 'dark';

export type Language = 'pt' | 'en' | 'es';

export type SavingReportState = {
    type: 'global' | 'group' | 'search';
    groupName?: string;
    results: MatchResult[];
};

export type ChurchFormData = Omit<Church, 'id'>;

export type SettingsTab = 'preferences' | 'automation';

export interface DeletingItem {
  type: 'bank' | 'church' | 'association' | 'all-data' | 'uploaded-files' | 'match-results' | 'learned-associations' | 'report-group' | 'report-saved' | 'report-row';
  id: string;
  name: string;
  meta?: {
    reportType?: 'income' | 'expenses';
  }
}

export type ComparisonType = 'income' | 'expenses' | 'both';

export interface SearchFilters {
    dateRange: {
        start: string | null;
        end: string | null;
    };
    valueFilter: {
        operator: 'any' | 'exact' | 'gt' | 'lt' | 'between';
        value1: number | null;
        value2: number | null;
    };
    transactionType: 'all' | 'income' | 'expenses';
    reconciliationStatus: 'all' | 'confirmed_any' | 'confirmed_auto' | 'confirmed_manual' | 'unconfirmed';
    filterBy: 'none' | 'church' | 'contributor';
    churchIds: string[];
    contributorName: string;
}


// --- New Type for Grouped Reports ---
export type GroupedReportData = Record<string, MatchResult[]>;