import { getBankKey } from './bankHelper';

/**
 * Retorna o identificador do banco priorizando a nova bank_key armazenada,
 * com fallback transparente para o algoritmo de correspondência clássica (includes)
 * em bancos cadastrados sem associação explícita.
 */
export function getBankIdentity(bank: {
  name: string;
  bank_key?: string | null;
}): string {
  if (bank.bank_key) {
    return bank.bank_key;
  }
  return getBankKey(bank.name);
}
