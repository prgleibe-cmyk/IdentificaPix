
/**
 * ARQUITETURA DE MODELOS APRENDIDOS (vNext)
 * 
 * Esta estrutura define o contrato para modelos de arquivos que o sistema
 * aprendeu a processar. Ela é projetada para ser serializável (JSON)
 * e independente de banco de dados.
 */

/**
 * Identidade do Modelo
 * Define quem é o modelo, sua versão e linhagem.
 */
export interface ModelIdentity {
    id: string;              // UUID único do modelo
    name: string;            // Nome legível (ex: "Extrato Itaú PJ")
    ownerId: string;         // ID do usuário ou 'SYSTEM' para modelos nativos
    version: number;         // Inteiro incremental (v1, v2...)
    lineageId: string;       // UUID que agrupa todas as versões do mesmo modelo
    createdAt: string;       // ISO Date
    updatedAt: string;       // ISO Date
    isActive: boolean;       // Soft delete / Desativação
}

/**
 * Evidências de Aprendizado (O "DNA" do arquivo)
 * Conjunto de características usadas para reconhecer se um arquivo desconhecido
 * pertence a este modelo.
 */
export interface ModelEvidence {
    mimeType: string;        // Ex: 'application/pdf', 'text/csv'
    extension: string;       // Ex: 'PDF', 'CSV', 'OFX'
    
    fingerprint: {
        columnCount: number;           // Número de colunas detectadas
        delimiter: string;             // Delimitador principal (;, \t, ,)
        headerSignature: string | null;// Hash SHA/CRC da linha de cabeçalho (se houver)
        
        // Assinatura Topológica: Sequência de tipos de dados (ex: ["DATE", "STRING", "AMOUNT", "EMPTY"])
        dataTopology: string[]; 
        
        // Palavras-chave que aparecem no cabeçalho ou nas primeiras linhas
        // Ex: "ITAU EMPRESAS", "EXTRATO PARA SIMPLES CONFERENCIA"
        distinctiveKeywords: string[]; 
    };
}

/**
 * Estratégia de Processamento
 * As regras exatas de como extrair e transformar os dados brutos.
 */
export interface ProcessingStrategy {
    parserType: 'CSV' | 'XLSX' | 'PDF_TEXT' | 'OFX' | 'IMAGE_OCR';
    
    // Mapeamento Posicional
    mapping: {
        dateIndex: number;
        descriptionIndex: number;
        amountIndex: number;
        typeIndex?: number;    // Opcional: Coluna que diz se é PIX/TED
        balanceIndex?: number; // Opcional: Para validação de saldo
    };

    // Regras de Formatação (Parser Config)
    formatters: {
        decimalSeparator: '.' | ',';
        thousandsSeparator?: '.' | ',' | '';
        dateFormat: string;    // Padrão esperado (ex: 'DD/MM/YYYY')
        currencySymbol?: string; // Ex: 'R$' para remoção
    };

    // Restrições de Área (Onde os dados começam e terminam)
    constraints: {
        skipRowsHeader: number;
        skipRowsFooter: number;
        // Validação: A coluna X deve conter Y para a linha ser válida
        mandatoryColumnValue?: { index: number, valuePattern: string }; 
    };
    
    // Regras de Limpeza Pós-Extração
    sanitization: {
        ignoredKeywords: string[]; // Palavras para remover da descrição (ex: "PIX ENVIADO")
        removeRegex?: string[];    // Padrões avançados para remover ruído
    };
}

/**
 * Metadados de Confiança e Performance
 * Usado pelo motor de inferência para decidir qual modelo aplicar 
 * quando múltiplos modelos coincidem com o fingerprint.
 */
export interface ModelConfidence {
    score: number;           // 0.0 a 1.0 (Probabilidade de acerto)
    usageCount: number;      // Quantas vezes foi aplicado
    successCount: number;    // Quantas vezes gerou transações válidas sem erro
    lastUsedAt: string | null;
    trainingSampleCount: number; // Quantas linhas foram usadas para treinar este modelo
}

/**
 * Estrutura Principal: Modelo de Arquivo Aprendido
 * Agrega todas as facetas do modelo.
 */
export interface LearnedFileModel {
    identity: ModelIdentity;
    evidence: ModelEvidence;
    strategy: ProcessingStrategy;
    confidence: ModelConfidence;
    
    // Extensibilidade para features futuras (ex: IA generativa)
    meta?: Record<string, any>; 
}
