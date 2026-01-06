
import { FileType, RawDocument } from '../types/core-engine';

export abstract class BaseAdapter<T> {
  protected abstract fileType: FileType;
  
  /**
   * Realiza a leitura fiel do arquivo sem modificações.
   */
  abstract readRaw(file: File): Promise<RawDocument<T>>;

  protected createRawDocument(file: File, content: T): RawDocument<T> {
    return {
      sourceName: file.name,
      fileType: this.fileType,
      content,
      timestamp: new Date().toISOString(),
      metadata: {
        size: file.size,
        encoding: 'UTF-8'
      }
    };
  }
}
