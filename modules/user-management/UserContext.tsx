
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuthSession } from '../../services/auth/authAdapter';
import { profileService } from '../../services/profileService';
import { UserProfile, ADMIN_PERMISSIONS } from './types';

interface UserContextType {
    profile: UserProfile | null;
    loading: boolean;
    authEmail: string | null;
    refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [authEmail, setAuthEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string, userEmail: string | null) => {
        if (!userId) return;
        setLoading(true);
        
        try {
            const data = await profileService.getProfile(userId);

            if (data) {
                console.log(`[UserContext] Perfil carregado via ID: ${data.role}`);
                setProfile(data as any);
                setLoading(false);
                return;
            }

            // Fallback Master Admin
            const isMasterAdmin = userEmail?.toLowerCase().trim() === 'identificapix@gmail.com';
            if (isMasterAdmin) {
                console.warn("[UserContext] Aplicando Fallback Master Admin para identificapix@gmail.com");
                setProfile({
                    id: userId,
                    main_account_id: userId,
                    role: 'admin',
                    congregation_id: null,
                    permissions: ADMIN_PERMISSIONS,
                    is_active: true,
                    email: userEmail || undefined
                });
            } else {
                console.error("[UserContext] Nenhum perfil encontrado e usuário não é Master Admin. Acesso Negado.");
                setProfile(null);
            }
        } catch (err) {
            console.error('[UserContext] Erro crítico no carregamento de perfil:', err);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getAuthSession().then((session) => {
            if (session?.user) {
                const email = session.user.email || null;
                setAuthEmail(email);
                fetchProfile(session.user.id, email);
            } else {
                setLoading(false);
            }
        });
    }, []);

    const refreshProfile = async () => {
        const session = await getAuthSession();
        if (session?.user) {
            await fetchProfile(session.user.id, session.user.email || null);
        }
    };

    return (
        <UserContext.Provider value={{ profile, loading, authEmail, refreshProfile }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser deve ser usado dentro de um UserProvider');
    }
    return context;
};
