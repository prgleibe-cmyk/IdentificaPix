
export * from './types/domain';
export * from './types/ui';
export * from './types/api';

export type ComparisonType = 'income' | 'expenses' | 'both';

export interface ContributorFile {
  church: any; 
  contributors: any[];
  fileName?: string;
  churchId?: string;
}

export interface GroupedReportData {
  [churchId: string]: any[]; 
}
