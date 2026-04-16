
export type UserRole = 'admin' | 'treasurer';

export interface UserPermissions {
    view_viva: boolean;
    view_reports: boolean;
    can_reconcile: boolean;
    can_export: boolean;
    can_confirm_final: boolean;
    can_upload_files: boolean;
    can_manage_settings: boolean;
    read_only: boolean;
    excluir_registros?: boolean;
}

export interface UserProfile {
    id: string;
    main_account_id: string;
    role: UserRole;
    congregation_id: string | null;
    permissions: UserPermissions;
    is_active: boolean;
    email?: string;
}

export const DEFAULT_TREASURER_PERMISSIONS: UserPermissions = {
    view_viva: true,
    view_reports: true,
    can_reconcile: true,
    can_export: false,
    can_confirm_final: false,
    can_upload_files: false,
    can_manage_settings: false,
    read_only: false
};

export const ADMIN_PERMISSIONS: UserPermissions = {
    view_viva: true,
    view_reports: true,
    can_reconcile: true,
    can_export: true,
    can_confirm_final: true,
    can_upload_files: true,
    can_manage_settings: true,
    read_only: false
};
