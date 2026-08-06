export interface FileModelItem {
  id?: string;
  user_id: string;
  bank_id?: string | null;
  name: string;
  version?: number;
  lineage_id?: string | null;
  is_active?: boolean;
  status?: string;
  fingerprint?: any;
  mapping?: any;
  parsing_rules?: any;
  snippet?: string | null;
  last_used_at?: string | null;
  created_at?: string;
}

export interface CreateFileModelDTO {
  user_id: string;
  bank_id?: string | null;
  name: string;
  version?: number;
  lineage_id?: string | null;
  is_active?: boolean;
  status?: string;
  fingerprint?: any;
  mapping?: any;
  parsing_rules?: any;
  snippet?: string | null;
}

export interface UpdateFileModelDTO {
  name?: string;
  bank_id?: string | null;
  version?: number;
  lineage_id?: string | null;
  is_active?: boolean;
  status?: string;
  fingerprint?: any;
  mapping?: any;
  parsing_rules?: any;
  snippet?: string | null;
  last_used_at?: string | null;
}
