import { Request, Response } from 'express';
import { FileModelService } from '../services/file_model.service.js';
import { FileModelValidator } from '../validators/file_model.validator.js';
import { getTenantContext, hasPermission } from '../../auth/utils/tenant.context.js';

export class FileModelController {
  private service: FileModelService;

  constructor(service: FileModelService) {
    this.service = service;
  }

  getUserModels = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar modelos.' });
      }

      const { user_id } = req.query;
      const requestedUserId = typeof user_id === 'string' && user_id.trim() !== '' ? user_id.trim() : undefined;

      if (!ctx.isSuperAdmin) {
        if (requestedUserId && requestedUserId !== ctx.userId && requestedUserId !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado aos modelos de outro usuário.' });
        }
        const effectiveUserId = ctx.ownerId || ctx.userId || '';
        const models = await this.service.getUserModels(effectiveUserId);
        return res.json({ success: true, data: models });
      }

      const models = await this.service.getUserModels(requestedUserId);
      return res.json({ success: true, data: models });
    } catch (err: any) {
      console.error('[FileModelController] Erro ao buscar modelos:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_MODELOS', message: err?.message });
    }
  };

  getAllAdmin = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (!ctx.isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso restrito a administradores.' });
      }

      const models = await this.service.getAllAdmin();
      return res.json({ success: true, data: models });
    } catch (err: any) {
      console.error('[FileModelController] Erro admin ao buscar modelos:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_MODELOS', message: err?.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }

      const { id } = req.params;
      const model = await this.service.getById(id);
      if (!model) {
        return res.status(404).json({ success: false, error: 'MODELO_NAO_ENCONTRADO', message: `Modelo ${id} não encontrado.` });
      }

      if (!ctx.isSuperAdmin) {
        const isOwnOrOrg = model.user_id === ctx.userId || model.user_id === ctx.ownerId;
        const isGlobalActive = Boolean(model.is_active);
        if (!isOwnOrOrg && !isGlobalActive) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado a este modelo.' });
        }
      }

      return res.json({ success: true, data: model });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_MODELO', message: err?.message });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para criar modelo.' });
      }
      if (ctx.isSecondaryUser && !hasPermission(ctx, 'create', 'edit')) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Permissão insuficiente para criar modelo.' });
      }

      if (!ctx.isSuperAdmin) {
        if (req.body?.user_id && req.body.user_id !== ctx.userId && req.body.user_id !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Não é permitido criar modelo para outro usuário.' });
        }
        req.body = { ...req.body, user_id: ctx.ownerId || ctx.userId };
      }

      const validation = FileModelValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const newModel = await this.service.create(req.body);
      return res.status(201).json({ success: true, message: 'Modelo criado com sucesso.', data: newModel });
    } catch (err: any) {
      console.error('[FileModelController] Erro ao criar modelo:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_CRIAR_MODELO', message: err?.message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (ctx.isSecondaryUser && !hasPermission(ctx, 'edit')) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Permissão insuficiente para alterar modelo.' });
      }

      const { id } = req.params;
      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'MODELO_NAO_ENCONTRADO' });
      }

      if (!ctx.isSuperAdmin) {
        if (!existing.user_id || (existing.user_id !== ctx.userId && existing.user_id !== ctx.ownerId)) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado para alterar este modelo.' });
        }
        if (req.body && 'user_id' in req.body) {
          delete req.body.user_id;
        }
      }

      const validation = FileModelValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const updated = await this.service.update(id, req.body);
      return res.json({ success: true, message: 'Modelo atualizado com sucesso.', data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_ATUALIZAR_MODELO', message: err?.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Permissão insuficiente para remover modelo.' });
      }

      const { id } = req.params;
      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'MODELO_NAO_ENCONTRADO' });
      }

      if (!ctx.isSuperAdmin) {
        if (!existing.user_id || (existing.user_id !== ctx.userId && existing.user_id !== ctx.ownerId)) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado para remover este modelo.' });
        }
      }

      await this.service.delete(id);
      return res.json({ success: true, message: 'Modelo removido com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_EXCLUIR_MODELO', message: err?.message });
    }
  };

  migrate = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (!ctx.isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso restrito a administradores gerais.' });
      }

      const rows = req.body?.rows || [];
      const result = await this.service.migrateFromSupabase(rows);
      return res.json({ success: true, message: `${result.migratedCount} modelos migrados.`, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_NA_MIGRACAO', message: err?.message });
    }
  };
}
