export interface ProfileItem {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  owner_id?: string | null;
  subscription_status?: string;
  subscription_ends_at?: string | null;
  trial_ends_at?: string | null;
  limit_ai?: number;
  usage_ai?: number;
  max_churches?: number;
  max_banks?: number;
  custom_price?: number | null;
  is_blocked?: boolean;
  is_lifetime?: boolean;
  permissions?: any;
  congregation?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProfileDTO {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  owner_id?: string | null;
  subscription_status?: string;
  subscription_ends_at?: string | null;
  trial_ends_at?: string | null;
  limit_ai?: number;
  usage_ai?: number;
  max_churches?: number;
  max_banks?: number;
  custom_price?: number | null;
  is_blocked?: boolean;
  is_lifetime?: boolean;
  permissions?: any;
  congregation?: string | null;
}

export interface UpdateProfileDTO {
  email?: string | null;
  name?: string | null;
  role?: string;
  owner_id?: string | null;
  subscription_status?: string;
  subscription_ends_at?: string | null;
  trial_ends_at?: string | null;
  limit_ai?: number;
  usage_ai?: number;
  max_churches?: number;
  max_banks?: number;
  custom_price?: number | null;
  is_blocked?: boolean;
  is_lifetime?: boolean;
  permissions?: any;
  congregation?: string | null;
}
