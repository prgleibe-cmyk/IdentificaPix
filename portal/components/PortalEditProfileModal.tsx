import React, { useState, useEffect, useRef } from 'react';
import { ContributorMockProfile, PortalChurch } from '../types/portal';
import { checkProfileCompleteness } from '../utils/portalProfileCompleteness';
import { formatCpf, formatPhone, validateCpfVisual, validatePhoneVisual, validateEmailVisual } from '../utils/portalFormatters';
import { invalidateContributorsCache } from '../../services/contributorsCache';
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
    RefreshCw,
    Building2,
    Landmark,
    FileText,
    Camera,
    Trash2
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
    // 1. Tipo de Pessoa & Identificação
    const [personType, setPersonType] = useState<'PF' | 'PJ'>('PF');
    const [name, setName] = useState('');
    const [tradeName, setTradeName] = useState('');
    const [cpf, setCpf] = useState('');
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
    const [addressCity, setAddressCity] = useState('');
    const [addressState, setAddressState] = useState('');

    // 4. Congregação & Vínculo
    const [congregation, setCongregation] = useState('');
    const [rolePosition, setRolePosition] = useState('');

    // 5. Dados Bancários & Pix
    const [pixKey, setPixKey] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAgency, setBankAgency] = useState('');
    const [bankAccount, setBankAccount] = useState('');

    // 6. Observações
    const [notes, setNotes] = useState('');

    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const [cepError, setCepError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize or reset form state when modal opens
    useEffect(() => {
        if (isOpen && contributor) {
            const rawType = contributor.person_type === 'PJ' || (contributor.cpf && contributor.cpf.replace(/\D/g, '').length === 14) ? 'PJ' : 'PF';
            setPersonType(rawType);
            setName(contributor.name || contributor.canonical_name || '');
            setTradeName(contributor.trade_name || '');
            setCpf(contributor.cpf ? formatCpf(contributor.cpf) : '');
            setRgIe(contributor.rg_ie || '');
            setBirthDate(contributor.birth_date ? String(contributor.birth_date).split('T')[0] : '');
            setPhotoPreview(contributor.photo_url || contributor.avatarUrl || null);

            setPhone(contributor.phone || contributor.whatsapp ? formatPhone(contributor.phone || contributor.whatsapp || '') : '');
            setEmail(contributor.email || '');
            setContactPerson(contributor.contact_person || '');

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
            setRolePosition(contributor.role_position || contributor.category || '');

            setPixKey(contributor.pix_key || '');
            setBankName(contributor.bank_name || '');
            setBankAgency(contributor.bank_agency || '');
            setBankAccount(contributor.bank_account || '');

            setNotes(contributor.notes || '');

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
        person_type: personType,
        trade_name: tradeName,
        cpf,
        rg_ie: rgIe,
        phone,
        whatsapp: phone,
        email,
        contact_person: contactPerson,
        birth_date: birthDate,
        photo_url: photoPreview || undefined,
        address_cep: addressCep,
        address_street: addressStreet,
        address_number: addressNumber,
        address_city: addressCity,
        address_state: addressState,
        city: addressCity,
        state: addressState,
        congregation,
        role_position: rolePosition,
        category: rolePosition,
        pix_key: pixKey,
        bank_name: bankName,
        bank_agency: bankAgency,
        bank_account: bankAccount,
        notes,
        isExisting: contributor?.isExisting ?? true
    };

    const completeness = checkProfileCompleteness(liveProfile);

    // Photo selection handler with resize optimization
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 500;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        setPhotoPreview(dataUrl);
                    } else {
                        setPhotoPreview(ev.target?.result as string);
                    }
                };
                img.onerror = () => {
                    setPhotoPreview(ev.target?.result as string);
                };
                img.src = ev.target?.result as string;
            };
            reader.readAsDataURL(file);
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
            errors.name = personType === 'PF' ? 'Nome completo é obrigatório.' : 'Razão social é obrigatória.';
        }
        if (!cpf.trim() || !validateCpfVisual(cpf)) {
            errors.cpf = personType === 'PF' ? 'CPF válido é obrigatório.' : 'CNPJ válido é obrigatório.';
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
            const cleanCpfDigits = cpf.replace(/\D/g, '') || null;
            const cleanPhoneDigits = phone.replace(/\D/g, '') || null;
            const targetChurchId = church?.id || contributor?.church_id || '00000000-0000-0000-0000-000000000001';

            const payload: any = {
                id: contributor?.id || undefined,
                church_id: targetChurchId,
                canonical_name: name.trim().toUpperCase(),
                name: name.trim(),
                person_type: personType,
                trade_name: tradeName.trim() || null,
                cpf: cleanCpfDigits,
                rg_ie: rgIe.trim() || null,
                birth_date: birthDate.trim() || null,
                photo_url: photoPreview || null,
                phone: cleanPhoneDigits,
                whatsapp: cleanPhoneDigits,
                email: email.trim() || null,
                contact_person: contactPerson.trim() || null,
                role_position: rolePosition.trim() || 'Membro',
                category: rolePosition.trim() || null,
                address_cep: addressCep.trim() || null,
                address_street: addressStreet.trim() || null,
                address_number: addressNumber.trim() || null,
                address_city: addressCity.trim() || null,
                address_state: addressState.trim() || null,
                pix_key: pixKey.trim() || null,
                bank_name: bankName.trim() || null,
                bank_agency: bankAgency.trim() || null,
                bank_account: bankAccount.trim() || null,
                notes: notes.trim() || null,
                status: 'active'
            };

            let updatedId = contributor?.id;
            let success = false;

            // 1. Tenta endpoint de atualização de perfil do portal
            let response = await fetch('/api/v1/contributors/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const resData = await response.json().catch(() => null);
                if (resData && resData.id) updatedId = resData.id;
                success = true;
            } else if (contributor?.id) {
                // 2. Fallback para PUT /api/v1/contributors/:id
                response = await fetch(`/api/v1/contributors/${contributor.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    const resData = await response.json().catch(() => null);
                    if (resData && resData.id) updatedId = resData.id;
                    success = true;
                }
            }

            if (!success) {
                // 3. Fallback para criação direta se ainda não cadastrado
                response = await fetch('/api/v1/contributors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    const resData = await response.json().catch(() => null);
                    if (resData && resData.id) updatedId = resData.id;
                    success = true;
                } else {
                    const errJson = await response.json().catch(() => ({}));
                    throw new Error(errJson.message || errJson.error || 'Falha ao salvar dados no servidor.');
                }
            }

            const updatedProfileObj: ContributorMockProfile = {
                ...liveProfile,
                id: updatedId || contributor?.id || 'contrib_' + Date.now(),
                isExisting: true,
                church_id: targetChurchId,
                updated_at: new Date().toISOString()
            };

            // Invalida cache de contribuintes para atualizar todos os relatórios e telas do sistema
            invalidateContributorsCache();

            // Save to localStorage
            try {
                localStorage.setItem('iggestor_portal_contributor', JSON.stringify(updatedProfileObj));
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new CustomEvent('contributor-profile-updated', { detail: updatedProfileObj }));
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
                        <div className="relative group w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-blue to-amber-500 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0 overflow-hidden">
                            {photoPreview ? (
                                <img 
                                    src={photoPreview} 
                                    alt={name} 
                                    className="w-full h-full object-cover" 
                                />
                            ) : name ? (
                                name.charAt(0).toUpperCase()
                            ) : (
                                <User className="w-6 h-6" />
                            )}
                            
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                title="Alterar foto de perfil"
                            >
                                <Camera className="w-5 h-5" />
                            </button>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                                    Atualizar Dados Cadastrais
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
                                Cadastro unificado da igreja — recebimento de comprovantes no WhatsApp, relatórios e tesouraria.
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

                    {/* SECTION 1: IDENTIFICAÇÃO PESSOAL / EMPRESARIAL */}
                    <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                                <User className="w-4 h-4 text-brand-blue dark:text-blue-400" />
                                <h4 className="text-xs font-black uppercase tracking-wider">
                                    1. Identificação {personType === 'PF' ? 'Pessoal' : 'Empresarial'}
                                </h4>
                            </div>
                            {photoPreview && (
                                <button
                                    type="button"
                                    onClick={() => setPhotoPreview(null)}
                                    className="text-[11px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Remover foto
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Nome Completo / Razão Social */}
                            <div className={personType === 'PJ' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    {personType === 'PF' ? 'Nome Completo *' : 'Razão Social Completa *'}
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={personType === 'PF' ? 'Ex: João da Silva Santos' : 'Ex: Empresa Distribuidora Ltda'}
                                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                        formErrors.name ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                    }`}
                                />
                                {formErrors.name && <p className="text-[11px] font-bold text-rose-500 mt-1">{formErrors.name}</p>}
                            </div>

                            {/* Nome Fantasia (PJ) */}
                            {personType === 'PJ' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Nome Fantasia / Comercial
                                    </label>
                                    <input
                                        type="text"
                                        value={tradeName}
                                        onChange={(e) => setTradeName(e.target.value)}
                                        placeholder="Ex: Comercial Silva"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            )}

                            {/* CPF / CNPJ */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    {personType === 'PF' ? 'CPF *' : 'CNPJ *'}
                                </label>
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                                    placeholder={personType === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                        formErrors.cpf ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                    }`}
                                />
                                {formErrors.cpf && <p className="text-[11px] font-bold text-rose-500 mt-1">{formErrors.cpf}</p>}
                            </div>

                            {/* RG / IE */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    {personType === 'PF' ? 'RG (Registro Geral)' : 'Inscrição Estadual (IE)'}
                                </label>
                                <input
                                    type="text"
                                    value={rgIe}
                                    onChange={(e) => setRgIe(e.target.value)}
                                    placeholder={personType === 'PF' ? '00.000.000-0' : 'Isento ou Nº IE'}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* Data de Nascimento / Fundação */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    {personType === 'PF' ? 'Data de Nascimento' : 'Data de Fundação'}
                                </label>
                                <input
                                    type="date"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* Foto de Perfil / Logo */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Foto de Perfil / Logo
                                </label>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full px-3.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-blue bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                >
                                    <Camera className="w-4 h-4 text-brand-blue" />
                                    <span>{photoPreview ? 'Alterar Imagem' : 'Selecionar Imagem'}</span>
                                </button>
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

                            {/* Representante / Contato PJ */}
                            {personType === 'PJ' && (
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Pessoa de Contato / Representante Legal
                                    </label>
                                    <input
                                        type="text"
                                        value={contactPerson}
                                        onChange={(e) => setContactPerson(e.target.value)}
                                        placeholder="Ex: Carlos Oliveira (Gerente / Responsável)"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 3: ENDEREÇO */}
                    <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                            <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <h4 className="text-xs font-black uppercase tracking-wider">
                                3. Endereço Residencial / Comercial
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
                                    Número / Bairro
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
                                4. Congregação &amp; Vínculo Ministerial
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Congregação / Setor
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
                                    {personType === 'PF' ? 'Vínculo / Cargo Eclesiástico' : 'Categoria / Ramo de Atuação'}
                                </label>
                                <input
                                    type="text"
                                    value={rolePosition}
                                    onChange={(e) => setRolePosition(e.target.value)}
                                    placeholder={personType === 'PF' ? "Ex: Membro, Diácono, Obreiro, Pastor, Doador..." : "Ex: Prestador de Serviços, Fornecedor, Tecnologia..."}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 5: DADOS BANCÁRIOS & CHAVE PIX */}
                    <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                            <Landmark className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            <h4 className="text-xs font-black uppercase tracking-wider">
                                5. Dados Bancários &amp; Chave Pix (Opcional)
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Chave Pix Principal
                                </label>
                                <input
                                    type="text"
                                    value={pixKey}
                                    onChange={(e) => setPixKey(e.target.value)}
                                    placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Banco / Instituição Financeira
                                </label>
                                <input
                                    type="text"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    placeholder="Ex: Nubank, Itaú, Banco do Brasil, Bradesco..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Agência Bancária
                                </label>
                                <input
                                    type="text"
                                    value={bankAgency}
                                    onChange={(e) => setBankAgency(e.target.value)}
                                    placeholder="0000"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Conta Corrente / Poupança
                                </label>
                                <input
                                    type="text"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                    placeholder="00000-0"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 6: OBSERVAÇÕES */}
                    <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            <h4 className="text-xs font-black uppercase tracking-wider">
                                6. Observações / Anotações
                            </h4>
                        </div>

                        <div>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Informações adicionais para a secretaria ou tesouraria..."
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                            />
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

