
import { BaseAdapter } from './BaseAdapter';
import { FileType, RawDocument } from '../types/core-engine';
import * as XLSX from 'xlsx';

export class ExcelAdapter extends BaseAdapter<string[][]> {
  protected fileType = FileType.XLSX;

  async readRaw(file: File): Promise<RawDocument<string[][]>> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { 
      type: 'array',
      cellDates: false, // Mantém datas como strings originais
      cellText: true,   // Prioriza o texto formatado da célula
      raw: false        // Garante que pegamos o que o usuário "vê"
    });
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { 
      header: 1,
      defval: '' 
    }) as string[][];

    return this.createRawDocument(file, data);
  }
}
