
import { FileProbe } from './Probe';
import { FileType, NormalizedTransaction } from '../types/core-engine';
import { ExcelAdapter } from '../adapters/ExcelAdapter';
import { CSVParser } from '../parsers/CSVParser';
import { Normalizer } from './Normalizer';

/**
 * Cérebro do Core Engine v3.
 * Orquestra o fluxo de dados do arquivo bruto até a saída normalizada.
 */
export class Orchestrator {
  
  /**
   * Processa um arquivo financeiro e retorna dados em 3 colunas.
   */
  static async processFile(file: File): Promise<NormalizedTransaction[]> {
    // 1. Identificação (Probe)
    const probe = await FileProbe.identify(file);

    // 2. Leitura (Adapters) - Exemplo com CSV/Excel
    // Nota: Em uma implementação completa, haveria um Factory de Adapters aqui
    if (probe.type === FileType.XLSX || probe.type === FileType.CSV) {
      const adapter = new ExcelAdapter();
      const rawDoc = await adapter.readRaw(file);

      // 3. Extração (Parsers)
      const parser = new CSVParser();
      const drafts = parser.parse(rawDoc);

      // 4. Consolidação Final (Normalizer)
      return Normalizer.normalize(drafts);
    }

    throw new Error(`Tipo de arquivo ${probe.type} não suportado para processamento direto.`);
  }
}
