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
 * 🎯 ESTRATÉGIA DE MODELO APRENDIDO (V8 - BLOCK AUDIT)
 * Autoridade máxima no processamento. Ignora lógica genérica.
 */
export const DatabaseModelStrategy = {
    name: 'Modelo Aprendido',
    
    async parse(content: any, model: FileModel, globalKeywords: string[] = []) {
        console.log(`[StrategyEngine] 🎯 Bypass Ativo -> Aplicando Contrato: "${model.name}"`);
        
        // 🧪 AUDITORIA DE REIDRATAÇÃO
        const mapping = model.mapping;
        const mappingType = typeof mapping;
        
        if (mappingType === 'string') {
            console.error(`[StrategyEngine] ❌ ERRO CRÍTICO: mapping chegou como STRING. blockRows inacessível.`);
        } else if (mapping.extractionMode === 'BLOCK') {
            const rowsCount = mapping.blockRows?.length || 0;
            console.log(`[StrategyEngine] 🧱 BLOCK rows: ${rowsCount}`);
            
            if (rowsCount === 0) {
                console.warn(`[StrategyEngine] ⚠️ Alerta: Objeto mapping existe, mas blockRows está vazio.`);
            }
        }
        
        // A autoridade de extração é delegada 100% ao executor do contrato aprendido
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
        
        // Se um modelo foi forçado (ex: via Laboratório), usa ele imediatamente
        if (overrideModel) {
            const txs = await DatabaseModelStrategy.parse(content, overrideModel, globalKeywords);
            return { transactions: txs, strategyName: `Treino: ${overrideModel.name}` };
        }

        // Gera DNA para busca no banco de modelos
        const fileFp = Fingerprinter.generate(rawText);
        
        // BUSCA SOBERANA: Match por Hash ou Padrão Estrutural
        const targetModel = models.find(m => {
            if (!m.is_active) return false;
            // Match exato de DNA
            if (m.fingerprint.headerHash === fileFp?.headerHash) return true;
            // Fallback genômico (mesma estrutura de colunas/tipos)
            return (m.fingerprint.structuralPattern && 
                    m.fingerprint.structuralPattern !== 'UNKNOWN' &&
                    m.fingerprint.structuralPattern === fileFp?.structuralPattern);
        });
        
        if (targetModel) {
            const txs = await DatabaseModelStrategy.parse(content, targetModel, globalKeywords);
            return { 
                transactions: txs, 
                strategyName: `Contrato: ${targetModel.name}`,
                fingerprint: fileFp 
            };
        }

        // Se não há modelo e a fonte é um arquivo real, bloqueia e requisita treinamento
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