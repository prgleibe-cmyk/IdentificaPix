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
    city: 'São Paulo',
    state: 'SP',
    congregation: 'Sede Central',
    isExisting: false
};

export const usePortalWizard = (churchId?: string) => {
    const [wizardState, setWizardState] = useState<ContributionWizardState>(() => {
        let savedContrib = { ...INITIAL_EMPTY_CONTRIBUTOR };
        try {
            const raw = localStorage.getItem('iggestor_portal_contributor');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.name) {
                    savedContrib = { ...savedContrib, ...parsed };
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
                const foundContribObj = {
                    id: matched.id,
                    name: matched.canonical_name || '',
                    cpf: matched.cpf || (type === 'cpf' ? val : ''),
                    phone: matched.phone || (type === 'phone' ? val : ''),
                    email: matched.email || (type === 'email' ? val : ''),
                    city: 'São Paulo',
                    state: 'SP',
                    congregation: 'Sede Central',
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
                        city: 'São Paulo',
                        state: 'SP',
                        congregation: 'Sede Central',
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
    }, [wizardState.identificationType, wizardState.identificationValue, churchId]);

    // Save new contributor to database
    const saveContributor = useCallback(async (activeChurchId?: string): Promise<boolean> => {
        const contrib = wizardState.contributor;
        if (contrib.isExisting && contrib.id) {
            return true; // Already registered
        }

        const targetChurchId = activeChurchId || churchId || '00000000-0000-0000-0000-000000000001';

        setIsSaving(true);
        setApiError(null);

        try {
            const response = await fetch('/api/v1/contributors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    church_id: targetChurchId,
                    canonical_name: contrib.name,
                    cpf: contrib.cpf,
                    email: contrib.email,
                    phone: contrib.phone,
                    status: 'active'
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                if (response.status === 409) {
                    throw new Error('Já existe um contribuinte cadastrado com este CPF.');
                }
                throw new Error(errData.error || 'Falha ao realizar cadastro do contribuinte.');
            }

            const newRecord = await response.json();
            const newContribObj = {
                ...contrib,
                id: newRecord.id,
                isExisting: true
            };
            try {
                localStorage.setItem('iggestor_portal_contributor', JSON.stringify(newContribObj));
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
        toggleItemSelection,
        setItemAmount,
        getTotalAmount,
        resetWizard
    };
};

