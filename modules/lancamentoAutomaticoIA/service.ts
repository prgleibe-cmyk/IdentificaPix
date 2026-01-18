
import { supabase } from '../../services/supabaseClient';
import { Logger } from '../../services/monitoringService';

/**
 * SERVIÇO DE PERSISTÊNCIA IA
 * Responsável por salvar e recuperar os padrões aprendidos durante o treinamento manual.
 */
export const iaTrainingService = {
    /**
     * Salva ou atualiza a sequência de passos aprendida para um banco específico.
     */
    async saveTrainingMemory(bankName: string, capturedSteps: any[]) {
        if (!bankName || !capturedSteps || capturedSteps.length === 0) {
            console.warn("[IA Service] Tentativa de salvar treino vazio ou sem identificação de banco.");
            return;
        }

        try {
            const { data: { session } } = await (supabase.auth as any).getSession();
            if (!session?.user?.id) throw new Error("Usuário não autenticado");

            const payload = {
                user_id: session.user.id,
                bank_name: bankName,
                steps: capturedSteps,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('ia_training_memory')
                .upsert([payload], { onConflict: 'user_id, bank_name' });

            if (error) throw error;

            Logger.info(`[IA Service] Memória de treinamento salva para: ${bankName}`);
        } catch (error) {
            Logger.error(`[IA Service] Erro ao salvar memória IA para ${bankName}`, error);
            throw error;
        }
    },

    /**
     * Recupera a sequência de passos salva para um banco específico.
     */
    async loadTrainingMemory(bankName: string): Promise<any[] | null> {
        try {
            const { data: { session } } = await (supabase.auth as any).getSession();
            if (!session?.user?.id) return null;

            const { data, error } = await supabase
                .from('ia_training_memory')
                .select('steps')
                .eq('user_id', session.user.id)
                .eq('bank_name', bankName)
                .maybeSingle();

            if (error) throw error;
            return data?.steps || null;
        } catch (error) {
            Logger.error(`[IA Service] Erro ao carregar memória para ${bankName}`, error);
            return null;
        }
    }
};
