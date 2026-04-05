import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Bank, Church, ChurchFormData, LearnedAssociation, MatchResult, FileModel } from '../types';
import { usePersistentState } from './usePersistentState';
import { strictNormalize, DEFAULT_CONTRIBUTION_KEYWORDS } from '../services/utils/parsingUtils';
import { useAuth } from '../contexts/AuthContext';
import { modelService } from '../services/modelService';

const DEFAULT_PAYMENT_METHODS = ['PIX', 'TED', 'BOLETO', 'DINHEIRO', 'CARTÃO', 'CHEQUE', 'DEPÓSITO'];

export const useReferenceData = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    const { subscription, systemSettings } = useAuth();
    const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;
    const userSuffix = user ? `-${user.id}` : '-guest';

    const [banks, setBanks] = usePersistentState<Bank[]>(`identificapix-banks${userSuffix}`, []);
    const [churches, setChurches] = usePersistentState<Church[]>(`identificapix-churches${userSuffix}`, []);
    const [reports, setReports] = useState<any[]>([]);
    const [fileModels, setFileModels] = useState<FileModel[]>([]);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>(`identificapix-similarity${userSuffix}`, 55);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>(`identificapix-daytolerance${userSuffix}`, 2);
    
    const customIgnoreKeywords = useMemo(() => systemSettings?.ignoredKeywords || [], [systemSettings?.ignoredKeywords]);
    const [contributionKeywords, setContributionKeywords] = usePersistentState<string[]>(`identificapix-contrib-keywords${userSuffix}`, DEFAULT_CONTRIBUTION_KEYWORDS);
    const [paymentMethods, setPaymentMethods] = usePersistentState<string[]>(`identificapix-payment-methods${userSuffix}`, DEFAULT_PAYMENT_METHODS);

    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);

    // ✅ CONTROLE DE EXECUÇÃO (NOVO - mínimo necessário)
    const lastOwnerIdRef = useRef<string | null>(null);

    useEffect(() => {
        let ignore = false;

        if (!user?.id) {
            lastOwnerIdRef.current = null;
            return;
        }

        // ✅ evita múltiplas execuções desnecessárias
        if (lastOwnerIdRef.current === user.id) return;

        const syncData = async () => {
            const isOwner = subscription.ownerId === user?.id;

            if (isOwner) {
                let bankQuery = supabase.from('banks').select('*').eq('user_id', user.id);
                const { data: b } = await bankQuery;
                if (b && !ignore) setBanks(b);
                
                let query = supabase.from('churches').select('*').eq('user_id', user.id);
                const { data: c } = await query;
                if (c && !ignore) setChurches(c);

            } else {
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
                        let fetchedModels = data.models || [];
                        
                        const allowedBankIds = subscription.bankIds || [];
                        const allowedChurchIds = subscription.congregationIds || [];
                        
                        if (allowedBankIds.length > 0) {
                            filteredBanks = filteredBanks.filter((b: any) => allowedBankIds.includes(b.id));
                        }
                        if (allowedChurchIds.length > 0) {
                            filteredChurches = filteredChurches.filter((c: any) => allowedChurchIds.includes(c.id));
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

                            // ✅ Consumindo modelos consolidados
                            setFileModels(fetchedModels);
                        }
                    }

                } catch (error) {
                    if (!ignore) {
                        console.error("[useReferenceData] Erro ao buscar dados via API:", error);
                    }
                }
            }

            // ✅ marca como executado
            lastOwnerIdRef.current = user.id;
        };

        syncData();

        return () => { ignore = true; };

    // ✅ dependências corrigidas (cirúrgico)
    }, [user?.id, subscription?.role, subscription?.ownerId]);

    // ✅ Carregamento inicial de associações e modelos para OWNER (Membros já recebem via API consolidada)
    useEffect(() => {
        let ignore = false;
        if (!user || subscription.ownerId !== user.id) return;

        const fetchOwnerExtras = async () => {
            try {
                // Associações
                const { data: assocData } = await supabase.from('learned_associations').select('*').eq('user_id', user.id);
                if (assocData && !ignore) {
                    setLearnedAssociations(assocData.map((d: any) => ({
                        id: d.id, 
                        normalizedDescription: d.normalized_description,
                        contributorNormalizedName: d.contributor_normalized_name,
                        churchId: d.church_id, 
                        bankId: 'global',
                        user_id: d.user_id
                    })));
                }

                // Modelos
                const models = await modelService.getUserModels(user.id);
                if (models && !ignore) setFileModels(models);
            } catch (e) {
                console.error("[useReferenceData] Erro ao buscar extras do owner:", e);
            }
        };

        fetchOwnerExtras();
        return () => { ignore = true; };
    }, [user?.id, subscription?.ownerId]);

    const ownerId = subscription.ownerId || user?.owner_id || user?.id;

    // ✅ REAL-TIME SYNC PARA METADADOS (Bancos, Igrejas, Associações)
    useEffect(() => {
        if (!ownerId) return;

        console.log('[ID:REALTIME]', {
          effectiveUserId: ownerId,
          filter: `user_id=eq.${ownerId}`
        });

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
                        setBanks(prev => prev.filter(b => b.id === payload.old.id));
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
                        setChurches(prev => prev.filter(c => c.id === payload.old.id));
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
    }, [ownerId]);

    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        if (!user || !matchResult.church) return;

        const contributorObj = matchResult.contributor;
        const contributorName = contributorObj?.cleanedName || contributorObj?.name || matchResult.transaction.cleanedDescription || matchResult.transaction.description;
        
        const normalizedDesc = strictNormalize(matchResult.transaction.description);
        
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

        try {
            const { data: existing } = await supabase
                .from('learned_associations')
                .select('id')
                .eq('normalized_description', normalizedDesc)
                .eq('user_id', effectiveUserId)
                .maybeSingle() as { data: any | null };

            if (existing) {
                console.log(`[WRITE:FIX] Atualizando learned_association com effectiveUserId: ${effectiveUserId}`);
                await (supabase.from('learned_associations') as any).update({ 
                    contributor_normalized_name: contributorName, 
                    church_id: matchResult.church.id
                }).eq('id', existing.id);
            } else {
                console.log(`[WRITE:FIX] Inserindo learned_association com effectiveUserId: ${effectiveUserId}`);
                await (supabase.from('learned_associations') as any).insert({ 
                    user_id: effectiveUserId, 
                    normalized_description: normalizedDesc, 
                    contributor_normalized_name: contributorName, 
                    church_id: matchResult.church.id
                });
            }
        } catch (err) {
            console.error("Erro ao persistir aprendizado:", err);
        }
    }, [user]);

    const fetchModels = useCallback(async () => {
        if (!user) return;
        // Se for membro, os modelos já vêm via API consolidada no syncData
        if (subscription.ownerId !== user.id) return;
        
        try {
            const models = await modelService.getUserModels(user.id);
            setFileModels(models);
        } catch (e) { console.error(e); }
    }, [user, subscription.ownerId]);

    useEffect(() => { fetchModels(); }, [fetchModels]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);

    const updateBank = useCallback(async (bankId: string, name: string) => {
        setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name } : b));
        closeEditBank();
        console.log(`[WRITE:ALREADY_CORRECT] Atualizando banco (ID: ${bankId})`);
        await (supabase.from('banks') as any).update({ name }).eq('id', bankId);
        showToast('Banco atualizado.', 'success');
    }, [closeEditBank, setBanks, showToast]);

    const addBank = useCallback(async (name: string): Promise<boolean> => {
        if(!user || !effectiveUserId) return false;
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }
        console.log(`[WRITE:FIX] Adicionando banco com effectiveUserId: ${effectiveUserId}`);
        const { data } = await (supabase.from('banks') as any).insert([{ name, user_id: effectiveUserId }]).select();
        if (data) {
            setBanks(prev => [...prev, data[0]]);
            showToast('Banco adicionado.', 'success');
            return true;
        }
        return false;
    }, [user, effectiveUserId, banks, subscription.maxBanks, setBanks, showToast]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
        closeEditChurch();
        console.log(`[WRITE:ALREADY_CORRECT] Atualizando igreja (ID: ${churchId})`);
        await (supabase.from('churches') as any).update(formData).eq('id', churchId);
        showToast('Igreja atualizada.', 'success');
    }, [closeEditChurch, setChurches, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user || !effectiveUserId) return false;
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }
        console.log(`[WRITE:FIX] Adicionando igreja com effectiveUserId: ${effectiveUserId}`);
        const { data } = await (supabase.from('churches') as any).insert([{ ...formData, user_id: effectiveUserId }]).select();
        if (data) {
            setChurches(prev => [...prev, data[0]]);
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

    return useMemo(() => ({
        banks, churches, reports, fileModels, fetchModels, similarityLevel, setSimilarityLevel, dayTolerance, setDayTolerance,
        customIgnoreKeywords, contributionKeywords, addContributionKeyword, removeContributionKeyword,
        paymentMethods, addPaymentMethod, removePaymentMethod,
        learnedAssociations, learnAssociation,
        editingBank, openEditBank, closeEditBank, updateBank, addBank,
        editingChurch, openEditChurch, closeEditChurch, updateChurch, addChurch,
        setBanks, setChurches, setLearnedAssociations
    }), [
        banks, churches, reports, fileModels, fetchModels, similarityLevel, dayTolerance, 
        customIgnoreKeywords, contributionKeywords, paymentMethods, learnedAssociations, learnAssociation, 
        editingBank, editingChurch, setBanks, setChurches, setSimilarityLevel, 
        setDayTolerance, openEditBank, closeEditBank, updateBank, addBank, 
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        addContributionKeyword, removeContributionKeyword, addPaymentMethod, removePaymentMethod
    ]);
};