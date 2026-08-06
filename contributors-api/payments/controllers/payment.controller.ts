import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { PaymentValidator } from '../validators/payment.validator.js';

export class PaymentController {
  private service: PaymentService;

  constructor(service: PaymentService) {
    this.service = service;
  }

  getAll = async (req: Request, res: Response) => {
    try {
      const { user_id } = req.query;
      const targetUserId = typeof user_id === 'string' ? user_id : undefined;
      const payments = await this.service.getAll(targetUserId);
      return res.json({ success: true, data: payments });
    } catch (err: any) {
      console.error('[PaymentController] Erro ao buscar pagamentos:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PAGAMENTOS', message: err?.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payment = await this.service.getById(id);
      if (!payment) {
        return res.status(404).json({ success: false, error: 'PAGAMENTO_NAO_ENCONTRADO', message: `Pagamento ${id} não encontrado.` });
      }
      return res.json({ success: true, data: payment });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PAGAMENTO', message: err?.message });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
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
      const { id } = req.params;
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
      const { id } = req.params;
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
      const rows = req.body?.rows || [];
      const result = await this.service.migrateFromSupabase(rows);
      return res.json({ success: true, message: `${result.migratedCount} pagamentos migrados com sucesso.`, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_NA_MIGRACAO_PAGAMENTOS', message: err?.message });
    }
  };
}
