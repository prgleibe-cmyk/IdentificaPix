
import { useContext, useEffect, useCallback, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLancamentoState } from './state';
import { lancamentoService } from './service';
import { MODOS_LANCAMENTO } from './constants';

export const useLancamentoAutomatico = () => {
    const { activeBankFiles, banks } = useContext(AppContext);
    const { user } = useAuth();
    const isFirstLoad = useRef(true);
    const executionTimer = useRef<any>(null);

    const { 
        state, 
        setModoAtivo, 
        setBancos, 
        toggleSelection,
        setBulkSelection,
        setAutoRunning,
        setCurrentItemId,
        atualizarIgrejaSugerida,
        iniciarLancamento: stateIniciarLancamento,
        confirmarLancamento: stateConfirmarLancamento,
        registrarObservacao,
        adicionarSugestoes,
        registrarAprovacao
    } = useLancamentoState();

    useEffect(() => {
        if (activeBankFiles && activeBankFiles.length > 0 && isFirstLoad.current) {
            const novosBancos = lancamentoService.mapearListaVivaPorBanco(activeBankFiles, banks);
            setBancos(novosBancos);
            isFirstLoad.current = false;
        }
    }, [activeBankFiles, banks, setBancos]);

    const iniciarLancamento = useCallback(async (bankId: string, itemId: string) => {
        // Primeiro muda o status para "executando"
        stateIniciarLancamento(bankId, itemId);
        setCurrentItemId(itemId);

        // Se estiver no Modo Assistido, tenta buscar na memória para sugerir na hora
        if (state.modoAtivo === MODOS_LANCAMENTO.ASSISTIDO && user) {
            const banco = state.bancos.find(b => b.bankId === bankId);
            const item = banco?.itens.find(i => i.id === itemId);
            
            if (item) {
                const sugestoes = await lancamentoService.gerarSugestoesReais(user.id, item);
                if (sugestoes.length > 0) {
                    const melhorSugestao = sugestoes[0];
                    adicionarSugestoes(sugestoes);
                    
                    // Aplica a sugestão da IA ao item para o usuário ver e decidir
                    atualizarIgrejaSugerida(bankId, itemId, melhorSugestao.valorSugerido);
                    
                    registrarObservacao(itemId, 'SUGESTAO_MEMORIA_ASSISTIDA', { 
                        sugestao: melhorSugestao.valorSugerido,
                        confianca: melhorSugestao.confianca 
                    });
                }
            }
        }
    }, [state.modoAtivo, state.bancos, user, stateIniciarLancamento, setCurrentItemId, adicionarSugestoes, atualizarIgrejaSugerida, registrarObservacao]);

    const confirmarLancamento = useCallback(async (bankId: string, itemId: string) => {
        const banco = state.bancos.find(b => b.bankId === bankId);
        const item = banco?.itens.find(i => i.id === itemId);

        // PERSISTÊNCIA NA MEMÓRIA DE APRENDIZADO
        if (user && item) {
            // Chamamos o serviço para salvar no Supabase antes de mover o estado local
            await lancamentoService.salvarAprendizado(user.id, item, state.modoAtivo);
        }

        stateConfirmarLancamento(bankId, itemId);
    }, [state.bancos, state.modoAtivo, user, stateConfirmarLancamento]);

    /**
     * MOTOR DE FILA SEQUENCIAL (MODO AUTOMÁTICO)
     * Garante que apenas um item execute por vez utilizando a memória de aprendizado.
     */
    useEffect(() => {
        if (state.modoAtivo !== MODOS_LANCAMENTO.AUTOMATICO || !state.isAutoRunning || !user) return;

        if (state.currentItemId) return;

        const proximoBanco = state.bancos.find(b => b.itens.some(i => state.selectedIds.includes(i.id)));
        if (!proximoBanco) {
            setAutoRunning(false);
            return;
        }

        const proximoItem = proximoBanco.itens.find(i => state.selectedIds.includes(i.id));
        if (!proximoItem) return;

        const processarProximo = async () => {
            // Tenta decidir via memória
            const categoriaDecidida = await lancamentoService.decidirCategoriaAutomatica(user.id, proximoItem);

            if (categoriaDecidida) {
                setCurrentItemId(proximoItem.id);
                // Injeta a decisão e executa
                atualizarIgrejaSugerida(proximoBanco.bankId, proximoItem.id, categoriaDecidida);
                
                await stateIniciarLancamento(proximoBanco.bankId, proximoItem.id);
                
                executionTimer.current = setTimeout(() => {
                    confirmarLancamento(proximoBanco.bankId, proximoItem.id);
                }, 1500);
            } else {
                registrarObservacao(proximoItem.id, 'AUTO_SKIP', { motivo: 'Padrão não encontrado na memória para este banco.' });
                toggleSelection(proximoItem.id);
            }
        };

        processarProximo();

        return () => {
            if (executionTimer.current) clearTimeout(executionTimer.current);
        };
    }, [state.isAutoRunning, state.currentItemId, state.selectedIds, state.modoAtivo, state.bancos, user, stateIniciarLancamento, confirmarLancamento, setCurrentItemId, setAutoRunning, toggleSelection, registrarObservacao, atualizarIgrejaSugerida]);

    return {
        bancos: state.bancos,
        modoAtivo: state.modoAtivo,
        isProcessando: state.isProcessando,
        selectedIds: state.selectedIds,
        isAutoRunning: state.isAutoRunning,
        currentItemId: state.currentItemId,
        setModoAtivo,
        toggleSelection,
        setBulkSelection,
        setAutoRunning,
        iniciarLancamento,
        confirmarLancamento,
        atualizarIgrejaSugerida,
        obterLogsDoItem: (id: string) => state.observacoes.filter(o => o.lancamentoId === id),
        obterSugestoesDoItem: (id: string) => state.sugestoes.filter(s => s.lancamentoId === id)
    };
};
