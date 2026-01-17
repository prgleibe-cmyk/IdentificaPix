import { LancamentoModo, LancamentoStatus } from './types';

export const MODOS_LANCAMENTO = {
    OBSERVACAO: 'OBSERVACAO' as LancamentoModo,
    ASSISTIDO: 'ASSISTIDO' as LancamentoModo,
    AUTOMATICO: 'AUTOMATICO' as LancamentoModo
};

export const STATUS_LANCAMENTO = {
    PENDENTE: 'PENDENTE' as LancamentoStatus,
    OBSERVACAO: 'OBSERVACAO' as LancamentoStatus,
    ASSISTIDO: 'ASSISTIDO' as LancamentoStatus,
    AUTOMATICO: 'AUTOMATICO' as LancamentoStatus,
    ERRO: 'ERRO' as LancamentoStatus,
    CONCLUIDO: 'CONCLUIDO' as LancamentoStatus,
    IGNORADO: 'IGNORADO' as LancamentoStatus
};

export const MODO_LABELS: Record<LancamentoModo, string> = {
    OBSERVACAO: 'Modo Observação (Passivo)',
    ASSISTIDO: 'Modo Assistido (Confirmação)',
    AUTOMATICO: 'Modo Automático (Total)'
};

export const MODO_DESCRIPTIONS: Record<LancamentoModo, string> = {
    OBSERVACAO: 'A IA apenas sugere os lançamentos no log, sem executar ações no sistema externo.',
    ASSISTIDO: 'A IA prepara os lançamentos e aguarda sua confirmação manual antes de processar.',
    AUTOMATICO: 'A IA identifica e lança automaticamente todos os registros reconhecidos com alta confiança.'
};