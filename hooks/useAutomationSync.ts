import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AutomationMacroService } from '../services/AutomationMacroService';

interface UseAutomationSyncProps {
    user: any;
    setIsLoading: (loading: boolean) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export const useAutomationSync = ({ user, setIsLoading, showToast }: UseAutomationSyncProps) => {
    const { subscription } = useAuth();
    const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;
    const [automationMacros, setAutomationMacros] = useState<any[]>([]);

    const fetchMacros = useCallback(async (silent = false) => {
        if (!effectiveUserId) return;
        if (!silent) console.log("[AutomationSync] Buscando macros no banco (VPS API) para o usuário:", effectiveUserId);
        
        try {
            const data = await AutomationMacroService.getAll(effectiveUserId);
            if (data) {
                setAutomationMacros(data);
            }
        } catch (error: any) {
            console.error("[AutomationSync] Erro ao buscar macros:", error?.message || error);
        }
    }, [user, effectiveUserId]);

    useEffect(() => {
        fetchMacros();
    }, [fetchMacros]);

    useEffect(() => {
        const handleExtensionMessage = async (event: MessageEvent) => {
            if (!event.data || event.data.source !== "IdentificaPixExt") return;

            const { type, payload } = event.data;
            console.log(`%c[AutomationSync] MENSAGEM RECEBIDA DA EXTENSÃO: ${type}`, "color: #8b5cf6; font-weight: bold;");

            if (type === "SAVE_TRAINING" && effectiveUserId) {
                setIsLoading(true);
                try {
                    console.log(`[WRITE:FIX] Salvando macro com effectiveUserId na VPS: ${effectiveUserId}`);
                    const newMacro = await AutomationMacroService.create({
                        user_id: effectiveUserId,
                        name: `Macro ${payload.bankName || 'Treino'} - ${new Date().toLocaleTimeString()}`,
                        steps: payload.steps,
                        target_url: payload.targetUrl || null
                    });
                    
                    setAutomationMacros(prev => [newMacro, ...prev]);
                    showToast("IA: Novo percurso aprendido e habilitado!", "success");
                } catch (e: any) {
                    console.error("[AutomationSync] ERRO CRÍTICO AO SALVAR MACRO:", e?.message || e);
                    showToast("Erro ao salvar aprendizado no banco de dados.", "error");
                } finally {
                    setIsLoading(false);
                }
            }
        };

        window.addEventListener("message", handleExtensionMessage);
        return () => window.removeEventListener("message", handleExtensionMessage);
    }, [user, effectiveUserId, setIsLoading, showToast]);

    return { automationMacros, fetchMacros };
};
