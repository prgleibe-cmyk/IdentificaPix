export interface AutomationMacro {
  id?: string;
  user_id: string;
  bank_id?: string | null;
  name: string;
  steps: any;
  target_url?: string | null;
  created_at?: string;
}

export interface CreateAutomationMacroDTO {
  user_id: string;
  bank_id?: string | null;
  name: string;
  steps: any;
  target_url?: string | null;
}

export interface UpdateAutomationMacroDTO {
  bank_id?: string | null;
  name?: string;
  steps?: any;
  target_url?: string | null;
}
