import { Request, Response } from 'express';
import { ProfileService } from '../services/profile.service.js';
import { ProfileValidator } from '../validators/profile.validator.js';
import { getTenantContext } from '../../auth/utils/tenant.context.js';
import { logAudit } from '../../services/audit.service.js';

export class ProfileController {
  private service: ProfileService;
  private pool?: any;

  constructor(service: ProfileService, pool?: any) {
    this.service = service;
    this.pool = pool;
  }

  getAll = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);

      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar perfis.' });
      }

      const { owner_id } = req.query;

      // SuperAdmin pode consultar todos ou filtrar por qualquer owner_id
      if (ctx.isSuperAdmin) {
        if (typeof owner_id === 'string' && owner_id.trim() !== '') {
          const profiles = await this.service.getByOwnerId(owner_id.trim());
          return res.json({ success: true, data: profiles });
        }
        const profiles = await this.service.getAll();
        return res.json({ success: true, data: profiles });
      }

      // Secundário: visualiza estritamente os perfis da sua organização
      if (ctx.isSecondaryUser) {
        const effectiveOwnerId = ctx.ownerId;
        if (!effectiveOwnerId) {
          return res.json({ success: true, data: [] });
        }
        const profiles = await this.service.getByOwnerId(effectiveOwnerId);
        return res.json({ success: true, data: profiles });
      }

      // Titular (Owner): visualiza estritamente os perfis da sua organização
      const effectiveOwnerId = ctx.ownerId || ctx.userId;
      if (typeof owner_id === 'string' && owner_id.trim() !== '') {
        if (owner_id.trim() !== effectiveOwnerId && owner_id.trim() !== ctx.userId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado aos perfis de outra organização.' });
        }
      }

      const profiles = await this.service.getByOwnerId(effectiveOwnerId || '');
      return res.json({ success: true, data: profiles });
    } catch (err: any) {
      console.error('[ProfileController] Erro ao buscar perfis:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PERFIS', message: err?.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ctx = getTenantContext(req);

      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar perfil.' });
      }

      const profile = await this.service.getById(id);
      if (!profile) {
        return res.status(404).json({ success: false, error: 'PERFIL_NAO_ENCONTRADO', message: `Perfil "${id}" não encontrado.` });
      }

      if (!ctx.isSuperAdmin) {
        const authenticatedUserId = ctx.userId;
        const authenticatedOwnerId = ctx.ownerId;

        // Secundário: só pode consultar o seu próprio perfil ou o perfil do seu titular
        if (ctx.isSecondaryUser) {
          const isOwn = profile.id === authenticatedUserId;
          const isOrgOwner = profile.id === authenticatedOwnerId || profile.owner_id === authenticatedOwnerId;
          if (!isOwn && !isOrgOwner) {
            return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado a este perfil.' });
          }
        } else {
          // Titular: só pode consultar perfis da sua própria organização
          const isOwn = profile.id === authenticatedUserId;
          const isTeamMember = profile.owner_id === authenticatedUserId || (authenticatedOwnerId && profile.owner_id === authenticatedOwnerId);
          if (!isOwn && !isTeamMember) {
            return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado aos dados de outra organização.' });
          }
        }
      }

      return res.json({ success: true, data: profile });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PERFIL', message: err?.message });
    }
  };

  createOrUpsert = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);

      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para criar perfil.' });
      }

      // 🛡️ Sub-etapa 3.5: Usuário secundário JAMAIS pode criar outros usuários/secundários
      if (ctx.isSecondaryUser) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Acesso negado: apenas o titular da organização pode cadastrar novos membros ou secundários.'
        });
      }

      // Titular criando secundário: força owner_id da sua própria organização e impede criação de super_admin
      if (!ctx.isSuperAdmin && ctx.isOwner) {
        req.body.owner_id = ctx.ownerId || ctx.userId;
        const roleLower = String(req.body.role || '').toLowerCase();
        if (['super_admin', 'superadmin', 'administrador_geral', 'owner'].includes(roleLower)) {
          req.body.role = 'member';
        }
      }

      const validation = ProfileValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const profile = await this.service.createOrUpsert(req.body);
      if (this.pool) {
        try {
          await logAudit(this.pool, {
            action: 'CREATE',
            entity: 'profiles',
            entityId: profile.id,
            churchId: profile.congregation || null,
            userId: profile.owner_id || ctx.ownerId || ctx.userId,
            newValues: profile,
            req
          });
        } catch (_) {}
      }
      return res.status(200).json({ success: true, message: 'Perfil salvo com sucesso.', data: profile });
    } catch (err: any) {
      console.error('[ProfileController] Erro ao criar/atualizar perfil:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_SALVAR_PERFIL', message: err?.message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ctx = getTenantContext(req);

      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para alterar perfil.' });
      }

      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'PERFIL_NAO_ENCONTRADO' });
      }

      // 🛡️ Sub-etapa 3.5: Validações para Secundários
      if (ctx.isSecondaryUser) {
        // 1. Secundário não pode alterar perfis de outros membros nem do titular
        if (existing.id !== ctx.userId) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Acesso negado: você não tem permissão para alterar o perfil de outros membros.'
          });
        }

        // 2. Secundário alterando os próprios dados cadastrais: bloqueia auto-escalação de privilégios
        delete req.body.role;
        delete req.body.permissions;
        delete req.body.owner_id;
        delete req.body.congregation;
        delete req.body.is_blocked;
        delete req.body.subscription_status;
        delete req.body.trial_ends_at;
        delete req.body.subscription_ends_at;
      } else if (!ctx.isSuperAdmin && ctx.isOwner) {
        // Titular: valida se o perfil pertence à sua organização
        const isSameOrg = existing.owner_id === ctx.ownerId || existing.owner_id === ctx.userId || existing.id === ctx.userId;
        if (!isSameOrg) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Acesso negado para alterar perfil de outra organização.'
          });
        }

        // Impede que titular transforme alguém em super_admin
        if (req.body.role && ['super_admin', 'superadmin', 'administrador_geral'].includes(String(req.body.role).toLowerCase())) {
          delete req.body.role;
        }
      }

      const validation = ProfileValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const updated = await this.service.update(id, req.body);
      if (this.pool) {
        try {
          await logAudit(this.pool, {
            action: 'UPDATE',
            entity: 'profiles',
            entityId: id,
            churchId: updated?.congregation || existing?.congregation || null,
            userId: updated?.owner_id || existing?.owner_id || ctx.ownerId || ctx.userId,
            oldValues: existing,
            newValues: updated,
            req
          });
        } catch (_) {}
      }
      return res.json({ success: true, message: 'Perfil atualizado com sucesso.', data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_ATUALIZAR_PERFIL', message: err?.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ctx = getTenantContext(req);

      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para remover perfil.' });
      }

      // 🛡️ Sub-etapa 3.5: Usuário secundário JAMAIS pode excluir perfis
      if (ctx.isSecondaryUser) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Acesso negado: apenas o titular pode excluir membros da organização.'
        });
      }

      const existing = await this.service.getById(id);
      if (!existing) {
        return res.json({ success: true, message: 'Perfil removido com sucesso.' });
      }

      if (!ctx.isSuperAdmin && ctx.isOwner) {
        // Titular não pode excluir seu próprio perfil principal por esta rota
        if (existing.id === ctx.userId) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Não é permitido ao titular excluir o próprio perfil principal.'
          });
        }

        // Valida se o perfil a ser excluído pertence à sua organização
        const isSameOrg = existing.owner_id === ctx.ownerId || existing.owner_id === ctx.userId;
        if (!isSameOrg) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Acesso negado para remover perfil de outra organização.'
          });
        }
      }

      await this.service.delete(id);
      if (this.pool) {
        try {
          await logAudit(this.pool, {
            action: 'DELETE',
            entity: 'profiles',
            entityId: id,
            churchId: existing?.congregation || null,
            userId: existing?.owner_id || ctx.ownerId || ctx.userId,
            oldValues: existing,
            req
          });
        } catch (_) {}
      }
      return res.json({ success: true, message: 'Perfil removido com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_EXCLUIR_PERFIL', message: err?.message });
    }
  };

  migrate = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Acesso negado: apenas administradores gerais podem executar migrações de perfis.'
        });
      }

      const rows = req.body?.rows || [];
      const result = await this.service.migrateFromSupabase(rows);
      return res.json({ success: true, message: `${result.migratedCount} perfis migrados com sucesso.`, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_NA_MIGRACAO_PERFIS', message: err?.message });
    }
  };
}
