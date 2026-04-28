
export enum FileType {
  PDF = 'PDF',
  CSV = 'CSV',
  XLSX = 'XLSX',
  OFX = 'OFX',
  TXT = 'TXT',
  UNKNOWN = 'UNKNOWN'
}

export interface ProbeResult {
  type: FileType;
  mimeType: string;
  extension: string;
  confidence: 'HIGH' | 'LOW';
}

export interface RawDocument<T = any> {
  sourceName: string;
  fileType: FileType;
  content: T;
  timestamp: string;
  metadata: {
    size: number;
    encoding: string;
  };
}

/**
 * Representação intermediária de uma transação.
 * Campos ainda são strings pois não passaram pela Normalização/Sanitização.
 */
export interface TransactionDraft {
  rawDate: string;
  rawDescription: string;
  rawAmount: string;
  sourceRowIndex: number;
  metadata: Record<string, any>;
}

/**
 * Resultado FINAL e IMUTÁVEL do motor de processamento.
 * Exatamente 3 colunas conforme regra de negócio.
 */
export interface NormalizedTransaction {
  data: string;  // YYYY-MM-DD
  nome: string;  // Descrição Limpa
  valor: number; // Float 64
}
