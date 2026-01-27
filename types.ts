
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
