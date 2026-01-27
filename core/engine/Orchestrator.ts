
import { FileProbe } from './Probe';
import { FileType, NormalizedTransaction } from '../types/core-engine';
import { ExcelAdapter } from '../adapters/ExcelAdapter';
import { StrategyEngine } from '../strategies';

/**
 * ORCHESTRATOR V6 - VISÃO MULTIMODAL PRIORITÁRIA
 */
export class Orchestrator {
  
  static async processFile(file: File, models: any[] = [], keywords: string[] = []): Promise<any> {
    const probe = await FileProbe.identify(file);
    
    // 👁️ TRATAMENTO ESPECIAL PARA PDF (VISÃO)
    if (probe.type === FileType.PDF) {
        console.log("[Engine] 👁️ PDF detectado. Ignorando extração de texto local para usar Visão IA.");
        
        // Converte para base64 para transporte direto
        const buffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        return await StrategyEngine.process(file.name, { 
            __rawText: '[DOCUMENTO_VISUAL]', 
            __base64: base64,
            __source: 'file' 
        }, models, keywords);
    }

    let content = "";

    // TRATAMENTO DE TEXTO/CSV/TXT
    if (probe.type === FileType.CSV || probe.type === FileType.TXT) {
        const rawText = await file.text();
        
        content = rawText
            .split(/\r?\n/)
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return "";
                if (!trimmed.includes(';') && !trimmed.includes('\t') && trimmed.includes('  ')) {
                    return trimmed.replace(/\s{2,}/g, ';');
                }
                return trimmed;
            })
            .filter(line => line.length > 0)
            .join('\n');
    } else {
        // Para Excel
        const adapter = new ExcelAdapter();
        const rawDoc = await adapter.readRaw(file);
        content = rawDoc.content.map(row => row.join(';')).join('\n');
    }

    return await StrategyEngine.process(file.name, { __rawText: content, __source: 'file' }, models, keywords);
  }
}
