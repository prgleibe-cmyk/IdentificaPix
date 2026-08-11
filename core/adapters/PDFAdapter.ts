
import { BaseAdapter } from './BaseAdapter';
import { FileType, RawDocument } from '../types/core-engine';

export class PDFAdapter extends BaseAdapter<string[]> {
  protected fileType = FileType.PDF;

  async readRaw(file: File): Promise<RawDocument<string[]>> {
    // Nota: pdfjsLib deve ser carregado via import map ou dinamicamente como no componente original
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) throw new Error("PDF Library not initialized");

    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(new Uint8Array(buffer));
    const pdf = await loadingTask.promise;
    
    let allLines: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      
      // Agrupamento RAW por coordenada Y com tolerância de 2.5px para manter fidelidade de linha em layouts PDF
      const lineBuckets: { y: number; items: any[] }[] = [];
      items.forEach(item => {
        const itemY = item.transform[5];
        let bucket = lineBuckets.find(b => Math.abs(b.y - itemY) <= 2.5);
        if (!bucket) {
          bucket = { y: itemY, items: [] };
          lineBuckets.push(bucket);
        }
        bucket.items.push(item);
      });

      // Ordenar os buckets do topo para o rodapé (Y decrescente)
      lineBuckets.sort((a, b) => b.y - a.y);

      lineBuckets.forEach(bucket => {
        const row = bucket.items
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map(item => item.str)
          .join(' ');
        
        if (row.trim()) allLines.push(row);
      });
    }

    return this.createRawDocument(file, allLines);
  }
}
