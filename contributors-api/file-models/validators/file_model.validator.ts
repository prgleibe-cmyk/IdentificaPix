export class FileModelValidator {
  static validateCreate(body: any): { isValid: boolean; error?: string } {
    if (!body || typeof body !== 'object') {
      return { isValid: false, error: 'O corpo da requisição deve ser um objeto válido.' };
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return { isValid: false, error: 'O campo "name" é obrigatório.' };
    }

    if (!body.user_id || typeof body.user_id !== 'string' || body.user_id.trim().length === 0) {
      return { isValid: false, error: 'O campo "user_id" é obrigatório.' };
    }

    return { isValid: true };
  }

  static validateUpdate(body: any): { isValid: boolean; error?: string } {
    if (!body || typeof body !== 'object') {
      return { isValid: false, error: 'O corpo da requisição deve ser um objeto válido.' };
    }
    return { isValid: true };
  }
}
