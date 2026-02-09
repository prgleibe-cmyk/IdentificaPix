export enum ReconciliationStatus {
  IDENTIFIED = 'IDENTIFICADO',
  UNIDENTIFIED = 'NÃO IDENTIFICADO',
  PENDING = 'PENDENTE' // Ghost records
}

export enum MatchMethod {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
  LEARNED = 'LEARNED',
  AI = 'AI',
  TEMPLATE = 'TEMPLATE'
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
  rawDescription: string;
  amount: number;
  originalAmount?: string;
  cleanedDescription?: string;
  contributionType?: string;
  paymentMethod?: string;
  bank_id?: string;
  // Fix: Added isConfirmed to Transaction interface to resolve property missing errors
  isConfirmed?: boolean;
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
  paymentMethod?: string;
  _churchName?: string;
  _churchId?: string;
  _internalId?: string;
}

export interface MatchResult {
  transaction: Transaction;
  contributor: Contributor | null;
  status: ReconciliationStatus;
  church: Church;
  matchMethod?: MatchMethod;
  similarity?: number;
  contributorAmount?: number;
  contributionType?: string;
  paymentMethod?: string;
  isConfirmed?: boolean;
  divergence?: {
    expectedChurch: Church;
    actualChurch: Church;
  };
  suggestion?: Contributor;
  _injectedId?: string;
  launchedAt?: string;
}

export interface LearnedAssociation {
  id?: string;
  normalizedDescription: string;
  contributorNormalizedName: string;
  churchId: string;
  bankId: string;
  user_id: string;
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
  status: 'draft' | 'approved';
  approvedBy?: string;
  approvedAt?: string;
  fingerprint: {
    columnCount: number;
    delimiter: string;
    headerHash: string | null;
    dataTopology: string;
    canonicalSignature?: string;
    structuralPattern?: string;
  };
  mapping: {
    extractionMode?: 'COLUMNS' | 'BLOCK';
    blockContract?: string;
    dateColumnIndex: number;
    descriptionColumnIndex: number;
    amountColumnIndex: number;
    paymentMethodColumnIndex?: number;
    typeColumnIndex?: number;
    skipRowsStart: number;
    skipRowsEnd: number;
    decimalSeparator: ',' | '.';
    thousandsSeparator: '.' | ',' | '';
    ignoredKeywords?: string[];
  };
  parsingRules: {
    ignoredKeywords: string[];
    rowFilters: string[];
    dateFormat?: string;
  };
  snippet?: string;
  createdAt: string;
  lastUsedAt?: string;
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
    spreadsheet?: SpreadsheetData;
  } | null;
}

export interface SpreadsheetData {
  title: string;
  logo: string | null;
  columns: ColumnDef[];
  rows: ManualRow[];
  signatures: string[];
}

export interface ManualRow {
  id: string;
  description: string;
  income: number;
  expense: number;
  qty: number;
  [key: string]: any;
}

export interface ColumnDef {
  id: string;
  label: string;
  type: 'text' | 'currency' | 'number' | 'computed' | 'index';
  editable: boolean;
  removable: boolean;
  visible: boolean;
}