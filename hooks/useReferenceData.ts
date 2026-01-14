
import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Bank, Church, ChurchFormData, LearnedAssociation, MatchResult, FileModel } from '../types';
import { usePersistentState } from './usePersistentState';
import { Logger } from '../services/monitoringService';
import { User } from '@supabase/supabase-js';
import { normalizeString, DEFAULT_CONTRIBUTION_KEYWORDS } from '../services/processingService';
import { useAuth } from '../contexts/AuthContext';
import { modelService } from '../services/modelService';

const DEFAULT_IGNORE_KEYWORDS = [
    'DÍZIMOS', 'OFERTAS', 'MISSÕES', 'TERRENO - NOVA SEDE', 'PIX', 'TED', 'DOC',
    'Transferência', 'Pagamento', 'Recebimento', 'Depósito', 'Contribuição',
    'Sr', 'Sra', 'Dr', 'Dra', 'RECEB OUTRA IF'
];

export const useReferenceData = (user: User | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    const { subscription } = useAuth();
    const userSuffix = user ? `-${user.id}` : '-guest';

    // --- State ---
    const [banks, setBanks] = usePersistentState<Bank[]>(`identificapix-banks${userSuffix}`, []);
    const [churches, setChurches] = usePersistentState<Church[]>(`identificapix-churches${userSuffix}`, []);
    const [fileModels, setFileModels] = useState<FileModel[]>([]);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>(`identificapix-similarity${userSuffix}`, 55);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>(`identificapix-daytolerance${userSuffix}`, 2);
    
    // Keywords
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = usePersistentState<string[]>(`identificapix-ignore-keywords${userSuffix}`, DEFAULT_IGNORE_KEYWORDS);
    const [contributionKeywords, setContributionKeywords] = usePersistentState<string[]>(`identificapix-contribution-types${userSuffix}`, DEFAULT_CONTRIBUTION_KEYWORDS);
    
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

    // --- Sincronização de Dados (Recuperação do Banco) ---
    useEffect(() => {
        if (!user) return;

        const syncData = async () => {
            try {
                // Sincroniza Bancos
                const { data: banksData } = await supabase
                    .from('banks')
                    .select('*')
                    .eq('user_id', user.id);
                
                if (banksData) {
                    setBanks(prev => {
                        // Merge para evitar perder temporários, mas prioriza DB
                        const dbIds = new Set(banksData.map(b => b.id));
                        const localOnly = prev.filter(b => b.id.startsWith('temp-') || !dbIds.has(b.id));
                        // Se o DB retornou dados, usamos eles como fonte de verdade + locais temporários
                        return banksData.length > 0 ? [...banksData, ...localOnly.filter(l => l.id.startsWith('temp-'))] : prev;
                    });
                }

                // Sincroniza Igrejas
                const { data: churchesData } = await supabase
                    .from('churches')
                    .select('*')
                    .eq('user_id', user.id);

                if (churchesData) {
                    setChurches(prev => {
                        const dbIds = new Set(churchesData.map(c => c.id));
                        const localOnly = prev.filter(c => c.id.startsWith('temp-') || !dbIds.has(c.id));
                        return churchesData.length > 0 ? [...churchesData, ...localOnly.filter(l => l.id.startsWith('temp-'))] : prev;
                    });
                }
            } catch (e) {
                console.error("Erro ao sincronizar cadastros:", e);
            }
        };

        syncData();
    }, [user, setBanks, setChurches]);

    // --- Fetch Models ---
    const fetchModels = useCallback(async () => {
        if (!user) return;
        try {
            const models = await modelService.getUserModels(user.id);
            setFileModels(models);
        } catch (e) {
            console.error("Failed to fetch models", e);
        }
    }, [user]);

    useEffect(() => {
        fetchModels();
    }, [fetchModels]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);

    const updateBank = useCallback(async (bankId: string, name: string) => {
        if(!user) return;
        const oldBanks = [...banks];
        setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name } : b));
        closeEditBank();
        const { error } = await supabase.from('banks').update({ name }).eq('id', bankId);
        if (error) { setBanks(oldBanks); showToast('Erro ao atualizar banco.', 'error'); }
        else showToast('Banco atualizado com sucesso.', 'success');
    }, [user, banks, setBanks, closeEditBank, showToast]);

    const addBank = useCallback(async (name: string): Promise<boolean> => {
        if(!user) { showToast("Você precisa estar logado.", "error"); return false; }
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite atingido (${subscription.maxBanks}).`, 'error');
            return false;
        }
        const tempId = `temp-${Date.now()}`;
        setBanks(prev => [...prev, { id: tempId, name }]);
        try {
            const { data, error } = await supabase.from('banks').insert([{ name, user_id: user.id }]).select();
            if (error || !data) { setBanks(prev => prev.filter(b => b.id !== tempId)); return false; }
            setBanks(prev => prev.map(b => b.id === tempId ? { ...b, id: data[0].id } : b));
            showToast('Banco adicionado.', 'success');
            return true;
        } catch (e) { return false; }
    }, [user, setBanks, showToast, banks.length, subscription.maxBanks]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        if(!user) return;
        const oldChurches = [...churches];
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
        closeEditChurch();
        const { error } = await supabase.from('churches').update(formData).eq('id', churchId);
        if (error) { setChurches(oldChurches); showToast('Erro ao atualizar igreja.', 'error'); }
        else showToast('Igreja atualizada.', 'success');
    }, [user, churches, setChurches, closeEditChurch, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user) return false;
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite atingido (${subscription.maxChurches}).`, 'error');
            return false;
        }
        const tempId = `temp-${Date.now()}`;
        setChurches(prev => [...prev, { id: tempId, ...formData }]);
        try {
            const { data, error } = await supabase.from('churches').insert([{ ...formData, user_id: user.id }]).select();
            if (error || !data) { setChurches(prev => prev.filter(c => c.id !== tempId)); return false; }
            setChurches(prev => prev.map(c => c.id === tempId ? { ...c, id: data[0].id } : c));
            showToast('Igreja adicionada.', 'success');
            return true;
        } catch (e) { return false; }
    }, [user, setChurches, showToast, churches.length, subscription.maxChurches]);

    useEffect(() => {
        if (!user) return;
        const fetchAssociations = async () => {
            const { data } = await supabase.from('learned_associations').select('*').eq('user_id', user.id);
            if (data) {
                const mapped: LearnedAssociation[] = data.map(d => ({
                    id: d.id, normalizedDescription: d.normalized_description,
                    contributorNormalizedName: d.contributor_normalized_name,
                    churchId: d.church_id, user_id: d.user_id
                }));
                setLearnedAssociations(mapped);
            }
        };
        fetchAssociations();
    }, [user]);

    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        if (!user || !matchResult.contributor || !matchResult.church) return;
        const normalizedDesc = normalizeString(matchResult.transaction.description, customIgnoreKeywords);
        const normalizedContrib = matchResult.contributor.normalizedName || normalizeString(matchResult.contributor.name, customIgnoreKeywords);
        if (learnedAssociations.some(la => la.normalizedDescription === normalizedDesc && la.contributorNormalizedName === normalizedContrib && la.churchId === matchResult.church.id)) return;
        const newAssociation: LearnedAssociation = { normalizedDescription: normalizedDesc, contributorNormalizedName: normalizedContrib, churchId: matchResult.church.id, user_id: user.id };
        setLearnedAssociations(prev => [...prev, newAssociation]);
        try {
            await supabase.from('learned_associations').insert({ user_id: user.id, normalized_description: normalizedDesc, contributor_normalized_name: normalizedContrib, church_id: matchResult.church.id });
        } catch (err) { setLearnedAssociations(prev => prev.filter(la => la.normalizedDescription !== normalizedDesc)); }
    }, [user, customIgnoreKeywords, learnedAssociations]);

    return useMemo(() => ({
        banks, setBanks,
        churches, setChurches,
        fileModels, fetchModels,
        similarityLevel, setSimilarityLevel,
        dayTolerance, setDayTolerance,
        customIgnoreKeywords, setCustomIgnoreKeywords, addIgnoreKeyword, removeIgnoreKeyword,
        contributionKeywords, setContributionKeywords, addContributionKeyword, removeContributionKeyword,
        learnedAssociations, setLearnedAssociations, learnAssociation,
        editingBank, openEditBank, closeEditBank, updateBank, addBank,
        editingChurch, openEditChurch, closeEditChurch, updateChurch, addChurch
    }), [banks, churches, fileModels, fetchModels, similarityLevel, dayTolerance, customIgnoreKeywords, contributionKeywords, learnedAssociations, editingBank, editingChurch, setBanks, setChurches, setSimilarityLevel, setDayTolerance, setCustomIgnoreKeywords, setContributionKeywords, addIgnoreKeyword, removeIgnoreKeyword, addContributionKeyword, removeContributionKeyword, setLearnedAssociations, learnAssociation, openEditBank, closeEditBank, updateBank, addBank, openEditChurch, closeEditChurch, updateChurch, addChurch]);
};
