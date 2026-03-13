
import { useUser } from './UserContext';
import { UserPermissions } from './types';

export const usePermissions = () => {
    const { profile, authEmail } = useUser();

    const can = (permission: keyof UserPermissions): boolean => {
        // Fallback de segurança máxima: Se for o e-mail do admin principal, sempre permite
        const userEmail = profile?.email || authEmail || "";
        const isSuperAdmin = userEmail.toLowerCase().trim() === 'identificapix@gmail.com';
        
        if (isSuperAdmin) {
            console.log(`AUDIT: Permissão [${permission}] concedida via SUPER ADMIN (Email Check)`);
            return true;
        }

        if (!profile) {
            console.log(`AUDIT: Permissão [${permission}] negada - Perfil é NULL`);
            return false;
        }
        if (!profile.is_active) {
            console.log(`AUDIT: Permissão [${permission}] negada - Perfil INATIVO`);
            return false;
        }
        
        // Admins têm permissão total por padrão, mas respeitamos o objeto de permissões se existir
        if (profile.role === 'admin') {
            console.log(`AUDIT: Permissão [${permission}] concedida - Usuário é ADMIN`);
            return true;
        }

        const hasPermission = !!profile.permissions[permission];
        console.log(`AUDIT: Verificação de permissão [${permission}]:`, hasPermission);
        return hasPermission;
    };

    const isRole = (role: 'admin' | 'treasurer'): boolean => {
        const userEmail = profile?.email || authEmail || "";
        const isSuperAdmin = userEmail.toLowerCase().trim() === 'identificapix@gmail.com';
        
        if (isSuperAdmin && role === 'admin') return true;
        
        return profile?.role === role;
    };

    return {
        can,
        isRole,
        role: profile?.role,
        congregationId: profile?.congregation_id,
        mainAccountId: profile?.main_account_id,
        profile
    };
};
