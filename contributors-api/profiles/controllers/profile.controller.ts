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
      const user = (req as any).user;
      const userRole = String(user?.role || '').toLowerCase();
      const userEmail = String(user?.email || '').toLowerCase().trim();
      const isSuperAdmin = Boolean(
        user?.isSuperAdmin || 
        userRole === 'super_admin' || 
        userRole === 'administrador_geral' ||
        userRole === 'superadmin' ||
        userRole === 'admin' ||
        userRole === 'owner' ||
        userEmail === 'identificapix@gmail.com'
      );
      const authenticatedUserId = user?.user_id || user?.userId || user?.id;
      const authenticatedOwnerId = user?.owner_id || user?.ownerId;
      const effectiveOwnerId = authenticatedOwnerId || authenticatedUserId;

      const { owner_id } = req.query;

      // Se foi solicitado um owner_id específico (ex: listagem de secundários de um owner)
      if (typeof owner_id === 'string' && owner_id.trim() !== '') {
        // Se for usuário autenticado comum tentando ver de outro owner sem permissão
        if (user && !isSuperAdmin && authenticatedUserId) {
          if (owner_id !== authenticatedUserId && owner_id !== effectiveOwnerId) {
            return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado aos perfis de outro usuário.' });
          }
        }
        const profiles = await this.service.getByOwnerId(owner_id.trim());
        return res.json({ success: true, data: profiles });
      }

      // Se não passou owner_id:
      // Se for SuperAdmin / Admin Owner / email identificapix@gmail.com ou sem usuário => Retorna TODOS os perfis
      if (isSuperAdmin || !user) {
        const profiles = await this.service.getAll();
        return res.json({ success: true, data: profiles });
      }

      // Se for usuário comum sem passar owner_id => Retorna apenas os seus secundários
      const profiles = await this.service.getByOwnerId(effectiveOwnerId);
      return res.json({ success: true, data: profiles });
    } catch (err: any) {
      console.error('[ProfileController] Erro ao buscar perfis:', err);
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PERFIS', message: err?.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMINISTRADOR_GERAL');
      const authenticatedUserId = user?.user_id || user?.userId || user?.id;
      const authenticatedOwnerId = user?.owner_id || user?.ownerId;

      const profile = await this.service.getById(id);
      if (!profile) {
        return res.status(404).json({ success: false, error: 'PERFIL_NAO_ENCONTRADO', message: `Perfil "${id}" não encontrado.` });
      }

      const isOwnProfile = profile.id === authenticatedUserId || profile.email?.toLowerCase() === user?.email?.toLowerCase();
      const isOwnerViewingMember = profile.owner_id === authenticatedUserId;
      const isMemberViewingOwner = profile.id === authenticatedOwnerId || (authenticatedOwnerId && profile.owner_id === authenticatedOwnerId);

      if (user && !isSuperAdmin && authenticatedUserId && !isOwnProfile && !isOwnerViewingMember && !isMemberViewingOwner) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado a este perfil.' });
      }

      return res.json({ success: true, data: profile });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_BUSCAR_PERFIL', message: err?.message });
    }
  };

  createOrUpsert = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMINISTRADOR_GERAL');
      const authenticatedUserId = user?.userId || user?.id;

      if (user && !isSuperAdmin && authenticatedUserId) {
        if (req.body.owner_id && req.body.owner_id !== authenticatedUserId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Não é permitido criar perfil para outro usuário.' });
        }
        req.body.owner_id = authenticatedUserId;
      }

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
      const user = (req as any).user;
      const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMINISTRADOR_GERAL');
      const authenticatedUserId = user?.userId || user?.id;

      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'PERFIL_NAO_ENCONTRADO' });
      }

      if (user && !isSuperAdmin && authenticatedUserId && existing.owner_id && existing.owner_id !== authenticatedUserId) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado para alterar este perfil.' });
      }

      const validation = ProfileValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const updated = await this.service.update(id, req.body);
      return res.json({ success: true, message: 'Perfil atualizado com sucesso.', data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'FALHA_AO_ATUALIZAR_PERFIL', message: err?.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMINISTRADOR_GERAL');
      const authenticatedUserId = user?.userId || user?.id;

      const existing = await this.service.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'PERFIL_NAO_ENCONTRADO' });
      }

      if (user && !isSuperAdmin && authenticatedUserId && existing.owner_id && existing.owner_id !== authenticatedUserId) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Acesso negado para remover este perfil.' });
      }

      const deleted = await this.service.delete(id);
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
