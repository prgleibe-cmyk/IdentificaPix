export class AdminConfigValidator {
  static validateUpsert(body: any): { isValid: boolean; error?: string } {
    if (!body || typeof body !== 'object') {
      return { isValid: false, error: 'O corpo da requisição deve ser um objeto válido.' };
    }

    if (!body.key || typeof body.key !== 'string' || body.key.trim().length === 0) {
      return { isValid: false, error: 'O campo "key" é obrigatório e deve ser uma string não vazia.' };
    }

    if (body.value === undefined) {
      return { isValid: false, error: 'O campo "value" é obrigatório.' };
    }

    return { isValid: true };
  }

  static validateKey(key: string): { isValid: boolean; error?: string } {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return { isValid: false, error: 'A chave configurada é inválida.' };
    }
    return { isValid: true };
  }
}
