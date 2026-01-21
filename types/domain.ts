
import { FileModel } from '../types';

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
  paymentMethod?: string; // Nova Coluna: FORMA
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
  paymentMethod?: string; // Suporte na lista de membros
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
  paymentMethod?: string; // FORMA consolidada
  divergence?: {
    expectedChurch: Church;
    actualChurch: Church;
  };
  suggestion?: Contributor;
  _injectedId?: string;
}

export interface LearnedAssociation {
  id?: string;
  normalizedDescription: string;
  contributorNormalizedName: string;
  churchId: string;
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
