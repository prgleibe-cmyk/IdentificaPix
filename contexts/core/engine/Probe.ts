
import { FileType, ProbeResult } from '../types/core-engine';

/**
 * Especialista em identificação de arquivos financeiros.
 * Não altera dados, apenas identifica a "natureza" do documento.
 */
export class FileProbe {
  
  /**
   * Identifica o tipo de arquivo analisando metadados e conteúdo binário inicial.
   */
  static async identify(file: File): Promise<ProbeResult> {
    const extension = file.name.split('.').pop()?.toUpperCase() || '';
    const mimeType = file.type;
    
    // 1. Verificação por Assinatura Binária (Primeiros 100 bytes)
    const headerHex = await this.getFileHeaderHex(file);
    const headerText = await this.getFileHeaderText(file);

    // PDF: %PDF- (hex: 25 50 44 46)
    if (headerHex.startsWith('25504446')) {
      return { type: FileType.PDF, mimeType, extension, confidence: 'HIGH' };
    }

    // Excel Moderno (XLSX): PK (hex: 50 4b 03 04)
    if (headerHex.startsWith('504b0304') && (extension === 'XLSX' || extension === 'XLS')) {
      return { type: FileType.XLSX, mimeType, extension, confidence: 'HIGH' };
    }

    // OFX: Procura pela tag <OFX ou DATA
    if (headerText.includes('<OFX') || headerText.includes('OFXHEADER')) {
      return { type: FileType.OFX, mimeType, extension, confidence: 'HIGH' };
    }

    // CSV/TXT: Checagem Semântica Simples
    if (extension === 'CSV' || mimeType === 'text/csv' || headerText.includes(';') || headerText.includes(',')) {
      return { type: FileType.CSV, mimeType, extension, confidence: 'LOW' };
    }

    if (extension === 'TXT' || mimeType === 'text/plain') {
      return { type: FileType.TXT, mimeType, extension, confidence: 'LOW' };
    }

    // Fallback por extensão se o mime/header falhar
    switch (extension) {
      case 'PDF': return { type: FileType.PDF, mimeType, extension, confidence: 'LOW' };
      case 'XLSX':
      case 'XLS': return { type: FileType.XLSX, mimeType, extension, confidence: 'LOW' };
      case 'OFX': return { type: FileType.OFX, mimeType, extension, confidence: 'LOW' };
      default: return { type: FileType.UNKNOWN, mimeType, extension, confidence: 'LOW' };
    }
  }

  private static async getFileHeaderHex(file: File): Promise<string> {
    const blob = file.slice(0, 10);
    const buffer = await blob.arrayBuffer();
    const uint = new Uint8Array(buffer);
    let bytes: string[] = [];
    uint.forEach((byte) => {
      bytes.push(byte.toString(16).padStart(2, '0'));
    });
    return bytes.join('');
  }

  private static async getFileHeaderText(file: File): Promise<string> {
    const blob = file.slice(0, 100);
    return await blob.text();
  }
}
