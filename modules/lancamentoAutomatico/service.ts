
import { LancamentoItem, BancoLancamento, ObservacaoLog, SugestaoLancamento, LancamentoModo } from './types';
import { supabase } from '../../services/supabaseClient';
import { GoogleGenAI } from "@google/genai";

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
                executionStatus: 'aguardando'
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
                timestamp_acao: new Date().toISOString()
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
     * TUTOR ENGINE: Aplica instruções específicas via LLM para decidir destino
     */
    async consultarTutor(item: LancamentoItem, instrucao: string): Promise<{ categoria: string, motivo: string } | null> {
        if (!instrucao.trim() || !process.env.API_KEY) return null;
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Analise a transação: "${item.nome}" no valor de ${item.valor} do banco ${item.bankName}.
            Instrução do Usuário: "${instrucao}"
            Baseado na instrução, qual o destino (Igreja/Centro de Custo) correto? 
            Responda apenas o nome do destino ou "IGNORAR" se não houver regra aplicável.`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { temperature: 0.1 }
            });
            const res = response.text?.trim() || "";
            return (res === "IGNORAR" || res.length < 2) ? null : { categoria: res, motivo: 'Regra do Tutor' };
        } catch (e) { return null; }
    },

    async gerarSugestoesReais(userId: string, item: LancamentoItem): Promise<SugestaoLancamento[]> {
        try {
            const { data: historico } = await supabase.from('lancamento_automatico_learning')
                .select('categoria_escolhida, nome_contribuinte, valor').eq('user_id', userId).eq('bank_id', item.bankId)
                .ilike('nome_contribuinte', `%${item.nome.substring(0, 10)}%`).limit(20);

            if (!historico || historico.length === 0) return [];
            const freq: Record<string, number> = {};
            historico.forEach(h => { freq[h.categoria_escolhida] = (freq[h.categoria_escolhida] || 0) + 1; });
            return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([cat, count], idx) => ({
                id: `sug-${Date.now()}-${idx}`, lancamentoId: item.id, campo: 'IGREJA', valorSugerido: cat,
                confianca: Math.min(95, 60 + (count * 5)), origem: 'IA_HISTORICO'
            }));
        } catch (e) { return []; }
    },

    async decidirCategoriaAutomatica(userId: string, item: LancamentoItem, instruction?: string): Promise<{ categoria: string, origem: string } | null> {
        // 1. Tenta Tutor primeiro (Prioridade do Usuário)
        if (instruction) {
            const tutorRes = await this.consultarTutor(item, instruction);
            if (tutorRes) return { categoria: tutorRes.categoria, origem: 'TUTOR' };
        }
        // 2. Fallback para Memória Histórica
        const sugestoes = await this.gerarSugestoesReais(userId, item);
        if (sugestoes.length > 0 && sugestoes[0].confianca >= 85) {
            return { categoria: sugestoes[0].valorSugerido, origem: 'MEMORIA' };
        }
        return null;
    }
};
