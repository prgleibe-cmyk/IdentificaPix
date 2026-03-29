import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

interface UseAutomationSyncProps {
    user: any;
    setIsLoading: (loading: boolean) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export const useAutomationSync = ({ user, setIsLoading, showToast }: UseAutomationSyncProps) => {
    const [automationMacros, setAutomationMacros] = useState<any[]>([]);

    const fetchMacros = useCallback(async (silent = false) => {
        if (!user) return;
        if (!silent) console.log("[AutomationSync] Buscando macros no banco para o usuário:", user.id);
        
        const { data, error } = await supabase
            .from('automation_macros')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error("[AutomationSync] Erro ao buscar macros:", error.message);
            return;
        }
        if (data) {
            setAutomationMacros(data);
        }
    }, [user]);

    useEffect(() => {
        fetchMacros();
    }, [fetchMacros]);

    useEffect(() => {
        const handleExtensionMessage = async (event: MessageEvent) => {
            if (!event.data || event.data.source !== "IdentificaPixExt") return;

            const { type, payload } = event.data;
            console.log(`%c[AutomationSync] MENSAGEM RECEBIDA DA EXTENSÃO: ${type}`, "color: #8b5cf6; font-weight: bold;");

            if (type === "SAVE_TRAINING" && user) {
                setIsLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('automation_macros')
                        .insert({
                            user_id: user.id,
                            name: `Macro ${payload.bankName || 'Treino'} - ${new Date().toLocaleTimeString()}`,
                            steps: payload.steps,
                            target_url: payload.targetUrl || null
                        })
                        .select();

                    if (error) throw error;
                    
                    setAutomationMacros(prev => [data[0], ...prev]);
                    showToast("IA: Novo percurso aprendido e habilitado!", "success");
                } catch (e: any) {
                    console.error("[AutomationSync] ERRO CRÍTICO AO SALVAR MACRO:", e.message);
                    showToast("Erro ao salvar aprendizado no banco de dados.", "error");
                } finally {
                    setIsLoading(false);
                }
            }
        };

        window.addEventListener("message", handleExtensionMessage);
        return () => window.removeEventListener("message", handleExtensionMessage);
    }, [user, setIsLoading, showToast]);

    return { automationMacros, fetchMacros };
};