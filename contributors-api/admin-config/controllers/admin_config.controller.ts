import { Request, Response } from 'express';
import { AdminConfigService } from '../services/admin_config.service.js';
import { AdminConfigValidator } from '../validators/admin_config.validator.js';

export class AdminConfigController {
  private service: AdminConfigService;

  constructor(service: AdminConfigService) {
    this.service = service;
  }

  /**
   * GET /api/v1/admin-config
   * Se ?key=xxx for fornecido, filtra pela chave.
   * Caso contrário, retorna todas as configurações.
   */
  getAll = async (req: Request, res: Response) => {
    try {
      const { key } = req.query;
      if (key && typeof key === 'string') {
        const item = await this.service.getByKey(key);
        return res.json({
          success: true,
          data: item ? [item] : [],
          config: item ? { [item.key]: item.value } : {}
        });
      }

      const { configMap, items } = await this.service.getAll();
      return res.json({
        success: true,
        data: items,
        config: configMap
      });
    } catch (err: any) {
      console.error('[AdminConfigController] Erro ao buscar configurações:', err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_BUSCAR_CONFIGURACOES',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * GET /api/v1/admin-config/:key
   */
  getByKey = async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const keyValidation = AdminConfigValidator.validateKey(key);
      if (!keyValidation.isValid) {
        return res.status(400).json({ success: false, error: keyValidation.error });
      }

      const item = await this.service.getByKey(key);
      if (!item) {
        return res.status(440).json({
          success: false,
          error: 'CONFIGURACAO_NAO_ENCONTRADA',
          message: `Nenhuma configuração encontrada com a chave "${key}".`
        });
      }

      return res.json({
        success: true,
        data: item,
        value: item.value
      });
    } catch (err: any) {
      console.error(`[AdminConfigController] Erro ao buscar chave "${req.params.key}":`, err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_BUSCAR_CHAVE',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * PUT /api/v1/admin-config
   * Aceita { key, value } ou lote em lote
   */
  upsert = async (req: Request, res: Response) => {
    try {
      const validation = AdminConfigValidator.validateUpsert(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const { key, value } = req.body;
      const updatedItem = await this.service.setConfig({ key, value });

      return res.json({
        success: true,
        message: `Configuração "${key}" salva com sucesso.`,
        data: updatedItem
      });
    } catch (err: any) {
      console.error('[AdminConfigController] Erro no UPSERT de configuração:', err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_GRAVAR_CONFIGURACAO',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * PATCH /api/v1/admin-config
   */
  patch = async (req: Request, res: Response) => {
    try {
      const { key, value } = req.body;
      const keyValidation = AdminConfigValidator.validateKey(key);
      if (!keyValidation.isValid) {
        return res.status(400).json({ success: false, error: keyValidation.error });
      }

      const updatedItem = await this.service.patchConfig(key, value);
      return res.json({
        success: true,
        message: `Configuração "${key}" atualizada com sucesso.`,
        data: updatedItem
      });
    } catch (err: any) {
      console.error('[AdminConfigController] Erro no PATCH de configuração:', err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_AO_ATUALIZAR_CONFIGURACAO',
        message: err?.message || 'Erro interno no servidor'
      });
    }
  };

  /**
   * POST /api/v1/admin-config/migrate
   * Copia registros legado do Supabase para o PostgreSQL.
   */
  migrate = async (req: Request, res: Response) => {
    try {
      const rows = req.body?.rows || [];
      const result = await this.service.migrateFromSupabase(rows);
      return res.json({
        success: true,
        message: `${result.migratedCount} configurações migradas com sucesso.`,
        data: result
      });
    } catch (err: any) {
      console.error('[AdminConfigController] Erro na migração de configurações:', err);
      return res.status(500).json({
        success: false,
        error: 'FALHA_NA_MIGRACAO',
        message: err?.message || 'Erro interno na migração'
      });
    }
  };
}
