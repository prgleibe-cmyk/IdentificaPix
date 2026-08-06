export class ProfileValidator {
  static validateCreate(body: any): { isValid: boolean; error?: string } {
    if (!body || typeof body !== 'object') {
      return { isValid: false, error: 'O corpo da requisição deve ser um objeto válido.' };
    }

    if (!body.id || typeof body.id !== 'string' || body.id.trim().length === 0) {
      return { isValid: false, error: 'O campo "id" é obrigatório para o perfil.' };
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
