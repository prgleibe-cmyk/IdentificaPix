
import { LancamentoItem, BancoLancamento, ObservacaoLog, SugestaoLancamento, LancamentoModo } from './types';
import { supabase } from '../../services/supabaseClient';

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

            // Busca o nome amigável do banco no cadastro para exibição
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
                tentativas: 0
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

    /**
     * PERSISTÊNCIA DE APRENDIZADO (Memória por Banco):
     * Salva o registro da ação do usuário no Supabase para treinamento futuro da IA.
     * Estrutura isolada por usuário e por banco.
     */
    async salvarAprendizado(userId: string, item: LancamentoItem, modo: LancamentoModo): Promise<void> {
        try {
            const { error } = await supabase
                .from('lancamento_automatico_learning')
                .insert({
                    user_id: userId,
                    bank_id: item.bankId,
                    bank_name: item.bankName,
                    transaction_id: item.origemId,
                    nome_contribuinte: item.nome,
                    data_transacao: item.data,
                    valor: item.valor,
                    categoria_escolhida: item.igrejaSugerida,
                    modo_execucao: modo,
                    status_confirmacao: item.status === 'LANCADO',
                    timestamp_acao: new Date().toISOString()
                });

            if (error) {
                console.error("[LancamentoLearning] Erro ao persistir aprendizado no banco:", error);
            }
        } catch (e) {
            console.error("[LancamentoLearning] Falha crítica na persistência de memória:", e);
        }
    },

    /**
     * CONSULTA DE MEMÓRIA (IA Assistida):
     * Consulta a base de aprendizado para encontrar padrões de lançamentos anteriores
     * baseados no nome do contribuinte e no banco específico.
     */
    async gerarSugestoesReais(userId: string, item: LancamentoItem): Promise<SugestaoLancamento[]> {
        try {
            // Busca registros similares no mesmo banco e usuário
            const { data: historico, error } = await supabase
                .from('lancamento_automatico_learning')
                .select('categoria_escolhida, nome_contribuinte, valor, bank_id')
                .eq('user_id', userId)
                .eq('bank_id', item.bankId)
                .ilike('nome_contribuinte', `%${item.nome}%`)
                .limit(20);

            if (error || !historico || historico.length === 0) return [];

            // Agrupa por categoria para encontrar a maior frequência
            const frequencia: Record<string, { count: number, matchScore: number }> = {};
            
            historico.forEach(h => {
                const cat = h.categoria_escolhida;
                if (!frequencia[cat]) frequencia[cat] = { count: 0, matchScore: 0 };
                
                frequencia[cat].count++;
                
                // Pesos por similaridade
                if (h.nome_contribuinte === item.nome) frequencia[cat].matchScore += 10;
                if (Math.abs(h.valor - item.valor) < 0.01) frequencia[cat].matchScore += 5;
            });

            const sugeridas = Object.entries(frequencia)
                .sort((a, b) => b[1].matchScore - a[1].matchScore)
                .slice(0, 2);

            return sugeridas.map(([categoria, stats], idx) => {
                let confianca = Math.min(95, (stats.matchScore / 15) * 100);
                if (stats.count > 3) confianca += 5;

                return {
                    id: `sug-memoria-${Date.now()}-${idx}`,
                    lancamentoId: item.id,
                    campo: 'IGREJA',
                    valorSugerido: categoria,
                    confianca: Math.round(confianca),
                    origem: 'IA_HISTORICO'
                };
            });
        } catch (e) {
            console.error("[LancamentoService] Erro ao consultar memória:", e);
            return [];
        }
    },

    /**
     * DECISÃO AUTOMÁTICA (MODO AUTOMÁTICO):
     * Utiliza a memória para decidir se um lançamento pode ser feito sozinho.
     */
    async decidirCategoriaAutomatica(userId: string, item: LancamentoItem): Promise<string | null> {
        const sugestoes = await this.gerarSugestoesReais(userId, item);
        if (sugestoes.length > 0) {
            const melhor = sugestoes[0];
            // No modo automático, o rigor de confiança da memória deve ser alto (90%+)
            if (melhor.confianca >= 90) {
                return melhor.valorSugerido;
            }
        }
        return null;
    },

    obterObservacoesPorLancamento(lancamentoId: string, todasObservacoes: { lancamentoId: string }[]): any[] {
        return todasObservacoes.filter(obs => obs.lancamentoId === lancamentoId);
    }
};
