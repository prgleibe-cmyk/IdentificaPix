
import { FileModel } from '../types';

export interface ObservationLog {
    id: string;
    timestamp: string;
    fileName: string;
    suggestedModelId: string;
    suggestedModelName: string;
    score: number;
}

const STORAGE_KEY = 'identificapix-observation-logs';

export const observationService = {
    /**
     * Registra uma nova identificação passiva.
     */
    addLog: (fileName: string, model: FileModel, score: number) => {
        try {
            const logs = observationService.getLogs();
            const newLog: ObservationLog = {
                id: `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                fileName,
                suggestedModelId: model.id,
                suggestedModelName: model.name,
                score
            };
            // Mantém apenas os últimos 200 registros para não estourar o storage
            const updatedLogs = [newLog, ...logs].slice(0, 200);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
        } catch (e) {
            console.error("Failed to save observation log", e);
        }
    },

    /**
     * Recupera o histórico de observações.
     */
    getLogs: (): ObservationLog[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    /**
     * Limpa o histórico.
     */
    clearLogs: () => {
        localStorage.removeItem(STORAGE_KEY);
    }
};
