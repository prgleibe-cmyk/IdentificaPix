import React, { useState, useEffect, useRef } from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalChurch, ContributorMockProfile } from '../types/portal';
import { formatCpf, formatPhone, validateEmailVisual } from '../utils/portalFormatters';
import { invalidateContributorsCache } from '../../services/contributorsCache';
import { 
    Building2, 
    CheckCircle2, 
    User, 
    Phone, 
    Mail, 
    Calendar, 
    ShieldCheck, 
    Sparkles, 
    ArrowRight, 
    Loader2, 
    Check,
    UserCheck,
    AlertCircle,
    MapPin,
    Landmark,
    FileText
} from 'lucide-react';

interface PortalRegisterPageProps {
    church?: PortalChurch | null;
    churchesList?: PortalChurch[];
    onNavigate: (route: string, params?: Record<string, string>) => void;
}

export const PortalRegisterPage: React.FC<PortalRegisterPageProps> = ({ 
    church, 
    churchesList = [], 
    onNavigate 
}) => {
    const [selectedChurchId, setSelectedChurchId] = useState<string>(church?.id || '');
    const [selectedChurch, setSelectedChurch] = useState<PortalChurch | null>(church || null);
    
    // 1. Tipo de Pessoa & Identificação
    const [personType, setPersonType] = useState<'PF' | 'PJ'>('PF');
    const [cpf, setCpf] = useState('');
    const [name, setName] = useState('');
    const [tradeName, setTradeName] = useState('');
    const [rgIe, setRgIe] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    // 2. Contato & Representante
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [contactPerson, setContactPerson] = useState('');

    // 3. Endereço
    const [addressCep, setAddressCep] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('SP');
    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const [cepError, setCepError] = useState<string | null>(null);

    // 4. Congregação & Vínculo
    const [congregation, setCongregation] = useState('Sede Central');
    const [rolePosition, setRolePosition] = useState('Membro');

    // 5. Dados Bancários & Pix
    const [pixKey, setPixKey] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAgency, setBankAgency] = useState('');
    const [bankAccount, setBankAccount] = useState('');

    // 6. Observações
    const [notes, setNotes] = useState('');

    // Existing Contributor lookup states
    const [contributorId, setContributorId] = useState<string | null>(null);
    const [isExisting, setIsExisting] = useState<boolean | null>(null);
    const [isCheckingCpf, setIsCheckingCpf] = useState(false);
    const [cpfCheckedValue, setCpfCheckedValue] = useState<string>('');
    const [lookupMessage, setLookupMessage] = useState<string | null>(null);

    // Name suggestions from database
    const [allContributors, setAllContributors] = useState<any[]>([]);
    const [nameSuggestions, setNameSuggestions] = useState<any[]>([]);
    const [showNameSuggestions, setShowNameSuggestions] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const nameSearchTimerRef = useRef<any>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    // Sync selected church when prop arrives or list loads
    useEffect(() => {
        if (church) {
            setSelectedChurch(church);
            setSelectedChurchId(church.id);
        } else if (churchesList.length > 0 && !selectedChurchId) {
            setSelectedChurch(churchesList[0]);
            setSelectedChurchId(churchesList[0].id);
        }
    }, [church, churchesList]);

    // Pre-load contributors list for smooth name suggestions and instant identification
    useEffect(() => {
        let isMounted = true;
        const fetchContributors = async () => {
            try {
                const targetChurch = selectedChurchId || church?.id || '';
                const url = targetChurch 
                    ? `/api/v1/contributors?status=active&church_id=${targetChurch}`
                    : '/api/v1/contributors?status=active';
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && Array.isArray(data)) {
                        setAllContributors(data);
                    }
                }
            } catch (_) {
                // Silently fall back to individual lookup
            }
        };

        fetchContributors();
        return () => { isMounted = false; };
    }, [selectedChurchId, church]);

    // Fill form from a found contributor record
    const populateFromContributor = (c: any) => {
        setContributorId(c.id);
        setIsExisting(true);
        const rawType = c.person_type === 'PJ' || (c.cpf && String(c.cpf).replace(/\D/g, '').length === 14) ? 'PJ' : 'PF';
        setPersonType(rawType);
        setName(c.name || c.canonical_name || '');
        setTradeName(c.trade_name || '');
        if (c.cpf) setCpf(formatCpf(c.cpf));
        setRgIe(c.rg_ie || '');
        if (c.phone || c.whatsapp) setPhone(formatPhone(c.phone || c.whatsapp));
        if (c.email) setEmail(c.email);
        setContactPerson(c.contact_person || '');
        if (c.birth_date) {
            setBirthDate(String(c.birth_date).split('T')[0]);
        }
        setPhotoPreview(c.photo_url || null);
        if (c.address_cep) setAddressCep(c.address_cep);
        if (c.address_street) setAddressStreet(c.address_street);
        if (c.address_number) setAddressNumber(c.address_number);
        if (c.address_city || c.city) setCity(c.address_city || c.city);
        if (c.address_state || c.state) setState(c.address_state || c.state);
        if (c.congregation) setCongregation(c.congregation);
        if (c.role_position || c.category) setRolePosition(c.role_position || c.category);
        if (c.pix_key) setPixKey(c.pix_key);
        if (c.bank_name) setBankName(c.bank_name);
        if (c.bank_agency) setBankAgency(c.bank_agency);
        if (c.bank_account) setBankAccount(c.bank_account);
        if (c.notes) setNotes(c.notes);
    };

    // Lookup contributor by CPF automatically
    const checkCpfIdentification = async (rawCpfValue: string) => {
        const cleanCpf = rawCpfValue.replace(/\D/g, '');
        if (cleanCpf.length !== 11 && cleanCpf.length !== 14) return;
        if (cleanCpf === cpfCheckedValue) return;

        setIsCheckingCpf(true);
        setApiError(null);
        setCpfCheckedValue(cleanCpf);

        try {
            const activeChurchId = selectedChurch?.id || selectedChurchId || '00000000-0000-0000-0000-000000000001';
            const response = await fetch('/api/v1/contributors/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    church_id: activeChurchId,
                    identifier: cleanCpf,
                    identifier_type: 'cpf'
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.found && data.contributor) {
                    const c = data.contributor;
                    populateFromContributor(c);
                    setLookupMessage(`Cadastro de "${c.name || c.canonical_name}" localizado! Você pode conferir ou atualizar seus dados abaixo.`);
                    setIsCheckingCpf(false);
                    return;
                }
            }

            // If not found via identify endpoint, check local loaded contributors array
            const localFound = allContributors.find(item => item.cpf && String(item.cpf).replace(/\D/g, '') === cleanCpf);
            if (localFound) {
                populateFromContributor(localFound);
                setLookupMessage(`Cadastro de "${localFound.name || localFound.canonical_name}" localizado! Você pode conferir ou atualizar seus dados abaixo.`);
                setIsCheckingCpf(false);
                return;
            }

            // Not found -> mark as new registration
            setIsExisting(false);
            setContributorId(null);
            setLookupMessage('Novo cadastro! Preencha seus dados abaixo para se cadastrar.');
        } catch (err) {
            console.error('[PortalRegisterPage] Erro ao consultar CPF:', err);
            setIsExisting(false);
        } finally {
            setIsCheckingCpf(false);
        }
    };

    // Auto CEP lookup via ViaCEP
    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        let formatted = raw;
        if (raw.length > 5) {
            formatted = `${raw.slice(0, 5)}-${raw.slice(5, 8)}`;
        }
        setAddressCep(formatted);
        setCepError(null);

        if (raw.length === 8) {
            setIsSearchingCep(true);
            try {
                const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.erro) {
                        if (data.logradouro) setAddressStreet(data.logradouro);
                        if (data.localidade) setCity(data.localidade);
                        if (data.uf) setState(data.uf);
                    } else {
                        setCepError('CEP não encontrado.');
                    }
                }
            } catch (err) {
                console.error('Erro ao consultar CEP:', err);
            } finally {
                setIsSearchingCep(false);
            }
        }
    };

    const handleChurchChange = (churchId: string) => {
        setSelectedChurchId(churchId);
        const found = churchesList.find(c => c.id === churchId);
        if (found) {
            setSelectedChurch(found);
        }
    };

    const handleCpfChange = (val: string) => {
        const formatted = formatCpf(val);
        setCpf(formatted);
        if (errors.cpf) {
            setErrors(prev => ({ ...prev, cpf: '' }));
        }

        const raw = formatted.replace(/\D/g, '');
        if (raw.length === 11 || raw.length === 14) {
            checkCpfIdentification(formatted);
        } else {
            if (isExisting !== null) {
                setIsExisting(null);
                setContributorId(null);
                setLookupMessage(null);
                setCpfCheckedValue('');
            }
        }
    };

    // Name input change & auto-complete filter
    const handleNameChange = (val: string) => {
        setName(val);
        if (errors.name) setErrors(prev => ({ ...prev, name: '' }));

        const trimmed = val.trim();
        const trimmedLower = trimmed.toLowerCase();

        if (trimmedLower.length >= 2 && !isExisting) {
            // 1. Immediate local filter
            const localMatches = allContributors.filter(c => {
                const cName = (c.name || c.canonical_name || '').toLowerCase();
                return cName.includes(trimmedLower);
            }).slice(0, 5);

            if (localMatches.length > 0) {
                setNameSuggestions(localMatches);
                setShowNameSuggestions(true);
            }

            // 2. Debounced remote lookup for database records
            if (nameSearchTimerRef.current) {
                clearTimeout(nameSearchTimerRef.current);
            }

            nameSearchTimerRef.current = setTimeout(async () => {
                try {
                    const activeChurchId = selectedChurch?.id || selectedChurchId || '00000000-0000-0000-0000-000000000001';
                    const res = await fetch(`/api/v1/contributors/identify?identifier_type=name&identifier=${encodeURIComponent(trimmed)}&church_id=${activeChurchId}`);
                    if (res.ok) {
                        const data = await res.json();
                        const results = data.results || (data.found && data.contributor ? [data.contributor] : []);
                        if (results.length > 0) {
                            const combined = [...results];
                            localMatches.forEach(lm => {
                                if (!combined.some(c => c.id === lm.id)) {
                                    combined.push(lm);
                                }
                            });
                            setNameSuggestions(combined.slice(0, 6));
                            setShowNameSuggestions(true);
                        }
                    }
                } catch (_) {}
            }, 300);
        } else {
            if (nameSearchTimerRef.current) {
                clearTimeout(nameSearchTimerRef.current);
            }
            setNameSuggestions([]);
            setShowNameSuggestions(false);
        }
    };

    // When selecting a contributor from name suggestions
    const handleSelectSuggestion = (c: any) => {
        populateFromContributor(c);
        setShowNameSuggestions(false);
        setLookupMessage(`Cadastro de "${c.name || c.canonical_name}" carregado! Você pode conferir ou atualizar seus dados abaixo.`);
    };

    const handlePhoneChange = (val: string) => {
        setPhone(formatPhone(val));
        if (errors.phone) {
            setErrors(prev => ({ ...prev, phone: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setApiError(null);

        const newErrors: Record<string, string> = {};
        const cleanName = name.trim();
        const cleanCpf = cpf.trim();
        const cleanPhone = phone.trim();
        const cleanEmail = email.trim();

        const rawCpf = cleanCpf.replace(/\D/g, '');
        if (!rawCpf) {
            newErrors.cpf = personType === 'PF' ? 'Informe seu CPF para identificação.' : 'Informe o CNPJ da empresa.';
        } else if (rawCpf.length !== 11 && rawCpf.length !== 14) {
            newErrors.cpf = personType === 'PF' ? 'CPF incompleto (deve conter 11 dígitos).' : 'CNPJ incompleto (deve conter 14 dígitos).';
        }

        if (!cleanName) {
            newErrors.name = personType === 'PF' ? 'Nome completo é obrigatório.' : 'Razão social é obrigatória.';
        } else if (personType === 'PF' && cleanName.split(' ').length < 2) {
            newErrors.name = 'Por favor, informe seu nome e sobrenome.';
        }

        const rawPhone = cleanPhone.replace(/\D/g, '');
        if (!rawPhone) {
            newErrors.phone = 'WhatsApp / Celular é obrigatório.';
        } else if (rawPhone.length < 10) {
            newErrors.phone = 'Telefone incompleto com DDD.';
        }

        if (cleanEmail && !validateEmailVisual(cleanEmail)) {
            newErrors.email = 'Informe um e-mail válido.';
        }

        const activeChurchId = selectedChurch?.id || selectedChurchId;
        if (!activeChurchId) {
            newErrors.church = 'Selecione a sua congregação / igreja.';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSaving(true);
        setApiError(null);

        try {
            let finalId = contributorId;

            const fullPayload: any = {
                id: contributorId || undefined,
                church_id: activeChurchId,
                canonical_name: cleanName.toUpperCase(),
                name: cleanName,
                person_type: personType,
                trade_name: tradeName.trim() || null,
                cpf: rawCpf,
                rg_ie: rgIe.trim() || null,
                phone: rawPhone,
                whatsapp: rawPhone,
                email: cleanEmail || null,
                contact_person: contactPerson.trim() || null,
                birth_date: birthDate || null,
                photo_url: photoPreview || null,
                address_cep: addressCep.trim() || null,
                address_street: addressStreet.trim() || null,
                address_number: addressNumber.trim() || null,
                address_city: city.trim() || null,
                address_state: state.trim() || null,
                role_position: rolePosition.trim() || 'Membro',
                category: rolePosition.trim() || null,
                pix_key: pixKey.trim() || null,
                bank_name: bankName.trim() || null,
                bank_agency: bankAgency.trim() || null,
                bank_account: bankAccount.trim() || null,
                notes: notes.trim() || null,
                status: 'active'
            };

            // 1. Tenta endpoint centralizado update-profile (UPSERT unificado)
            let updateRes = await fetch('/api/v1/contributors/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullPayload)
            });

            if (updateRes.ok) {
                const updateData = await updateRes.json().catch(() => null);
                if (updateData?.id) finalId = updateData.id;
            } else if (isExisting && contributorId) {
                // Fallback para PUT /api/v1/contributors/:id
                updateRes = await fetch(`/api/v1/contributors/${contributorId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullPayload)
                });
                if (updateRes.ok) {
                    const updateData = await updateRes.json().catch(() => null);
                    if (updateData?.id) finalId = updateData.id;
                }
            } else {
                // Fallback para POST /api/v1/contributors
                const createRes = await fetch('/api/v1/contributors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullPayload)
                });
                if (createRes.ok) {
                    const createData = await createRes.json().catch(() => null);
                    if (createData?.id) finalId = createData.id;
                } else if (createRes.status !== 409) {
                    const errData = await createRes.json().catch(() => ({}));
                    throw new Error(errData.message || errData.error || 'Falha ao salvar cadastro.');
                }
            }

            invalidateContributorsCache();

            const savedProfile: ContributorMockProfile = {
                id: finalId || contributorId || 'contrib_' + Date.now(),
                name: cleanName,
                canonical_name: cleanName.toUpperCase(),
                person_type: personType,
                trade_name: tradeName,
                cpf: cleanCpf,
                rg_ie: rgIe,
                phone: cleanPhone,
                whatsapp: cleanPhone,
                email: cleanEmail,
                contact_person: contactPerson,
                church_id: activeChurchId,
                congregation: congregation || selectedChurch?.name || 'Sede Central',
                address_cep: addressCep,
                address_street: addressStreet,
                address_number: addressNumber,
                address_city: city,
                address_state: state,
                city: city,
                state: state,
                birth_date: birthDate,
                photo_url: photoPreview || undefined,
                role_position: rolePosition,
                category: rolePosition,
                pix_key: pixKey,
                bank_name: bankName,
                bank_agency: bankAgency,
                bank_account: bankAccount,
                notes: notes,
                isExisting: true
            };

            localStorage.setItem('iggestor_portal_contributor', JSON.stringify(savedProfile));
            localStorage.setItem('iggestor_just_registered', 'true');
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('contributor-profile-updated', { detail: savedProfile }));

            setIsSaving(false);
            const churchSlug = selectedChurch?.slug || selectedChurch?.id || 'igreja';
            onNavigate('church', { churchSlug });

        } catch (err: any) {
            console.error('[PortalRegisterPage] Erro ao cadastrar:', err);
            setApiError(err.message || 'Ocorreu um erro ao salvar o cadastro. Tente novamente.');
            setIsSaving(false);
        }
    };

    const churchName = selectedChurch?.name || 'Igreja';

    return (
        <PortalContainer maxWidth="7xl">
            <div className="max-w-2xl mx-auto py-4 sm:py-8 px-2">
                
                {/* Header Card with Church Identity */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden mb-6 text-center">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none -ml-10 -mb-10" />

                    <div className="relative flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-1 shadow-lg shadow-emerald-500/20 mb-3 flex items-center justify-center">
                            {selectedChurch?.logoUrl ? (
                                <img
                                    src={selectedChurch.logoUrl}
                                    alt={churchName}
                                    className="w-full h-full object-cover rounded-xl bg-white"
                                />
                            ) : (
                                <div className="w-full h-full rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-600">
                                    <Building2 className="w-8 h-8" />
                                </div>
                            )}
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 mb-2 border border-emerald-200 dark:border-emerald-800">
                            <Sparkles className="w-3 h-3 text-emerald-500" />
                            Auto-Cadastro &amp; Identificação Oficial
                        </span>

                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            {churchName}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                            Informe seu CPF/CNPJ ou Nome para localizar seu cadastro ou realizar seu cadastro unificado em menos de 1 minuto.
                        </p>
                    </div>
                </div>

                {/* Form Body */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-5 text-slate-800 dark:text-slate-100">
                        
                        {/* SELECTOR: PF / PJ */}
                        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                            <button
                                type="button"
                                onClick={() => setPersonType('PF')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    personType === 'PF'
                                        ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <User className="w-4 h-4" />
                                <span>Pessoa Física (Membro / Doador)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPersonType('PJ')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    personType === 'PJ'
                                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <Building2 className="w-4 h-4" />
                                <span>Pessoa Jurídica (Empresa / Fornecedor)</span>
                            </button>
                        </div>

                        {/* Church Selector (if multiple available) */}
                        {churchesList.length > 1 && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-emerald-600" />
                                    <span>Selecione a sua Congregação / Igreja *</span>
                                </label>
                                <select
                                    value={selectedChurchId}
                                    onChange={(e) => handleChurchChange(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                                >
                                    {churchesList.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.church && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.church}</p>}
                            </div>
                        )}

                        {/* STEP 1: CPF FIRST WITH AUTOMATIC IDENTIFICATION */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-slate-50/50 dark:from-emerald-950/20 dark:to-slate-800/60 border border-emerald-500/20 dark:border-emerald-800/40 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    <span>1. Digite seu {personType === 'PF' ? 'CPF' : 'CNPJ'} *</span>
                                </label>
                                {isCheckingCpf && (
                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Consultando base de dados...</span>
                                    </span>
                                )}
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={(e) => handleCpfChange(e.target.value)}
                                    maxLength={personType === 'PF' ? 14 : 18}
                                    placeholder={personType === 'PF' ? "000.000.000-00" : "00.000.000/0000-00"}
                                    className={`w-full px-4 py-3.5 rounded-2xl border font-mono text-base font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
                                        isExisting === true
                                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                            : errors.cpf 
                                                ? 'border-rose-400 focus:ring-rose-500/20' 
                                                : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20'
                                    }`}
                                />
                                {isExisting === true && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-emerald-500 text-white shadow-sm">
                                        <Check className="w-4 h-4 stroke-[3]" />
                                    </div>
                                )}
                            </div>

                            {/* Status Banner when CPF is detected */}
                            {lookupMessage && (
                                <div className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 animate-fade-in ${
                                    isExisting === true
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                                }`}>
                                    {isExisting === true ? (
                                        <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    ) : (
                                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                        <span>{lookupMessage}</span>
                                        {isExisting === true && (
                                            <p className="text-[11px] font-normal text-emerald-700 dark:text-emerald-300 mt-0.5">
                                                Altere qualquer campo abaixo caso precise atualizar seu telefone ou endereço.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {errors.cpf && <p className="text-xs text-rose-500 font-semibold">{errors.cpf}</p>}
                        </div>

                        {/* STEP 2: NOME / RAZÃO SOCIAL & NOME FANTASIA */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className={`relative ${personType === 'PJ' ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <User className="w-4 h-4 text-emerald-600" />
                                    <span>{personType === 'PF' ? 'Nome Completo *' : 'Razão Social Completa *'}</span>
                                </label>
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    value={name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    onFocus={() => {
                                        if (name.trim().length >= 2 && nameSuggestions.length > 0 && !isExisting) {
                                            setShowNameSuggestions(true);
                                        }
                                    }}
                                    placeholder={personType === 'PF' ? "Ex: João da Silva Santos" : "Ex: Empresa Distribuidora Ltda"}
                                    className={`w-full px-4 py-3 rounded-2xl border bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 transition-all uppercase font-bold ${
                                        errors.name 
                                            ? 'border-rose-400 focus:ring-rose-500/20' 
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/20'
                                    }`}
                                />

                                {/* Name Suggestions Dropdown */}
                                {showNameSuggestions && nameSuggestions.length > 0 && (
                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden text-xs">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                            <span>Cadastros Encontrados (Clique para carregar dados)</span>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowNameSuggestions(false)}
                                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                            {nameSuggestions.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => handleSelectSuggestion(item)}
                                                    className="w-full text-left p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                                >
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-white">{item.name || item.canonical_name}</p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {item.cpf ? `Documento: ${formatCpf(item.cpf)}` : ''} 
                                                            {item.phone ? ` • Tel: ${formatPhone(item.phone)}` : ''}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-1 rounded-lg shrink-0">
                                                        Selecionar
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {errors.name && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.name}</p>}
                            </div>

                            {/* Nome Fantasia (PJ) */}
                            {personType === 'PJ' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        <span>Nome Fantasia / Comercial</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={tradeName}
                                        onChange={(e) => setTradeName(e.target.value)}
                                        placeholder="Ex: Comercial Silva"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                                    />
                                </div>
                            )}
                        </div>

                        {/* RG / IE & Data de Nascimento */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <span>{personType === 'PF' ? 'RG (Registro Geral)' : 'Inscrição Estadual (IE)'}</span>
                                </label>
                                <input
                                    type="text"
                                    value={rgIe}
                                    onChange={(e) => setRgIe(e.target.value)}
                                    placeholder={personType === 'PF' ? "00.000.000-0" : "Isento ou Nº IE"}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span>{personType === 'PF' ? 'Data de Nascimento' : 'Data de Fundação'}</span>
                                </label>
                                <input
                                    type="date"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                                />
                            </div>
                        </div>

                        {/* WhatsApp and Email Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Phone className="w-4 h-4 text-emerald-600" />
                                    <span>WhatsApp / Celular *</span>
                                </label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => handlePhoneChange(e.target.value)}
                                    maxLength={15}
                                    placeholder="(00) 00000-0000"
                                    className={`w-full px-4 py-3 rounded-2xl border font-mono bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 transition-all ${
                                        errors.phone 
                                            ? 'border-rose-400 focus:ring-rose-500/20' 
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/20'
                                    }`}
                                />
                                {errors.phone && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.phone}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span>E-mail (Opcional)</span>
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                                    }}
                                    placeholder="seuemail@exemplo.com"
                                    className={`w-full px-4 py-3 rounded-2xl border bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${
                                        errors.email 
                                            ? 'border-rose-400 focus:ring-rose-500/20' 
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/20'
                                    }`}
                                />
                                {errors.email && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.email}</p>}
                            </div>

                            {/* Pessoa de Contato / Representante PJ */}
                            {personType === 'PJ' && (
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span>Pessoa de Contato / Representante Legal</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={contactPerson}
                                        onChange={(e) => setContactPerson(e.target.value)}
                                        placeholder="Ex: Carlos Oliveira (Gerente / Representante)"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Endereço Completo */}
                        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                <MapPin className="w-4 h-4 text-amber-500" />
                                <span>Endereço Residencial / Comercial</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        CEP
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={addressCep}
                                            onChange={handleCepChange}
                                            maxLength={9}
                                            placeholder="00000-000"
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        />
                                        {isSearchingCep && (
                                            <Loader2 className="w-3.5 h-3.5 text-brand-blue animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                                        )}
                                    </div>
                                    {cepError && <p className="text-[10px] font-bold text-rose-500 mt-0.5">{cepError}</p>}
                                </div>

                                <div className="sm:col-span-4">
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        Logradouro / Rua
                                    </label>
                                    <input
                                        type="text"
                                        value={addressStreet}
                                        onChange={(e) => setAddressStreet(e.target.value)}
                                        placeholder="Ex: Rua das Flores"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        Número / Bairro
                                    </label>
                                    <input
                                        type="text"
                                        value={addressNumber}
                                        onChange={(e) => setAddressNumber(e.target.value)}
                                        placeholder="Ex: 123, Centro"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div className="sm:col-span-3">
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        Cidade
                                    </label>
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="Ex: São Paulo"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div className="sm:col-span-1">
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        UF
                                    </label>
                                    <input
                                        type="text"
                                        value={state}
                                        onChange={(e) => setState(e.target.value.toUpperCase())}
                                        placeholder="SP"
                                        maxLength={2}
                                        className="w-full px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-bold uppercase text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Congregação & Vínculo */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-indigo-500" />
                                    <span>Congregação / Setor</span>
                                </label>
                                <input
                                    type="text"
                                    value={congregation}
                                    onChange={(e) => setCongregation(e.target.value)}
                                    placeholder="Ex: Sede Central"
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <User className="w-4 h-4 text-indigo-500" />
                                    <span>{personType === 'PF' ? 'Vínculo / Cargo Eclesiástico' : 'Categoria / Ramo de Atuação'}</span>
                                </label>
                                <input
                                    type="text"
                                    value={rolePosition}
                                    onChange={(e) => setRolePosition(e.target.value)}
                                    placeholder={personType === 'PF' ? "Ex: Membro, Diácono, Obreiro, Pastor, Doador..." : "Ex: Prestador de Serviços, Fornecedor, Tecnologia..."}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>
                        </div>

                        {/* Dados Bancários & Pix (Opcional) */}
                        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                <Landmark className="w-4 h-4 text-cyan-500" />
                                <span>Dados Bancários &amp; Chave Pix (Opcional)</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        Chave Pix Principal
                                    </label>
                                    <input
                                        type="text"
                                        value={pixKey}
                                        onChange={(e) => setPixKey(e.target.value)}
                                        placeholder="CPF, CNPJ, E-mail, Telefone ou Aleatória"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        Banco / Instituição
                                    </label>
                                    <input
                                        type="text"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        placeholder="Ex: Nubank, Itaú, Banco do Brasil..."
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        Agência
                                    </label>
                                    <input
                                        type="text"
                                        value={bankAgency}
                                        onChange={(e) => setBankAgency(e.target.value)}
                                        placeholder="0000"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                        Conta Corrente / Poupança
                                    </label>
                                    <input
                                        type="text"
                                        value={bankAccount}
                                        onChange={(e) => setBankAccount(e.target.value)}
                                        placeholder="00000-0"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Observações / Anotações */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <span>Observações / Anotações Adicionais</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Informações adicionais para a congregação ou tesouraria..."
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                            />
                        </div>

                        {/* Error Alert */}
                        {apiError && (
                            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{apiError}</span>
                            </div>
                        )}

                        {/* Privacy & Safe Note */}
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Seus dados são confidenciais e protegidos pela LGPD para fins ministeriais da igreja.</span>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSaving || isCheckingCpf}
                            className="w-full mt-2 flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-xs sm:text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xl shadow-emerald-600/25 cursor-pointer uppercase tracking-wider disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Salvando Cadastro...</span>
                                </>
                            ) : isExisting ? (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>Confirmar / Atualizar Dados e Acessar Portal</span>
                                    <ArrowRight className="w-4 h-4 ml-1" />
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>Concluir Cadastro e Acessar Portal</span>
                                    <ArrowRight className="w-4 h-4 ml-1" />
                                </>
                            )}
                        </button>

                    </form>
                </div>

            </div>
        </PortalContainer>
    );
};
