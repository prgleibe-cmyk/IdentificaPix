import { Request, Response } from 'express';
import { FileModelService } from '../services/file_model.service.js';
import { FileModelValidator } from '../validators/file_model.validator.js';

export class FileModelController {
  private service: FileModelService;

  constructor(service: FileModelService) {
    this.service = service;
  }

  getUserModels = async (req: Request, res: Response) => {
    try {
      const { user_id } = req.query;
      const targetUserId = typeof user_id === 'string' ? user_id : undefined;
      const models = await this.service.getUserModels(targetUserId);
      return res.json({ success: true, data: models });
    } catch (err: any) {
      console.error('[FileModelController] Erro ao buscar modelos:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_MODELOS', message: err?.message });
    }
  };

  getAllAdmin = async (req: Request, res: Response) => {
    try {
      const models = await this.service.getAllAdmin();
      return res.json({ success: true, data: models });
    } catch (err: any) {
      console.error('[FileModelController] Erro admin ao buscar modelos:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_MODELOS', message: err?.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const model = await this.service.getById(id);
      if (!model) {
        return res.status(404).json({ success: false, error: 'MODELO_NAO_ENCONTRADO', message: `Modelo ${id} não encontrado.` });
      }
      return res.json({ success: true, data: model });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_MODELO', message: err?.message });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
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
      const { id } = req.params;
      const validation = FileModelValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const updated = await this.service.update(id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'MODELO_NAO_ENCONTRADO' });
      }
      return res.json({ success: true, message: 'Modelo atualizado com sucesso.', data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_ATUALIZAR_MODELO', message: err?.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await this.service.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'MODELO_NAO_ENCONTRADO' });
      }
      return res.json({ success: true, message: 'Modelo removido com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_EXCLUIR_MODELO', message: err?.message });
    }
  };

  migrate = async (req: Request, res: Response) => {
    try {
      const rows = req.body?.rows || [];
      const result = await this.service.migrateFromSupabase(rows);
      return res.json({ success: true, message: `${result.migratedCount} modelos migrados.`, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_NA_MIGRACAO', message: err?.message });
    }
  };
}
