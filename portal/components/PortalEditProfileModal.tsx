import React, { useState, useEffect } from 'react';
import { ContributorMockProfile, PortalChurch } from '../types/portal';
import { checkProfileCompleteness } from '../utils/portalProfileCompleteness';
import { formatCpf, formatPhone, validateCpfVisual, validatePhoneVisual, validateEmailVisual } from '../utils/portalFormatters';
import { 
    X, 
    Save, 
    User, 
    Phone, 
    Mail, 
    Calendar, 
    MapPin, 
    Church, 
    CheckCircle2, 
    AlertTriangle, 
    Sparkles, 
    Search, 
    Loader2,
    ShieldCheck,
    RefreshCw
} from 'lucide-react';

interface PortalEditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    contributor: ContributorMockProfile | null;
    church?: PortalChurch | null;
    onProfileUpdated: (updated: ContributorMockProfile) => void;
}

export const PortalEditProfileModal: React.FC<PortalEditProfileModalProps> = ({
    isOpen,
    onClose,
    contributor,
    church,
    onProfileUpdated
}) => {
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [addressCep, setAddressCep] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [addressCity, setAddressCity] = useState('');
    const [addressState, setAddressState] = useState('');
    const [congregation, setCongregation] = useState('');
    const [rolePosition, setRolePosition] = useState('');

    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const [cepError, setCepError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    // Initialize or reset form state when modal opens
    useEffect(() => {
        if (isOpen && contributor) {
            setName(contributor.name || contributor.canonical_name || '');
            setCpf(contributor.cpf ? formatCpf(contributor.cpf) : '');
            setPhone(contributor.phone || contributor.whatsapp ? formatPhone(contributor.phone || contributor.whatsapp || '') : '');
            setEmail(contributor.email || '');
            setBirthDate(contributor.birth_date || '');
            setAddressCep(contributor.address_cep || '');
            setAddressStreet(contributor.address_street || '');
            setAddressNumber(contributor.address_number || '');
            setAddressCity(contributor.address_city || contributor.city || '');
            setAddressState(contributor.address_state || contributor.state || '');
            setCongregation(
                (contributor.congregation && contributor.congregation !== 'Sede Central') 
                    ? contributor.congregation 
                    : (church?.name || '')
            );
            setRolePosition(contributor.role_position || '');
            setFormErrors({});
            setApiError(null);
            setSaveSuccess(false);
            setCepError(null);
        }
    }, [isOpen, contributor, church]);

    if (!isOpen) return null;

    // Temporary object to calculate live completeness
    const liveProfile: ContributorMockProfile = {
        id: contributor?.id || '',
        name,
        canonical_name: name.trim().toUpperCase(),
        cpf,
        phone,
        whatsapp: phone,
        email,
        birth_date: birthDate,
        address_cep: addressCep,
        address_street: addressStreet,
        address_number: addressNumber,
        address_city: addressCity,
        address_state: addressState,
        city: addressCity,
        state: addressState,
        congregation,
        role_position: rolePosition,
        isExisting: contributor?.isExisting ?? true
    };

    const completeness = checkProfileCompleteness(liveProfile);

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
                        if (data.localidade) setAddressCity(data.localidade);
                        if (data.uf) setAddressState(data.uf);
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!name.trim() || name.trim().length < 3) {
            errors.name = 'Nome completo é obrigatório.';
        }
        if (!cpf.trim() || !validateCpfVisual(cpf)) {
            errors.cpf = 'CPF válido é obrigatório.';
        }
        if (!phone.trim() || !validatePhoneVisual(phone)) {
            errors.phone = 'Telefone/WhatsApp válido é obrigatório.';
        }
        if (email.trim() && !validateEmailVisual(email)) {
            errors.email = 'E-mail em formato inválido.';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setFormErrors({});
        setIsSaving(true);
        setApiError(null);

        try {
            const cleanCpfDigits = cpf.replace(/\D/g, '');
            const cleanPhoneDigits = phone.replace(/\D/g, '');
            const targetChurchId = church?.id || contributor?.church_id || '00000000-0000-0000-0000-000000000001';

            const payload: any = {
                canonical_name: name.trim().toUpperCase(),
                name: name.trim(),
                cpf: cleanCpfDigits,
                phone: cleanPhoneDigits,
                whatsapp: cleanPhoneDigits,
                email: email.trim() || null,
                birth_date: birthDate.trim() || null,
                address_cep: addressCep.trim() || null,
                address_street: addressStreet.trim() || null,
                address_number: addressNumber.trim() || null,
                address_city: addressCity.trim() || null,
                address_state: addressState.trim() || null,
                role_position: rolePosition.trim() || null,
                church_id: targetChurchId,
                status: 'active'
            };

            let updatedId = contributor?.id;

            if (contributor?.id) {
                // Update existing contributor record
                const response = await fetch(`/api/v1/contributors/${contributor.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    throw new Error(errJson.message || errJson.error || 'Falha ao salvar dados no servidor.');
                }
                const resData = await response.json();
                if (resData && resData.id) updatedId = resData.id;
            } else {
                // Register/create new contributor record
                const response = await fetch('/api/v1/contributors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    throw new Error(errJson.message || errJson.error || 'Falha ao cadastrar contribuinte.');
                }
                const resData = await response.json();
                if (resData && resData.id) updatedId = resData.id;
            }

            const updatedProfileObj: ContributorMockProfile = {
                ...liveProfile,
                id: updatedId || contributor?.id || 'contrib_' + Date.now(),
                isExisting: true,
                church_id: targetChurchId
            };

            // Save to localStorage
            try {
                localStorage.setItem('iggestor_portal_contributor', JSON.stringify(updatedProfileObj));
                window.dispatchEvent(new Event('storage'));
            } catch (_) {}

            onProfileUpdated(updatedProfileObj);
            setSaveSuccess(true);

            setTimeout(() => {
                onClose();
            }, 1200);

        } catch (err: any) {
            console.error('[PortalEditProfileModal] Erro ao salvar perfil:', err);
            setApiError(err.message || 'Erro ao conectar com o banco de dados. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all"
                style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
            >
                {/* Modal Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 via-white to-amber-50/80 dark:from-slate-800/80 dark:via-slate-900 dark:to-slate-800/80 flex items-start justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-blue to-amber-500 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                            {name ? name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                                    Atualizar Meus Dados
                                </h3>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    completeness.score >= 90
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}>
                                    {completeness.score}% Completo
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Mantenha seus dados completos para recebimento de comprovantes no WhatsApp e relatórios.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Completeness Bar */}
                <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex-1">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            <span>Status do Preenchimento</span>
                            <span>{completeness.filledFields} de {completeness.totalFields} itens</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                    completeness.score >= 90 
                                        ? 'bg-emerald-500' 
                                        : completeness.score >= 60 
                                            ? 'bg-blue-500' 
                                            : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.max(8, completeness.score)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Modal Form Body */}
                <form 
                    id="portal-profile-form" 
                    onSubmit={handleSave} 
                    className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6"
                    style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
                >
                    {saveSuccess && (
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 animate-in fade-in">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div>
                                <h4 className="text-xs font-black">Cadastro Atualizado com Sucesso!</h4>
                                <p className="text-[11px] font-medium">Seus dados foram salvos e sincronizados com a tesouraria da igreja.</p>
                            </div>
                        </div>
                    )}

                    {apiError && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-800 dark:text-rose-300">
                            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <p className="text-xs font-bold">{apiError}</p>
                        </div>
                    )}

                    {/* SECTION 1: DADOS PESSOAIS */}
                    <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                            <User className="w-4 h-4 text-brand-blue dark:text-blue-400" />
                            <h4 className="text-xs font-black uppercase tracking-wider">
                                1. Identificação Pessoal
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Nome Completo */}
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Nome Completo *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ex: João da Silva Santos"
                                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                        formErrors.name ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                    }`}
                                />
                                {formErrors.name && <p className="text-[11px] font-bold text-rose-500 mt-1">{formErrors.name}</p>}
                            </div>

                            {/* CPF */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    CPF / CNPJ *
                                </label>
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                                    placeholder="000.000.000-00"
                                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                        formErrors.cpf ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                    }`}
                                />
                                {formErrors.cpf && <p className="text-[11px] font-bold text-rose-500 mt-1">{formErrors.cpf}</p>}
                            </div>

                            {/* Data de Nascimento */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Data de Nascimento
                                </label>
                                <input
                                    type="text"
                                    value={birthDate}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/\D/g, '');
                                        if (val.length > 2) val = `${val.slice(0, 2)}/${val.slice(2)}`;
                                        if (val.length > 5) val = `${val.slice(0, 5)}/${val.slice(5, 9)}`;
                                        setBirthDate(val);
                                    }}
                                    placeholder="DD/MM/AAAA"
                                    maxLength={10}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <span className="text-[10px] text-slate-400 block mt-0.5">Para orações e comemoração de aniversário.</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: CONTATO & WHATSAPP */}
                    <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                            <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <h4 className="text-xs font-black uppercase tracking-wider">
                                2. Contato &amp; Envio de Comprovantes
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Telefone / WhatsApp */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Telefone / WhatsApp *
                                </label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                                    placeholder="(11) 98765-4321"
                                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                        formErrors.phone ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                    }`}
                                />
                                {formErrors.phone && <p className="text-[11px] font-bold text-rose-500 mt-1">{formErrors.phone}</p>}
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                    ✓ Comprovantes são enviados automaticamente para este WhatsApp.
                                </span>
                            </div>

                            {/* E-mail */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    E-mail
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu.email@exemplo.com"
                                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                        formErrors.email ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                    }`}
                                />
                                {formErrors.email && <p className="text-[11px] font-bold text-rose-500 mt-1">{formErrors.email}</p>}
                                <span className="text-[10px] text-slate-400 block mt-0.5">Para envio de relatórios e extratos anuais.</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: ENDEREÇO */}
                    <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                            <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <h4 className="text-xs font-black uppercase tracking-wider">
                                3. Endereço Residencial
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3.5">
                            {/* CEP */}
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    CEP
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={addressCep}
                                        onChange={handleCepChange}
                                        placeholder="00000-000"
                                        maxLength={9}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    {isSearchingCep && (
                                        <Loader2 className="w-4 h-4 text-brand-blue animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                                    )}
                                </div>
                                {cepError && <p className="text-[10px] font-bold text-rose-500 mt-0.5">{cepError}</p>}
                            </div>

                            {/* Logradouro / Rua */}
                            <div className="sm:col-span-4">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Logradouro / Rua
                                </label>
                                <input
                                    type="text"
                                    value={addressStreet}
                                    onChange={(e) => setAddressStreet(e.target.value)}
                                    placeholder="Rua, Avenida, Alameda..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* Número */}
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Número / Apto
                                </label>
                                <input
                                    type="text"
                                    value={addressNumber}
                                    onChange={(e) => setAddressNumber(e.target.value)}
                                    placeholder="Ex: 123, Bloco B"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* Cidade */}
                            <div className="sm:col-span-3">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Cidade
                                </label>
                                <input
                                    type="text"
                                    value={addressCity}
                                    onChange={(e) => setAddressCity(e.target.value)}
                                    placeholder="Ex: São Paulo"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* Estado (UF) */}
                            <div className="sm:col-span-1">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    UF
                                </label>
                                <input
                                    type="text"
                                    value={addressState}
                                    onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                                    placeholder="SP"
                                    maxLength={2}
                                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold uppercase text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: CONGREGAÇÃO & VÍNCULO */}
                    <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                            <Church className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <h4 className="text-xs font-black uppercase tracking-wider">
                                4. Congregação &amp; Vínculo
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Congregação / Igreja
                                </label>
                                <input
                                    type="text"
                                    value={congregation}
                                    onChange={(e) => setCongregation(e.target.value)}
                                    placeholder="Ex: Sede Central ou Congregação Local"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Cargo / Função / Vínculo
                                </label>
                                <input
                                    type="text"
                                    value={rolePosition}
                                    onChange={(e) => setRolePosition(e.target.value)}
                                    placeholder="Ex: Membro, Diácono, Obreiro, Visitante..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>
                    </div>
                </form>

                {/* Modal Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        form="portal-profile-form"
                        disabled={isSaving}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-amber-500 hover:from-blue-600 hover:to-amber-600 text-white text-xs font-black shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Salvando Alterações...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Salvar e Atualizar Cadastro
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
