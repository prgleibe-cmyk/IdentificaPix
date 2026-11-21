import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { getAuthToken } from '../services/auth/authAdapter';
import { Bank, Church, ChurchFormData, ContributionType, LearnedAssociation, MatchResult, PaymentMethod, PaymentOperationType, TenantCustomOption, TenantOptionScope } from '../types';
import { usePersistentState } from './usePersistentState';
import { strictNormalize, DEFAULT_CONTRIBUTION_KEYWORDS, isInvalidOrNumericName, cleanBankDescription, normalizeString } from '../services/utils/parsingUtils';
import { useAuth } from '../contexts/AuthContext';
import { batchState } from './reconciliation/useCloudSync';
import { fetchWithMemoryCache, invalidateClientCache } from '../services/clientDataCache';
import { getCachedContributors } from '../services/contributorsCache';
import { safeFetch, safeParseJson } from '../services/utils/safeFetch';

const DEFAULT_PAYMENT_METHODS = ['PIX', 'DINHEIRO'];
const DEFAULT_CONTRIBUTOR_ROLES = [
    'Membro',
    'Visitante',
    'Pastor / Pastora',
    'Diácono / Diaconisa',
    'Presbítero / Evangelista',
    'Obreiro / Obreira',
    'Líder de Ministério / Célula',
    'Voluntário',
    'Dizimista',
    'Músico / Louvor',
    'Prestador de Serviços',
    'Fornecedor / Empresa',
    'Concessionária / Utilidades',
    'Outro'
];
const DEFAULT_SUPPLIER_CATEGORIES = [
    'Construção e Reformas',
    'Equipamentos de Som / Iluminação',
    'Prestação de Serviços Técnicos',
    'Água, Energia, Internet e Concessionárias',
    'Alimentação, Eventos e Buffet',
    'Gráfica, Comunicação Visual e Papelaria',
    'Outros Fornecedores'
];
const DEFAULT_PASTOR_ROLES = ['Pastor Presidente', 'Pastor Auxiliar'];
const DEFAULT_TREASURER_ROLES = ['1º Tesoureiro', '2º Tesoureiro'];

export const useReferenceData = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void, realtimeRefreshKey?: number) => {
    const { subscription, systemSettings, isSubscriptionReady } = useAuth();
    const roleStr = String(user?.role || subscription?.role || '').toLowerCase().trim();
    const isClientOwnerOrAdmin = !subscription?.ownerId || 
        subscription.ownerId === user?.id || 
        subscription.ownerId === '00000000-0000-0000-0000-000000000001' || 
        roleStr === 'owner' || 
        roleStr === 'admin' || 
        roleStr === 'principal';
    const effectiveUserId = isClientOwnerOrAdmin ? (user?.id || subscription?.ownerId) : (subscription?.ownerId || user?.owner_id || user?.id);
    const userSuffix = user ? `-${user.id}` : '-guest';

    const [banks, setBanks] = usePersistentState<Bank[]>(`identificapix-banks${userSuffix}`, []);
    const [churches, setChurches] = usePersistentState<Church[]>(`identificapix-churches${userSuffix}`, [], true);
    const [reports, setReports] = useState<any[]>([]);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>(`identificapix-similarity${userSuffix}`, 55);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>(`identificapix-daytolerance${userSuffix}`, 2);
    
    const [contributionKeywords, setContributionKeywords] = usePersistentState<string[]>(`identificapix-contrib-keywords${userSuffix}`, DEFAULT_CONTRIBUTION_KEYWORDS);
    const [paymentMethodItems, setPaymentMethodItems] = useState<PaymentMethod[]>([]);
    const [hasLoadedPaymentMethods, setHasLoadedPaymentMethods] = useState(false);
    const [tenantOptions, setTenantOptions] = useState<TenantCustomOption[]>([]);
    const [hasLoadedTenantOptions, setHasLoadedTenantOptions] = useState(false);
    const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);

    const paymentMethods = useMemo(() => {
        if (!hasLoadedPaymentMethods) return DEFAULT_PAYMENT_METHODS;
        return paymentMethodItems
            .filter(pm => pm.is_active !== false)
            .map(pm => (pm.name || '').trim().toUpperCase())
            .filter(Boolean);
    }, [hasLoadedPaymentMethods, paymentMethodItems]);

    const customRoles = useMemo(() => {
        if (!hasLoadedTenantOptions) return DEFAULT_CONTRIBUTOR_ROLES;
        return tenantOptions.filter(o => o.scope === 'contributor_role').map(o => o.name);
    }, [hasLoadedTenantOptions, tenantOptions]);

    const supplierCategories = useMemo(() => {
        if (!hasLoadedTenantOptions) return DEFAULT_SUPPLIER_CATEGORIES;
        return tenantOptions.filter(o => o.scope === 'supplier_category').map(o => o.name);
    }, [hasLoadedTenantOptions, tenantOptions]);

    const pastorRoles = useMemo(() => {
        if (!hasLoadedTenantOptions) return DEFAULT_PASTOR_ROLES;
        return tenantOptions.filter(o => o.scope === 'pastor_role').map(o => o.name);
    }, [hasLoadedTenantOptions, tenantOptions]);

    const treasurerRoles = useMemo(() => {
        if (!hasLoadedTenantOptions) return DEFAULT_TREASURER_ROLES;
        return tenantOptions.filter(o => o.scope === 'treasurer_role').map(o => o.name);
    }, [hasLoadedTenantOptions, tenantOptions]);

    const fetchContributionTypes = useCallback(async (forceRefresh = false) => {
        if (!user?.id) {
            setContributionTypes([]);
            return;
        }
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
            const url = effectiveUserId 
                ? `/api/v1/contribution-types?user_id=${encodeURIComponent(effectiveUserId)}`
                : '/api/v1/contribution-types';
            const data = await fetchWithMemoryCache<ContributionType[]>(url, { headers }, {
                ttlMs: 45000,
                forceRefresh
            });
            if (Array.isArray(data)) {
                setContributionTypes(data);
            }
        } catch (err) {
            console.error('Erro ao buscar tipos de contribuição:', err);
        }
    }, [user?.id, effectiveUserId]);

    const fetchPaymentMethods = useCallback(async (forceRefresh = false) => {
        if (!user?.id) {
            setPaymentMethodItems([]);
            setHasLoadedPaymentMethods(false);
            return;
        }
        try {
            const token = await getAuthToken();
            if (!token) return;
            const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
            const url = effectiveUserId
                ? `/api/v1/payment-methods?user_id=${encodeURIComponent(effectiveUserId)}`
                : '/api/v1/payment-methods';
            const data = await fetchWithMemoryCache<PaymentMethod[]>(url, { headers }, {
                ttlMs: 45000,
                forceRefresh
            });
            if (Array.isArray(data)) {
                setPaymentMethodItems(data);
                setHasLoadedPaymentMethods(true);
            }
        } catch (err) {
            console.error('Erro ao buscar formas de recebimento/pagamento:', err);
        }
    }, [user?.id, effectiveUserId]);

    const fetchTenantOptions = useCallback(async (forceRefresh = false) => {
        if (!user?.id) {
            setTenantOptions([]);
            setHasLoadedTenantOptions(false);
            return;
        }
        try {
            const token = await getAuthToken();
            if (!token) return;
            const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
            const url = effectiveUserId
                ? `/api/v1/tenant-options?user_id=${encodeURIComponent(effectiveUserId)}`
                : '/api/v1/tenant-options';
            const data = await fetchWithMemoryCache<TenantCustomOption[]>(url, { headers }, {
                ttlMs: 45000,
                forceRefresh
            });
            if (Array.isArray(data)) {
                setTenantOptions(data);
                setHasLoadedTenantOptions(true);
            }
        } catch (err) {
            console.error('Erro ao buscar cargos e categorias:', err);
        }
    }, [user?.id, effectiveUserId]);

    useEffect(() => {
        fetchContributionTypes();
    }, [fetchContributionTypes]);

    useEffect(() => {
        fetchPaymentMethods(Boolean(realtimeRefreshKey && realtimeRefreshKey > 0));
    }, [fetchPaymentMethods, realtimeRefreshKey]);

    useEffect(() => {
        fetchTenantOptions(Boolean(realtimeRefreshKey && realtimeRefreshKey > 0));
    }, [fetchTenantOptions, realtimeRefreshKey]);

    // Limpeza única de chaves legadas globais não isoladas por tenant
    useEffect(() => {
        try {
            localStorage.removeItem('identificapix_payment_methods_meta_v2');
            localStorage.removeItem('iggestor_custom_roles_v1');
            localStorage.removeItem('iggestor_supplier_categories_v1');
            localStorage.removeItem('iggestor_pastor_roles_v2');
            localStorage.removeItem('iggestor_treasurer_roles_v2');
        } catch (_) {}
    }, []);

    // ✅ MIGRATION/CLEANUP logic for contribution keywords (mantida isolada sem apagar formas de pagamento)
    const hasMigratedRef = useRef(false);

    useEffect(() => {
        if (!userSuffix) return;
        if (hasMigratedRef.current) return;
        if (!contributionKeywords) return;

        let changed = false;
        let nextKeywords = [...contributionKeywords];

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

        if (changed && JSON.stringify(nextKeywords) !== JSON.stringify(contributionKeywords)) {
            setContributionKeywords(nextKeywords);
        }

        hasMigratedRef.current = true;
    }, [contributionKeywords, userSuffix, setContributionKeywords]);

    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);
    const isBatchUpdating = batchState.isBatchUpdating;

    // ✅ CONTROLE DE EXECUÇÃO E CARGA ATÔMICA
    const [isReady, setIsReady] = useState(false);
    const lastSyncKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (realtimeRefreshKey && realtimeRefreshKey > 0) {
            lastSyncKeyRef.current = null;
        }
    }, [realtimeRefreshKey]);

    useEffect(() => {
        let ignore = false;

        if (!user?.id) {
            lastSyncKeyRef.current = null;
            setIsReady(true);
            return;
        }

        // Aguarda a resolução completa das permissões e assinatura antes de buscar
        if (isSubscriptionReady === false) {
            return;
        }

        const effectiveOwnerId = isClientOwnerOrAdmin ? (user?.id || subscription?.ownerId) : subscription.ownerId;
        const allowedChurchKey = (subscription?.congregationIds || []).join(',');
        const syncKey = `${user.id}:${effectiveOwnerId}:${roleStr}:${allowedChurchKey}:${realtimeRefreshKey || 0}`;

        if (lastSyncKeyRef.current === syncKey) {
            return;
        }

        const syncData = async () => {
            try {
                const token = await getAuthToken();
                const ownerId = effectiveOwnerId;
                const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

                let response = await safeFetch(`/api/v1/reference/data/${ownerId}?limit=50&offset=0`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: authHeaders
                });

                if (!response.ok) {
                    response = await safeFetch(`/api/reference/data/${ownerId}?limit=50&offset=0`, {
                        method: 'GET',
                        cache: 'no-store',
                        headers: authHeaders
                    });
                }

                let data: any = null;
                if (response.ok) {
                    data = await safeParseJson(response, 'useReferenceData.referenceData');
                } else {
                    const [bRes, cRes, aRes] = await Promise.all([
                        safeFetch(`/api/v1/banks?user_id=${ownerId}`, { headers: authHeaders, cache: 'no-store' }),
                        safeFetch(`/api/v1/churches?user_id=${ownerId}`, { headers: authHeaders, cache: 'no-store' }),
                        safeFetch(`/api/v1/learned_associations?user_id=${ownerId}`, { headers: authHeaders, cache: 'no-store' })
                    ]);
                    const bList = bRes.ok ? await safeParseJson(bRes, 'useReferenceData.banks').catch(() => []) : [];
                    const cList = cRes.ok ? await safeParseJson(cRes, 'useReferenceData.churches').catch(() => []) : [];
                    const aList = aRes.ok ? await safeParseJson(aRes, 'useReferenceData.associations').catch(() => []) : [];
                    data = {
                        banks: Array.isArray(bList) ? bList : [],
                        churches: Array.isArray(cList) ? cList : [],
                        reports: [],
                        associations: Array.isArray(aList) ? aList : []
                    };
                }

                if (data && !ignore) {
                    let filteredBanks = Array.isArray(data.banks) ? data.banks : [];
                    let filteredChurches = Array.isArray(data.churches) ? data.churches : [];
                    let fetchedReports = data.reports || [];
                    let fetchedAssociations = data.associations || [];
                    
                    const isSecondaryUser = Boolean(
                        subscription.ownerId && 
                        subscription.ownerId !== user?.id && 
                        roleStr !== 'owner' && 
                        roleStr !== 'principal' && 
                        roleStr !== 'admin' && 
                        roleStr !== 'superadmin' &&
                        user?.role !== 'SUPER_ADMIN' &&
                        user?.role !== 'ADMINISTRADOR_GERAL'
                    );
                    
                    if (isSecondaryUser) {
                        const allowedBankIds = subscription.bankIds || [];
                        const allowedChurchIds = subscription.congregationIds || [];
                        
                        if (allowedBankIds.length > 0) {
                            filteredBanks = filteredBanks.filter((b: any) => allowedBankIds.includes(b.id));
                        } else {
                            filteredBanks = [];
                        }

                        if (allowedChurchIds.length > 0) {
                            filteredChurches = filteredChurches.filter((c: any) => allowedChurchIds.includes(c.id));
                            fetchedReports = fetchedReports.filter((r: any) => Boolean(r.church_id && allowedChurchIds.includes(r.church_id)));
                        } else {
                            filteredChurches = [];
                            fetchedReports = [];
                        }
                    }
                    
                    if (!ignore) {
                        setBanks(filteredBanks);
                        setChurches(filteredChurches);

                        if (fetchedReports.length > 0) {
                            setReports(fetchedReports);
                        }

                        if (fetchedAssociations.length > 0) {
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
                }

            } catch (error) {
                if (!ignore) {
                    console.error("[useReferenceData] Erro ao buscar dados via API:", error);
                }
            } finally {
                if (!ignore) {
                    lastSyncKeyRef.current = syncKey;
                    setIsReady(true);
                }
            }
        };

        syncData();

        return () => { ignore = true; };

    }, [user?.id, subscription?.role, subscription?.ownerId, subscription?.congregationIds, isSubscriptionReady, realtimeRefreshKey, isClientOwnerOrAdmin, roleStr]);

    // ✅ REAL-TIME SYNC PARA METADADOS (Bancos, Igrejas, Associações)
    useEffect(() => {
        // Handled via REST API
    }, [user?.id, subscription.ownerId, setBanks, setChurches, setLearnedAssociations]);

    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        console.log('[IA-LEARN] Chamou função de aprendizado', {
            entrada: matchResult
        });

        if (!user || !matchResult.church) return;

        const contributorObj = matchResult.contributor;
        const rawContribName = contributorObj?.cleanedName || contributorObj?.name;
        const contributorName = (rawContribName && !isInvalidOrNumericName(rawContribName, matchResult.transaction.description))
            ? rawContribName
            : '';

        if (!contributorName) {
            console.log('[IA-LEARN] Aprendizado cancelado: nome do contribuinte inválido ou numérico');
            return;
        }
        
        const normalizedDesc = strictNormalize(matchResult.transaction.description || '');
        const rawNormalizedDesc = matchResult.transaction.rawDescription ? strictNormalize(matchResult.transaction.rawDescription) : '';
        const cleanDescStrict = strictNormalize(cleanBankDescription(matchResult.transaction.description || ''));
        const cleanRawStrict = matchResult.transaction.rawDescription ? strictNormalize(cleanBankDescription(matchResult.transaction.rawDescription)) : '';
        
        if (isBatchUpdating) return;

        // 🛡️ Prioriza a igreja de cadastro original do contribuinte em vez de alteração temporária do lançamento
        let originalChurchId = (contributorObj as any)?._churchId || (contributorObj as any)?.church?.id || (contributorObj as any)?.church_id;

        // Se a igreja original não veio anexada no objeto, busca o cadastro original pelo ID ou pelo nome no cache de contribuintes
        if (!originalChurchId && (contributorObj?.id || contributorName)) {
            try {
                const cachedList = await getCachedContributors();
                const found = (Array.isArray(cachedList) ? cachedList : []).find((c: any) => {
                    if (contributorObj?.id && c.id === contributorObj.id) return true;
                    const cNorm = normalizeString(c.canonical_name || c.name || '');
                    const targetNorm = normalizeString(contributorName);
                    return cNorm && targetNorm && cNorm === targetNorm;
                });
                if (found && found.church_id && found.church_id !== 'church-1') {
                    originalChurchId = found.church_id;
                }
            } catch (_) {}
        }

        if (!originalChurchId || originalChurchId === 'church-1') {
            originalChurchId = matchResult.church.id;
        }

        batchState.isAtomicUpdate = true;
        const newAssociation: LearnedAssociation = { 
            normalizedDescription: normalizedDesc, 
            contributorNormalizedName: contributorName, 
            churchId: originalChurchId, 
            bankId: 'global',
            user_id: effectiveUserId 
        };

        const descsToSave: string[] = [];
        if (normalizedDesc) descsToSave.push(normalizedDesc);
        if (rawNormalizedDesc && !descsToSave.includes(rawNormalizedDesc)) descsToSave.push(rawNormalizedDesc);
        if (cleanDescStrict && !descsToSave.includes(cleanDescStrict)) descsToSave.push(cleanDescStrict);
        if (cleanRawStrict && !descsToSave.includes(cleanRawStrict)) descsToSave.push(cleanRawStrict);

        setLearnedAssociations(prev => {
            const filtered = prev.filter(la => !descsToSave.includes(la.normalizedDescription));
            const newEntries = descsToSave.map(desc => ({
                normalizedDescription: desc, 
                contributorNormalizedName: contributorName, 
                churchId: originalChurchId, 
                bankId: 'global',
                user_id: effectiveUserId 
            }));
            return [...newEntries, ...filtered];
        });

        console.log('[IA-LEARN] Salvando aprendizado', {
            dados: newAssociation
        });

        try {
            console.log(`[WRITE:FIX] Persistindo learned_association com effectiveUserId: ${effectiveUserId} no VPS`);
            const token = getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            for (const desc of descsToSave) {
                await fetch('/api/v1/learned_associations', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: effectiveUserId,
                        normalized_description: desc,
                        contributor_normalized_name: contributorName,
                        church_id: originalChurchId
                    })
                });
            }
        } catch (err) {
            console.error("Erro ao persistir aprendizado no VPS:", err);
        }
    }, [user, effectiveUserId, isBatchUpdating]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);

    const updateBank = useCallback(async (
        bankId: string,
        name: string,
        accepted_contribution_types?: string[] | null,
        bankDetails?: { agency?: string | null; account_number?: string | null }
    ) => {
        const account_name = name;
        const existingBank = banks.find(b => b.id === bankId);
        const hasAgencyDetail = Boolean(bankDetails && Object.prototype.hasOwnProperty.call(bankDetails, 'agency'));
        const hasAccountNumberDetail = Boolean(bankDetails && Object.prototype.hasOwnProperty.call(bankDetails, 'account_number'));
        const resolvedAcceptedTypes = accepted_contribution_types !== undefined
            ? accepted_contribution_types
            : (existingBank?.accepted_contribution_types ?? null);
        const resolvedAgency = hasAgencyDetail
            ? (typeof bankDetails?.agency === 'string' && bankDetails.agency.trim() ? bankDetails.agency.trim() : null)
            : (existingBank?.agency ?? null);
        const resolvedAccountNumber = hasAccountNumberDetail
            ? (typeof bankDetails?.account_number === 'string' && bankDetails.account_number.trim() ? bankDetails.account_number.trim() : null)
            : (existingBank?.account_number ?? null);

        const requestBody: Record<string, any> = {
            name,
            account_name,
            accepted_contribution_types: resolvedAcceptedTypes
        };
        if (hasAgencyDetail) {
            requestBody.agency = resolvedAgency;
        }
        if (hasAccountNumberDetail) {
            requestBody.account_number = resolvedAccountNumber;
        }

        console.log(`[WRITE:UPDATE] Atualizando conta bancária (ID: ${bankId}) no VPS`);
        const token = await getAuthToken();
        const res = await fetch(`/api/v1/banks/${bankId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.message || 'Erro ao atualizar conta bancária.';
            showToast(errMsg, 'error');
            throw new Error(errMsg);
        }

        const updatedBank = await res.json().catch(() => null);
        setBanks(prev => prev.map(b => b.id === bankId ? {
            ...b,
            ...(updatedBank || {
                name,
                account_name,
                agency: resolvedAgency,
                account_number: resolvedAccountNumber,
                accepted_contribution_types: resolvedAcceptedTypes
            })
        } : b));
        showToast('Banco atualizado.', 'success');
        return updatedBank || true;
    }, [banks, setBanks, showToast]);

    const addBank = useCallback(async (
        nameOrPayload: string | {
            name: string;
            bank_key?: string | null;
            account_name?: string | null;
            agency?: string | null;
            account_number?: string | null;
            accepted_contribution_types?: string[] | null;
        },
        bank_key_legacy?: string | null
    ): Promise<any> => {
        if(!user || !effectiveUserId) return false;
        if (banks.length >= (subscription.maxBanks || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }

        let name: string;
        let bank_key: string | null = null;
        let account_name: string | null = null;
        let agency: string | null = null;
        let account_number: string | null = null;
        let accepted_contribution_types: string[] | null = null;

        if (typeof nameOrPayload === 'string') {
            name = nameOrPayload;
            bank_key = bank_key_legacy || null;
            account_name = name;
        } else {
            name = nameOrPayload.name;
            bank_key = nameOrPayload.bank_key || null;
            account_name = nameOrPayload.account_name ?? nameOrPayload.name;
            agency = typeof nameOrPayload.agency === 'string' && nameOrPayload.agency.trim() ? nameOrPayload.agency.trim() : null;
            account_number = typeof nameOrPayload.account_number === 'string' && nameOrPayload.account_number.trim() ? nameOrPayload.account_number.trim() : null;
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
        const token = await getAuthToken();
        const res = await fetch('/api/v1/banks', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                name,
                user_id: effectiveUserId,
                bank_key: bank_key ?? null,
                account_name: account_name ?? name,
                agency,
                account_number,
                accepted_contribution_types
            })
        });

        if (res.ok) {
            const newBank = await res.json();
            setBanks(prev => [...prev, newBank]);
            showToast('Banco adicionado.', 'success');
            return newBank;
        }

        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.message || 'Erro ao adicionar conta bancária.';
        showToast(errMsg, 'error');
        throw new Error(errMsg);
    }, [user, effectiveUserId, banks, subscription.maxBanks, setBanks, showToast]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        console.log(`[WRITE:ALREADY_CORRECT] Atualizando igreja (ID: ${churchId}) no VPS`);
        const token = await getAuthToken();
        const res = await fetch(`/api/v1/churches/${churchId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(formData)
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.message || 'Erro ao atualizar igreja.';
            showToast(errMsg, 'error');
            throw new Error(errMsg);
        }

        const updatedChurch = await res.json().catch(() => null);
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...(updatedChurch || formData) } : c));
        try {
            localStorage.removeItem('iggestor_portal_churches_cache');
        } catch (_) {}
        closeEditChurch();
        showToast('Igreja atualizada.', 'success');
        return updatedChurch || true;
    }, [closeEditChurch, setChurches, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user || !effectiveUserId) return false;
        if (churches.length >= (subscription.maxChurches || 1)) {
            showToast(`Limite atingido.`, 'error');
            return false;
        }
        try {
            console.log(`[WRITE:FIX] Adicionando igreja com effectiveUserId: ${effectiveUserId} no VPS`);
            const token = await getAuthToken();
            const res = await fetch('/api/v1/churches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ ...formData, user_id: effectiveUserId })
            });
            if (res.ok) {
                const newChurch = await res.json();
                setChurches(prev => [...prev, newChurch]);
                try {
                    localStorage.removeItem('iggestor_portal_churches_cache');
                } catch (_) {}
                showToast('Igreja adicionada.', 'success');
                return true;
            }
            const errJson = await res.json().catch(() => ({}));
            showToast(errJson?.message || 'Erro ao cadastrar igreja.', 'error');
            return false;
        } catch (err) {
            console.error('Erro ao cadastrar igreja:', err);
            showToast('Erro ao comunicar com o servidor ao cadastrar igreja.', 'error');
            return false;
        }
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

    const addPaymentMethod = useCallback(async (
        dataOrMethod: string | { name: string; type?: PaymentOperationType; category?: string | null; bank_id?: string | null; order?: number; is_active?: boolean }
    ) => {
        const payload = typeof dataOrMethod === 'string'
            ? { name: dataOrMethod.trim().toUpperCase(), type: 'ambos' as PaymentOperationType }
            : {
                ...dataOrMethod,
                name: (dataOrMethod.name || '').trim().toUpperCase()
            };

        const token = await getAuthToken();
        const res = await fetch('/api/v1/payment-methods', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ ...payload, user_id: effectiveUserId })
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.message || 'Erro ao cadastrar forma de recebimento/pagamento.';
            showToast(errMsg, 'error');
            throw new Error(errMsg);
        }

        const newMethod: PaymentMethod = await res.json();
        invalidateClientCache('/api/v1/payment-methods');
        setPaymentMethodItems(prev => [...prev, newMethod]);
        setHasLoadedPaymentMethods(true);
        showToast(`Forma "${newMethod.name}" adicionada.`, 'success');
        window.dispatchEvent(new CustomEvent('payment_methods_updated', { detail: { action: 'create', method: newMethod } }));
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('identificapix_realtime_sync');
                bc.postMessage({ type: 'payment_methods_updated' });
                bc.close();
            } catch (_) {}
        }
        return newMethod;
    }, [effectiveUserId, showToast]);

    const removePaymentMethod = useCallback(async (idOrMethodName: string) => {
        const cleanTarget = (idOrMethodName || '').trim();
        const matched = paymentMethodItems.find(
            pm => pm.id === cleanTarget || (pm.name || '').trim().toUpperCase() === cleanTarget.toUpperCase()
        );
        const targetId = matched?.id || cleanTarget;

        const token = await getAuthToken();
        const res = await fetch(`/api/v1/payment-methods/${encodeURIComponent(targetId)}`, {
            method: 'DELETE',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.message || 'Erro ao excluir forma de recebimento/pagamento.';
            showToast(errMsg, 'error');
            return false;
        }

        invalidateClientCache('/api/v1/payment-methods');
        setPaymentMethodItems(prev => prev.filter(pm => pm.id !== targetId));
        showToast('Forma removida.', 'success');
        window.dispatchEvent(new CustomEvent('payment_methods_updated', { detail: { action: 'delete', id: targetId } }));
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('identificapix_realtime_sync');
                bc.postMessage({ type: 'payment_methods_updated' });
                bc.close();
            } catch (_) {}
        }
        return true;
    }, [paymentMethodItems, showToast]);

    const updatePaymentMethod = useCallback(async (
        idOrOldMethod: string,
        dataOrNewMethod: string | { name: string; type?: PaymentOperationType; category?: string | null; bank_id?: string | null; order?: number; is_active?: boolean }
    ) => {
        const cleanTarget = (idOrOldMethod || '').trim();
        const matched = paymentMethodItems.find(
            pm => pm.id === cleanTarget || (pm.name || '').trim().toUpperCase() === cleanTarget.toUpperCase()
        );
        const targetId = matched?.id || cleanTarget;

        const payload = typeof dataOrNewMethod === 'string'
            ? {
                name: dataOrNewMethod.trim().toUpperCase(),
                type: matched?.type || ('ambos' as PaymentOperationType),
                category: matched?.category ?? null,
                bank_id: matched?.bank_id ?? null,
                order: matched?.order ?? 1,
                is_active: matched?.is_active !== false
            }
            : {
                ...dataOrNewMethod,
                name: (dataOrNewMethod.name || '').trim().toUpperCase()
            };

        const token = await getAuthToken();
        const res = await fetch(`/api/v1/payment-methods/${encodeURIComponent(targetId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.message || 'Erro ao atualizar forma de recebimento/pagamento.';
            showToast(errMsg, 'error');
            throw new Error(errMsg);
        }

        const updated: PaymentMethod = await res.json();
        invalidateClientCache('/api/v1/payment-methods');
        setPaymentMethodItems(prev => prev.map(pm => pm.id === targetId ? updated : pm));
        setHasLoadedPaymentMethods(true);
        showToast(`Forma "${updated.name}" atualizada.`, 'success');
        window.dispatchEvent(new CustomEvent('payment_methods_updated', { detail: { action: 'update', method: updated } }));
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('identificapix_realtime_sync');
                bc.postMessage({ type: 'payment_methods_updated' });
                bc.close();
            } catch (_) {}
        }
        return updated;
    }, [paymentMethodItems, showToast]);

    const addContributionType = useCallback(async (data: { name: string; type: 'entrada' | 'saida'; category?: string; bank_id?: string; order?: number; is_active?: boolean }) => {
        try {
            const token = await getAuthToken();
            const res = await fetch('/api/v1/contribution-types', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ ...data, user_id: effectiveUserId })
            });
            if (res.ok) {
                const newType = await res.json();
                invalidateClientCache('/api/v1/contribution-types');
                setContributionTypes(prev => [...prev, newType]);
                showToast(`Tipo "${newType.name}" cadastrado.`, 'success');
                window.dispatchEvent(new CustomEvent('contribution_types_updated', { detail: { action: 'create', type: newType } }));
                if (typeof BroadcastChannel !== 'undefined') {
                    try {
                        const bc = new BroadcastChannel('identificapix_realtime_sync');
                        bc.postMessage({ type: 'contribution_types_updated' });
                        bc.close();
                    } catch (_) {}
                }
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
            const token = await getAuthToken();
            const res = await fetch(`/api/v1/contribution-types/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updated = await res.json();
                invalidateClientCache('/api/v1/contribution-types');
                setContributionTypes(prev => prev.map(item => item.id === id ? updated : item));
                showToast(`Tipo "${updated.name}" atualizado.`, 'success');
                window.dispatchEvent(new CustomEvent('contribution_types_updated', { detail: { action: 'update', type: updated } }));
                if (typeof BroadcastChannel !== 'undefined') {
                    try {
                        const bc = new BroadcastChannel('identificapix_realtime_sync');
                        bc.postMessage({ type: 'contribution_types_updated' });
                        bc.close();
                    } catch (_) {}
                }
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
            const token = await getAuthToken();
            const res = await fetch(`/api/v1/contribution-types/${id}`, {
                method: 'DELETE',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (res.ok) {
                invalidateClientCache('/api/v1/contribution-types');
                setContributionTypes(prev => prev.filter(item => item.id !== id));
                showToast('Tipo de contribuição removido.', 'success');
                window.dispatchEvent(new CustomEvent('contribution_types_updated', { detail: { action: 'delete', id } }));
                if (typeof BroadcastChannel !== 'undefined') {
                    try {
                        const bc = new BroadcastChannel('identificapix_realtime_sync');
                        bc.postMessage({ type: 'contribution_types_updated' });
                        bc.close();
                    } catch (_) {}
                }
                return true;
            } else {
                const errJson = await res.json().catch(() => ({}));
                showToast(errJson.message || 'Erro ao excluir tipo.', 'error');
                return false;
            }
        } catch (err) {
            console.error('Erro ao excluir tipo:', err);
            showToast('Erro ao comunicar com o servidor.', 'error');
            return false;
        }
    }, [showToast]);

    const addTenantOption = useCallback(async (scope: TenantOptionScope, name: string) => {
        const trimmed = (name || '').trim();
        if (!trimmed) return false;
        const existing = tenantOptions.find(
            o => o.scope === scope && o.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) return existing;

        const token = await getAuthToken();
        const res = await fetch('/api/v1/tenant-options', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ scope, name: trimmed, user_id: effectiveUserId })
        });
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.message || 'Erro ao cadastrar item.';
            showToast(errMsg, 'error');
            return false;
        }
        const created: TenantCustomOption = await res.json();
        invalidateClientCache('/api/v1/tenant-options');
        setTenantOptions(prev => [...prev, created]);
        setHasLoadedTenantOptions(true);
        showToast(`"${created.name}" adicionado(a).`, 'success');
        return created;
    }, [tenantOptions, effectiveUserId, showToast]);

    const renameTenantOption = useCallback(async (scope: TenantOptionScope, oldName: string, newName: string) => {
        const trimmed = (newName || '').trim();
        if (!trimmed || trimmed === oldName) return false;
        const target = tenantOptions.find(
            o => o.scope === scope && o.name === oldName
        ) || tenantOptions.find(
            o => o.scope === scope && o.name.trim().toLowerCase() === (oldName || '').trim().toLowerCase()
        );
        if (!target) {
            return await addTenantOption(scope, trimmed);
        }

        const token = await getAuthToken();
        const res = await fetch(`/api/v1/tenant-options/${encodeURIComponent(target.id)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ name: trimmed })
        });
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.message || 'Erro ao renomear item.';
            showToast(errMsg, 'error');
            return false;
        }
        const updated: TenantCustomOption = await res.json();
        invalidateClientCache('/api/v1/tenant-options');
        setTenantOptions(prev => prev.map(o => o.id === target.id ? updated : o));
        showToast(`Atualizado para "${updated.name}".`, 'success');
        return updated;
    }, [tenantOptions, addTenantOption, showToast]);

    const deleteTenantOption = useCallback(async (scope: TenantOptionScope, nameToDelete: string) => {
        const target = tenantOptions.find(
            o => o.scope === scope && o.name === nameToDelete
        ) || tenantOptions.find(
            o => o.scope === scope && o.name.trim().toLowerCase() === (nameToDelete || '').trim().toLowerCase()
        );
        if (!target) return false;

        const token = await getAuthToken();
        const res = await fetch(`/api/v1/tenant-options/${encodeURIComponent(target.id)}`, {
            method: 'DELETE',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.message || 'Erro ao excluir item.';
            showToast(errMsg, 'error');
            return false;
        }
        invalidateClientCache('/api/v1/tenant-options');
        setTenantOptions(prev => prev.filter(o => o.id !== target.id));
        showToast('Item removido.', 'success');
        return true;
    }, [tenantOptions, showToast]);

    return useMemo(() => ({
        banks, churches, reports, isReady, similarityLevel, setSimilarityLevel, dayTolerance, setDayTolerance,
        contributionKeywords, addContributionKeyword, removeContributionKeyword,
        paymentMethods, paymentMethodItems, fetchPaymentMethods, addPaymentMethod, removePaymentMethod, updatePaymentMethod,
        contributionTypes, fetchContributionTypes, addContributionType, updateContributionType, removeContributionType,
        customRoles, supplierCategories, pastorRoles, treasurerRoles, fetchTenantOptions, addTenantOption, renameTenantOption, deleteTenantOption,
        learnedAssociations, learnAssociation,
        editingBank, openEditBank, closeEditBank, updateBank, addBank,
        editingChurch, openEditChurch, closeEditChurch, updateChurch, addChurch,
        setBanks, setChurches, setLearnedAssociations
    }), [
        banks, churches, reports, isReady, similarityLevel, dayTolerance, 
        contributionKeywords, paymentMethods, paymentMethodItems, fetchPaymentMethods, contributionTypes, fetchContributionTypes, addContributionType, updateContributionType, removeContributionType,
        customRoles, supplierCategories, pastorRoles, treasurerRoles, fetchTenantOptions, addTenantOption, renameTenantOption, deleteTenantOption,
        learnedAssociations, learnAssociation, 
        editingBank, editingChurch, setBanks, setChurches, setSimilarityLevel, 
        setDayTolerance, openEditBank, closeEditBank, updateBank, addBank, 
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        addContributionKeyword, removeContributionKeyword, addPaymentMethod, removePaymentMethod, updatePaymentMethod
    ]);
};