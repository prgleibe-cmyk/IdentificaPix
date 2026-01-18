import { useContext, useEffect, useCallback, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLancamentoState } from './state';
import { lancamentoService } from './service';
import { MODOS_LANCAMENTO } from './constants';
import { enqueue as iaEnqueue, startAuto, stopAuto, clearQueue, onIAFinish } from "../lancamentoAutomaticoIA";

export const useLancamentoAutomatico = () => {
    const { activeBankFiles, banks } = useContext(AppContext);
    const { user } = useAuth();
    const isFirstLoad = useRef(true);
    const executionTimer = useRef<any>(null);

    const { 
        state, setModoAtivo, setBancos, toggleSelection, setBulkSelection, setAutoRunning,
        setInstructionModal, setCurrentItemId, atualizarIgrejaSugerida,
        iniciarLancamento: stateIniciarLancamento, confirmarLancamento: stateConfirmarLancamento,
        registrarObservacao, adicionarSugestoes,
    } = useLancamentoState();

    useEffect(() => {
        if (activeBankFiles?.length > 0 && isFirstLoad.current) {
            setBancos(lancamentoService.mapearListaVivaPorBanco(activeBankFiles, banks));
            isFirstLoad.current = false;
        }
    }, [activeBankFiles, banks, setBancos]);

    const openInstructions = useCallback(async (bankId: string) => {
        if (!user) return;
        const text = await lancamentoService.obterInstrucaoIA(user.id, bankId);
        setInstructionModal(true, text);
    }, [user, setInstructionModal]);

    const saveInstructions = useCallback(async (bankId: string, text: string) => {
        if (!user) return;
        await lancamentoService.salvarInstrucaoIA(user.id, bankId, text);
        setInstructionModal(false);
    }, [user, setInstructionModal]);

    const iniciarLancamento = useCallback(async (bankId: string, itemId: string) => {
        stateIniciarLancamento(bankId, itemId);
        setCurrentItemId(itemId);
        
        if (user) {
            const item = state.bancos.find(b => b.bankId === bankId)?.itens.find(i => i.id === itemId);
            if (item) {
                const instr = await lancamentoService.obterInstrucaoIA(user.id, bankId);
                const decisao = await lancamentoService.decidirCategoriaAutomatica(user.id, item, instr);
                if (decisao) {
                    atualizarIgrejaSugerida(bankId, itemId, decisao.categoria);
                    registrarObservacao(itemId, 'SUGESTAO_IA', { 
                        categoria: decisao.categoria, 
                        confianca: decisao.proposal.confianca,
                        motivo: decisao.proposal.observacao 
                    });
                }
            }
        }
    }, [state.bancos, user, stateIniciarLancamento, setCurrentItemId, atualizarIgrejaSugerida, registrarObservacao]);

    const confirmarLancamento = useCallback(async (bankId: string, itemId: string) => {
        const item = state.bancos.find(b => b.bankId === bankId)?.itens.find(i => i.id === itemId);
        if (user && item) await lancamentoService.salvarAprendizado(user.id, item, state.modoAtivo);
        stateConfirmarLancamento(bankId, itemId);
    }, [state.bancos, state.modoAtivo, user, stateConfirmarLancamento]);

    useEffect(() => {
        onIAFinish((itemIA) => {
            if (!itemIA) return;
            confirmarLancamento(itemIA.bankId, itemIA.id);
        });
    }, [confirmarLancamento]);

    useEffect(() => {
        if (state.modoAtivo !== MODOS_LANCAMENTO.AUTOMATICO || !state.isAutoRunning || !user) {
            stopAuto();
            return;
        }

        if (state.selectedIds.length > 0) {
            startAuto();
        }

        const processarProximoDaFila = async () => {
            if (state.currentItemId) return;

            const proximoItem = state.bancos.flatMap(b => b.itens).find(i => state.selectedIds.includes(i.id));
            
            if (!proximoItem) { 
                setAutoRunning(false); 
                stopAuto();
                clearQueue();
                return; 
            }

            iaEnqueue({
                id: proximoItem.id,
                bankId: proximoItem.bankId,
                transactionData: proximoItem,
                status: "pending",
                attempts: 0,
                priority: 1
            });

            try {
                const instr = await lancamentoService.obterInstrucaoIA(user.id, proximoItem.bankId);
                const decisao = await lancamentoService.decidirCategoriaAutomatica(user.id, proximoItem, instr);

                if (decisao && decisao.proposal.confianca >= 80) {
                    stateIniciarLancamento(proximoItem.bankId, proximoItem.id);
                    setCurrentItemId(proximoItem.id);
                    atualizarIgrejaSugerida(proximoItem.bankId, proximoItem.id, decisao.categoria);
                    
                    // Força sincronização do estado visual para refletir "executando"
                    setBancos([...state.bancos]);

                    registrarObservacao(proximoItem.id, 'IA_DECISAO_AUTO', { 
                        categoria: decisao.categoria, 
                        confianca: decisao.proposal.confianca,
                        caixa: decisao.proposal.caixa
                    });
                } else {
                    registrarObservacao(proximoItem.id, 'IA_PULO_AUTO', { 
                        motivo: decisao ? 'Baixa confiança' : 'Sem padrão reconhecido' 
                    });
                    toggleSelection(proximoItem.id);
                }
            } catch (err) {
                console.error("[AutoLoop] Falha ao processar item:", err);
                toggleSelection(proximoItem.id);
            }
        };

        const intervalId = setTimeout(processarProximoDaFila, 500);
        return () => {
            clearTimeout(intervalId);
            clearTimeout(executionTimer.current);
        };
    }, [
        state.isAutoRunning, 
        state.currentItemId, 
        state.selectedIds, 
        state.modoAtivo, 
        state.bancos, 
        user, 
        stateIniciarLancamento, 
        setCurrentItemId, 
        atualizarIgrejaSugerida, 
        registrarObservacao, 
        confirmarLancamento, 
        toggleSelection, 
        setAutoRunning,
        setBancos
    ]);

    return {
        ...state, setModoAtivo, toggleSelection, setBulkSelection, setAutoRunning,
        iniciarLancamento, confirmarLancamento, atualizarIgrejaSugerida,
        openInstructions, saveInstructions, closeInstructions: () => setInstructionModal(false),
        obterSugestoesDoItem: (id: string) => state.sugestoes.filter(s => s.lancamentoId === id)
    };
};