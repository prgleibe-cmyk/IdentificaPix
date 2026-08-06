export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateLoginInput(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const email = sanitizeEmail(body?.email);
  const password = body?.password;

  if (!email || !isValidEmail(email)) {
    errors.push('E-mail inválido.');
  }
  if (!password || typeof password !== 'string' || password.trim() === '') {
    errors.push('Senha é obrigatória.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateSignupInput(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const email = sanitizeEmail(body?.email);
  const password = body?.password;
  const name = body?.name;

  if (!email || !isValidEmail(email)) {
    errors.push('E-mail informado é inválido.');
  }
  if (!password || typeof password !== 'string') {
    errors.push('Senha é obrigatória.');
  }
  if (name && typeof name !== 'string') {
    errors.push('Nome inválido.');
  }

  return { valid: errors.length === 0, errors };
}

export function validatePasswordResetRequest(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const email = sanitizeEmail(body?.email);

  if (!email || !isValidEmail(email)) {
    errors.push('E-mail válido é obrigatório.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateResetPassword(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const token = body?.token;
  const newPassword = body?.newPassword || body?.password;

  if (!token || typeof token !== 'string') {
    errors.push('Token de recuperação é obrigatório.');
  }
  if (!newPassword || typeof newPassword !== 'string') {
    errors.push('Nova senha é obrigatória.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateChangePassword(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (!currentPassword || typeof currentPassword !== 'string') {
    errors.push('Senha atual é obrigatória.');
  }
  if (!newPassword || typeof newPassword !== 'string') {
    errors.push('Nova senha é obrigatória.');
  }

  return { valid: errors.length === 0, errors };
}
