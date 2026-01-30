
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
    const userSuffix = user ? `-${user.id}` : '-guest';

    const [banks, setBanks] = usePersistentState<Bank[]>(`identificapix-banks${userSuffix}`, []);
    const [churches, setChurches] = usePersistentState<Church[]>(`identificapix-churches${userSuffix}`, []);
    const [fileModels, setFileModels] = useState<FileModel[]>([]);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>(`identificapix-similarity${userSuffix}`, 55);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>(`identificapix-daytolerance${userSuffix}`, 2);
    
    const customIgnoreKeywords = useMemo(() => systemSettings?.ignoredKeywords || [], [systemSettings?.ignoredKeywords]);
    const [contributionKeywords, setContributionKeywords] = usePersistentState<string[]>(`identificapix-contrib-keywords${userSuffix}`, DEFAULT_CONTRIBUTION_KEYWORDS);
    const [paymentMethods, setPaymentMethods] = usePersistentState<string[]>(`identificapix-payment-methods${userSuffix}`, DEFAULT_PAYMENT_METHODS);

    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);

    useEffect(() => {
        if (!user) return;
        const syncData = async () => {
            const { data: b } = await supabase.from('banks').select('*').eq('user_id', user.id);
            if (b) setBanks(b);
            const { data: c } = await supabase.from('churches').select('*').eq('user_id', user.id);
            if (c) setChurches(c);
        };
        syncData();
    }, [user, setBanks, setChurches]);

    useEffect(() => {
        if (!user) return;
        const fetchAssociations = async () => {
            const { data } = await supabase.from('learned_associations').select('*').eq('user_id', user.id);
            if (data) {
                setLearnedAssociations(data.map(d => ({
                    id: d.id, 
                    normalizedDescription: d.normalized_description,
                    contributorNormalizedName: d.contributor_normalized_name,
                    churchId: d.church_id, 
                    bankId: d.bank_id || 'global',
                    user_id: d.user_id
                })));
            }
        };
        fetchAssociations();
    }, [user]);

    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        if (!user || !matchResult.church) return;

        // Se o contribuinte for nulo, usamos a descrição como nome
        const contributorObj = matchResult.contributor;
        const contributorName = contributorObj?.cleanedName || contributorObj?.name || matchResult.transaction.cleanedDescription || matchResult.transaction.description;
        
        const normalizedDesc = strictNormalize(matchResult.transaction.description);
        const bankId = matchResult.transaction.bank_id || 'global';
        
        const newAssociation: LearnedAssociation = { 
            normalizedDescription: normalizedDesc, 
            contributorNormalizedName: contributorName, 
            churchId: matchResult.church.id, 
            bankId: bankId,
            user_id: user.id 
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
                .eq('user_id', user.id)
                .maybeSingle();

            if (existing) {
                await supabase.from('learned_associations').update({ 
                    contributor_normalized_name: contributorName, 
                    church_id: matchResult.church.id,
                    bank_id: bankId 
                }).eq('id', existing.id);
            } else {
                await supabase.from('learned_associations').insert({ 
                    user_id: user.id, 
                    normalized_description: normalizedDesc, 
                    contributor_normalized_name: contributorName, 
                    church_id: matchResult.church.id,
                    bank_id: bankId
                });
            }
        } catch (err) {
            console.error("Erro ao persistir aprendizado:", err);
        }
    }, [user]);

    const fetchModels = useCallback(async () => {
        if (!user) return;
        try {
            const models = await modelService.getUserModels(user.id);
            setFileModels(models);
        } catch (e) { console.error(e); }
    }, [user]);

    useEffect(() => { fetchModels(); }, [fetchModels]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);

    const updateBank = useCallback(async (bankId: string, name: string) => {
        setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name } : b));
        closeEditBank();
        await supabase.from('banks').update({ name }).eq('id', bankId);
        showToast('Banco atualizado.', 'success');
    }, [closeEditBank, setBanks, showToast]);

    const addBank = useCallback(async (name: string): Promise<boolean> => {
        if(!user) return false;
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }
        const { data } = await supabase.from('banks').insert([{ name, user_id: user.id }]).select();
        if (data) {
            setBanks(prev => [...prev, data[0]]);
            showToast('Banco adicionado.', 'success');
            return true;
        }
        return false;
    }, [user, banks, subscription.maxBanks, setBanks, showToast]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
        closeEditChurch();
        await supabase.from('churches').update(formData).eq('id', churchId);
        showToast('Igreja atualizada.', 'success');
    }, [closeEditChurch, setChurches, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user) return false;
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }
        const { data } = await supabase.from('churches').insert([{ ...formData, user_id: user.id }]).select();
        if (data) {
            setChurches(prev => [...prev, data[0]]);
            showToast('Igreja adicionada.', 'success');
            return true;
        }
        return false;
    }, [user, churches, subscription.maxChurches, setChurches, showToast]);

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
        setBanks, setChurches, setLearnedAssociations
    }), [
        banks, churches, fileModels, fetchModels, similarityLevel, dayTolerance, 
        customIgnoreKeywords, contributionKeywords, paymentMethods, learnedAssociations, learnAssociation, 
        editingBank, editingChurch, setBanks, setChurches, setSimilarityLevel, 
        setDayTolerance, openEditBank, closeEditBank, updateBank, addBank, 
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        addContributionKeyword, removeContributionKeyword, addPaymentMethod, removePaymentMethod
    ]);
};
