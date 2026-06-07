import { getBankKey } from './bankHelper';

/**
 * Retorna o identificador do banco prioritariamente pela bank_key armazenada (modo determinístico).
 * Se não existir bank_key, recai para GENERIC, mantendo getBankKey estritamente como fallback
 * silencioso de compatibilidade histórica.
 */
export function getBankIdentity(bank: {
  name: string;
  bank_key?: string | null;
}): string {
  if (bank.bank_key) {
    return bank.bank_key;
  }
  
  // Compatibilidade silenciosa de último recurso se o nome for informado
  if (bank.name) {
    return getBankKey(bank.name);
  }

  return 'GENERIC';
}
