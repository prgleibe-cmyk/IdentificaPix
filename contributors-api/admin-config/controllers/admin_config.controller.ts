import { Request, Response } from 'express';
import { AdminConfigService } from '../services/admin_config.service.js';
import { AdminConfigValidator } from '../validators/admin_config.validator.js';
import { getTenantContext } from '../../auth/utils/tenant.context.js';

const PUBLIC_READ_KEYS = new Set(['system_settings']);

export class AdminConfigController {
  private service: AdminConfigService;

  constructor(service: AdminConfigService) {
    this.service = service;
  }

  /**
   * GET /api/v1/admin-config
   * Se ?key=system_settings, permite leitura pública das configurações gerais do app.
   * Outras chaves e listagem completa exigem SuperAdmin autenticado.
   */
  getAll = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      const { key } = req.query;
      if (key && typeof key === 'string') {
        if (!PUBLIC_READ_KEYS.has(key)) {
          if (!ctx.isAuthenticated) {
            return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
          }
          if (!ctx.isSuperAdmin) {
            return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso restrito a administradores gerais.' });
          }
        }
        const item = await this.service.getByKey(key);
        return res.json({
          success: true,
          data: item ? [item] : [],
          config: item ? { [item.key]: item.value } : {}
        });
      }

      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para listar configurações administrativas.' });
      }
      if (!ctx.isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso restrito a administradores gerais.' });
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

      if (!PUBLIC_READ_KEYS.has(key)) {
        const ctx = getTenantContext(req);
        if (!ctx.isAuthenticated) {
          return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
        }
        if (!ctx.isSuperAdmin) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso restrito a administradores gerais.' });
        }
      }

      const item = await this.service.getByKey(key);
      if (!item) {
        return res.status(404).json({
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
   */
  upsert = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (!ctx.isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Apenas administradores gerais podem alterar configurações globais.' });
      }

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
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (!ctx.isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Apenas administradores gerais podem alterar configurações globais.' });
      }

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
