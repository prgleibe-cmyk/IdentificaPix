
import { BaseAdapter } from './BaseAdapter';
import { FileType, RawDocument } from '../types/core-engine';
import * as XLSX from 'xlsx';

export class ExcelAdapter extends BaseAdapter<string[][]> {
  protected fileType = FileType.XLSX;

  async readRaw(file: File): Promise<RawDocument<string[][]>> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { 
      type: 'array',
      cellDates: false, 
      cellText: true,   
      raw: false        
    });
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { 
      header: 1,
      defval: '' 
    }) as any[][];

    // Converte para string[][] respeitando o conteúdo original de cada célula
    const mappedData = data.map(row => 
        row.map(cell => cell === null || cell === undefined ? '' : String(cell).trim())
    );

    return this.createRawDocument(file, mappedData);
  }
}
