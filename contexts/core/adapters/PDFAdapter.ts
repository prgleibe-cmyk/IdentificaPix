
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
      
      // Agrupamento RAW por coordenada Y para manter fidelidade de linha
      const lineMap: Map<number, any[]> = new Map();
      items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push(item);
      });

      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
      sortedY.forEach(y => {
        const row = lineMap.get(y)!
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map(item => item.str)
          .join(' ');
        
        if (row.trim()) allLines.push(row);
      });
    }

    return this.createRawDocument(file, allLines);
  }
}
