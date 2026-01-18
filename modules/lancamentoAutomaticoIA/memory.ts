import { MemoryItem, LearnedStep, QueueItem } from './types';
import { getIAState, setMemory } from './state';
import { supabase } from '../../services/supabaseClient';

const runtimeCache: Record<string, LearnedStep[]> = {};

/**
 * Função de decisão baseada em memória:
 * Localiza um padrão salvo que corresponda ao item atual.
 */
export function decideByMemory(item: any, memory: MemoryItem[]) {
  if (!memory || !memory.length) return null;

  const match = memory.find(m =>
    m.pattern === (item.nome || item.transactionData?.nome) &&
    m.bankId === (item.bankId || item.transactionData?.bankId)
  );

  return match || null;
}

/**
 * Persiste o aprendizado da IA no banco de dados.
 * Utiliza uma chave composta (banco + pagador + valor) para reforçar padrões conhecidos.
 */
export async function saveLearning(item: any) {
    if (!item || !item.transactionData) return;

    const data = item.transactionData;
    const bankId = item.bankId || data.bankId;
    const payer = data.nome;
    const value = data.valor;
    const action = data.igrejaSugerida;

    if (!bankId || !payer || !action) return;

    // Chave única para este padrão específico
    const key = `${bankId}_${payer}_${value}`;

    const record = {
        key,
        bank_id: bankId,
        payer_name: payer,
        amount: value,
        target_category: action,
        confidence_level: 1, // Incremento base
        updated_at: new Date().toISOString()
    };

    try {
        // Busca se já existe para incrementar confiança
        const { data: existing } = await supabase
            .from("ia_learned_memory")
            .select("confidence_level")
            .eq("key", key)
            .maybeSingle();

        if (existing) {
            record.confidence_level = (existing.confidence_level || 0) + 1;
        }

        await supabase
            .from("ia_learned_memory")
            .upsert(record, { onConflict: "key" });

        // Atualiza memória em tempo de execução
        const { memory } = getIAState();
        const newMemory: MemoryItem = {
            id: key,
            bankId,
            pattern: payer,
            result: action,
            confidence: record.confidence_level,
            lastUsed: record.updated_at
        };
        setMemory([...memory.filter(m => m.id !== key), newMemory]);

        console.debug("[IA MEMORY] Padrão aprendido/reforçado:", key, "Confiança:", record.confidence_level);
    } catch (e) {
        console.error("[IA MEMORY] Falha ao persistir aprendizado:", e);
    }
}

/**
 * Recupera aprendizados baseados no histórico de transações similares.
 */
export const loadLearning = (bankId: string): MemoryItem[] => {
    const { memory } = getIAState();
    return memory.filter(m => m.bankId === bankId);
};

/**
 * Busca na memória global/local um padrão que corresponda ao item da fila.
 */
export async function getMemoryForItem(item: QueueItem): Promise<MemoryItem | null> {
    const { memory } = getIAState();
    const match = memory.find(m => 
        m.bankId === item.bankId && 
        m.pattern === item.transactionData.nome
    );
    return match || null;
}

/**
 * Persiste um seletor CSS aprendido durante a observação do usuário no Supabase.
 */
export async function saveLearnedSelector(bankId: string, data: Omit<LearnedStep, 'bankId'>) {
    if (!runtimeCache[bankId]) runtimeCache[bankId] = [];
    
    const newStep: LearnedStep = { ...data, bankId };
    runtimeCache[bankId].push(newStep);

    try {
        await supabase.from("ia_learned_steps").insert([{
            bank_id: bankId,
            action: data.action,
            selector: data.selector,
            order: data.order
        }]);
    } catch (e) {
        console.error("Erro ao persistir seletor no Supabase:", e);
    }
}

/**
 * Recupera seletores aprendidos para um banco específico do Supabase ou Cache.
 */
export async function loadLearnedSelectors(bankId: string): Promise<LearnedStep[]> {
    if (runtimeCache[bankId]) return runtimeCache[bankId];

    try {
        const { data, error } = await supabase
            .from("ia_learned_steps")
            .select("*")
            .eq("bank_id", bankId)
            .order("order", { ascending: true });

        if (error) throw error;

        const mappedData: LearnedStep[] = (data || []).map(d => ({
            bankId: d.bank_id,
            action: d.action as "click" | "input",
            selector: d.selector,
            order: d.order
        }));

        runtimeCache[bankId] = mappedData;
        return mappedData;
    } catch (e) {
        console.error("Erro ao carregar seletores do Supabase:", e);
        return [];
    }
}