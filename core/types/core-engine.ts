
export enum FileType {
  PDF = 'PDF',
  XLSX = 'XLSX',
  OFX = 'OFX',
  CSV = 'CSV',
  TXT = 'TXT',
  UNKNOWN = 'UNKNOWN'
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

export interface TransactionDraft {
  rawDate: string;
  rawDescription: string;
  rawAmount: string;
  [key: string]: any;
}

export interface NormalizedTransaction {
  data: string;  // YYYY-MM-DD
  nome: string;
  valor: number;
}

export interface ProbeResult {
  type: FileType;
  mimeType: string;
  extension: string;
  confidence: 'HIGH' | 'LOW';
}
