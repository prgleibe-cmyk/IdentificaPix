
export interface RawTextLine {
    index: number;
    text: string;
}

export interface GroupingRules {
    // Regex para identificar início de registro por Data (Ex: /\d{2}\/\d{2}/)
    dateRegex: RegExp;
    // Regex para identificar início de registro por Valor (Caso fallback)
    amountRegex: RegExp;
    // Se false, forçará uma linha por registro (comportamento CSV clássico)
    allowMultiLineDescription: boolean;
}

export interface GroupedRecord {
    id: string;
    startIndex: number;
    endIndex: number;
    rawText: string;
    lines: RawTextLine[];
    trigger: 'DATE' | 'AMOUNT' | 'CONTINUATION' | 'HEADER';
}

/**
 * MOTOR DE AGRUPAMENTO DETERMINÍSTICO (Core v3)
 * 
 * Responsabilidade Única:
 * Transformar uma lista plana de linhas de texto em blocos lógicos (Registros),
 * garantindo que nenhuma linha seja descartada e que registros multi-linha
 * sejam preservados.
 * 
 * NÃO realiza parsing de valores ou datas. Apenas agrupa.
 */
export class GroupingEngine {

    /**
     * Processa as linhas brutas e retorna registros agrupados.
     */
    static process(rawLines: string[], rules: GroupingRules): GroupedRecord[] {
        const records: GroupedRecord[] = [];
        let currentBuffer: RawTextLine[] = [];
        let currentTrigger: GroupedRecord['trigger'] = 'HEADER';
        
        // Mapeia para estrutura interna com índice original
        const inputLines: RawTextLine[] = rawLines.map((text, index) => ({ index, text }));

        const flushBuffer = () => {
            if (currentBuffer.length === 0) return;

            const startIndex = currentBuffer[0].index;
            const endIndex = currentBuffer[currentBuffer.length - 1].index;
            const rawText = currentBuffer.map(l => l.text).join(' '); // Concatenação espacial simples

            records.push({
                id: `rec-${startIndex}-${endIndex}`,
                startIndex,
                endIndex,
                rawText,
                lines: [...currentBuffer],
                trigger: currentTrigger
            });

            currentBuffer = [];
        };

        for (let i = 0; i < inputLines.length; i++) {
            const line = inputLines[i];
            const content = line.text.trim();

            if (!content) continue; // Ignora linhas vazias, mas mantém integridade do índice

            // 1. Verifica Gatilhos de Início de Novo Registro
            const hasDate = rules.dateRegex.test(content);
            const hasAmount = rules.amountRegex.test(content);
            
            let isNewRecord = false;
            let newTrigger: GroupedRecord['trigger'] = 'CONTINUATION';

            // REGRA 1: Data é o gatilho mais forte. Sempre inicia novo registro.
            if (hasDate) {
                isNewRecord = true;
                newTrigger = 'DATE';
            } 
            // REGRA 2: Valor inicia registro APENAS se não houver um aberto ou se estivermos no Header
            // (Isso permite que a linha 3 de um registro tenha um valor sem quebrar o registro da linha 1)
            else if (hasAmount && (currentTrigger === 'HEADER' || !rules.allowMultiLineDescription)) {
                // Se não permitimos multi-linha, qualquer valor é um novo registro potencial
                isNewRecord = true;
                newTrigger = 'AMOUNT';
            }

            // REGRA DE QUEBRA:
            // Se detectamos um novo início E já temos dados acumulados, fecha o anterior.
            if (isNewRecord && currentBuffer.length > 0) {
                // Exceção: Se for a mesma linha que iniciou (impossível no loop, mas por segurança)
                flushBuffer();
            }

            // Se o buffer estava vazio (início do arquivo ou pós-flush), define o gatilho deste novo bloco
            if (currentBuffer.length === 0) {
                currentTrigger = isNewRecord ? newTrigger : 'HEADER';
            }

            // REGRA DE CONTINUIDADE:
            // Adiciona a linha ao buffer atual (seja ele novo ou existente)
            currentBuffer.push(line);
        }

        // Flush final (último registro do arquivo)
        flushBuffer();

        return records;
    }
}
