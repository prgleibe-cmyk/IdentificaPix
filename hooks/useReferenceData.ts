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

    // ✅ CONTROLE DE EXECUÇÃO (NOVO - mínimo necessário)
    const lastOwnerIdRef = useRef<string | null>(null);

    useEffect(() => {
        let ignore = false;

        if (!user?.id) {
            lastOwnerIdRef.current = null;
            return;
        }

        const ownerId = subscription.ownerId || user.id;

        // ✅ evita múltiplas execuções desnecessárias
        if (lastOwnerIdRef.current === ownerId) return;

        const syncData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) {
                    console.warn("[useReferenceData] Token não encontrado para busca de dados.");
                    return;
                }

                console.log(`[useReferenceData] Buscando dados de referência via API segura para owner: ${ownerId}`);
                const response = await fetch(`/api/reference/data/${ownerId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (ignore) return;
                    
                    let filteredBanks = data.banks || [];
                    let filteredChurches = data.churches || [];
                    let associations = data.associations || [];
                    
                    // Aplicar filtros de permissão para membros
                    if (subscription.role === 'member') {
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
                        
                        // Atualizar aprendizados (learned_associations)
                        if (associations) {
                            setLearnedAssociations(associations.map((d: any) => ({
                                id: d.id, 
                                normalizedDescription: d.normalized_description,
                                contributorNormalizedName: d.contributor_normalized_name,
                                churchId: d.church_id, 
                                bankId: 'global',
                                user_id: d.user_id
                            })));
                        }
                        
                        console.log(`[useReferenceData] Sucesso: ${filteredBanks.length} bancos, ${filteredChurches.length} igrejas e ${associations?.length || 0} aprendizados.`);
                    }
                } else {
                    const errorText = await response.text();
                    console.error(`[useReferenceData] Erro na API: ${response.status} - ${errorText}`);
                }

            } catch (error) {
                if (!ignore) {
                    console.error("[useReferenceData] Erro ao buscar dados via API:", error);
                }
            }

            // ✅ marca como executado
            lastOwnerIdRef.current = ownerId;
        };

        syncData();

        return () => { ignore = true; };

    // ✅ dependências corrigidas (cirúrgico)
    }, [user?.id, subscription.ownerId, subscription.role]);

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
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) throw new Error("Token não encontrado");

            const response = await fetch('/api/reference/association/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    normalized_description: normalizedDesc,
                    contributor_normalized_name: contributorName,
                    church_id: matchResult.church.id,
                    ownerId: ownerId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erro ao salvar aprendizado");
            }

            console.log(`[ReferenceData] Aprendizado salvo com sucesso via API.`);
        } catch (err) {
            console.error("Erro ao persistir aprendizado via API:", err);
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
        if (!user || !subscription.ownerId) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Token não encontrado");

            const response = await fetch('/api/reference/bank/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ id: bankId, name, ownerId: subscription.ownerId })
            });

            if (!response.ok) throw new Error("Erro ao atualizar banco");

            setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name } : b));
            closeEditBank();
            showToast('Banco atualizado.', 'success');
        } catch (error) {
            console.error("Erro ao atualizar banco via API:", error);
            showToast('Erro ao atualizar banco.', 'error');
        }
    }, [closeEditBank, setBanks, showToast, user, subscription.ownerId]);

    const addBank = useCallback(async (name: string): Promise<boolean> => {
        if(!user || !subscription.ownerId) return false;
        const ownerId = subscription.ownerId;
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Token não encontrado");

            const response = await fetch('/api/reference/bank/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, ownerId })
            });

            if (!response.ok) throw new Error("Erro ao adicionar banco");

            const data = await response.json();
            setBanks(prev => [...prev, data]);
            showToast('Banco adicionado.', 'success');
            return true;
        } catch (error) {
            console.error("Erro ao adicionar banco via API:", error);
            showToast('Erro ao adicionar banco.', 'error');
            return false;
        }
    }, [user, banks, subscription.maxBanks, subscription.ownerId, setBanks, showToast]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        if (!user || !subscription.ownerId) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Token não encontrado");

            const response = await fetch('/api/reference/church/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ id: churchId, formData, ownerId: subscription.ownerId })
            });

            if (!response.ok) throw new Error("Erro ao atualizar igreja");

            setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
            closeEditChurch();
            showToast('Igreja atualizada.', 'success');
        } catch (error) {
            console.error("Erro ao atualizar igreja via API:", error);
            showToast('Erro ao atualizar igreja.', 'error');
        }
    }, [closeEditChurch, setChurches, showToast, user, subscription.ownerId]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user || !subscription.ownerId) return false;
        const ownerId = subscription.ownerId;
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Token não encontrado");

            const response = await fetch('/api/reference/church/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ formData, ownerId })
            });

            if (!response.ok) throw new Error("Erro ao adicionar igreja");

            const data = await response.json();
            setChurches(prev => [...prev, data]);
            showToast('Igreja adicionada.', 'success');
            return true;
        } catch (error) {
            console.error("Erro ao adicionar igreja via API:", error);
            showToast('Erro ao adicionar igreja.', 'error');
            return false;
        }
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