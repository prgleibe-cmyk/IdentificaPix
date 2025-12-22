
import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Bank, Church, ChurchFormData, LearnedAssociation, MatchResult } from '../types';
import { usePersistentState } from './usePersistentState';
import { Logger } from '../services/monitoringService';
import { User } from '@supabase/supabase-js';
import { normalizeString } from '../services/processingService';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_IGNORE_KEYWORDS = [
    'DÍZIMOS', 'OFERTAS', 'MISSÕES', 'TERRENO - NOVA SEDE', 'PIX', 'TED', 'DOC',
    'Transferência', 'Pagamento', 'Recebimento', 'Depósito', 'Contribuição',
    'Sr', 'Sra', 'Dr', 'Dra'
];

export const useReferenceData = (user: User | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    // Access subscription directly from AuthContext
    const { subscription } = useAuth();

    // --- User Scoping for Local Storage ---
    const userSuffix = user ? `-${user.id}` : '-guest';

    // --- State ---
    const [banks, setBanks] = usePersistentState<Bank[]>(`identificapix-banks${userSuffix}`, []);
    const [churches, setChurches] = usePersistentState<Church[]>(`identificapix-churches${userSuffix}`, []);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>(`identificapix-similarity${userSuffix}`, 55);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>(`identificapix-daytolerance${userSuffix}`, 2);
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = usePersistentState<string[]>(`identificapix-ignore-keywords${userSuffix}`, DEFAULT_IGNORE_KEYWORDS);
    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    
    // UI State for Editing
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);

    // --- Actions: Keywords ---
    const addIgnoreKeyword = useCallback((k: string) => setCustomIgnoreKeywords(prev => [...prev, k]), [setCustomIgnoreKeywords]);
    const removeIgnoreKeyword = useCallback((k: string) => setCustomIgnoreKeywords(prev => prev.filter(i => i !== k)), [setCustomIgnoreKeywords]);

    // --- Actions: Banks ---
    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);

    const updateBank = useCallback(async (bankId: string, name: string) => {
        if(!user) return;
        const oldBanks = [...banks];
        setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name } : b));
        closeEditBank();

        const { error } = await supabase.from('banks').update({ name }).eq('id', bankId);
        if (error) {
            setBanks(oldBanks); 
            showToast('Erro ao atualizar banco.', 'error');
        } else {
            showToast('Banco atualizado com sucesso.', 'success');
        }
    }, [user, banks, setBanks, closeEditBank, showToast]);

    const addBank = useCallback(async (name: string): Promise<boolean> => {
        if(!user) {
            showToast("Você precisa estar logado para adicionar um banco.", "error");
            return false;
        }

        // Limit Enforcement
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite de bancos atingido (${subscription.maxBanks}). Faça upgrade do plano.`, 'error');
            return false;
        }
        
        const tempId = `temp-${Date.now()}`;
        const newBank: Bank = { id: tempId, name };
        setBanks(prev => [...prev, newBank]);

        try {
            const { data, error } = await supabase.from('banks').insert([{ name, user_id: user.id }]).select();
            
            if (error || !data || data.length === 0) {
                Logger.error('Error adding bank', error);
                setBanks(prev => prev.filter(b => b.id !== tempId)); 
                showToast(`Erro ao adicionar banco: ${error?.message || 'Erro de conexão'}`, 'error');
                return false;
            } else {
                setBanks(prev => prev.map(b => b.id === tempId ? { ...b, id: data[0].id } : b));
                showToast('Banco adicionado com sucesso.', 'success');
                return true;
            }
        } catch (e: any) {
            Logger.error('Exception adding bank', e);
            setBanks(prev => prev.filter(b => b.id !== tempId));
            showToast(`Erro de exceção: ${e.message}`, 'error');
            return false;
        }
    }, [user, setBanks, showToast, banks.length, subscription.maxBanks]);

    // --- Actions: Churches ---
    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        if(!user) return;
        const oldChurches = [...churches];
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
        closeEditChurch();

        const { error } = await supabase.from('churches').update(formData).eq('id', churchId);
        if (error) {
            setChurches(oldChurches);
            showToast('Erro ao atualizar igreja.', 'error');
        } else {
            showToast('Igreja atualizada com sucesso.', 'success');
        }
    }, [user, churches, setChurches, closeEditChurch, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user) {
            showToast("Você precisa estar logado para adicionar uma igreja.", "error");
            return false;
        }

        // Limit Enforcement
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite de igrejas atingido (${subscription.maxChurches}). Faça upgrade do plano.`, 'error');
            return false;
        }

        const payloadSize = new Blob([JSON.stringify(formData)]).size;
        if (payloadSize > 5 * 1024 * 1024) { 
             showToast("A imagem do logo é muito grande. Por favor, use uma imagem menor.", "error");
             return false;
        }

        const tempId = `temp-${Date.now()}`;
        const newChurch: Church = { id: tempId, ...formData };
        setChurches(prev => [...prev, newChurch]);

        try {
            const { data, error } = await supabase.from('churches').insert([{ ...formData, user_id: user.id }]).select();

            if (error || !data || data.length === 0) {
                Logger.error('Error adding church', error);
                setChurches(prev => prev.filter(c => c.id !== tempId));
                showToast(`Erro ao adicionar igreja: ${error?.message || 'Erro de conexão'}`, 'error');
                return false;
            } else {
                setChurches(prev => prev.map(c => c.id === tempId ? { ...c, id: data[0].id } : c));
                showToast('Igreja adicionada com sucesso.', 'success');
                return true;
            }
        } catch (e: any) {
            Logger.error('Exception adding church', e);
            setChurches(prev => prev.filter(c => c.id !== tempId));
            showToast(`Erro de exceção: ${e.message}`, 'error');
            return false;
        }
    }, [user, setChurches, showToast, churches.length, subscription.maxChurches]);

    useEffect(() => {
        if (!user) return;
        const fetchAssociations = async () => {
            const { data } = await supabase.from('learned_associations').select('*').eq('user_id', user.id);
            if (data) {
                const mapped: LearnedAssociation[] = data.map(d => ({
                    id: d.id,
                    normalizedDescription: d.normalized_description,
                    contributorNormalizedName: d.contributor_normalized_name,
                    churchId: d.church_id,
                    user_id: d.user_id
                }));
                setLearnedAssociations(mapped);
            }
        };
        fetchAssociations();
    }, [user, setLearnedAssociations]);

    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        if (!user) return;
        if (!matchResult.contributor || !matchResult.church) return;

        const normalizedDesc = normalizeString(matchResult.transaction.description, customIgnoreKeywords);
        const normalizedContrib = matchResult.contributor.normalizedName || normalizeString(matchResult.contributor.name, customIgnoreKeywords);

        const exists = learnedAssociations.some(la => 
            la.normalizedDescription === normalizedDesc && 
            la.contributorNormalizedName === normalizedContrib &&
            la.churchId === matchResult.church.id
        );

        if (exists) return;

        const newAssociation: LearnedAssociation = {
            normalizedDescription: normalizedDesc,
            contributorNormalizedName: normalizedContrib,
            churchId: matchResult.church.id,
            user_id: user.id
        };

        setLearnedAssociations(prev => [...prev, newAssociation]);

        try {
            await supabase.from('learned_associations').insert({
                user_id: user.id,
                normalized_description: normalizedDesc,
                contributor_normalized_name: normalizedContrib,
                church_id: matchResult.church.id
            });
        } catch (err) {
            Logger.error('Failed to save association', err);
            setLearnedAssociations(prev => prev.filter(la => la.normalizedDescription !== normalizedDesc));
        }
    }, [user, customIgnoreKeywords, learnedAssociations, setLearnedAssociations]);

    return useMemo(() => ({
        banks, setBanks,
        churches, setChurches,
        similarityLevel, setSimilarityLevel,
        dayTolerance, setDayTolerance,
        customIgnoreKeywords, setCustomIgnoreKeywords, addIgnoreKeyword, removeIgnoreKeyword,
        learnedAssociations, setLearnedAssociations, learnAssociation,
        
        editingBank, openEditBank, closeEditBank, updateBank, addBank,
        editingChurch, openEditChurch, closeEditChurch, updateChurch, addChurch
    }), [
        banks, churches, similarityLevel, dayTolerance, customIgnoreKeywords, learnedAssociations, 
        editingBank, editingChurch,
        setBanks, setChurches, setSimilarityLevel, setDayTolerance, setCustomIgnoreKeywords, 
        addIgnoreKeyword, removeIgnoreKeyword, setLearnedAssociations, learnAssociation,
        openEditBank, closeEditBank, updateBank, addBank,
        openEditChurch, closeEditChurch, updateChurch, addChurch
    ]);
};
