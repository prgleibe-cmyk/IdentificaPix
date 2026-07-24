import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Bank, Church, ChurchFormData, ContributionType, LearnedAssociation, MatchResult } from '../types';
import { usePersistentState } from './usePersistentState';
import { strictNormalize, DEFAULT_CONTRIBUTION_KEYWORDS } from '../services/utils/parsingUtils';
import { useAuth } from '../contexts/AuthContext';
import { batchState } from './reconciliation/useCloudSync';

const DEFAULT_PAYMENT_METHODS = ['PIX', 'DINHEIRO'];

export const useReferenceData = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void, realtimeRefreshKey?: number) => {
    const { subscription, systemSettings } = useAuth();
    const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;
    const userSuffix = user ? `-${user.id}` : '-guest';

    const [banks, setBanks] = usePersistentState<Bank[]>(`identificapix-banks${userSuffix}`, []);
    const [churches, setChurches] = usePersistentState<Church[]>(`identificapix-churches${userSuffix}`, []);
    const [reports, setReports] = useState<any[]>([]);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>(`identificapix-similarity${userSuffix}`, 55);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>(`identificapix-daytolerance${userSuffix}`, 2);
    
    const [contributionKeywords, setContributionKeywords] = usePersistentState<string[]>(`identificapix-contrib-keywords${userSuffix}`, DEFAULT_CONTRIBUTION_KEYWORDS);
    const [paymentMethods, setPaymentMethods] = usePersistentState<string[]>(`identificapix-payment-methods${userSuffix}`, DEFAULT_PAYMENT_METHODS);
    const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);

    const fetchContributionTypes = useCallback(async () => {
        try {
            const url = effectiveUserId 
                ? `/api/v1/contribution-types?user_id=${encodeURIComponent(effectiveUserId)}`
                : '/api/v1/contribution-types';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setContributionTypes(data);
            }
        } catch (err) {
            console.error('Erro ao buscar tipos de contribuição:', err);
        }
    }, [effectiveUserId]);

    useEffect(() => {
        fetchContributionTypes();
    }, [fetchContributionTypes]);

    // ✅ MIGRATION/CLEANUP logic to ensure only 'DÍZIMO', 'OFERTA' for contribution types and 'PIX', 'DINHEIRO' for payment methods
    const hasMigratedRef = useRef(false);

    useEffect(() => {
        if (!userSuffix) return;
        if (hasMigratedRef.current) return;
        
        if (!contributionKeywords || !paymentMethods) return;

        let changed = false;
        let nextKeywords = [...contributionKeywords];
        let nextMethods = [...paymentMethods];

        // 1. Clean contribution keywords if they match the legacy defaults
        if (contributionKeywords.length === 10 && contributionKeywords.includes('COLETA')) {
            nextKeywords = ['DÍZIMO', 'OFERTA'];
            changed = true;
        } else if (contributionKeywords.length > 2) {
            const oldDefaults = ['DÍZIMOS', 'COLETA', 'COLETAS', 'MISSÃO', 'MISSÕES', 'VOTOS', 'CAMPANHA', 'OFERTAS'];
            const filtered = contributionKeywords.filter(kw => !oldDefaults.includes(kw.toUpperCase()));
            if (filtered.length !== contributionKeywords.length) {
                nextKeywords = filtered;
                if (!nextKeywords.some(k => k.toUpperCase() === 'DÍZIMO')) nextKeywords.push('DÍZIMO');
                if (!nextKeywords.some(k => k.toUpperCase() === 'OFERTA')) nextKeywords.push('OFERTA');
                changed = true;
            }
        }

        // 2. Clean payment methods if they match legacy defaults
        if (paymentMethods.length === 7 && paymentMethods.includes('TED')) {
            nextMethods = ['PIX', 'DINHEIRO'];
            changed = true;
        } else if (paymentMethods.length > 2) {
            const oldMethods = ['TED', 'BOLETO', 'CARTÃO', 'CHEQUE', 'DEPÓSITO'];
            const filtered = paymentMethods.filter(pm => !oldMethods.includes(pm.toUpperCase()));
            if (filtered.length !== paymentMethods.length) {
                nextMethods = filtered;
                if (!nextMethods.some(m => m.toUpperCase() === 'PIX')) nextMethods.push('PIX');
                if (!nextMethods.some(m => m.toUpperCase() === 'DINHEIRO')) nextMethods.push('DINHEIRO');
                changed = true;
            }
        }

        if (changed) {
            if (JSON.stringify(nextKeywords) !== JSON.stringify(contributionKeywords)) {
                setContributionKeywords(nextKeywords);
            }
            if (JSON.stringify(nextMethods) !== JSON.stringify(paymentMethods)) {
                setPaymentMethods(nextMethods);
            }
        }
        
        hasMigratedRef.current = true;
    }, [contributionKeywords, paymentMethods, userSuffix, setContributionKeywords, setPaymentMethods]);

    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);
    const isBatchUpdating = batchState.isBatchUpdating;

    // ✅ CONTROLE DE EXECUÇÃO (NOVO - mínimo necessário)
    const lastOwnerIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (realtimeRefreshKey && realtimeRefreshKey > 0) {
            lastOwnerIdRef.current = null;
        }
    }, [realtimeRefreshKey]);

    useEffect(() => {
        let ignore = false;

        if (!user?.id) {
            lastOwnerIdRef.current = null;
            return;
        }

        // ✅ evita múltiplas execuções desnecessárias
        if (lastOwnerIdRef.current === user.id) return;

        const syncData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const ownerId = subscription.ownerId || user.id;

                const response = await fetch(`/api/reference/data/${ownerId}?limit=50&offset=0`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (ignore) return;
                    
                    let filteredBanks = data.banks || [];
                    let filteredChurches = data.churches || [];
                    let fetchedReports = data.reports || [];
                    let fetchedAssociations = data.associations || [];
                    
                    const isOwner = subscription.ownerId === user?.id;
                    
                    if (!isOwner) {
                        const allowedBankIds = subscription.bankIds || [];
                        const allowedChurchIds = subscription.congregationIds || [];
                        
                        if (allowedBankIds.length > 0) {
                            filteredBanks = filteredBanks.filter((b: any) => allowedBankIds.includes(b.id));
                        }
                        if (allowedChurchIds.length > 0) {
                            filteredChurches = filteredChurches.filter((c: any) => allowedChurchIds.includes(c.id));
                        }
                    }
                    
                    if (!ignore) {
                        setBanks(filteredBanks);
                        setChurches(filteredChurches);
                        setReports(fetchedReports);
                        
                        // ✅ Consumindo associações consolidadas
                        setLearnedAssociations(fetchedAssociations.map((d: any) => ({
                            id: d.id, 
                            normalizedDescription: d.normalized_description,
                            contributorNormalizedName: d.contributor_normalized_name,
                            churchId: d.church_id, 
                            bankId: 'global',
                            user_id: d.user_id
                        })));
                    }
                }

            } catch (error) {
                if (!ignore) {
                    console.error("[useReferenceData] Erro ao buscar dados via API:", error);
                }
            }

            // ✅ marca como executado
            lastOwnerIdRef.current = user.id;
        };

        syncData();

        return () => { ignore = true; };

    // ✅ dependências corrigidas (cirúrgico)
    }, [user?.id, subscription?.role, subscription?.ownerId, realtimeRefreshKey]);

    // ✅ REAL-TIME SYNC PARA METADADOS (Bancos, Igrejas, Associações)
    useEffect(() => {
        const ownerId = subscription.ownerId || user?.owner_id || user?.id;
        if (!ownerId) return;

        const channel = supabase
            .channel(`reference-realtime-${ownerId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'banks', filter: `user_id=eq.${ownerId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setBanks(prev => {
                            if (prev.some(b => b.id === payload.new.id)) return prev;
                            return [...prev, payload.new as Bank];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setBanks(prev => prev.map(b => b.id === payload.new.id ? { ...b, ...payload.new } : b));
                    } else if (payload.eventType === 'DELETE') {
                        setBanks(prev => prev.filter(b => b.id !== payload.old.id));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'churches', filter: `user_id=eq.${ownerId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setChurches(prev => {
                            if (prev.some(c => c.id === payload.new.id)) return prev;
                            return [...prev, payload.new as Church];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setChurches(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
                    } else if (payload.eventType === 'DELETE') {
                        setChurches(prev => prev.filter(c => c.id !== payload.old.id));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'learned_associations', filter: `user_id=eq.${ownerId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const d = payload.new;
                        const newAssoc: LearnedAssociation = {
                            id: d.id,
                            normalizedDescription: d.normalized_description,
                            contributorNormalizedName: d.contributor_normalized_name,
                            churchId: d.church_id,
                            bankId: 'global',
                            user_id: d.user_id
                        };
                        setLearnedAssociations(prev => {
                            const filtered = prev.filter(la => la.id !== d.id && la.normalizedDescription !== d.normalized_description);
                            return [newAssoc, ...filtered];
                        });
                    } else if (payload.eventType === 'DELETE') {
                        setLearnedAssociations(prev => prev.filter(la => la.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, subscription.ownerId, setBanks, setChurches, setLearnedAssociations]);

    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        console.log('[IA-LEARN] Chamou função de aprendizado', {
            entrada: matchResult
        });

        if (!user || !matchResult.church) return;

        const contributorObj = matchResult.contributor;
        const contributorName = contributorObj?.cleanedName || contributorObj?.name || matchResult.transaction.cleanedDescription || matchResult.transaction.description;
        
        const normalizedDesc = strictNormalize(matchResult.transaction.description);
        
        if (isBatchUpdating) return;

        batchState.isAtomicUpdate = true;
        const newAssociation: LearnedAssociation = { 
            normalizedDescription: normalizedDesc, 
            contributorNormalizedName: contributorName, 
            churchId: matchResult.church.id, 
            bankId: 'global',
            user_id: effectiveUserId 
        };

        setLearnedAssociations(prev => {
            const filtered = prev.filter(la => la.normalizedDescription !== normalizedDesc);
            return [newAssociation, ...filtered];
        });

        console.log('[IA-LEARN] Salvando aprendizado', {
            dados: newAssociation
        });

        try {
            console.log(`[WRITE:FIX] Persistindo learned_association com effectiveUserId: ${effectiveUserId} no VPS`);
            await fetch('/api/v1/learned_associations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: effectiveUserId,
                    normalized_description: normalizedDesc,
                    contributor_normalized_name: contributorName,
                    church_id: matchResult.church.id
                })
            });
        } catch (err) {
            console.error("Erro ao persistir aprendizado no VPS:", err);
        }
    }, [user, effectiveUserId, isBatchUpdating]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);

    const updateBank = useCallback(async (bankId: string, name: string, accepted_contribution_types?: string[] | null) => {
        const account_name = name;
        setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name, account_name, accepted_contribution_types } : b));
        console.log(`[WRITE:UPDATE] Atualizando banco name, account_name e accepted_contribution_types (ID: ${bankId}) no VPS`);
        await fetch(`/api/v1/banks/${bankId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, account_name, accepted_contribution_types })
        });
        showToast('Banco atualizado.', 'success');
    }, [setBanks, showToast]);

    const addBank = useCallback(async (nameOrPayload: string | { name: string; bank_key?: string | null; account_name?: string | null; accepted_contribution_types?: string[] | null }, bank_key_legacy?: string | null): Promise<any> => {
        if(!user || !effectiveUserId) return false;
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }

        let name: string;
        let bank_key: string | null = null;
        let account_name: string | null = null;
        let accepted_contribution_types: string[] | null = null;

        if (typeof nameOrPayload === 'string') {
            name = nameOrPayload;
            bank_key = bank_key_legacy || null;
            account_name = name;
        } else {
            name = nameOrPayload.name;
            bank_key = nameOrPayload.bank_key || null;
            account_name = nameOrPayload.account_name ?? nameOrPayload.name;
            accepted_contribution_types = nameOrPayload.accepted_contribution_types || null;
        }

        const normalizedBankKey = bank_key || null;
        const normalizedAccountName = (account_name || name || '').trim().toLowerCase();

        const isDuplicate = banks.some(b => {
            const bKey = b.bank_key || null;
            const bAccName = (b.account_name || b.name || '').trim().toLowerCase();
            return bKey === normalizedBankKey && bAccName === normalizedAccountName;
        });

        if (isDuplicate) {
            console.error('[addBank] DUPLICATE_ACCOUNT_NAME');
            showToast('Já existe uma conta com esse nome neste banco', 'error');
            throw new Error('DUPLICATE_ACCOUNT_NAME');
        }

        console.log(`[WRITE:FIX] Adicionando banco com effectiveUserId: ${effectiveUserId} no VPS`);
        const res = await fetch('/api/v1/banks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                user_id: effectiveUserId,
                bank_key: bank_key ?? null,
                account_name: account_name ?? name,
                accepted_contribution_types
            })
        });

        if (res.ok) {
            const newBank = await res.json();
            setBanks(prev => [...prev, newBank]);
            showToast('Banco adicionado.', 'success');
            return newBank;
        }
        return false;
    }, [user, effectiveUserId, banks, subscription.maxBanks, setBanks, showToast]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
        closeEditChurch();
        console.log(`[WRITE:ALREADY_CORRECT] Atualizando igreja (ID: ${churchId}) no VPS`);
        await fetch(`/api/v1/churches/${churchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        showToast('Igreja atualizada.', 'success');
    }, [closeEditChurch, setChurches, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user || !effectiveUserId) return false;
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }
        console.log(`[WRITE:FIX] Adicionando igreja com effectiveUserId: ${effectiveUserId} no VPS`);
        const res = await fetch('/api/v1/churches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, user_id: effectiveUserId })
        });
        if (res.ok) {
            const newChurch = await res.json();
            setChurches(prev => [...prev, newChurch]);
            showToast('Igreja adicionada.', 'success');
            return true;
        }
        return false;
    }, [user, effectiveUserId, churches, subscription.maxChurches, setChurches, showToast]);

    const addContributionKeyword = useCallback((keyword: string) => {
        const upper = keyword.trim().toUpperCase();
        if (!contributionKeywords.includes(upper)) {
            setContributionKeywords(prev => [...prev, upper]);
            showToast(`Palavra "${upper}" adicionada.`, 'success');
        }
    }, [contributionKeywords, setContributionKeywords, showToast]);

    const removeContributionKeyword = useCallback((keyword: string) => {
        setContributionKeywords(prev => prev.filter(k => k !== keyword));
        showToast("Palavra removida.", "success");
    }, [setContributionKeywords, showToast]);

    const addPaymentMethod = useCallback((method: string) => {
        const upper = method.trim().toUpperCase();
        if (!paymentMethods.includes(upper)) {
            setPaymentMethods(prev => [...prev, upper]);
            showToast(`Forma "${upper}" adicionada.`, 'success');
        }
    }, [paymentMethods, setPaymentMethods, showToast]);

    const removePaymentMethod = useCallback((method: string) => {
        setPaymentMethods(prev => prev.filter(m => m !== method));
        showToast("Forma removida.", "success");
    }, [setPaymentMethods, showToast]);

    const addContributionType = useCallback(async (data: { name: string; type: 'entrada' | 'saida'; category?: string; bank_id?: string; order?: number; is_active?: boolean }) => {
        try {
            const res = await fetch('/api/v1/contribution-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, user_id: effectiveUserId })
            });
            if (res.ok) {
                const newType = await res.json();
                setContributionTypes(prev => [...prev, newType]);
                showToast(`Tipo "${newType.name}" cadastrado.`, 'success');
                return newType;
            } else {
                const errJson = await res.json().catch(() => ({}));
                showToast(errJson.message || 'Erro ao cadastrar tipo.', 'error');
                return false;
            }
        } catch (err: any) {
            console.error('Erro ao cadastrar tipo:', err);
            showToast('Erro ao comunicar com o servidor.', 'error');
            return false;
        }
    }, [effectiveUserId, showToast]);

    const updateContributionType = useCallback(async (id: string, data: { name: string; type: 'entrada' | 'saida'; category?: string; bank_id?: string; order?: number; is_active?: boolean }) => {
        try {
            const res = await fetch(`/api/v1/contribution-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updated = await res.json();
                setContributionTypes(prev => prev.map(item => item.id === id ? updated : item));
                showToast(`Tipo "${updated.name}" atualizado.`, 'success');
                return updated;
            } else {
                const errJson = await res.json().catch(() => ({}));
                showToast(errJson.message || 'Erro ao atualizar tipo.', 'error');
                return false;
            }
        } catch (err: any) {
            console.error('Erro ao atualizar tipo:', err);
            showToast('Erro ao comunicar com o servidor.', 'error');
            return false;
        }
    }, [showToast]);

    const removeContributionType = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/v1/contribution-types/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setContributionTypes(prev => prev.filter(item => item.id !== id));
                showToast('Tipo de contribuição removido.', 'success');
                return true;
            } else {
                showToast('Erro ao excluir tipo.', 'error');
                return false;
            }
        } catch (err) {
            console.error('Erro ao excluir tipo:', err);
            showToast('Erro ao comunicar com o servidor.', 'error');
            return false;
        }
    }, [showToast]);

    return useMemo(() => ({
        banks, churches, reports, similarityLevel, setSimilarityLevel, dayTolerance, setDayTolerance,
        contributionKeywords, addContributionKeyword, removeContributionKeyword,
        paymentMethods, addPaymentMethod, removePaymentMethod,
        contributionTypes, fetchContributionTypes, addContributionType, updateContributionType, removeContributionType,
        learnedAssociations, learnAssociation,
        editingBank, openEditBank, closeEditBank, updateBank, addBank,
        editingChurch, openEditChurch, closeEditChurch, updateChurch, addChurch,
        setBanks, setChurches, setLearnedAssociations
    }), [
        banks, churches, reports, similarityLevel, dayTolerance, 
        contributionKeywords, paymentMethods, contributionTypes, fetchContributionTypes, addContributionType, updateContributionType, removeContributionType, learnedAssociations, learnAssociation, 
        editingBank, editingChurch, setBanks, setChurches, setSimilarityLevel, 
        setDayTolerance, openEditBank, closeEditBank, updateBank, addBank, 
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        addContributionKeyword, removeContributionKeyword, addPaymentMethod, removePaymentMethod
    ]);
};