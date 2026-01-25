
import { Transaction, FileModel } from '../types';
import { ContractExecutor } from './engine/ContractExecutor';
import { Fingerprinter } from './processors/Fingerprinter';
import { DateResolver } from './processors/DateResolver';
import { AmountResolver } from './processors/AmountResolver';
import { TypeResolver } from './processors/TypeResolver';
import { NameResolver } from './processors/NameResolver';
import { Logger } from '../services/monitoringService';

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
    parse(content: any, yearAnchor: number, models?: FileModel[], globalKeywords?: string[]): Transaction[] | Promise<Transaction[]>;
}

/**
 * 🛡️ ESTRATÉGIA DE CONTRATO (V2 - PADRONIZAÇÃO GLOBAL)
 * Garante que modelos aprendidos sejam aplicados com limpeza de palavras-chaves.
 */
export const DatabaseModelStrategy: BankStrategy = {
    name: 'Modelo Aprendido',
    canHandle: (filename, content, models) => {
        if (!models || models.length === 0) return false;
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const fileFp = Fingerprinter.generate(rawText);
        if (!fileFp) return false;

        return models.some(m => 
            m.is_active && 
            (m.fingerprint.headerHash === fileFp.headerHash)
        );
    },
    parse: async (content, yearAnchor, models, globalKeywords = []) => {
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const fileFp = Fingerprinter.generate(rawText);
        
        const model = models?.find(m => 
            m.is_active && 
            (m.fingerprint.headerHash === fileFp?.headerHash)
        );

        if (!model) return [];

        console.log(`[Strategy:CONTRACT] Executando: "${model.name}" com higienização de palavras-chaves.`);
        return await ContractExecutor.apply(model, content, globalKeywords);
    }
};

export const GenericStrategy: BankStrategy = {
    name: 'Genérico (Virtual)',
    canHandle: () => true,
    parse: (content, yearAnchor, models, globalKeywords = []) => {
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const lines = rawText.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
        if (lines.length === 0) return [];
        
        const delimiter = Fingerprinter.detectDelimiter(lines[0]);
        const grid = lines.map((l: string) => l.split(delimiter));
        
        const dateIdx = DateResolver.identifyDateColumn(grid);
        const amountIdx = AmountResolver.identifyAmountColumn(grid, [dateIdx]);
        const nameIdx = NameResolver.identifyNameColumn(grid, [dateIdx, amountIdx]);
        
        const transactions: Transaction[] = [];
        
        grid.forEach((cols, index) => {
            const rawDate = dateIdx !== -1 ? (cols[dateIdx] || '') : '';
            const rawAmount = amountIdx !== -1 ? (cols[amountIdx] || '') : '';
            const rawDesc = nameIdx !== -1 ? (cols[nameIdx] || '') : cols.join(' ');

            const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numVal = parseFloat(stdAmount);

            if (isoDate && !isNaN(numVal)) {
                const cleaned = NameResolver.clean(rawDesc, globalKeywords);
                transactions.push({
                    id: `gen-${index}-${Date.now()}`,
                    date: isoDate,
                    description: cleaned,
                    rawDescription: cols.join('|'),
                    amount: numVal,
                    originalAmount: rawAmount,
                    cleanedDescription: cleaned,
                    contributionType: TypeResolver.resolveFromDescription(rawDesc)
                });
            }
        });
        return transactions;
    }
};

export const StrategyEngine = {
    strategies: [DatabaseModelStrategy, GenericStrategy],
    process: async (filename: string, content: any, models: FileModel[] = [], globalKeywords: string[] = [], overrideModel?: FileModel): Promise<StrategyResult> => {
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const source = content?.__source || 'unknown';
        
        if (overrideModel) {
            const txs = await DatabaseModelStrategy.parse(content, 2025, [overrideModel], globalKeywords);
            return { transactions: txs, strategyName: `Treino: ${overrideModel.name}` };
        }

        const fileFp = Fingerprinter.generate(rawText);
        const targetModel = models.find(m => m.is_active && m.fingerprint.headerHash === fileFp?.headerHash);
        
        if (targetModel) {
            const txs = await DatabaseModelStrategy.parse(content, 2025, [targetModel], globalKeywords);
            return { transactions: txs, strategyName: `Contrato: ${targetModel.name}` };
        }

        if (source !== 'virtual' && source !== 'gmail') {
            return { 
                status: 'MODEL_REQUIRED',
                fileName: filename,
                fingerprint: fileFp,
                preview: rawText.substring(0, 500),
                transactions: [], 
                strategyName: 'Bloqueio: Sem Modelo'
            };
        }

        const txs = GenericStrategy.parse(content, 2025, [], globalKeywords) as Transaction[];
        return { transactions: txs, strategyName: 'Genérico' };
    }
};
