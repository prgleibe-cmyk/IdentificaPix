import { Request } from 'express';
import { verifyAccessToken } from './jwt.utils.js';

export interface TenantContext {
  userId: string | null;
  ownerId: string | null;
  churchId: string | null;
  allowedChurchIds: string[];
  allowedBankIds: string[];
  permissions: string[];
  role: string | null;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isSecondaryUser: boolean;
  isAuthenticated: boolean;
}

export function extractContextPermissions(user: any): string[] {
  if (!user) return [];
  const perms = new Set<string>();

  if (Array.isArray(user.permissions)) {
    user.permissions.forEach((p: any) => {
      if (typeof p === 'string' && p.trim()) {
        perms.add(p.trim().toLowerCase());
      }
    });
  } else if (typeof user.permissions === 'string' && user.permissions.trim()) {
    try {
      const parsed = JSON.parse(user.permissions);
      if (Array.isArray(parsed)) {
        parsed.forEach((p: any) => {
          if (typeof p === 'string' && p.trim()) perms.add(p.trim().toLowerCase());
        });
      }
    } catch (_) {
      perms.add(user.permissions.trim().toLowerCase());
    }
  }

  return Array.from(perms);
}

export function hasPermission(ctx: TenantContext, ...requiredPermissions: string[]): boolean {
  if (!ctx.isAuthenticated) return false;
  if (ctx.isSuperAdmin || ctx.isOwner) return true;
  if (ctx.permissions.includes('all') || ctx.permissions.includes('admin')) return true;

  if (requiredPermissions.length === 0) return true;

  return requiredPermissions.some(reqPerm => {
    const p = reqPerm.toLowerCase();
    if (ctx.permissions.includes(p)) return true;

    // Equivalências / Hierarquias lógicas
    if (p === 'view' && (ctx.permissions.includes('edit') || ctx.permissions.includes('create') || ctx.permissions.includes('delete'))) {
      return true;
    }
    if (p === 'create' && ctx.permissions.includes('edit')) {
      return true;
    }
    if (p === 'reports' && (ctx.permissions.includes('view') || ctx.permissions.includes('edit'))) {
      return true;
    }
    return false;
  });
}

export function extractContextAllowedBankIds(user: any): string[] {
  const ids = new Set<string>();
  if (!user) {
    return [];
  }

  const addIfValid = (val: any) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0) ids.add(trimmed);
    }
  };

  if (Array.isArray(user.bank_ids)) user.bank_ids.forEach(addIfValid);
  if (Array.isArray(user.bankIds)) user.bankIds.forEach(addIfValid);
  if (Array.isArray(user.allowed_bank_ids)) user.allowed_bank_ids.forEach(addIfValid);
  if (Array.isArray(user.allowedBankIds)) user.allowedBankIds.forEach(addIfValid);

  if (user.permissions && typeof user.permissions === 'object') {
    if (Array.isArray(user.permissions.bankIds)) user.permissions.bankIds.forEach(addIfValid);
    if (Array.isArray(user.permissions.bank_ids)) user.permissions.bank_ids.forEach(addIfValid);
  } else if (Array.isArray(user.permissions)) {
    user.permissions.forEach((perm: any) => {
      if (typeof perm === 'string') {
        if (perm.startsWith('bank:') || perm.startsWith('bank_id:')) {
          addIfValid(perm.split(':')[1]);
        }
      }
    });
  }

  return Array.from(ids);
}

export function extractContextAllowedChurchIds(user: any, headerChurchId?: string | null): string[] {
  const ids = new Set<string>();
  if (!user) {
    return [];
  }

  // 1. Direct church_id
  if (user.church_id && typeof user.church_id === 'string' && user.church_id.trim()) {
    ids.add(user.church_id.trim());
  }
  if (user.churchId && typeof user.churchId === 'string' && user.churchId.trim()) {
    ids.add(user.churchId.trim());
  }

  // 2. congregation_ids / allowed_church_ids
  if (Array.isArray(user.congregation_ids)) {
    user.congregation_ids.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.congregationIds)) {
    user.congregationIds.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.allowed_church_ids)) {
    user.allowed_church_ids.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.allowedChurchIds)) {
    user.allowedChurchIds.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }

  // 3. Permissions array / object
  if (Array.isArray(user.permissions)) {
    user.permissions.forEach((perm: any) => {
      if (typeof perm === 'string') {
        if (perm.startsWith('congregation:')) {
          const cid = perm.split(':')[1];
          if (cid && cid.trim()) ids.add(cid.trim());
        } else if (perm.startsWith('church:')) {
          const cid = perm.split(':')[1];
          if (cid && cid.trim()) ids.add(cid.trim());
        }
      }
    });
  } else if (user.permissions && typeof user.permissions === 'object') {
    if (Array.isArray(user.permissions.congregationIds)) {
      user.permissions.congregationIds.forEach((id: any) => {
        if (typeof id === 'string' && id.trim()) ids.add(id.trim());
      });
    }
    if (typeof user.permissions.congregation === 'string' && user.permissions.congregation.trim()) {
      ids.add(user.permissions.congregation.trim());
    }
  }

  return Array.from(ids);
}

export function getTenantContext(req: Request): TenantContext {
  const reqAny = req as any;
  let user = reqAny.user;

  if (!user && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.substring(7).trim();
      user = verifyAccessToken(token);
      reqAny.user = user;
    } catch (e) {
      // Token inválido ou expirado: não autentica
      user = null;
    }
  }

  // Se o usuário está autenticado com token JWT válido:
  if (user) {
    const userId = user.user_id || user.id || null;
    const ownerId = user.owner_id || user.ownerId || userId;
    const role = user.role || 'user';
    const isSuperAdmin = Boolean(user.is_superadmin || role === 'superadmin' || user.isSuperAdmin);

    // Congregações e bancos permitidos derivam estritamente do token assinado
    const allowedChurchIds = extractContextAllowedChurchIds(user);
    const allowedBankIds = extractContextAllowedBankIds(user);
    const churchId = user.church_id || (allowedChurchIds.length > 0 ? allowedChurchIds[0] : null) || null;

    const hasSeparateOwner = Boolean(ownerId && userId && ownerId !== userId);
    const isSecondaryRole = ['secondary', 'member', 'operador', 'colaborador'].includes(role) || (role === 'user' && hasSeparateOwner);
    const isSecondaryUser = !isSuperAdmin && (hasSeparateOwner || isSecondaryRole || Boolean(user.is_secondary));
    const isOwner = isSuperAdmin || (!isSecondaryUser && (role === 'owner' || role === 'principal' || !hasSeparateOwner));

    let permissions = extractContextPermissions(user);
    if ((isSuperAdmin || isOwner) && (permissions.length === 0 || !permissions.includes('all'))) {
      permissions = ['all', ...permissions];
    }

    return {
      userId,
      ownerId,
      churchId,
      allowedChurchIds,
      allowedBankIds,
      permissions,
      role,
      isSuperAdmin,
      isOwner,
      isSecondaryUser,
      isAuthenticated: true
    };
  }

  // Caso não haja token válido, retorna contexto não-autenticado estrito
  return {
    userId: null,
    ownerId: null,
    churchId: null,
    allowedChurchIds: [],
    allowedBankIds: [],
    permissions: [],
    role: null,
    isSuperAdmin: false,
    isOwner: false,
    isSecondaryUser: false,
    isAuthenticated: false
  };
}

/**
 * 🛡️ BLINDAGEM DE RATEIOS (SPLITS):
 * Validação rigorosa da consistência matemática e integridade multi-tenant dos rateios.
 * Garante que:
 * 1. Cada fatia tenha valor numérico estritamente positivo (amount > 0).
 * 2. A soma de todas as fatias coincida com o valor nominal da transação (|sum - |amount|| <= 0.01).
 * 3. Usuários secundários só possam alocar fatias para congregações autorizadas em allowedChurchIds.
 */
export function validateTransactionSplits(
  splitsInput: any,
  txAmount: number | string | undefined | null,
  ctx?: TenantContext | null
): { isValid: boolean; error?: string; message?: string; parsedSplits?: any[] } {
  if (splitsInput === undefined || splitsInput === null) {
    return { isValid: true };
  }

  let splitsArray: any[] = [];
  if (typeof splitsInput === 'string') {
    const trimmed = splitsInput.trim();
    if (!trimmed || trimmed === 'null' || trimmed === '[]') {
      return { isValid: true, parsedSplits: [] };
    }
    try {
      splitsArray = JSON.parse(trimmed);
    } catch {
      return {
        isValid: false,
        error: 'SPLITS_INVALID_JSON',
        message: 'O formato JSON do campo "splits" é inválido.'
      };
    }
  } else if (Array.isArray(splitsInput)) {
    splitsArray = splitsInput;
  } else {
    return {
      isValid: false,
      error: 'SPLITS_MUST_BE_ARRAY',
      message: 'O campo "splits" deve ser uma lista de divisões contábeis (array).'
    };
  }

  if (splitsArray.length === 0) {
    return { isValid: true, parsedSplits: [] };
  }

  const targetAmount = Math.abs(Number(txAmount) || 0);
  let totalSplits = 0;

  for (let i = 0; i < splitsArray.length; i++) {
    const split = splitsArray[i];
    if (!split || typeof split !== 'object') {
      return {
        isValid: false,
        error: 'SPLITS_INVALID_ITEM',
        message: `A divisão de rateio na posição ${i + 1} é inválida.`
      };
    }

    const itemAmount = Number(split.amount);
    if (isNaN(itemAmount) || !isFinite(itemAmount) || itemAmount <= 0) {
      return {
        isValid: false,
        error: 'SPLITS_INVALID_AMOUNT',
        message: `A divisão de rateio na posição ${i + 1} possui valor inválido ou não-positivo (R$ ${split.amount}). Cada parcela deve ser maior que zero.`
      };
    }

    totalSplits += itemAmount;

    // Validação Multi-tenant para usuário secundário
    if (ctx && ctx.isSecondaryUser && ctx.allowedChurchIds && ctx.allowedChurchIds.length > 0) {
      const splitChurchId = split.churchId || split.church_id;
      if (splitChurchId && splitChurchId !== 'unidentified' && splitChurchId !== 'geral') {
        if (!ctx.allowedChurchIds.includes(splitChurchId)) {
          return {
            isValid: false,
            error: 'SPLITS_CHURCH_NOT_ALLOWED',
            message: `Acesso negado: a congregação "${splitChurchId}" referenciada na parcela ${i + 1} do rateio não é autorizada para este usuário.`
          };
        }
      }
    }
  }

  // Verifica tolerância de centavos (0.01) contra imprecisão IEEE 754
  const diff = Math.round(Math.abs(totalSplits - targetAmount) * 100) / 100;
  if (diff > 0.01) {
    return {
      isValid: false,
      error: 'SPLITS_SUM_MISMATCH',
      message: `Divergência matemática no rateio: A soma das parcelas (R$ ${totalSplits.toFixed(2)}) difere do valor total do lançamento (R$ ${targetAmount.toFixed(2)}). A diferença é de R$ ${diff.toFixed(2)}.`
    };
  }

  return { isValid: true, parsedSplits: splitsArray };
}

