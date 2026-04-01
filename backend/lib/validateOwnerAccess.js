/**
 * validateOwnerAccess - Centraliza a validação de acesso ao ownerId.
 * 
 * Esta função verifica se o usuário autenticado (req.user) tem permissão para acessar
 * os dados pertencentes ao ownerId fornecido.
 * 
 * Regras:
 * - OWNER: Pode acessar se o seu ID for igual ao ownerId.
 * - ADMIN: Pode acessar se o seu owner_id for igual ao ownerId.
 * - PRINCIPAL/SECUNDÁRIO/MEMBER: Podem acessar se o seu owner_id for igual ao ownerId.
 * 
 * @param {Object} req - Objeto de requisição do Express (contém req.user)
 * @param {string} ownerId - ID do proprietário dos dados solicitados
 * @throws {Error} - Lança erro com status 403 se o acesso for negado.
 */
export const validateOwnerAccess = (req, ownerId) => {
  const { user } = req;
  const timestamp = new Date().toISOString();

  if (!user) {
    console.error(`[AUDITORIA] Tentativa de acesso sem usuário autenticado em ${timestamp}`);
    const error = new Error("Usuário não autenticado.");
    error.status = 401;
    throw error;
  }

  let hasAccess = false;

  // 1. Validação por Papel (Role)
  if (user.role === 'owner' && user.id === ownerId) {
    hasAccess = true;
  } else if (user.role === 'admin' && user.owner_id === ownerId) {
    hasAccess = true;
  } else if (
    (user.role === 'principal' || user.role === 'secondary' || user.role === 'member') &&
    user.owner_id === ownerId
  ) {
    hasAccess = true;
  }

  // 2. Auditoria e Bloqueio
  if (!hasAccess) {
    console.warn(`[AUDITORIA - ACESSO NEGADO] 
      Timestamp: ${timestamp}
      Solicitante (userId): ${user.id}
      Papel (role): ${user.role}
      Owner Requisitado: ${ownerId}
    `);

    const error = new Error("Acesso negado: Você não tem permissão para acessar estes dados.");
    error.status = 403;
    throw error;
  }

  return true;
};