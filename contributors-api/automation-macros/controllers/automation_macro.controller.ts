import { Request, Response } from 'express';
import { AutomationMacroService } from '../services/automation_macro.service.js';
import { AutomationMacroValidator } from '../validators/automation_macro.validator.js';
import { getTenantContext, hasPermission } from '../../auth/utils/tenant.context.js';

export class AutomationMacroController {
  private service: AutomationMacroService;

  constructor(service: AutomationMacroService) {
    this.service = service;
  }

  /**
   * GET /api/v1/automation-macros
   * Opcional: ?user_id=xxx (apenas superadmin pode consultar outro tenant)
   */
  getAll = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar macros.' });
      }

      const { user_id } = req.query;
      const requestedUserId = typeof user_id === 'string' && user_id.trim() !== '' ? user_id.trim() : undefined;

      if (!ctx.isSuperAdmin) {
        if (requestedUserId && requestedUserId !== ctx.userId && requestedUserId !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado às macros de outra organização.' });
        }
        const effectiveUserId = ctx.ownerId || ctx.userId || '';
        let macros = await this.service.getByUserId(effectiveUserId);
        if (ctx.isSecondaryUser && ctx.allowedBankIds.length > 0) {
          macros = macros.filter((m: any) => !m.bank_id || ctx.allowedBankIds.includes(m.bank_id));
        }
        return res.json({ success: true, data: macros });
      }

      const macros = await this.service.getByUserId(requestedUserId);
      return res.json({
        success: true,
        data: macros
      });
    } catch (err: any) {
      console.error('[AutomationMacroController] Erro ao buscar macros:', err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_BUSCAR_MACROS',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * GET /api/v1/automation-macros/:id
   */
  getById = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }

      const { id } = req.params;
      const macro = await this.service.getById(id);
      if (!macro) {
        return res.status(404).json({
          success: false,
          error: 'MACRO_NAO_ENCONTRADA',
          message: `Nenhuma macro de automação encontrada com o ID "${id}".`
        });
      }

      if (!ctx.isSuperAdmin) {
        if (macro.user_id !== ctx.userId && macro.user_id !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado a esta macro.' });
        }
        if (ctx.isSecondaryUser && macro.bank_id && ctx.allowedBankIds.length > 0 && !ctx.allowedBankIds.includes(macro.bank_id)) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado: conta bancária não autorizada.' });
        }
      }

      return res.json({
        success: true,
        data: macro
      });
    } catch (err: any) {
      console.error(`[AutomationMacroController] Erro ao buscar macro ${req.params.id}:`, err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_BUSCAR_MACRO',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * POST /api/v1/automation-macros
   */
  create = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para criar macro.' });
      }
      if (ctx.isSecondaryUser && !hasPermission(ctx, 'create', 'edit')) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Permissão insuficiente para criar macro.' });
      }

      if (!ctx.isSuperAdmin) {
        if (req.body?.user_id && req.body.user_id !== ctx.userId && req.body.user_id !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Não é permitido criar macro para outro usuário.' });
        }
        if (ctx.isSecondaryUser && req.body?.bank_id && ctx.allowedBankIds.length > 0 && !ctx.allowedBankIds.includes(req.body.bank_id)) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado: conta bancária não autorizada.' });
        }
        req.body = { ...req.body, user_id: ctx.ownerId || ctx.userId };
      }

      const validation = AutomationMacroValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const newMacro = await this.service.create(req.body);
      return res.status(201).json({
        success: true,
        message: 'Macro de automação criada com sucesso.',
        data: newMacro
      });
    } catch (err: any) {
      console.error('[AutomationMacroController] Erro ao criar macro:', err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_CRIAR_MACRO',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * PUT /api/v1/automation-macros/:id
   * PATCH /api/v1/automation-macros/:id
   */
  update = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (ctx.isSecondaryUser && !hasPermission(ctx, 'edit')) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Permissão insuficiente para alterar macro.' });
      }

      const { id } = req.params;
      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'MACRO_NAO_ENCONTRADA',
          message: `Macro "${id}" não encontrada para atualização.`
        });
      }

      if (!ctx.isSuperAdmin) {
        if (existing.user_id !== ctx.userId && existing.user_id !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado para alterar esta macro.' });
        }
        if (ctx.isSecondaryUser && ctx.allowedBankIds.length > 0) {
          if (existing.bank_id && !ctx.allowedBankIds.includes(existing.bank_id)) {
            return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado: banco da macro não autorizado.' });
          }
          if (req.body?.bank_id && !ctx.allowedBankIds.includes(req.body.bank_id)) {
            return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado: banco de destino não autorizado.' });
          }
        }
        if (req.body && 'user_id' in req.body) {
          delete req.body.user_id;
        }
      }

      const validation = AutomationMacroValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const updated = await this.service.update(id, req.body);
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'MACRO_NAO_ENCONTRADA',
          message: `Macro "${id}" não encontrada para atualização.`
        });
      }

      return res.json({
        success: true,
        message: 'Macro de automação atualizada com sucesso.',
        data: updated
      });
    } catch (err: any) {
      console.error(`[AutomationMacroController] Erro ao atualizar macro ${req.params.id}:`, err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_ATUALIZAR_MACRO',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * DELETE /api/v1/automation-macros/:id
   */
  delete = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Permissão insuficiente para excluir macro.' });
      }

      const { id } = req.params;
      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'MACRO_NAO_ENCONTRADA',
          message: `Macro "${id}" não encontrada para exclusão.`
        });
      }

      if (!ctx.isSuperAdmin) {
        if (existing.user_id !== ctx.userId && existing.user_id !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado para remover esta macro.' });
        }
        if (ctx.isSecondaryUser && existing.bank_id && ctx.allowedBankIds.length > 0 && !ctx.allowedBankIds.includes(existing.bank_id)) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado: banco não autorizado.' });
        }
      }

      const deleted = await this.service.delete(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'MACRO_NAO_ENCONTRADA',
          message: `Macro "${id}" não encontrada para exclusão.`
        });
      }

      return res.json({
        success: true,
        message: 'Macro de automação removida com sucesso.'
      });
    } catch (err: any) {
      console.error(`[AutomationMacroController] Erro ao excluir macro ${req.params.id}:`, err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_EXCLUIR_MACRO',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * POST /api/v1/automation-macros/migrate
   */
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
      return res.json({
        success: true,
        message: `${result.migratedCount} macros de automação migradas com sucesso.`,
        data: result
      });
    } catch (err: any) {
      console.error('[AutomationMacroController] Erro na migração de macros:', err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_NA_MIGRACAO_MACROS',
        message: err?.message || 'Erro interno na migração'
      });
    }
  };
}
