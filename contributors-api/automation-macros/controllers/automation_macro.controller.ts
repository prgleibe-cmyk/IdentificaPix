import { Request, Response } from 'express';
import { AutomationMacroService } from '../services/automation_macro.service.js';
import { AutomationMacroValidator } from '../validators/automation_macro.validator.js';

export class AutomationMacroController {
  private service: AutomationMacroService;

  constructor(service: AutomationMacroService) {
    this.service = service;
  }

  /**
   * GET /api/v1/automation-macros
   * Opcional: ?user_id=xxx
   */
  getAll = async (req: Request, res: Response) => {
    try {
      const { user_id } = req.query;
      const targetUserId = typeof user_id === 'string' ? user_id : undefined;
      const macros = await this.service.getByUserId(targetUserId);

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
      const { id } = req.params;
      const macro = await this.service.getById(id);
      if (!macro) {
        return res.status(404).json({
          success: false,
          error: 'MACRO_NAO_ENCONTRADA',
          message: `Nenhuma macro de automação encontrada com o ID "${id}".`
        });
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
      const { id } = req.params;
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
      const { id } = req.params;
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
