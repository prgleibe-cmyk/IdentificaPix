
import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Bank, Church, ChurchFormData, LearnedAssociation, MatchResult, FileModel } from '../types';
import { usePersistentState } from './usePersistentState';
import { strictNormalize, DEFAULT_CONTRIBUTION_KEYWORDS } from '../services/utils/parsingUtils';
import { useAuth } from '../contexts/AuthContext';
import { modelService } from '../services/modelService';

const DEFAULT_PAYMENT_METHODS = ['PIX', 'TED', 'BOLETO', 'DINHEIRO', 'CARTÃO', 'CHEQUE', 'DEPÓSITO'];

export const useReferenceData = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    const { subscription, systemSettings } = useAuth();
    const userSuffix = user ? `-${user.id}` : null;

    const [banks, setBanks, banksHydrated] = usePersistentState<Bank[]>(userSuffix ? `identificapix-banks${userSuffix}` : null, []);
    const [churches, setChurches, churchesHydrated] = usePersistentState<Church[]>(userSuffix ? `identificapix-churches${userSuffix}` : null, []);
    const [fileModels, setFileModels] = useState<FileModel[]>([]);
    const [similarityLevel, setSimilarityLevel, similarityLevelHydrated] = usePersistentState<number>(userSuffix ? `identificapix-similarity${userSuffix}` : null, 55);
    const [dayTolerance, setDayTolerance, dayToleranceHydrated] = usePersistentState<number>(userSuffix ? `identificapix-daytolerance${userSuffix}` : null, 2);
    
    const customIgnoreKeywords = useMemo(() => systemSettings?.ignoredKeywords || [], [systemSettings?.ignoredKeywords]);
    const [contributionKeywords, setContributionKeywords, contributionKeywordsHydrated] = usePersistentState<string[]>(userSuffix ? `identificapix-contrib-keywords${userSuffix}` : null, DEFAULT_CONTRIBUTION_KEYWORDS);
    const [paymentMethods, setPaymentMethods, paymentMethodsHydrated] = usePersistentState<string[]>(userSuffix ? `identificapix-payment-methods${userSuffix}` : null, DEFAULT_PAYMENT_METHODS);

    const isHydrated = banksHydrated && churchesHydrated && similarityLevelHydrated && dayToleranceHydrated && contributionKeywordsHydrated && paymentMethodsHydrated;

    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);

    useEffect(() => {
        if (!user) return;
        const syncData = async () => {
            const ownerId = subscription.ownerId || user.id;
            
            // Se for o dono, pode usar o Supabase diretamente (RLS permite)
            // Se for membro/admin, usamos a API backend que tem privilégios de Service Role
            if (subscription.role === 'owner') {
                let bankQuery = supabase.from('banks').select('*').eq('user_id', ownerId);
                const { data: b } = await bankQuery;
                if (b) setBanks(b);
                
                let query = supabase.from('churches').select('*').eq('user_id', ownerId);
                const { data: c } = await query;
                if (c) setChurches(c);
            } else {
                // Para usuários secundários, usamos a API backend para contornar limitações de RLS
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    const response = await fetch(`/api/reference/data/${ownerId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Aplicar filtros de permissão no frontend para garantir
                        let filteredBanks = data.banks || [];
                        let filteredChurches = data.churches || [];
                        
                        if (subscription.role !== 'owner') {
                            const allowedBankIds = subscription.bankIds || [];
                            const allowedChurchIds = subscription.congregationIds || [];
                            
                            filteredBanks = filteredBanks.filter((b: any) => allowedBankIds.includes(b.id));
                            filteredChurches = filteredChurches.filter((c: any) => allowedChurchIds.includes(c.id));
                        }
                        
                        setBanks(filteredBanks);
                        setChurches(filteredChurches);
                    }
                } catch (error) {
                    console.error("[useReferenceData] Erro ao buscar dados via API:", error);
                }
            }
        };
        syncData();
    }, [user, subscription, setBanks, setChurches]);

    useEffect(() => {
        if (!user) return;
        const fetchAssociations = async () => {
            const ownerId = subscription.ownerId || user.id;
            const { data } = await supabase.from('learned_associations').select('*').eq('user_id', ownerId) as { data: any[] | null };
            if (data) {
                setLearnedAssociations(data.map((d: any) => ({
                    id: d.id, 
                    normalizedDescription: d.normalized_description,
                    contributorNormalizedName: d.contributor_normalized_name,
                    churchId: d.church_id, 
                    bankId: 'global', // Removido bank_id para evitar erro 400
                    user_id: d.user_id
                })));
            }
        };
        fetchAssociations();
    }, [user]);

    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        if (!user || !matchResult.church) return;

        const contributorObj = matchResult.contributor;
        const contributorName = contributorObj?.cleanedName || contributorObj?.name || matchResult.transaction.cleanedDescription || matchResult.transaction.description;
        
        const normalizedDesc = strictNormalize(matchResult.transaction.description);
        
        const ownerId = subscription.ownerId || user.id;
        const newAssociation: LearnedAssociation = { 
            normalizedDescription: normalizedDesc, 
            contributorNormalizedName: contributorName, 
            churchId: matchResult.church.id, 
            bankId: 'global',
            user_id: ownerId 
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
                .eq('user_id', ownerId)
                .maybeSingle() as { data: any | null };

            if (existing) {
                await (supabase.from('learned_associations') as any).update({ 
                    contributor_normalized_name: contributorName, 
                    church_id: matchResult.church.id
                }).eq('id', existing.id);
            } else {
                await (supabase.from('learned_associations') as any).insert({ 
                    user_id: ownerId, 
                    normalized_description: normalizedDesc, 
                    contributor_normalized_name: contributorName, 
                    church_id: matchResult.church.id
                });
            }
        } catch (err) {
            console.error("Erro ao persistir aprendizado:", err);
        }
    }, [user, subscription.ownerId]);

    const fetchModels = useCallback(async () => {
        if (!user) return;
        const ownerId = subscription.ownerId || user.id;
        try {
            const models = await modelService.getUserModels(ownerId);
            setFileModels(models);
        } catch (e) { console.error(e); }
    }, [user, subscription.ownerId]);

    useEffect(() => { fetchModels(); }, [fetchModels]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);

    const updateBank = useCallback(async (bankId: string, name: string) => {
        setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name } : b));
        closeEditBank();
        await (supabase.from('banks') as any).update({ name }).eq('id', bankId);
        showToast('Banco atualizado.', 'success');
    }, [closeEditBank, setBanks, showToast]);

    const addBank = useCallback(async (name: string): Promise<boolean> => {
        if(!user) return false;
        const ownerId = subscription.ownerId || user.id;
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }
        const { data } = await (supabase.from('banks') as any).insert([{ name, user_id: ownerId }]).select();
        if (data) {
            setBanks(prev => [...prev, data[0]]);
            showToast('Banco adicionado.', 'success');
            return true;
        }
        return false;
    }, [user, banks, subscription.maxBanks, subscription.ownerId, setBanks, showToast]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
        closeEditChurch();
        await (supabase.from('churches') as any).update(formData).eq('id', churchId);
        showToast('Igreja atualizada.', 'success');
    }, [closeEditChurch, setChurches, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user) return false;
        const ownerId = subscription.ownerId || user.id;
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }
        const { data } = await (supabase.from('churches') as any).insert([{ ...formData, user_id: ownerId }]).select();
        if (data) {
            setChurches(prev => [...prev, data[0]]);
            showToast('Igreja adicionada.', 'success');
            return true;
        }
        return false;
    }, [user, churches, subscription.maxChurches, subscription.ownerId, setChurches, showToast]);

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
        banks, churches, fileModels, fetchModels, similarityLevel, setSimilarityLevel, dayTolerance, setDayTolerance,
        customIgnoreKeywords, contributionKeywords, addContributionKeyword, removeContributionKeyword,
        paymentMethods, addPaymentMethod, removePaymentMethod,
        learnedAssociations, learnAssociation,
        editingBank, openEditBank, closeEditBank, updateBank, addBank,
        editingChurch, openEditChurch, closeEditChurch, updateChurch, addChurch,
        setBanks, setChurches, setLearnedAssociations,
        isHydrated
    }), [
        banks, churches, fileModels, fetchModels, similarityLevel, dayTolerance, 
        customIgnoreKeywords, contributionKeywords, paymentMethods, learnedAssociations, learnAssociation, 
        editingBank, editingChurch, setBanks, setChurches, setSimilarityLevel, 
        setDayTolerance, openEditBank, closeEditBank, updateBank, addBank, 
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        addContributionKeyword, removeContributionKeyword, addPaymentMethod, removePaymentMethod,
        isHydrated
    ]);
};
