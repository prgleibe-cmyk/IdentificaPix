
import { useState, useCallback } from 'react';
import { LancamentoItem, LancamentoModo, LancamentoState, BancoLancamento, ObservacaoLog, SugestaoLancamento, AprovacaoSugestao } from './types';
import { MODOS_LANCAMENTO } from './constants';

export const useLancamentoState = () => {
    const [state, setState] = useState<LancamentoState & { selectedIds: string[], isAutoRunning: boolean, currentItemId: string | null }>({
        bancos: [],
        modoAtivo: MODOS_LANCAMENTO.OBSERVACAO,
        isProcessando: false,
        observacoes: [],
        sugestoes: [],
        aprovacoes: [],
        selectedIds: [],
        isAutoRunning: false,
        currentItemId: null
    });

    const setModoAtivo = useCallback((modo: LancamentoModo) => {
        setState(prev => ({ ...prev, modoAtivo: modo, isAutoRunning: false, currentItemId: null }));
    }, []);

    const setBancos = useCallback((novosBancos: BancoLancamento[]) => {
        setState(prev => ({ 
            ...prev, 
            bancos: novosBancos 
        }));
    }, []);

    const toggleSelection = useCallback((id: string) => {
        setState(prev => {
            if (prev.isAutoRunning) return prev;
            const selectedIds = prev.selectedIds.includes(id)
                ? prev.selectedIds.filter(sid => sid !== id)
                : [...prev.selectedIds, id];
            return { ...prev, selectedIds };
        });
    }, []);

    const setBulkSelection = useCallback((ids: string[], select: boolean) => {
        setState(prev => {
            if (prev.isAutoRunning) return prev;
            let nextSelected: string[];
            if (select) {
                const uniqueNewIds = ids.filter(id => !prev.selectedIds.includes(id));
                nextSelected = [...prev.selectedIds, ...uniqueNewIds];
            } else {
                nextSelected = prev.selectedIds.filter(id => !ids.includes(id));
            }
            return { ...prev, selectedIds: nextSelected };
        });
    }, []);

    const setAutoRunning = useCallback((running: boolean) => {
        setState(prev => ({ ...prev, isAutoRunning: running }));
    }, []);

    const setCurrentItemId = useCallback((id: string | null) => {
        setState(prev => ({ ...prev, currentItemId: id }));
    }, []);

    const atualizarIgrejaSugerida = useCallback((bankId: string, itemId: string, novaIgreja: string) => {
        setState(prev => ({
            ...prev,
            bancos: prev.bancos.map(b => b.bankId === bankId ? {
                ...b,
                itens: b.itens.map(i => i.id === itemId ? { ...i, igrejaSugerida: novaIgreja } : i)
            } : b)
        }));
    }, []);

    const iniciarLancamento = useCallback((bankId: string, itemId: string) => {
        setState(prev => ({
            ...prev,
            bancos: prev.bancos.map(b => b.bankId === bankId ? {
                ...b,
                itens: b.itens.map(i => i.id === itemId ? { ...i, executionStatus: 'executando' as const } : i)
            } : b),
            observacoes: [{
                id: `obs-init-${Date.now()}`,
                lancamentoId: itemId,
                acao: 'LANCAMENTO_INICIADO',
                payload: { bankId },
                dataHora: new Date().toISOString()
            }, ...prev.observacoes]
        }));
    }, []);

    const confirmarLancamento = useCallback((bankId: string, itemId: string) => {
        setState(prev => ({
            ...prev,
            selectedIds: prev.selectedIds.filter(id => id !== itemId),
            currentItemId: prev.currentItemId === itemId ? null : prev.currentItemId,
            bancos: prev.bancos.map(banco => {
                if (banco.bankId !== bankId) return banco;
                
                const itemToMove = banco.itens.find(i => i.id === itemId);
                if (!itemToMove) return banco;

                const updatedItem = { ...itemToMove, status: 'LANCADO' as const, executionStatus: 'confirmado' as const };

                return {
                    ...banco,
                    itens: banco.itens.filter(i => i.id !== itemId),
                    lancados: [updatedItem, ...banco.lancados]
                };
            })
        }));
    }, []);

    const adicionarSugestoes = useCallback((novas: SugestaoLancamento[]) => {
        setState(prev => ({
            ...prev,
            sugestoes: [...prev.sugestoes.filter(s => !novas.some(n => n.lancamentoId === s.lancamentoId)), ...novas]
        }));
    }, []);

    const registrarAprovacao = useCallback((aprovacao: AprovacaoSugestao) => {
        setState(prev => ({
            ...prev,
            aprovacoes: [...prev.aprovacoes.filter(a => a.sugestaoId !== aprovacao.sugestaoId), aprovacao]
        }));
    }, []);

    const registrarObservacao = useCallback((lancamentoId: string, acao: string, payload: any) => {
        const novaObservacao: ObservacaoLog = {
            id: `obs-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            lancamentoId,
            acao,
            payload,
            dataHora: new Date().toISOString()
        };

        setState(prev => ({
            ...prev,
            observacoes: [novaObservacao, ...prev.observacoes]
        }));
    }, []);

    return {
        state,
        setModoAtivo,
        setBancos,
        toggleSelection,
        setBulkSelection,
        setAutoRunning,
        setCurrentItemId,
        atualizarIgrejaSugerida,
        iniciarLancamento,
        confirmarLancamento,
        adicionarSugestoes,
        registrarAprovacao,
        registrarObservacao
    };
};
