import { Transaction, FileModel } from '../types';
import { ContractExecutor } from './engine/ContractExecutor';
import { Fingerprinter } from './processors/Fingerprinter';

export interface StrategyResult {
    transactions: Transaction[];
    strategyName: string;
    status?: 'MODEL_REQUIRED';
    fileName?: string;
    fingerprint?: any;
    preview?: string;
}

/**
 * 🎯 ESTRATÉGIA DE MODELO APRENDIDO (V7 - HARD BYPASS)
 * Autoridade máxima no processamento. Nenhum fallback inteligente.
 */
export const DatabaseModelStrategy = {
    name: 'Modelo Aprendido',
    
    async parse(content: any, model: FileModel, globalKeywords: string[] = []) {
        console.log(`[StrategyEngine] 🎯 Bypass Ativo -> Aplicando Contrato: "${model.name}"`);
        return await ContractExecutor.apply(model, content, globalKeywords);
    }
};

export const StrategyEngine = {
    process: async (
        filename: string, 
        content: any, 
        models: FileModel[] = [], 
        globalKeywords: string[] = [], 
        overrideModel?: FileModel
    ): Promise<StrategyResult> => {
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const source = content?.__source || 'unknown';
        
        if (overrideModel) {
            const txs = await DatabaseModelStrategy.parse(content, overrideModel, globalKeywords);
            return { transactions: txs, strategyName: `Treino: ${overrideModel.name}` };
        }

        const fileFp = Fingerprinter.generate(rawText);
        
        const targetModel = models.find(m => {
            if (!m.is_active) return false;
            if (m.fingerprint.headerHash === fileFp?.headerHash) return true;
            return (
                m.fingerprint.structuralPattern &&
                m.fingerprint.structuralPattern !== 'UNKNOWN' &&
                m.fingerprint.structuralPattern === fileFp?.structuralPattern
            );
        });
        
        if (targetModel) {
            const txs = await DatabaseModelStrategy.parse(content, targetModel, globalKeywords);
            return { 
                transactions: txs, 
                strategyName: `Contrato: ${targetModel.name}`,
                fingerprint: fileFp 
            };
        }

        if (source === 'file' || source === 'unknown') {
            console.warn(`[StrategyEngine] ⚠️ Bloqueio: DNA não reconhecido (${fileFp?.headerHash}).`);
            return { 
                status: 'MODEL_REQUIRED',
                fileName: filename,
                fingerprint: fileFp,
                preview: rawText.substring(0, 500),
                transactions: [], 
                strategyName: 'Requisitar Modelo'
            };
        }

        return { transactions: [], strategyName: 'Inconclusivo' };
    }
};
