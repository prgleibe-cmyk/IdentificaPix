import { Request, Response } from 'express';
import { ProfileService } from '../services/profile.service.js';
import { ProfileValidator } from '../validators/profile.validator.js';

export class ProfileController {
  private service: ProfileService;

  constructor(service: ProfileService) {
    this.service = service;
  }

  getAll = async (req: Request, res: Response) => {
    try {
      const { owner_id } = req.query;
      if (typeof owner_id === 'string' && owner_id.trim() !== '') {
        const profiles = await this.service.getByOwnerId(owner_id);
        return res.json({ success: true, data: profiles });
      }

      const profiles = await this.service.getAll();
      return res.json({ success: true, data: profiles });
    } catch (err: any) {
      console.error('[ProfileController] Erro ao buscar perfis:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PERFIS', message: err?.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const profile = await this.service.getById(id);
      if (!profile) {
        return res.status(404).json({ success: false, error: 'PERFIL_NAO_ENCONTRADO', message: `Perfil "${id}" não encontrado.` });
      }
      return res.json({ success: true, data: profile });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PERFIL', message: err?.message });
    }
  };

  createOrUpsert = async (req: Request, res: Response) => {
    try {
      const validation = ProfileValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const profile = await this.service.createOrUpsert(req.body);
      return res.status(200).json({ success: true, message: 'Perfil salvo com sucesso.', data: profile });
    } catch (err: any) {
      console.error('[ProfileController] Erro ao criar/atualizar perfil:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_SALVAR_PERFIL', message: err?.message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validation = ProfileValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const updated = await this.service.update(id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'PERFIL_NAO_ENCONTRADO' });
      }
      return res.json({ success: true, message: 'Perfil atualizado com sucesso.', data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_ATUALIZAR_PERFIL', message: err?.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await this.service.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'PERFIL_NAO_ENCONTRADO' });
      }
      return res.json({ success: true, message: 'Perfil removido com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_EXCLUIR_PERFIL', message: err?.message });
    }
  };

  migrate = async (req: Request, res: Response) => {
    try {
      const rows = req.body?.rows || [];
      const result = await this.service.migrateFromSupabase(rows);
      return res.json({ success: true, message: `${result.migratedCount} perfis migrados com sucesso.`, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_NA_MIGRACAO_PERFIS', message: err?.message });
    }
  };
}
