
import { supabase } from '../../services/supabaseClient';
import { Logger } from '../../services/monitoringService';

/**
 * SERVIÇO DE PERSISTÊNCIA IA
 * Responsável por salvar e recuperar os padrões aprendidos durante o treinamento manual.
 */
export const iaTrainingService = {
    /**
     * Salva ou atualiza a sequência de passos aprendida para um banco específico.
     * Versão verificada com logs e alertas de erro.
     */
    async saveTrainingMemory(bankName: string, capturedSteps: any[]) {
        if (!bankName || !capturedSteps || capturedSteps.length === 0) {
            console.warn("[IA Service] Tentativa de salvar treino vazio ou sem identificação de banco.");
            return false;
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

            if (error) {
                console.error("Erro salvando memória IA:", error);
                alert(`Erro ao salvar memória para o banco "${bankName}": ${error.message}`);
                return false;
            }

            console.log(`[IA Service] Memória gravada com sucesso para o banco "${bankName}"`);
            return true;
        } catch (error: any) {
            Logger.error(`[IA Service] Erro fatal ao salvar memória IA para ${bankName}`, error);
            alert(`Falha técnica ao salvar treinamento: ${error.message}`);
            return false;
        }
    },

    /**
     * Recupera a sequência de passos salva para um banco específico do usuário autenticado.
     * Versão verificada com validação de dados e alertas de ausência de memória.
     */
    async loadTrainingMemory(bankName: string): Promise<any[]> {
        if (!bankName) return [];

        try {
            const { data: { session } } = await (supabase.auth as any).getSession();
            if (!session?.user?.id) return [];

            const { data, error } = await supabase
                .from('ia_training_memory')
                .select('steps')
                .eq('user_id', session.user.id)
                .eq('bank_name', bankName)
                .maybeSingle();

            if (error) {
                console.error("Erro carregando memória IA:", error);
                alert(`Erro ao carregar memória para o banco "${bankName}": ${error.message}`);
                return [];
            }

            if (!data || !data.steps || !data.steps.length) {
                console.warn(`[IA Service] Nenhuma memória encontrada para o banco "${bankName}"`);
                alert(`Não há memória de treinamento para o banco "${bankName}". Por favor, utilize o Modo Assistido pelo menos uma vez para ensinar o caminho à IA.`);
                return [];
            }

            console.log(`[IA Service] Memória carregada com sucesso para o banco "${bankName}"`);
            return data.steps;
        } catch (error: any) {
            Logger.error(`[IA Service] Erro fatal ao carregar memória para ${bankName}`, error);
            return [];
        }
    }
};
