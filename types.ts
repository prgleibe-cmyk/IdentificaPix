
export * from './types/domain';
export * from './types/ui';
export * from './types/api';

// Tipos Complexos ou que dependem de vários módulos mantidos aqui temporariamente
export type ComparisonType = 'income' | 'expenses' | 'both';

export interface ContributorFile {
  church: any; // Church from domain
  contributors: any[]; // Contributor from domain
  fileName?: string;
  churchId?: string;
}

export interface GroupedReportData {
  [churchId: string]: any[]; // MatchResult[] from domain
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
    results: any[]; // MatchResult[]
    sourceFiles: any[];
    bankStatementFile: any;
    spreadsheet?: any; // SpreadsheetData
  } | null;
}

export interface SpreadsheetData {
  title: string;
  logo: string | null;
  columns: any[]; // ColumnDef
  rows: any[]; // ManualRow
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
