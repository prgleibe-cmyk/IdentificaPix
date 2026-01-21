import { FileProbe } from './Probe';
import { FileType, NormalizedTransaction } from '../types/core-engine';
import { ExcelAdapter } from '../adapters/ExcelAdapter';
import { StrategyEngine } from '../strategies';

/**
 * ORCHESTRATOR V5 - SINCRONIA WYSIWYG (What You See Is What You Get)
 * Este motor garante que a "visão" do Laboratório seja idêntica à Produção.
 */
export class Orchestrator {
  
  static async processFile(file: File, models: any[] = [], keywords: string[] = []): Promise<any> {
    const probe = await FileProbe.identify(file);
    let content = "";

    // TRATAMENTO DE TEXTO/PDF (O PONTO CRÍTICO DAS FOTOS)
    if (probe.type === FileType.PDF || probe.type === FileType.TXT || probe.type === FileType.CSV) {
        const rawText = await file.text();
        
        // REPLICAR EXATAMENTE A LÓGICA DO useFileProcessing.ts
        // Se o arquivo não tem delimitadores fortes (; ou \t), transformamos espaços duplos em ;
        // Isso cria a grade virtual que o usuário vê no Laboratório.
        content = rawText
            .split(/\r?\n/)
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return "";
                // Se não tem delimitador mas tem espaços duplos (típico de PDF/TXT do SICOOB nas fotos)
                if (!trimmed.includes(';') && !trimmed.includes('\t') && trimmed.includes('  ')) {
                    return trimmed.replace(/\s{2,}/g, ';');
                }
                return trimmed;
            })
            .filter(line => line.length > 0)
            .join('\n');
            
        console.log("[Engine] Conteúdo normalizado com colunas virtuais (;) para paridade.");
    } else {
        // Para Excel, mantemos o padrão já convertido
        const adapter = new ExcelAdapter();
        const rawDoc = await adapter.readRaw(file);
        content = rawDoc.content.map(row => row.join(';')).join('\n');
    }

    // Passamos o conteúdo já estruturado como "CSV Virtual" para o motor de estratégia
    return await StrategyEngine.process(file.name, content, models, keywords);
  }
}