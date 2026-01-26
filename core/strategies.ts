
import { Transaction, FileModel } from '../types';
import { ContractExecutor } from './engine/ContractExecutor';
import { Fingerprinter } from './processors/Fingerprinter';
import { DateResolver } from './processors/DateResolver';
import { AmountResolver } from './processors/AmountResolver';
import { NameResolver } from './processors/NameResolver';

export interface StrategyResult {
    transactions: Transaction[];
    strategyName: string;
    status?: 'MODEL_REQUIRED';
    fileName?: string;
    fingerprint?: any;
    preview?: string;
}

export interface BankStrategy {
    name: string;
    canHandle(filename: string, content: any, models?: FileModel[]): boolean;
    parse(content: any, models?: FileModel[], globalKeywords?: string[]): Transaction[] | Promise<Transaction[]>;
}

export const DatabaseModelStrategy: BankStrategy = {
    name: 'Modelo Aprendido',
    canHandle: (filename, content, models) => {
        if (!models || models.length === 0) return false;
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const fileFp = Fingerprinter.generate(rawText);
        if (!fileFp) return false;

        return models.some(m => 
            m.is_active && 
            m.fingerprint.headerHash === fileFp.headerHash &&
            m.fingerprint.columnCount === fileFp.columnCount
        );
    },
    parse: async (content, models, globalKeywords = []) => {
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const fileFp = Fingerprinter.generate(rawText);
        
        const model = models?.find(m => 
            m.is_active && 
            m.fingerprint.headerHash === fileFp?.headerHash &&
            m.fingerprint.columnCount === fileFp?.columnCount
        );

        if (!model) return [];

        console.log(`[StrategyEngine] 🎯 Aplicando Modelo: "${model.name}" (v${model.version}) | DNA: ${model.fingerprint.headerHash}`);
        return await ContractExecutor.apply(model, content, globalKeywords);
    }
};

export const StrategyEngine = {
    process: async (filename: string, content: any, models: FileModel[] = [], globalKeywords: string[] = [], overrideModel?: FileModel): Promise<StrategyResult> => {
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const source = content?.__source || 'unknown';
        
        if (overrideModel) {
            const txs = await DatabaseModelStrategy.parse(content, [overrideModel], globalKeywords);
            return { transactions: txs, strategyName: `Treino: ${overrideModel.name}` };
        }

        const fileFp = Fingerprinter.generate(rawText);
        const targetModel = models.find(m => 
            m.is_active && 
            m.fingerprint.headerHash === fileFp?.headerHash &&
            m.fingerprint.columnCount === fileFp?.columnCount
        );
        
        if (targetModel) {
            const txs = await DatabaseModelStrategy.parse(content, [targetModel], globalKeywords);
            return { transactions: txs, strategyName: `Contrato: ${targetModel.name}` };
        }

        if (source === 'file' || source === 'unknown') {
            console.warn(`[StrategyEngine] ⚠️ Bloqueio: Nenhum modelo compatível para DNA ${fileFp?.headerHash}`);
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
