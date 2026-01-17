
import { LancamentoItem, BancoLancamento, ObservacaoLog, SugestaoLancamento, LancamentoModo } from './types';
import { supabase } from '../../services/supabaseClient';
import { GoogleGenAI } from "@google/genai";
import { decisionEngine, DecisionResult } from './decisionEngine';

export const lancamentoService = {
    /**
     * Organiza a Lista Viva por banco utilizando os dados de cadastro (bankId/bankName),
     * garantindo que múltiplos arquivos do mesmo banco sejam agrupados corretamente.
     */
    mapearListaVivaPorBanco(activeBankFiles: any[], banks: any[]): BancoLancamento[] {
        if (!activeBankFiles || !Array.isArray(activeBankFiles)) return [];

        const bancosMap = new Map<string, BancoLancamento>();

        activeBankFiles.forEach(file => {
            const bankId = file.bankId;
            if (!bankId) return;

            const bankInfo = banks.find(b => b.id === bankId);
            const bankName = bankInfo?.name || file.fileName || 'Banco Desconhecido';
            
            const novosItens: LancamentoItem[] = (file.processedTransactions || []).map((t: any) => ({
                id: `fila-${t.id || Math.random().toString(36).substr(2, 9)}`,
                origemId: t.id || '',
                data: t.date || '',
                nome: t.description || 'Sem descrição',
                valor: Number(t.amount || 0),
                igrejaSugerida: t.church_name || 'Não identificada',
                tipoContribuicao: t.contributionType,
                status: 'PENDENTE',
                bankId,
                bankName,
                tentativas: 0,
                executionStatus: 'aguardando',
                metadata: {} 
            }));

            if (bancosMap.has(bankId)) {
                const existing = bancosMap.get(bankId)!;
                existing.itens = [...existing.itens, ...novosItens];
            } else {
                bancosMap.set(bankId, {
                    bankId,
                    bankName,
                    itens: novosItens,
                    lancados: []
                });
            }
        });

        return Array.from(bancosMap.values());
    },

    async salvarAprendizado(userId: string, item: LancamentoItem, modo: LancamentoModo): Promise<void> {
        try {
            const aiProposal = item.metadata?.ai_proposal;
            
            await supabase.from('lancamento_automatico_learning').insert({
                user_id: userId,
                bank_id: item.bankId,
                bank_name: item.bankName,
                transaction_id: item.origemId,
                nome_contribuinte: item.nome,
                data_transacao: item.data,
                valor: item.valor,
                categoria_escolhida: item.igrejaSugerida,
                modo_execution: modo,
                status_confirmacao: item.status === 'LANCADO',
                timestamp_acao: new Date().toISOString(),
                // Metadados da IA para análise de performance posterior
                metadata: aiProposal ? {
                    confianca: aiProposal.confianca,
                    caixa_sugerido: aiProposal.caixa,
                    motivo_ia: aiProposal.observacao
                } : null
            });
        } catch (e) { console.error(e); }
    },

    async salvarInstrucaoIA(userId: string, bankId: string, instrucao: string): Promise<void> {
        await supabase.from('lancamento_automatico_instructions').upsert({ 
            user_id: userId, bank_id: bankId, instruction_text: instrucao, updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, bank_id' });
    },

    async obterInstrucaoIA(userId: string, bankId: string): Promise<string> {
        const { data } = await supabase.from('lancamento_automatico_instructions')
            .select('instruction_text').eq('user_id', userId).eq('bank_id', bankId).maybeSingle();
        return data?.instruction_text || '';
    },

    /**
     * Executa o Motor de Decisão para um item específico.
     */
    async decidirCategoriaAutomatica(userId: string, item: LancamentoItem, instruction?: string): Promise<{ categoria: string, origem: string, proposal: DecisionResult } | null> {
        try {
            // 1. Busca Histórico (Memória do Usuário)
            const { data: history } = await supabase.from('lancamento_automatico_learning')
                .select('*')
                .eq('user_id', userId)
                .eq('bank_id', item.bankId)
                .ilike('nome_contribuinte', `%${item.nome.substring(0, 8)}%`)
                .order('timestamp_acao', { ascending: false })
                .limit(10);

            // 2. Aciona o Cérebro da IA (Decision Engine)
            const proposal = await decisionEngine({
                item,
                instruction,
                history: history || []
            });

            // 3. Persiste proposta no item
            item.metadata = { ...item.metadata, ai_proposal: proposal };

            // 4. Critério de Automação: Confiança mínima de 80%
            if (proposal.confianca >= 80) {
                return { 
                    categoria: proposal.categoria, 
                    origem: proposal.caixa,
                    proposal 
                };
            }
        } catch (e) {
            console.error("[Service] Erro no motor de decisão:", e);
        }
        
        return null;
    }
};
