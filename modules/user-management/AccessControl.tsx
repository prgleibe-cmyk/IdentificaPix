
import React from 'react';
import { usePermissions } from './usePermissions';
import { UserPermissions } from './types';

interface AccessControlProps {
    permission?: keyof UserPermissions;
    role?: 'admin' | 'treasurer';
    children: React.ReactNode;
    fallback?: React.ReactNode;
    showDenied?: boolean;
}

export const AccessControl: React.FC<AccessControlProps> = ({ 
    permission, 
    role, 
    children, 
    fallback = null,
    showDenied = false
}) => {
    const { can, isRole } = usePermissions();

    let hasAccess = true;

    if (permission && !can(permission)) {
        hasAccess = false;
    }

    if (role && !isRole(role)) {
        hasAccess = false;
    }

    if (!hasAccess) {
        console.log(`AUDIT: AccessControl BLOQUEOU acesso. Permissão requerida: ${permission}, Role requerida: ${role}`);
        if (showDenied) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Acesso Negado</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        Você não possui as permissões necessárias para acessar esta funcionalidade. Entre em contato com o administrador.
                    </p>
                </div>
            );
        }
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
