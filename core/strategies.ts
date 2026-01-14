
import { Transaction, FileModel } from '../types';
import { DateResolver } from './processors/DateResolver';
import { AmountResolver } from './processors/AmountResolver';
import { NameResolver } from './processors/NameResolver';
import { TypeResolver } from './processors/TypeResolver';
import { generateFingerprint } from './processors/Fingerprinter';

/**
 * 🛡️ CORE_ESTAVEL - MOTOR DE ESTRATÉGIAS (SYSTEM HEART)
 * --------------------------------------------------------------------------
 * 🧱 REGRA DE OURO:
 * “Qualquer ajuste futuro só pode acontecer em UM módulo isolado por vez, 
 *  sem tocar no CORE_ESTAVEL.”
 * --------------------------------------------------------------------------
 * 
 * ESTE ARQUIVO É A ÚNICA FONTE DE VERDADE PARA O PROCESSAMENTO DE ARQUIVOS.
 * 
 * - NÃO ALTERE a lógica das estratégias existentes (Generic, Sicoob, Database).
 * - NÃO ADICIONE dependências de UI ou React aqui.
 * - NÃO MODIFIQUE os parsers auxiliares sem rodar a suíte de testes completa.
 * 
 * Status: CONGELADO (v3.0 Stable)
 */

/**
 * Interface que todo Parser de Banco deve implementar.
 */
export interface BankStrategy {
    name: string;
    canHandle(filename: string, content: string, models?: FileModel[]): boolean;
    parse(content: string, yearAnchor: number, models?: FileModel[], globalKeywords?: string[]): Transaction[];
}

/**
 * ESTRATÉGIA: MODELO APRENDIDO (DatabaseModelStrategy)
 * Verifica se o arquivo corresponde a um modelo salvo no banco/local.
 * CORE_ESTAVEL: NÃO MODIFICAR.
 */
export const DatabaseModelStrategy: BankStrategy = {
    name: 'Modelo Aprendido',

    canHandle: (filename, content, models) => {
        if (!models || models.length === 0) return false;
        
        const fingerprint = generateFingerprint(content);
        if (!fingerprint) return false;

        // Procura um modelo com o mesmo delimitador e contagem de colunas
        return models.some(m => 
            m.fingerprint.delimiter === fingerprint.delimiter &&
            m.fingerprint.columnCount === fingerprint.columnCount
        );
    },

    parse: (content, yearAnchor, models, globalKeywords = []) => {
        if (!models || models.length === 0) return [];
        const fingerprint = generateFingerprint(content);
        if (!fingerprint) return [];

        // Tenta encontrar o modelo correspondente na lista fornecida
        const matchingModel = models.find(m => 
            m.fingerprint.delimiter === fingerprint.delimiter &&
            m.fingerprint.columnCount === fingerprint.columnCount
        );

        if (!matchingModel) return [];

        const transactions: Transaction[] = [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        const { dateColumnIndex, descriptionColumnIndex, amountColumnIndex, typeColumnIndex, skipRowsStart } = matchingModel.mapping;
        const delimiter = matchingModel.fingerprint.delimiter;

        // Combina palavras-chave do modelo com as globais
        const combinedKeywords = [
            ...(matchingModel.parsingRules?.ignoredKeywords || []),
            ...globalKeywords
        ];

        // Pula linhas iniciais configuradas
        const dataLines = lines.slice(skipRowsStart || 0);

        dataLines.forEach((line, index) => {
            const cols = line.split(delimiter || ';');
            
            // Verifica se tem colunas suficientes
            if (cols.length <= Math.max(dateColumnIndex, descriptionColumnIndex, amountColumnIndex)) return;

            const rawDate = cols[dateColumnIndex];
            const rawDesc = cols[descriptionColumnIndex];
            const rawAmount = cols[amountColumnIndex];
            const rawType = typeColumnIndex !== undefined ? cols[typeColumnIndex] : '';

            const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
            const amountStr = AmountResolver.clean(rawAmount);
            const amount = parseFloat(amountStr);

            if (isoDate && !isNaN(amount) && amount !== 0) {
                // REMOVIDO FILTRO DE CONTROLE (SALDO/TOTAL) A PEDIDO DO USUÁRIO
                // if (NameResolver.isControlRow(rawDesc)) return;

                const cleanedDesc = NameResolver.clean(rawDesc, combinedKeywords);
                // Se o tipo não vier do arquivo, tenta inferir
                const finalType = rawType ? rawType.trim().toUpperCase() : TypeResolver.resolveFromDescription(rawDesc);

                transactions.push({
                    id: `db-${index}-${Date.now()}`,
                    date: isoDate,
                    description: rawDesc,
                    amount: amount,
                    originalAmount: rawAmount,
                    cleanedDescription: cleanedDesc,
                    contributionType: finalType
                });
            }
        });

        // Atualiza o nome da estratégia para exibir qual modelo foi usado
        // (Nota: Isso é um efeito colateral no objeto singleton, útil para debug)
        DatabaseModelStrategy.name = `Modelo: ${matchingModel.name}`;
        
        return transactions;
    }
};

/**
 * ESTRATÉGIA: SICOOB (PDF/Texto)
 * Ajustada para leitura em blocos com filtro agressivo de Cabeçalho/Rodapé
 * CORE_ESTAVEL: NÃO MODIFICAR.
 */
export const SicoobStrategy: BankStrategy = {
    name: 'Sicoob (Extrato PDF)',
    
    canHandle: (filename, content) => {
        const upper = content.toUpperCase();
        return upper.includes('SICOOB') || 
               (upper.includes('DATA') && upper.includes('HISTÓRICO') && upper.includes('VALOR'));
    },

    parse: (content, yearAnchor, models, globalKeywords = []) => {
        const transactions: Transaction[] = [];
        const lines = content.split(/\r?\n/);
        
        // Regex para capturar a linha principal: "DD/MM  DESCRIÇÃO...  VALOR(C/D)"
        const headerRegex = /^(\d{2}\/\d{2})\s+(.*?)\s+([\d.,]+[CD]?\*?)$/;

        // Regex de LIXO (Header de página repetido e Rodapé)
        const noiseRegex = /SICOOB|SISTEMA DE COOPERATIVAS|PLATAFORMA DE SERVIÇOS|EXTRATO CONTA|DATA\s+HISTÓRICO\s+VALOR|TOTAL DE|OUVIDORIA|CENTRAL DE ATENDIMENTO|DEFICIENTES AUDITIVOS|CAPITAIS|REGIÕES|0800/i;

        let currentBlock: {
            date: string;
            lines: string[];
            rawAmount: string;
        } | null = null;

        const processBlock = (block: typeof currentBlock) => {
            if (!block) return;

            const isoDate = DateResolver.resolveToISO(block.date, yearAnchor);
            
            // Tratamento do Valor (C = Crédito, D = Débito)
            let multiplier = 1;
            const valUpper = block.rawAmount.toUpperCase();
            if (valUpper.includes('D') || valUpper.includes('-')) multiplier = -1;
            
            const amountStr = AmountResolver.clean(block.rawAmount);
            const amount = Math.abs(parseFloat(amountStr)) * multiplier;

            if (isoDate && !isNaN(amount)) {
                const fullDescription = block.lines.join(' ');
                const cleanedDescription = NameResolver.clean(fullDescription, globalKeywords);
                const type = TypeResolver.resolveFromDescription(fullDescription);

                transactions.push({
                    id: `sicoob-${isoDate}-${amount}-${transactions.length}`,
                    date: isoDate,
                    description: fullDescription, 
                    amount: amount,
                    originalAmount: block.rawAmount,
                    cleanedDescription: cleanedDescription, 
                    contributionType: type
                });
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (noiseRegex.test(line)) continue;

            const match = line.match(headerRegex);

            if (match) {
                if (currentBlock) {
                    processBlock(currentBlock);
                }
                currentBlock = {
                    date: match[1], 
                    lines: [match[2].trim()], 
                    rawAmount: match[3] 
                };
            } else {
                if (currentBlock) {
                    currentBlock.lines.push(line);
                }
            }
        }

        if (currentBlock) {
            processBlock(currentBlock);
        }

        return transactions;
    }
};

/**
 * ESTRATÉGIA: GENÉRICA (Fallback Inteligente)
 * CORE_ESTAVEL: NÃO MODIFICAR.
 */
export const GenericStrategy: BankStrategy = {
    name: 'Genérico (CSV/Excel)',

    canHandle: () => true,

    parse: (content, yearAnchor, models, globalKeywords = []) => {
        const transactions: Transaction[] = [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        if (lines.length === 0) return [];

        const firstLine = lines[0];
        const delimiter = firstLine.includes(';') ? ';' : (firstLine.includes('\t') ? '\t' : ',');
        
        const rows = lines.map(l => l.split(delimiter));
        const dateIdx = DateResolver.identifyDateColumn(rows);
        const amountIdx = AmountResolver.identifyAmountColumn(rows, [dateIdx]);
        const nameIdx = NameResolver.identifyNameColumn(rows, [dateIdx, amountIdx]);
        const typeIdx = TypeResolver.identifyTypeColumn(rows, [dateIdx, amountIdx, nameIdx]);

        if (dateIdx === -1 || amountIdx === -1) return [];

        rows.forEach((row, index) => {
            const rawDate = row[dateIdx];
            const rawAmount = row[amountIdx];
            const rawDesc = nameIdx !== -1 ? row[nameIdx] : 'Sem descrição';
            
            let rawType = typeIdx !== -1 ? row[typeIdx] : '';
            if (!rawType || rawType.trim() === '') {
                rawType = TypeResolver.resolveFromDescription(rawDesc);
            } else {
                rawType = rawType.toUpperCase().trim();
            }

            const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
            const amountStr = AmountResolver.clean(rawAmount);
            const amount = parseFloat(amountStr);

            if (isoDate && !isNaN(amount) && amount !== 0) {
                // REMOVIDO FILTRO DE CONTROLE (SALDO/TOTAL) A PEDIDO DO USUÁRIO
                // if (NameResolver.isControlRow(rawDesc)) return;

                transactions.push({
                    id: `gen-${index}-${Date.now()}`,
                    date: isoDate,
                    description: rawDesc,
                    amount: amount,
                    originalAmount: rawAmount,
                    cleanedDescription: NameResolver.clean(rawDesc, globalKeywords),
                    contributionType: rawType
                });
            }
        });

        return transactions;
    }
};

/**
 * Strategy Engine (Orquestrador)
 * CORE_ESTAVEL: NÃO MODIFICAR A ORDEM OU A LÓGICA DE SELEÇÃO.
 */
export const StrategyEngine = {
    // A ordem importa: Modelos Salvos -> Estratégias Específicas -> Genérico
    strategies: [DatabaseModelStrategy, SicoobStrategy, GenericStrategy],

    process: (filename: string, content: string, models: FileModel[] = [], globalKeywords: string[] = [], overrideModel?: FileModel): { transactions: Transaction[], strategyName: string } => {
        const yearAnchor = DateResolver.discoverAnchorYear(content);
        
        // 1. PRIORIDADE ABSOLUTA: Modelo Específico (Se aprovado e passado)
        if (overrideModel) {
            try {
                // Força o uso do modelo específico passando apenas ele para a estratégia de banco de dados
                // O canHandle ou verificação interna pode ser ignorado pois assumimos que o caller já validou
                const specificResults = DatabaseModelStrategy.parse(content, yearAnchor, [overrideModel], globalKeywords);
                
                if (specificResults.length > 0) {
                    console.log(`[Engine] Modelo Específico Aplicado: ${overrideModel.name}`);
                    return { 
                        transactions: specificResults, 
                        strategyName: `Modelo Aprovado: ${overrideModel.name}` 
                    };
                } else {
                    console.warn(`[Engine] Modelo específico ${overrideModel.name} falhou em gerar transações. Caindo para fallback.`);
                }
            } catch (e) {
                console.error(`[Engine] Erro crítico ao aplicar modelo específico:`, e);
                // Continua para o fallback padrão em caso de erro
            }
        }

        // 2. Fluxo Padrão (Auto-detecção)
        for (const strategy of StrategyEngine.strategies) {
            // Se for a estratégia genérica, deixa por último
            if (strategy.name === GenericStrategy.name) continue;

            if (strategy.canHandle(filename, content, models)) {
                // Passa os modelos apenas para quem precisa (DatabaseModelStrategy)
                const results = strategy.parse(content, yearAnchor, models, globalKeywords);
                if (results.length > 0) {
                    console.log(`[Engine] Estratégia Detectada: ${strategy.name}`);
                    return { transactions: results, strategyName: strategy.name };
                }
            }
        }

        console.log(`[Engine] Nenhuma estratégia específica. Usando Genérico.`);
        return { 
            transactions: GenericStrategy.parse(content, yearAnchor, models, globalKeywords),
            strategyName: GenericStrategy.name 
        };
    }
};
