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
    parse(content: any, models?: FileModel[]): Transaction[] | Promise<Transaction[]>;
}

/**
 * 🎯 ESTRATÉGIA DE MODELO APRENDIDO (V5 - RESILIENTE)
 * Suporta falhas de hash em Excel através de comparação genômica (Structural Pattern).
 */
export const DatabaseModelStrategy: BankStrategy = {
    name: 'Modelo Aprendido',
    canHandle: (filename, content, models) => {
        if (!models || models.length === 0) return false;
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const fileFp = Fingerprinter.generate(rawText);
        if (!fileFp) return false;

        return models.some(m => {
            if (!m.is_active) return false;

            // 1. Match por Hash (Rápido/Exato)
            if (m.fingerprint.headerHash === fileFp.headerHash) return true;

            // 2. Match por Padrão Estrutural (Fallback para instabilidade de Excel)
            // Se a sequência de tipos (Data-Texto-Valor) for idêntica, consideramos o mesmo modelo.
            if (m.fingerprint.structuralPattern && 
                m.fingerprint.structuralPattern !== 'UNKNOWN' &&
                m.fingerprint.structuralPattern === fileFp.structuralPattern) {
                console.log(`[StrategyEngine] 🧬 Match Genômico detectado para ${filename}`);
                return true;
            }

            return false;
        });
    },
    parse: async (content, models) => {
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const fileFp = Fingerprinter.generate(rawText);
        
        // Busca o modelo usando a mesma lógica resiliente do canHandle
        const model = models?.find(m => {
            if (!m.is_active) return false;
            if (m.fingerprint.headerHash === fileFp?.headerHash) return true;
            return (m.fingerprint.structuralPattern && 
                    m.fingerprint.structuralPattern !== 'UNKNOWN' &&
                    m.fingerprint.structuralPattern === fileFp?.structuralPattern);
        });

        if (!model) return [];

        console.log(`[StrategyEngine] 🎯 Aplicando Modelo: "${model.name}" (v${model.version})`);
        return await ContractExecutor.apply(model, content);
    }
};

export const StrategyEngine = {
    process: async (filename: string, content: any, models: FileModel[] = [], overrideModel?: FileModel): Promise<StrategyResult> => {
        const rawText = content?.__rawText || (typeof content === 'string' ? content : "");
        const source = content?.__source || 'unknown';
        
        if (overrideModel) {
            const txs = await DatabaseModelStrategy.parse(content, [overrideModel]);
            return { transactions: txs, strategyName: `Treino: ${overrideModel.name}` };
        }

        const fileFp = Fingerprinter.generate(rawText);
        
        // Busca o modelo alvo usando a lógica de fallback estrutural
        const targetModel = models.find(m => {
            if (!m.is_active) return false;
            if (m.fingerprint.headerHash === fileFp?.headerHash) return true;
            return (m.fingerprint.structuralPattern && 
                    m.fingerprint.structuralPattern !== 'UNKNOWN' &&
                    m.fingerprint.structuralPattern === fileFp?.structuralPattern);
        });
        
        if (targetModel) {
            const txs = await DatabaseModelStrategy.parse(content, [targetModel]);
            return { transactions: txs, strategyName: `Contrato: ${targetModel.name}` };
        }

        if (source === 'file' || source === 'unknown') {
            console.warn(`[StrategyEngine] ⚠️ Bloqueio: Nenhum modelo compatível para DNA ${fileFp?.headerHash} ou Padrão ${fileFp?.structuralPattern}`);
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