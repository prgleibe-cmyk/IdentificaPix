export enum ReconciliationStatus {
  IDENTIFIED = 'IDENTIFICADO',
  UNIDENTIFIED = 'NÃO IDENTIFICADO',
  PENDING = 'PENDENTE', // Ghost records
  RESOLVED = 'RESOLVIDO' // Confirmed records
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
  bank_key?: string | null;
  account_name?: string | null;
  accepted_contribution_types?: string[] | null;
}

export interface ContributionType {
  id: string;
  name: string;
  type: 'entrada' | 'saida';
  category?: string | null;
  bank_id?: string | null;
  order?: number;
  is_active?: boolean;
  user_id?: string | null;
  created_at?: string;
  bank_name?: string | null;
}

export interface ChurchLeader {
  id?: string;
  name: string;
  title: string;
}

export interface Church {
  id: string;
  name: string;
  address: string;
  logoUrl: string;
  pastor: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  pixKey?: string;
  cep?: string;
  city?: string;
  state?: string;
  treasurer?: string;
  pastors?: ChurchLeader[];
  treasurers?: ChurchLeader[];
  whatsapp_official?: string;
  whatsapp_responsible?: 'tesouraria' | 'pastor' | 'outro' | string;
  auto_comm_enabled?: boolean;
  auto_send_on_confirmation?: boolean;
}

export interface PastoralMessage {
  id?: string;
  church_id: string;
  title: string;
  type: 'texto' | 'audio' | 'video' | 'imagem' | 'link';
  content: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  user_id?: string;
  created_at?: string;
}

export interface CommunicationLog {
  id?: string;
  queue_id?: string;
  church_id: string;
  contributor_id?: string;
  contributor_name?: string;
  event_type: 'ContributionConfirmed' | 'Receipt' | 'Pastoral' | 'Birthday' | 'Devotional' | 'Campaign' | 'Notice' | string;
  channel: 'whatsapp' | 'email' | 'sms' | string;
  status: 'enviado' | 'pendente' | 'falha' | 'pronto_para_envio' | 'skipped' | string;
  recipient_phone?: string;
  message_summary?: string;
  provider_message_id?: string;
  error_message?: string;
  user_id?: string;
  created_at?: string;
}

export interface CommunicationEvent {
  id?: string;
  event_type: 'ContributionConfirmed' | string;
  church_id: string;
  contributor_id?: string;
  reference_id?: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'SKIPPED' | string;
  user_id?: string;
  created_at?: string;
}

export interface CommunicationQueueItem {
  id: string;
  event_id?: string;
  church_id: string;
  contributor_id?: string;
  recipient_phone?: string;
  channel: string;
  message_type: string;
  rendered_content: string;
  media_attachments?: any[];
  status: 'PENDING' | 'PROCESSING' | 'READY_FOR_SEND' | 'SENT' | 'FAILED' | 'SKIPPED' | string;
  attempts: number;
  max_attempts: number;
  next_attempt_at?: string;
  provider_message_id?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChurchFormData {
  name: string;
  address: string;
  pastor: string;
  logoUrl: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  pixKey?: string;
  cep?: string;
  city?: string;
  state?: string;
  treasurer?: string;
  pastors?: ChurchLeader[];
  treasurers?: ChurchLeader[];
  whatsapp_official?: string;
  whatsapp_responsible?: string;
  auto_comm_enabled?: boolean;
  auto_send_on_confirmation?: boolean;
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
  type?: string;
  contribution_request_id?: string;
  source?: string;
  pix_key?: string;
  row_hash?: string;
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
  phone?: string;
  mobile?: string;
  whatsapp?: string;
  _churchName?: string;
  _churchId?: string;
  _internalId?: string;
}

export interface TransactionSplit {
  id: string;
  amount: number;
  contributionType: string;
  description?: string;
}

export interface MatchResult {
  transaction: Transaction;
  contributor: Contributor | null;
  status: ReconciliationStatus;
  church: Church;
  reportId?: string;
  matchMethod?: MatchMethod;
  similarity?: number;
  contributorAmount?: number;
  contributionType?: string;
  paymentMethod?: string;
  isConfirmed?: boolean;
  updatedAt?: string;
  divergence?: {
    expectedChurch: Church;
    actualChurch: Church;
  };
  suggestion?: Contributor;
  _injectedId?: string;
  _churchId?: string;
  launchedAt?: string;
  splits?: TransactionSplit[];
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
    learnedSnapshot?: any;
    dateColumnIndex: number;
    descriptionColumnIndex: number;
    amountColumnIndex: number;
    paymentMethodColumnIndex?: number;
    typeColumnIndex?: number;
    skipRowsStart: number;
    skipRowsEnd: number;
    decimalSeparator: ',' | '.';
    thousandsSeparator: '.' | ',' | '';
  };
  parsingRules: {
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
  church_id?: string;
  data: {
    results?: MatchResult[];
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

export interface PastorAutomation {
  id: string;
  user_id: string;
  pastor_name: string;
  pix_key: string;
  pix_key_type: string;
  payment_day: number;
  gross_amount: number;
  net_amount: number;
  tithe_amount: number;
  tithe_enabled: boolean;
  church_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}