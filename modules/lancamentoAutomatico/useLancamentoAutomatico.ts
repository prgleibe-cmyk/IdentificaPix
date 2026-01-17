
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
        
        // No modo assistido ou manual, tentamos sugerir via IA se houver tutor/memória
        if (user) {
            const item = state.bancos.find(b => b.bankId === bankId)?.itens.find(i => i.id === itemId);
            if (item) {
                const instr = await lancamentoService.obterInstrucaoIA(user.id, bankId);
                const decisao = await lancamentoService.decidirCategoriaAutomatica(user.id, item, instr);
                if (decisao) {
                    atualizarIgrejaSugerida(bankId, itemId, decisao.categoria);
                    registrarObservacao(itemId, 'SUGESTAO_IA', { decisao });
                }
            }
        }
    }, [state.bancos, user, stateIniciarLancamento, setCurrentItemId, atualizarIgrejaSugerida, registrarObservacao]);

    const confirmarLancamento = useCallback(async (bankId: string, itemId: string) => {
        const item = state.bancos.find(b => b.bankId === bankId)?.itens.find(i => i.id === itemId);
        if (user && item) await lancamentoService.salvarAprendizado(user.id, item, state.modoAtivo);
        stateConfirmarLancamento(bankId, itemId);
    }, [state.bancos, state.modoAtivo, user, stateConfirmarLancamento]);

    // LOOP DE EXECUÇÃO AUTOMÁTICA
    useEffect(() => {
        if (state.modoAtivo !== MODOS_LANCAMENTO.AUTOMATICO || !state.isAutoRunning || !user || state.currentItemId) return;

        const processarFila = async () => {
            const proximoItem = state.bancos.flatMap(b => b.itens).find(i => state.selectedIds.includes(i.id));
            if (!proximoItem) { setAutoRunning(false); return; }

            const instr = await lancamentoService.obterInstrucaoIA(user.id, proximoItem.bankId);
            const decisao = await lancamentoService.decidirCategoriaAutomatica(user.id, proximoItem, instr);

            if (decisao) {
                stateIniciarLancamento(proximoItem.bankId, proximoItem.id);
                setCurrentItemId(proximoItem.id);
                atualizarIgrejaSugerida(proximoItem.bankId, proximoItem.id, decisao.categoria);
                registrarObservacao(proximoItem.id, 'AUTO_EXEC', { decisao });
                
                executionTimer.current = setTimeout(() => {
                    confirmarLancamento(proximoItem.bankId, proximoItem.id);
                }, 800 + Math.random() * 400); // Delay humano
            } else {
                registrarObservacao(proximoItem.id, 'AUTO_SKIP', { motivo: 'Sem confiança' });
                toggleSelection(proximoItem.id);
            }
        };
        processarFila();
        return () => clearTimeout(executionTimer.current);
    }, [state.isAutoRunning, state.currentItemId, state.selectedIds, state.modoAtivo, state.bancos, user, stateIniciarLancamento, setCurrentItemId, atualizarIgrejaSugerida, registrarObservacao, confirmarLancamento, toggleSelection, setAutoRunning]);

    return {
        ...state, setModoAtivo, toggleSelection, setBulkSelection, setAutoRunning,
        iniciarLancamento, confirmarLancamento, atualizarIgrejaSugerida,
        openInstructions, saveInstructions, closeInstructions: () => setInstructionModal(false),
        obterSugestoesDoItem: (id: string) => state.sugestoes.filter(s => s.lancamentoId === id)
    };
};
