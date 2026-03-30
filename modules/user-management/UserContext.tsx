
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
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
            // 1. Tenta buscar pelo ID real do usuário (Cenário ideal)
            let { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (data && !error) {
                console.log(`[UserContext] Perfil carregado via ID: ${data.role} | Congregação: ${data.congregation_id}`);
                setProfile(data as UserProfile);
                setLoading(false);
                return;
            }

            // 2. Se não encontrou por ID, tenta o resgate pelo e-mail (Cenário: Novo Tesoureiro ou Admin sem ID)
            if (userEmail) {
                const cleanEmail = userEmail.toLowerCase().trim();
                console.log(`[UserContext] ID não encontrado. Tentando resgate por e-mail: ${cleanEmail}`);
                
                const { data: emailData } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('email', cleanEmail)
                    .single();
                
                if (emailData) {
                    console.log(`[UserContext] Perfil encontrado por e-mail. Vinculando ID ${userId}...`);
                    const { data: claimed, error: claimError } = await supabase
                        .from('user_profiles')
                        .update({ id: userId } as any)
                        .eq('email', cleanEmail)
                        .select()
                        .single();
                    
                    if (!claimError && claimed) {
                        console.log(`[UserContext] Vínculo realizado com sucesso: ${claimed.role}`);
                        setProfile(claimed as UserProfile);
                        setLoading(false);
                        return;
                    }
                }
            }

            // 3. Fallback Master (Última instância de segurança para o dono do sistema)
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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                const email = session.user.email || null;
                setAuthEmail(email);
                fetchProfile(session.user.id, email);
            } else {
                setProfile(null);
                setAuthEmail(null);
                setLoading(false);
            }
        });

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                const email = session.user.email || null;
                setAuthEmail(email);
                fetchProfile(session.user.id, email);
            } else {
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const refreshProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
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
