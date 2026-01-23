import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Bank, Church, ChurchFormData, LearnedAssociation, MatchResult, FileModel } from '../types';
import { usePersistentState } from './usePersistentState';
import { Logger } from '../services/monitoringService';
import { normalizeString, DEFAULT_CONTRIBUTION_KEYWORDS } from '../services/processingService';
import { useAuth } from '../contexts/AuthContext';
import { modelService } from '../services/modelService';

const DEFAULT_IGNORE_KEYWORDS = [
    'DÍZIMOS', 'OFERTAS', 'MISSÕES', 'TERRENO - NOVA SEDE', 'PIX', 'TED', 'DOC',
    'Transferência', 'Pagamento', 'Recebimento', 'Depósito', 'Contribuição',
    'Sr', 'Sra', 'Dr', 'Dra', 'RECEB OUTRA IF'
];

const DEFAULT_PAYMENT_METHODS = [
    'PIX', 'CARTÃO', 'DINHEIRO', 'TRANSFERÊNCIA', 'BOLETO', 'CHEQUE'
];

export const useReferenceData = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    const { subscription } = useAuth();
    const userSuffix = user ? `-${user.id}` : '-guest';

    // --- State ---
    const [banks, setBanks] = usePersistentState<Bank[]>(`identificapix-banks${userSuffix}`, []);
    const [churches, setChurches] = usePersistentState<Church[]>(`identificapix-churches${userSuffix}`, []);
    const [fileModels, setFileModels] = useState<FileModel[]>([]);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>(`identificapix-similarity${userSuffix}`, 55);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>(`identificapix-daytolerance${userSuffix}`, 2);
    
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = usePersistentState<string[]>(`identificapix-ignore-keywords${userSuffix}`, DEFAULT_IGNORE_KEYWORDS);
    const [contributionKeywords, setContributionKeywords] = usePersistentState<string[]>(`identificapix-contribution-types${userSuffix}`, DEFAULT_CONTRIBUTION_KEYWORDS);
    const [paymentMethods, setPaymentMethods] = usePersistentState<string[]>(`identificapix-payment-methods${userSuffix}`, DEFAULT_PAYMENT_METHODS);
    
    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);

    // --- Methods for Keywords ---
    const addIgnoreKeyword = useCallback((k: string) => {
        if (!k.trim()) return;
        setCustomIgnoreKeywords(prev => prev.includes(k.trim()) ? prev : [...prev, k.trim()]);
    }, [setCustomIgnoreKeywords]);

    const removeIgnoreKeyword = useCallback((k: string) => setCustomIgnoreKeywords(prev => prev.filter(i => i !== k)), [setCustomIgnoreKeywords]);

    const addContributionKeyword = useCallback((k: string) => {
        if (!k.trim()) return;
        setContributionKeywords(prev => {
            const normalized = k.toUpperCase().trim();
            return prev.includes(normalized) ? prev : [...prev, normalized];
        });
    }, [setContributionKeywords]);

    const removeContributionKeyword = useCallback((k: string) => setContributionKeywords(prev => prev.filter(i => i !== k)), [setContributionKeywords]);

    const addPaymentMethod = useCallback((k: string) => {
        if (!k.trim()) return;
        setPaymentMethods(prev => {
            const normalized = k.toUpperCase().trim();
            return prev.includes(normalized) ? prev : [...prev, normalized];
        });
    }, [setPaymentMethods]);

    const removePaymentMethod = useCallback((k: string) => setPaymentMethods(prev => prev.filter(i => i !== k)), [setPaymentMethods]);

    // --- Sincronização de Dados ---
    useEffect(() => {
        if (!user) return;

        const syncData = async () => {
            try {
                const { data: banksData } = await supabase.from('banks').select('*').eq('user_id', user.id);
                if (banksData) setBanks(prev => banksData.length > 0 ? banksData : prev);

                const { data: churchesData } = await supabase.from('churches').select('*').eq('user_id', user.id);
                if (churchesData) setChurches(prev => churchesData.length > 0 ? churchesData : prev);
            } catch (e) {
                console.error("Erro ao sincronizar cadastros:", e);
            }
        };

        syncData();
    }, [user, setBanks, setChurches]);

    const fetchModels = useCallback(async () => {
        if (!user) return;
        // OBRIGATÓRIO: Log de auditoria de recarga segura
        console.log("[ModelRegistry] Refresh executado antes do processamento.");
        try {
            const models = await modelService.getUserModels(user.id);
            setFileModels(models);
        } catch (e) { 
            console.error("[ModelRegistry] Erro ao recarregar modelos:", e); 
        }
    }, [user]);

    useEffect(() => { fetchModels(); }, [fetchModels]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);

    const updateBank = useCallback(async (bankId: string, name: string) => {
        if(!user) return;
        setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name } : b));
        closeEditBank();
        await supabase.from('banks').update({ name }).eq('id', bankId);
        showToast('Banco atualizado.', 'success');
    }, [user, banks, setBanks, closeEditBank, showToast]);

    const addBank = useCallback(async (name: string): Promise<boolean> => {
        if(!user) return false;
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite atingido (${subscription.maxBanks}).`, 'error');
            return false;
        }
        const { data, error } = await supabase.from('banks').insert([{ name, user_id: user.id }]).select();
        if (data) {
            setBanks(prev => [...prev, data[0]]);
            showToast('Banco adicionado.', 'success');
            return true;
        }
        return false;
    }, [user, setBanks, showToast, banks.length, subscription.maxBanks]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        if(!user) return;
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
        closeEditChurch();
        await supabase.from('churches').update(formData).eq('id', churchId);
        showToast('Igreja atualizada.', 'success');
    }, [user, churches, setChurches, closeEditChurch, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user) return false;
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite atingido (${subscription.maxChurches}).`, 'error');
            return false;
        }
        const { data } = await supabase.from('churches').insert([{ ...formData, user_id: user.id }]).select();
        if (data) {
            setChurches(prev => [...prev, data[0]]);
            showToast('Igreja adicionada.', 'success');
            return true;
        }
        return false;
    }, [user, setChurches, showToast, churches.length, subscription.maxChurches]);

    // --- LÓGICA DE APRENDIZADO REFINADA ---
    useEffect(() => {
        if (!user) return;
        const fetchAssociations = async () => {
            const { data } = await supabase.from('learned_associations').select('*').eq('user_id', user.id);
            if (data) {
                setLearnedAssociations(data.map(d => ({
                    id: d.id, normalizedDescription: d.normalized_description,
                    contributorNormalizedName: d.contributor_normalized_name,
                    churchId: d.church_id, user_id: d.user_id
                })));
            }
        };
        fetchAssociations();
    }, [user]);

    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        if (!user || !matchResult.contributor || !matchResult.church) return;

        const normalizedDesc = normalizeString(matchResult.transaction.description, customIgnoreKeywords);
        const normalizedContrib = matchResult.contributor.normalizedName || normalizeString(matchResult.contributor.name, customIgnoreKeywords);
        
        const existingIdx = learnedAssociations.findIndex(la => la.normalizedDescription === normalizedDesc);
        const existing = existingIdx !== -1 ? learnedAssociations[existingIdx] : null;

        if (existing && existing.contributorNormalizedName === normalizedContrib && existing.churchId === matchResult.church.id) {
            return;
        }

        const newAssociation: LearnedAssociation = { 
            normalizedDescription: normalizedDesc, 
            contributorNormalizedName: normalizedContrib, 
            churchId: matchResult.church.id, 
            user_id: user.id 
        };

        try {
            if (existing) {
                setLearnedAssociations(prev => {
                    const next = [...prev];
                    next[existingIdx] = newAssociation;
                    return next;
                });

                await supabase.from('learned_associations')
                    .update({ 
                        contributor_normalized_name: normalizedContrib, 
                        church_id: matchResult.church.id 
                    })
                    .eq('normalized_description', normalizedDesc)
                    .eq('user_id', user.id);
            } else {
                setLearnedAssociations(prev => [...prev, newAssociation]);
                await supabase.from('learned_associations').insert({ 
                    user_id: user.id, 
                    normalized_description: normalizedDesc, 
                    contributor_normalized_name: normalizedContrib, 
                    church_id: matchResult.church.id 
                });
            }
        } catch (err) {
            console.error("Erro ao persistir aprendizado da IA:", err);
        }
    }, [user, customIgnoreKeywords, learnedAssociations]);

    return useMemo(() => ({
        banks, setBanks, churches, setChurches, fileModels, fetchModels, similarityLevel, setSimilarityLevel, dayTolerance, setDayTolerance,
        customIgnoreKeywords, setCustomIgnoreKeywords, addIgnoreKeyword, removeIgnoreKeyword,
        contributionKeywords, setContributionKeywords, addContributionKeyword, removeContributionKeyword,
        paymentMethods, setPaymentMethods, addPaymentMethod, removePaymentMethod,
        learnedAssociations, setLearnedAssociations, learnAssociation,
        editingBank, openEditBank, closeEditBank, updateBank, addBank,
        editingChurch, openEditChurch, closeEditChurch, updateChurch, addChurch
    }), [banks, churches, fileModels, fetchModels, similarityLevel, dayTolerance, customIgnoreKeywords, contributionKeywords, paymentMethods, learnedAssociations, editingBank, editingChurch, setBanks, setChurches, setSimilarityLevel, setDayTolerance, setCustomIgnoreKeywords, setContributionKeywords, setPaymentMethods, addIgnoreKeyword, removeIgnoreKeyword, addContributionKeyword, removeContributionKeyword, addPaymentMethod, removePaymentMethod, setLearnedAssociations, learnAssociation, openEditBank, closeEditBank, updateBank, addBank, openEditChurch, closeEditChurch, updateChurch, addChurch]);
};