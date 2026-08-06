export interface AdminConfigItem {
  id?: string;
  key: string;
  value: any;
  updated_at?: string;
}

export interface UpsertAdminConfigDTO {
  key: string;
  value: any;
}

export interface PatchAdminConfigDTO {
  key: string;
  value: any;
}
