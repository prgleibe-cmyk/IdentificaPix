
import { Transaction, FileModel } from '../types';
import { ContractExecutor } from './engine/ContractExecutor';
import { Fingerprinter } from './processors/Fingerprinter';
import { DateResolver } from './processors/DateResolver';
import { AmountResolver } from './processors/AmountResolver';
import { TypeResolver } from './processors/TypeResolver';

export interface BankStrategy {
    name: string;
    canHandle(filename: string, content: string, models?: FileModel[]): boolean;
    parse(content: string, yearAnchor: number, models?: FileModel[], globalKeywords?: string[]): Transaction[] | Promise<Transaction[]>;
}

/**
 * 🛡️ PIPELINE SOURCE RESOLVER (INTEGRAL V6)
 * Processamento via Modelo Aprendido usando o ContractExecutor.
 */
export const DatabaseModelStrategy: BankStrategy = {
    name: 'Modelo Aprendido',
    canHandle: (filename, content, models) => {
        if (!models || models.length === 0) return false;
        const fileFp = Fingerprinter.generate(content);
        if (!fileFp) return false;

        return models.some(m => 
            m.is_active && (
                (m.fingerprint.headerHash === fileFp.headerHash && m.fingerprint.headerHash !== null) ||
                (m.fingerprint.structuralPattern === fileFp.structuralPattern && m.fingerprint.structuralPattern !== 'UNKNOWN') ||
                (m.fingerprint.canonicalSignature === fileFp.canonicalSignature)
            )
        );
    },
    parse: async (content, yearAnchor, models, globalKeywords = []) => {
        const fileFp = Fingerprinter.generate(content);
        const model = models?.find(m => 
            m.is_active && (
                (m.fingerprint.headerHash === fileFp?.headerHash) || 
                (m.fingerprint.structuralPattern === fileFp?.structuralPattern) ||
                (m.fingerprint.canonicalSignature === fileFp?.canonicalSignature)
            )
        );

        if (!model) return [];

        // EXECUÇÃO DIRETA E BLINDADA
        const result = await ContractExecutor.apply(model, content);
        return result;
    }
};

export const GenericStrategy: BankStrategy = {
    name: 'Genérico',
    canHandle: () => true,
    parse: (content, yearAnchor, models, globalKeywords = []) => {
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        const delimiter = Fingerprinter.detectDelimiter(lines[0]);
        const grid = lines.map(l => l.split(delimiter));
        const dateIdx = DateResolver.identifyDateColumn(grid);
        const amountIdx = AmountResolver.identifyAmountColumn(grid, [dateIdx]);
        const nameIdx = TypeResolver.identifyTypeColumn(grid, [dateIdx, amountIdx]);
        const transactions: Transaction[] = [];
        grid.forEach((cols, index) => {
            const rawDate = cols[dateIdx] || '';
            const rawDesc = cols[nameIdx] || cols.join(' ');
            const rawAmount = cols[amountIdx] || '';
            const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numVal = parseFloat(stdAmount);
            if (isoDate && !isNaN(numVal) && stdAmount !== "0.00") {
                transactions.push({
                    id: `gen-${index}-${Date.now()}`,
                    date: isoDate,
                    description: rawDesc,
                    rawDescription: rawDesc,
                    amount: numVal,
                    originalAmount: rawAmount,
                    cleanedDescription: rawDesc,
                    contributionType: TypeResolver.resolveFromDescription(rawDesc)
                });
            }
        });
        return transactions;
    }
};

export const StrategyEngine = {
    strategies: [DatabaseModelStrategy, GenericStrategy],
    process: async (filename: string, content: string, models: FileModel[] = [], globalKeywords: string[] = [], overrideModel?: FileModel): Promise<{ transactions: Transaction[], strategyName: string }> => {
        const yearAnchor = DateResolver.discoverAnchorYear(content);
        
        let targetModel = overrideModel;

        if (!targetModel) {
            const fileFp = Fingerprinter.generate(content);
            targetModel = models.find(m => 
                m.is_active && (
                    (m.fingerprint.headerHash === fileFp?.headerHash && m.fingerprint.headerHash !== null) ||
                    (m.fingerprint.structuralPattern === fileFp?.structuralPattern) ||
                    (m.fingerprint.canonicalSignature === fileFp?.canonicalSignature)
                )
            );
        }

        // SE HOUVER MODELO, O FLUXO É EXCLUSIVO. NÃO HÁ FALLBACK PARA GENÉRICO.
        if (targetModel) {
            const txs = await DatabaseModelStrategy.parse(content, yearAnchor, [targetModel], globalKeywords);
            return { transactions: txs, strategyName: targetModel.name };
        }

        const genResult = GenericStrategy.parse(content, yearAnchor, models, globalKeywords) as Transaction[];
        return { transactions: genResult, strategyName: 'Genérico' };
    }
};
