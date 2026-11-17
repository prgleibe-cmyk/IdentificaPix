import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { PaymentValidator } from '../validators/payment.validator.js';
import { getTenantContext } from '../../auth/utils/tenant.context.js';

export class PaymentController {
  private service: PaymentService;

  constructor(service: PaymentService) {
    this.service = service;
  }

  getAll = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar pagamentos.' });
      }
      if (ctx.isSecondaryUser) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado: usuários secundários não possuem acesso ao histórico financeiro da assinatura.' });
      }

      const { user_id } = req.query;
      const requestedUserId = typeof user_id === 'string' && user_id.trim() !== '' ? user_id.trim() : undefined;

      if (!ctx.isSuperAdmin) {
        if (requestedUserId && requestedUserId !== ctx.userId && requestedUserId !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado aos pagamentos de outro usuário.' });
        }
        const effectiveUserId = ctx.ownerId || ctx.userId || '';
        const payments = await this.service.getAll(effectiveUserId);
        return res.json({ success: true, data: payments });
      }

      const payments = await this.service.getAll(requestedUserId);
      return res.json({ success: true, data: payments });
    } catch (err: any) {
      console.error('[PaymentController] Erro ao buscar pagamentos:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PAGAMENTOS', message: err?.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (ctx.isSecondaryUser) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado.' });
      }

      const { id } = req.params;
      const payment = await this.service.getById(id);
      if (!payment) {
        return res.status(404).json({ success: false, error: 'PAGAMENTO_NAO_ENCONTRADO', message: `Pagamento ${id} não encontrado.` });
      }

      if (!ctx.isSuperAdmin && payment.user_id !== ctx.userId && payment.user_id !== ctx.ownerId) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado ao pagamento de outro usuário.' });
      }

      return res.json({ success: true, data: payment });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PAGAMENTO', message: err?.message });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária para registrar pagamento.' });
      }
      if (ctx.isSecondaryUser) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado: usuários secundários não podem registrar pagamentos de assinatura.' });
      }

      if (!ctx.isSuperAdmin) {
        if (req.body?.user_id && req.body.user_id !== ctx.userId && req.body.user_id !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Não é permitido registrar pagamento para outro usuário.' });
        }
        req.body = { ...req.body, user_id: ctx.ownerId || ctx.userId };
      }

      const validation = PaymentValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const newPayment = await this.service.create(req.body);
      return res.status(201).json({ success: true, message: 'Pagamento registrado com sucesso.', data: newPayment });
    } catch (err: any) {
      console.error('[PaymentController] Erro ao registrar pagamento:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_REGISTRAR_PAGAMENTO', message: err?.message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (ctx.isSecondaryUser) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado.' });
      }

      const { id } = req.params;
      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'PAGAMENTO_NAO_ENCONTRADO' });
      }

      if (!ctx.isSuperAdmin) {
        if (existing.user_id !== ctx.userId && existing.user_id !== ctx.ownerId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado para atualizar pagamento de outro usuário.' });
        }
        if (req.body && 'user_id' in req.body) {
          delete req.body.user_id;
        }
      }

      const validation = PaymentValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const updated = await this.service.update(id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'PAGAMENTO_NAO_ENCONTRADO' });
      }
      return res.json({ success: true, message: 'Pagamento atualizado com sucesso.', data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_ATUALIZAR_PAGAMENTO', message: err?.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const ctx = getTenantContext(req);
      if (!ctx.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
      }
      if (ctx.isSecondaryUser) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado.' });
      }

      const { id } = req.params;
      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'PAGAMENTO_NAO_ENCONTRADO' });
      }

      if (!ctx.isSuperAdmin && existing.user_id !== ctx.userId && existing.user_id !== ctx.ownerId) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado para excluir pagamento de outro usuário.' });
      }

      const deleted = await this.service.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'PAGAMENTO_NAO_ENCONTRADO' });
      }
      return res.json({ success: true, message: 'Pagamento removido com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_EXCLUIR_PAGAMENTO', message: err?.message });
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
      return res.json({ success: true, message: `${result.migratedCount} pagamentos migrados com sucesso.`, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_NA_MIGRACAO_PAGAMENTOS', message: err?.message });
    }
  };
}
