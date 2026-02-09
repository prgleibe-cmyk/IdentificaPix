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
 * 🎯 ESTRATÉGIA DE MODELO APRENDIDO (V9 - HARD BYPASS SAFE PIPE)
 * Autoridade máxima no processamento. Nenhum fallback inteligente.
 */
export const DatabaseModelStrategy = {
    name: 'Modelo Aprendido',
    
    async parse(content: any, model: FileModel, globalKeywords: string[] = []) {
        // 🔒 Blindagem soberana do modelo antes do contrato
        const safeModel = hydrateModelMapping(model);

        const rows =
            safeModel.mapping?.blockRows ??
            safeModel.mapping?.rows ??
            safeModel.mapping?.learnedRows ??
            [];

        console.log(`[StrategyEngine] 🎯 Bypass Ativo -> Aplicando Contrato: ${safeModel.name}`);
        console.log(`[StrategyEngine] 🧱 BLOCK rows: ${Array.isArray(rows) ? rows.length : 0}`);

        return await ContractExecutor.apply(safeModel, content, globalKeywords);
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
            if (m.fingerprint?.headerHash === fileFp?.headerHash) return true;
            return (
                m.fingerprint?.structuralPattern &&
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

/**
 * 🔧 Hidratador soberano do mapping
 * Não altera aprendizado, apenas normaliza leitura.
 */
function hydrateModelMapping(model: any): FileModel {
    if (!model) return model;

    let mapping: any = model.mapping || {};

    if (typeof mapping === 'string') {
        try {
            mapping = JSON.parse(mapping);
        } catch {
            mapping = {};
        }
    }

    let rows =
        mapping.blockRows ??
        mapping.block_rows ??
        mapping.rows ??
        mapping.learnedRows ??
        [];

    if (typeof rows === 'string') {
        try {
            rows = JSON.parse(rows);
        } catch {
            rows = [];
        }
    }

    if (!Array.isArray(rows) && typeof rows === 'object') {
        rows = Object.values(rows);
    }

    return {
        ...model,
        mapping: {
            ...mapping,
            blockRows: Array.isArray(rows) ? rows : []
        }
    };
}
