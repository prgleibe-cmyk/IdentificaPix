export type LancamentoStatus = 'PENDENTE' | 'LANCADO' | 'ERRO' | 'IGNORADO';

export type LancamentoModo = 'OBSERVACAO' | 'ASSISTIDO' | 'AUTOMATICO';

export type ItemExecutionStatus = 'aguardando' | 'executando' | 'confirmado';

export interface SugestaoLancamento {
    id: string;
    lancamentoId: string;
    campo: 'CATEGORIA' | 'TIPO' | 'CENTRO_CUSTO' | 'IGREJA';
    valorSugerido: string;
    confianca: number; // 0 a 100
    origem: 'IA_HISTORICO' | 'IA_SEMANTICA' | 'REGRA_FIXA';
}

export interface AprovacaoSugestao {
    id: string;
    sugestaoId: string;
    aprovado: boolean;
    valorFinal: string;
    dataHora: string;
}

export interface ObservacaoLog {
    id: string;
    lancamentoId: string;
    acao: string;
    payload: any;
    dataHora: string;
}

export interface LancamentoItem {
    id: string;
    origemId: string;
    data: string;
    nome: string;
    valor: number;
    igrejaSugerida: string;
    tipoContribuicao?: string;
    status: LancamentoStatus;
    bankId: string;
    bankName: string;
    tentativas: number;
    ultimaTentativa?: string;
    metadata?: Record<string, any>;
    executionStatus?: ItemExecutionStatus;
}

export interface BancoLancamento {
    bankId: string;
    bankName: string;
    itens: LancamentoItem[];
    lancados: LancamentoItem[];
}

export interface LancamentoState {
    bancos: BancoLancamento[];
    modoAtivo: LancamentoModo;
    isProcessando: boolean;
    observacoes: ObservacaoLog[];
    sugestoes: SugestaoLancamento[];
    aprovacoes: AprovacaoSugestao[];
}