import React, { useState, useEffect } from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalChurch, ContributorMockProfile } from '../types/portal';
import { formatCpf, formatPhone, validateEmailVisual } from '../utils/portalFormatters';
import { Building2, CheckCircle2, User, Phone, Mail, Calendar, ShieldCheck, Sparkles, ArrowRight, Loader2, HeartHandshake } from 'lucide-react';

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
    
    // Form fields
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [congregation, setCongregation] = useState('Sede Central');
    const [city, setCity] = useState('');
    const [state, setState] = useState('SP');

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

    const handleChurchChange = (churchId: string) => {
        setSelectedChurchId(churchId);
        const found = churchesList.find(c => c.id === churchId);
        if (found) {
            setSelectedChurch(found);
        }
    };

    const handleCpfChange = (val: string) => {
        setCpf(formatCpf(val));
        if (errors.cpf) {
            setErrors(prev => ({ ...prev, cpf: '' }));
        }
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

        if (!cleanName) {
            newErrors.name = 'Nome completo é obrigatório.';
        } else if (cleanName.split(' ').length < 2) {
            newErrors.name = 'Por favor, informe seu nome e sobrenome.';
        }

        const rawCpf = cleanCpf.replace(/\D/g, '');
        if (!rawCpf) {
            newErrors.cpf = 'CPF é obrigatório para identificação segura.';
        } else if (rawCpf.length !== 11) {
            newErrors.cpf = 'CPF incompleto (deve conter 11 dígitos).';
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

        try {
            const payload = {
                church_id: activeChurchId,
                canonical_name: cleanName,
                name: cleanName,
                cpf: cleanCpf,
                phone: cleanPhone,
                whatsapp: cleanPhone,
                email: cleanEmail || undefined,
                birth_date: birthDate || undefined,
                address_city: city || undefined,
                address_state: state || undefined,
                role_position: 'Membro',
                status: 'active'
            };

            const response = await fetch('/api/v1/contributors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            let responseData: any = {};
            try {
                responseData = await response.json();
            } catch (_) {}

            // Handle already registered gracefully (Recognize member and proceed to portal)
            if (response.status === 409) {
                // If already registered, fetch profile or synthesize session
                const existingObj: ContributorMockProfile = {
                    id: responseData.existingId || 'existing-contributor',
                    name: cleanName,
                    canonical_name: cleanName,
                    cpf: cleanCpf,
                    phone: cleanPhone,
                    email: cleanEmail,
                    church_id: activeChurchId,
                    congregation: congregation || selectedChurch?.name || 'Sede Central',
                    city: city,
                    state: state,
                    isExisting: true
                };

                try {
                    localStorage.setItem('iggestor_portal_contributor', JSON.stringify(existingObj));
                    localStorage.setItem('iggestor_just_registered', 'true');
                    window.dispatchEvent(new Event('storage'));
                } catch (_) {}

                setIsSaving(false);
                const churchSlug = selectedChurch?.slug || selectedChurch?.id || 'igreja';
                onNavigate('church', { churchSlug });
                return;
            }

            if (!response.ok) {
                throw new Error(responseData.error || 'Não foi possível concluir o cadastro no momento.');
            }

            // Successfully created new contributor record
            const newContributor: ContributorMockProfile = {
                id: responseData.id || `contrib-${Date.now()}`,
                name: cleanName,
                canonical_name: cleanName,
                cpf: cleanCpf,
                phone: cleanPhone,
                email: cleanEmail,
                church_id: activeChurchId,
                congregation: congregation || selectedChurch?.name || 'Sede Central',
                city: city,
                state: state,
                isExisting: true
            };

            try {
                localStorage.setItem('iggestor_portal_contributor', JSON.stringify(newContributor));
                localStorage.setItem('iggestor_just_registered', 'true');
                window.dispatchEvent(new Event('storage'));
            } catch (_) {}

            setIsSaving(false);
            const churchSlug = selectedChurch?.slug || selectedChurch?.id || 'igreja';
            onNavigate('church', { churchSlug });
        } catch (err: any) {
            console.error('[PortalRegisterPage] Erro ao cadastrar:', err);
            setApiError(err.message || 'Ocorreu um erro ao salvar o cadastro. Tente novamente.');
            setIsSaving(false);
        }
    };

    const churchName = selectedChurch?.name || 'Igreja Local';

    return (
        <PortalContainer maxWidth="7xl">
            <div className="max-w-xl mx-auto py-4 sm:py-8 px-2">
                
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
                            Cadastro Oficial de Membro & Contribuinte
                        </span>

                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            {churchName}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                            Preencha seus dados em menos de 1 minuto para ter acesso direto ao Portal e ao Aplicativo da Igreja.
                        </p>
                    </div>
                </div>

                {/* Form Body */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-4 text-slate-800 dark:text-slate-100">
                        
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

                        {/* Name Field */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <User className="w-4 h-4 text-emerald-600" />
                                <span>Nome Completo *</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                                }}
                                placeholder="Ex: João da Silva Santos"
                                className={`w-full px-4 py-3 rounded-2xl border bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 transition-all ${
                                    errors.name 
                                        ? 'border-rose-400 focus:ring-rose-500/20' 
                                        : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/20'
                                }`}
                            />
                            {errors.name && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.name}</p>}
                        </div>

                        {/* CPF and WhatsApp Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    <span>CPF *</span>
                                </label>
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={(e) => handleCpfChange(e.target.value)}
                                    maxLength={14}
                                    placeholder="000.000.000-00"
                                    className={`w-full px-4 py-3 rounded-2xl border font-mono bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 transition-all ${
                                        errors.cpf 
                                            ? 'border-rose-400 focus:ring-rose-500/20' 
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/20'
                                    }`}
                                />
                                {errors.cpf && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.cpf}</p>}
                            </div>

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
                                    className={`w-full px-4 py-3 rounded-2xl border font-mono bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 transition-all ${
                                        errors.phone 
                                            ? 'border-rose-400 focus:ring-rose-500/20' 
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/20'
                                    }`}
                                />
                                {errors.phone && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.phone}</p>}
                            </div>
                        </div>

                        {/* Email and Birth Date Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    className={`w-full px-4 py-3 rounded-2xl border bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 transition-all ${
                                        errors.email 
                                            ? 'border-rose-400 focus:ring-rose-500/20' 
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/20'
                                    }`}
                                />
                                {errors.email && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.email}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span>Data de Nascimento (Opcional)</span>
                                </label>
                                <input
                                    type="date"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>
                        </div>

                        {/* Error Alert */}
                        {apiError && (
                            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-bold flex items-center gap-2">
                                <span>⚠️</span>
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
                            disabled={isSaving}
                            className="w-full mt-2 flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-xs sm:text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xl shadow-emerald-600/25 cursor-pointer uppercase tracking-wider disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Salvando Cadastro...</span>
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
