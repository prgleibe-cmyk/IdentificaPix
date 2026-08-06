export class PaymentValidator {
  static validateCreate(body: any): { isValid: boolean; error?: string } {
    if (!body || typeof body !== 'object') {
      return { isValid: false, error: 'O corpo da requisição deve ser um objeto válido.' };
    }

    if (!body.user_id || typeof body.user_id !== 'string' || body.user_id.trim().length === 0) {
      return { isValid: false, error: 'O campo "user_id" é obrigatório.' };
    }

    if (body.amount === undefined || body.amount === null || isNaN(Number(body.amount))) {
      return { isValid: false, error: 'O campo "amount" é obrigatório e deve ser numérico.' };
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
