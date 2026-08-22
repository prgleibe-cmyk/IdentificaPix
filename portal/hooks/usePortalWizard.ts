import { useState, useCallback, useEffect } from 'react';
import { 
    ContributionWizardState, 
    ContributorMockProfile, 
    ContributionItemMock, 
    IdentificationType 
} from '../types/portal';
import { generateMockReferenceNumber } from '../utils/portalFormatters';

const DEFAULT_CONTRIBUTION_CATEGORIES: ContributionItemMock[] = [
    { id: 'dizimo', label: 'Dízimo', description: 'Contribuição regular de dízimo senhorial', selected: true, amount: 100 },
    { id: 'oferta', label: 'Oferta Geral', description: 'Oferta voluntária para manutenção do templo', selected: false, amount: 0 },
    { id: 'missoes', label: 'Missões', description: 'Fundo para missões e evangelismo', selected: false, amount: 0 },
    { id: 'construcao', label: 'Construção & Reformas', description: 'Fundo para obras e melhorias da igreja', selected: false, amount: 0 },
    { id: 'acao_social', label: 'Ação Social', description: 'Projetos comunitários e cestas básicas', selected: false, amount: 0 },
    { id: 'eventos', label: 'Eventos & Congressos', description: 'Inscrições e fundos de eventos eclesiásticos', selected: false, amount: 0 },
    { id: 'campanhas', label: 'Campanhas Especiais', description: 'Campanhas de fé e votos específicos', selected: false, amount: 0 }
];

const INITIAL_EMPTY_CONTRIBUTOR: ContributorMockProfile = {
    id: '',
    name: '',
    cpf: '',
    phone: '',
    email: '',
    address_cep: '',
    address_street: '',
    address_number: '',
    address_city: '',
    address_state: '',
    city: '',
    state: '',
    congregation: '',
    isExisting: false
};

export const usePortalWizard = (churchId?: string, churchName?: string) => {
    const [wizardState, setWizardState] = useState<ContributionWizardState>(() => {
        let savedContrib = { ...INITIAL_EMPTY_CONTRIBUTOR };
        try {
            const raw = localStorage.getItem('iggestor_portal_contributor');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.name) {
                    savedContrib = { ...savedContrib, ...parsed };
                    if (savedContrib.congregation === 'Sede Central') {
                        savedContrib.congregation = churchName || '';
                    }
                }
            }
        } catch (_) {}

        return {
            step: 1, // 1: Identification, 2: Contributor details/registration, 3: Choose items & amounts, 4: Summary, 5: Payment, 6: Success
            identificationType: 'cpf',
            identificationValue: savedContrib.cpf || savedContrib.phone || savedContrib.email || '',
            mockSearchFound: !!savedContrib.id,
            contributor: savedContrib,
            contributionItems: DEFAULT_CONTRIBUTION_CATEGORIES.map(item => ({ ...item })),
            referenceNumber: generateMockReferenceNumber(),
            createdAt: new Date().toISOString()
        };
    });

    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchPublicTypes = async () => {
            try {
                const res = await fetch('/api/v1/contribution-types/public');
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && Array.isArray(data) && data.length > 0) {
                        const mapped: ContributionItemMock[] = data.map((item: any, idx: number) => ({
                            id: item.id,
                            label: item.name,
                            description: item.category || `Contribuição destinada para ${item.name}`,
                            selected: idx === 0,
                            amount: idx === 0 ? 100 : 0,
                            bank_id: item.bank_id
                        }));
                        setWizardState(prev => ({
                            ...prev,
                            contributionItems: mapped
                        }));
                    }
                }
            } catch (err) {
                console.error('[usePortalWizard] Erro ao carregar tipos de contribuição:', err);
            }
        };
        fetchPublicTypes();
        return () => { isMounted = false; };
    }, []);

    const setStep = useCallback((step: number) => {
        setWizardState(prev => ({ ...prev, step: Math.max(1, Math.min(5, step)) }));
    }, []);

    const nextStep = useCallback(() => {
        setWizardState(prev => {
            const next = prev.step + 1;
            if (next === 3 && !prev.referenceNumber) {
                return { ...prev, step: next, referenceNumber: generateMockReferenceNumber() };
            }
            return { ...prev, step: Math.min(5, next) };
        });
    }, []);

    const prevStep = useCallback(() => {
        setWizardState(prev => ({ ...prev, step: Math.max(1, prev.step - 1) }));
    }, []);

    const setIdentificationType = useCallback((type: IdentificationType) => {
        setWizardState(prev => ({ ...prev, identificationType: type, identificationValue: '' }));
    }, []);

    const setIdentificationValue = useCallback((value: string) => {
        setWizardState(prev => ({ ...prev, identificationValue: value }));
    }, []);

    // Perform real search against official identification endpoint on backend
    const performSearchContributor = useCallback(async (activeChurchId?: string): Promise<boolean> => {
        const type = wizardState.identificationType;
        const val = wizardState.identificationValue.trim();
        if (!val) return false;

        setIsSearching(true);
        setApiError(null);

        try {
            const targetChurchId = activeChurchId || churchId || '00000000-0000-0000-0000-000000000001';

            const response = await fetch('/api/v1/contributors/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    church_id: targetChurchId,
                    identifier: val,
                    identifier_type: type
                }),
                cache: 'no-store'
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.message || `Falha na consulta (${response.status})`);
            }

            const data = await response.json();

            if (data.found && data.contributor) {
                const matched = data.contributor;
                const foundContribObj: ContributorMockProfile = {
                    id: matched.id,
                    name: matched.name || matched.canonical_name || '',
                    canonical_name: matched.canonical_name || matched.name || '',
                    cpf: matched.cpf || (type === 'cpf' ? val : ''),
                    phone: matched.phone || matched.whatsapp || (type === 'phone' ? val : ''),
                    whatsapp: matched.whatsapp || matched.phone || '',
                    email: matched.email || (type === 'email' ? val : ''),
                    birth_date: matched.birth_date || '',
                    person_type: matched.person_type || 'PF',
                    trade_name: matched.trade_name || '',
                    rg_ie: matched.rg_ie || '',
                    contact_person: matched.contact_person || '',
                    category: matched.category || '',
                    role_position: matched.role_position || '',
                    pix_key: matched.pix_key || '',
                    bank_name: matched.bank_name || '',
                    bank_agency: matched.bank_agency || '',
                    bank_account: matched.bank_account || '',
                    address_cep: matched.address_cep || '',
                    address_street: matched.address_street || '',
                    address_number: matched.address_number || '',
                    address_city: matched.address_city || matched.city || '',
                    address_state: matched.address_state || matched.state || '',
                    city: matched.address_city || matched.city || '',
                    state: matched.address_state || matched.state || '',
                    congregation: (matched.congregation && matched.congregation !== 'Sede Central') ? matched.congregation : (churchName || ''),
                    notes: matched.notes || '',
                    photo_url: matched.photo_url || '',
                    church_id: matched.church_id || targetChurchId,
                    status: matched.status || 'active',
                    updated_at: matched.updated_at || matched.created_at || new Date().toISOString(),
                    last_confirmed_at: matched.last_confirmed_at || matched.updated_at || matched.created_at || new Date().toISOString(),
                    isExisting: true
                };
                try {
                    localStorage.setItem('iggestor_portal_contributor', JSON.stringify(foundContribObj));
                } catch (_) {}

                setWizardState(prev => ({
                    ...prev,
                    mockSearchFound: true,
                    contributor: foundContribObj
                }));
                setIsSearching(false);
                return true;
            } else {
                setWizardState(prev => ({
                    ...prev,
                    mockSearchFound: false,
                    contributor: {
                        id: '',
                        name: '',
                        cpf: type === 'cpf' ? val : '',
                        phone: type === 'phone' ? val : '',
                        email: type === 'email' ? val : '',
                        birth_date: '',
                        address_cep: '',
                        address_street: '',
                        address_number: '',
                        address_city: '',
                        address_state: '',
                        city: '',
                        state: '',
                        congregation: churchName || '',
                        isExisting: false
                    }
                }));
                setIsSearching(false);
                return false;
            }
        } catch (err: any) {
            console.error('[usePortalWizard] Erro ao identificar contribuinte:', err);
            setApiError(err.message || 'Erro ao comunicar com a base de dados.');
            setIsSearching(false);
            return false;
        }
    }, [wizardState.identificationType, wizardState.identificationValue, churchId, churchName]);

    // Save or update contributor to database
    const saveContributor = useCallback(async (activeChurchId?: string): Promise<boolean> => {
        const contrib = wizardState.contributor;
        const targetChurchId = activeChurchId || churchId || '00000000-0000-0000-0000-000000000001';

        setIsSaving(true);
        setApiError(null);

        try {
            if (contrib.id) {
                // If ID exists, update profile
                const updatePayload = {
                    id: contrib.id,
                    church_id: targetChurchId,
                    canonical_name: contrib.name || contrib.canonical_name,
                    name: contrib.name || contrib.canonical_name,
                    cpf: contrib.cpf,
                    phone: contrib.phone,
                    whatsapp: contrib.whatsapp || contrib.phone,
                    email: contrib.email,
                    birth_date: contrib.birth_date,
                    address_cep: contrib.address_cep,
                    address_street: contrib.address_street,
                    address_number: contrib.address_number,
                    address_city: contrib.address_city || contrib.city,
                    address_state: contrib.address_state || contrib.state,
                    role_position: contrib.role_position
                };

                let res = await fetch('/api/v1/contributors/update-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload)
                });

                if (!res.ok) {
                    res = await fetch(`/api/v1/contributors/${contrib.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatePayload)
                    });
                }

                const updatedRecord = res.ok ? await res.json().catch(() => null) : null;
                const updatedObj: ContributorMockProfile = {
                    ...contrib,
                    id: updatedRecord?.id || contrib.id,
                    isExisting: true,
                    church_id: targetChurchId
                };

                try {
                    localStorage.setItem('iggestor_portal_contributor', JSON.stringify(updatedObj));
                    window.dispatchEvent(new Event('storage'));
                } catch (_) {}

                setWizardState(prev => ({
                    ...prev,
                    mockSearchFound: true,
                    contributor: updatedObj
                }));

                setIsSaving(false);
                return true;
            }

            const response = await fetch('/api/v1/contributors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    church_id: targetChurchId,
                    canonical_name: contrib.name || contrib.canonical_name,
                    name: contrib.name,
                    cpf: contrib.cpf,
                    email: contrib.email,
                    phone: contrib.phone,
                    whatsapp: contrib.whatsapp || contrib.phone,
                    birth_date: contrib.birth_date,
                    address_cep: contrib.address_cep,
                    address_street: contrib.address_street,
                    address_number: contrib.address_number,
                    address_city: contrib.address_city || contrib.city,
                    address_state: contrib.address_state || contrib.state,
                    role_position: contrib.role_position,
                    status: 'active'
                })
            });

            if (!response.ok && response.status !== 409) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Falha ao realizar cadastro do contribuinte.');
            }

            const newRecord = await response.json().catch(() => ({}));
            const newContribObj: ContributorMockProfile = {
                ...contrib,
                id: newRecord?.id || contrib.id || `contrib-${Date.now()}`,
                isExisting: true,
                church_id: targetChurchId
            };
            try {
                localStorage.setItem('iggestor_portal_contributor', JSON.stringify(newContribObj));
                window.dispatchEvent(new Event('storage'));
            } catch (_) {}

            setWizardState(prev => ({
                ...prev,
                mockSearchFound: true,
                contributor: newContribObj
            }));

            setIsSaving(false);
            return true;
        } catch (err: any) {
            console.error('[usePortalWizard] Erro ao salvar contribuinte:', err);
            setApiError(err.message || 'Erro ao registrar contribuinte.');
            setIsSaving(false);
            return false;
        }
    }, [wizardState.contributor, churchId]);

    // Update contributor profile directly on server
    const updateContributorProfileOnServer = useCallback(async (updatedData: Partial<ContributorMockProfile>): Promise<boolean> => {
        const merged: ContributorMockProfile = {
            ...wizardState.contributor,
            ...updatedData
        };

        setIsSaving(true);
        setApiError(null);

        try {
            if (merged.id) {
                const res = await fetch(`/api/v1/contributors/${merged.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        canonical_name: merged.name || merged.canonical_name,
                        name: merged.name,
                        cpf: merged.cpf,
                        phone: merged.phone,
                        whatsapp: merged.whatsapp || merged.phone,
                        email: merged.email,
                        birth_date: merged.birth_date,
                        address_cep: merged.address_cep,
                        address_street: merged.address_street,
                        address_number: merged.address_number,
                        address_city: merged.address_city || merged.city,
                        address_state: merged.address_state || merged.state,
                        role_position: merged.role_position
                    })
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || 'Falha ao atualizar dados.');
                }
            }

            try {
                localStorage.setItem('iggestor_portal_contributor', JSON.stringify(merged));
                window.dispatchEvent(new Event('storage'));
            } catch (_) {}

            setWizardState(prev => ({
                ...prev,
                contributor: merged
            }));

            setIsSaving(false);
            return true;
        } catch (err: any) {
            console.error('[usePortalWizard] Erro ao atualizar perfil:', err);
            setApiError(err.message || 'Erro ao atualizar dados.');
            setIsSaving(false);
            return false;
        }
    }, [wizardState.contributor]);

    // 1-Click Periodic Confirmation (6 months)
    const confirmContributorProfileOnServer = useCallback(async (): Promise<boolean> => {
        const contrib = wizardState.contributor;
        setIsSaving(true);
        try {
            if (contrib.id) {
                await fetch('/api/v1/contributors/confirm-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: contrib.id,
                        cpf: contrib.cpf
                    })
                });
            }
            const nowIso = new Date().toISOString();
            const updatedObj: ContributorMockProfile = {
                ...contrib,
                updated_at: nowIso,
                last_confirmed_at: nowIso
            };
            try {
                localStorage.setItem('iggestor_portal_contributor', JSON.stringify(updatedObj));
                window.dispatchEvent(new Event('storage'));
            } catch (_) {}

            setWizardState(prev => ({
                ...prev,
                contributor: updatedObj
            }));
            setIsSaving(false);
            return true;
        } catch (err: any) {
            console.error('[usePortalWizard] Erro ao confirmar perfil semestral:', err);
            setIsSaving(false);
            return false;
        }
    }, [wizardState.contributor]);

    const getTotalAmount = useCallback(() => {
        return wizardState.contributionItems
            .filter(i => i.selected)
            .reduce((sum, item) => sum + (item.amount || 0), 0);
    }, [wizardState.contributionItems]);

    // Register official Contribution Request on backend
    const createContributionRequest = useCallback(async (activeChurchId?: string): Promise<boolean> => {
        const targetChurchId = activeChurchId || churchId;
        const contrib = wizardState.contributor;
        const total = getTotalAmount();

        if (!targetChurchId) {
            setApiError('Igreja não identificada. Por favor, recarregue a página.');
            return false;
        }

        if (!contrib.id) {
            setApiError('Contribuinte não identificado. Cadastre-se ou identifique-se primeiro.');
            return false;
        }

        if (total <= 0) {
            setApiError('Selecione ao menos uma categoria com valor maior que zero.');
            return false;
        }

        setIsSaving(true);
        setApiError(null);

        try {
            const selectedItemsStr = wizardState.contributionItems
                .filter(i => i.selected && i.amount > 0)
                .map(i => `${i.label}: R$ ${i.amount.toFixed(2)}`)
                .join('; ');

            const response = await fetch('/api/v1/contribution-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    church_id: targetChurchId,
                    contributor_id: contrib.id,
                    amount: total,
                    description: selectedItemsStr || 'Intenção de Contribuição'
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Falha ao registrar a intenção de contribuição.');
            }

            const requestRecord = await response.json();
            
            // Format ID for reference display or use full request ID
            const shortRef = requestRecord.id ? `REQ-${requestRecord.id.slice(0, 8).toUpperCase()}` : generateMockReferenceNumber();

            setWizardState(prev => ({
                ...prev,
                referenceNumber: shortRef,
                contributionRequestId: requestRecord.id,
                contributionRequestStatus: requestRecord.status || 'pending'
            }));

            setIsSaving(false);
            return true;
        } catch (err: any) {
            console.error('[usePortalWizard] Erro ao criar solicitação de contribuição:', err);
            setApiError(err.message || 'Erro ao registrar intenção de contribuição.');
            setIsSaving(false);
            return false;
        }
    }, [wizardState.contributor, wizardState.contributionItems, getTotalAmount, churchId]);

    const setMockSearchFound = useCallback((found: boolean) => {
        setWizardState(prev => ({
            ...prev,
            mockSearchFound: found
        }));
    }, []);

    const updateContributor = useCallback((updates: Partial<ContributorMockProfile>) => {
        setWizardState(prev => ({
            ...prev,
            contributor: { ...prev.contributor, ...updates }
        }));
    }, []);

    const toggleItemSelection = useCallback((itemId: string) => {
        setWizardState(prev => ({
            ...prev,
            contributionItems: prev.contributionItems.map(item => {
                if (item.id === itemId) {
                    const newSelected = !item.selected;
                    return {
                        ...item,
                        selected: newSelected,
                        amount: newSelected && item.amount === 0 ? 50 : item.amount
                    };
                }
                return item;
            })
        }));
    }, []);

    const setItemAmount = useCallback((itemId: string, amount: number) => {
        setWizardState(prev => ({
            ...prev,
            contributionItems: prev.contributionItems.map(item => {
                if (item.id === itemId) {
                    return { ...item, amount: Math.max(0, amount), selected: amount > 0 ? true : item.selected };
                }
                return item;
            })
        }));
    }, []);

    const resetWizard = useCallback(() => {
        setWizardState({
            step: 1,
            identificationType: 'cpf',
            identificationValue: '',
            mockSearchFound: false,
            contributor: { ...INITIAL_EMPTY_CONTRIBUTOR },
            contributionItems: DEFAULT_CONTRIBUTION_CATEGORIES.map(item => ({ ...item })),
            referenceNumber: generateMockReferenceNumber(),
            createdAt: new Date().toISOString()
        });
        setApiError(null);
    }, []);

    return {
        wizardState,
        isSearching,
        isSaving,
        apiError,
        setStep,
        nextStep,
        prevStep,
        setIdentificationType,
        setIdentificationValue,
        performSearchContributor,
        saveContributor,
        createContributionRequest,
        setMockSearchFound,
        updateContributor,
        updateContributorProfileOnServer,
        confirmContributorProfileOnServer,
        toggleItemSelection,
        setItemAmount,
        getTotalAmount,
        resetWizard
    };
};

