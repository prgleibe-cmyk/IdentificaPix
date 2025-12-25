
import { BaseAdapter } from './BaseAdapter';
import { FileType, RawDocument } from '../types/core-engine';

export class TextAdapter extends BaseAdapter<string> {
  protected fileType: FileType;

  constructor(type: FileType = FileType.TXT) {
    super();
    this.fileType = type;
  }

  async readRaw(file: File): Promise<RawDocument<string>> {
    const text = await file.text();
    return this.createRawDocument(file, text);
  }
}
