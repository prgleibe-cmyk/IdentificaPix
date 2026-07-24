import React, { useState } from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { IdentificationType, ContributorMockProfile } from '../types/portal';
import { 
    formatCpf, 
    formatPhone, 
    validateCpfVisual, 
    validatePhoneVisual, 
    validateEmailVisual 
} from '../utils/portalFormatters';
import { 
    ShieldCheck, 
    CheckCircle2, 
    BookOpen, 
    Heart, 
    Sparkles, 
    User, 
    Phone, 
    Mail, 
    Lock, 
    Building2, 
    ArrowRight,
    Search,
    RefreshCw
} from 'lucide-react';

const logoImg = '/logo.png?v=15';

interface PortalIdentifyStepProps {
    identificationType: IdentificationType;
    identificationValue: string;
    contributor: ContributorMockProfile;
    mockSearchFound: boolean;
    isSearching?: boolean;
    isSaving?: boolean;
    apiError?: string | null;
    onTypeChange: (type: IdentificationType) => void;
    onValueChange: (value: string) => void;
    onPerformSearch: () => Promise<boolean>;
    onUpdateContributor: (updates: Partial<ContributorMockProfile>) => void;
    onSaveContributor: () => Promise<boolean>;
    onMockSearchToggle: (found: boolean) => void;
    onContinue: () => void;
}

export const PortalIdentifyStep: React.FC<PortalIdentifyStepProps> = ({
    identificationType,
    identificationValue,
    contributor,
    mockSearchFound,
    isSearching = false,
    isSaving = false,
    apiError,
    onTypeChange,
    onValueChange,
    onPerformSearch,
    onUpdateContributor,
    onSaveContributor,
    onMockSearchToggle,
    onContinue
}) => {
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [inputError, setInputError] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        let formatted = raw;

        if (identificationType === 'cpf') {
            formatted = formatCpf(raw);
        } else if (identificationType === 'phone') {
            formatted = formatPhone(raw);
        }

        onValueChange(formatted);
        if (inputError) setInputError(null);
    };

    const handleSearchAndContinue = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!identificationValue.trim()) {
            setInputError('Por favor, informe seu CPF, Telefone ou E-mail para entrar.');
            return;
        }

        if (identificationType === 'cpf' && !validateCpfVisual(identificationValue)) {
            setInputError('CPF inválido. Digite os 11 dígitos numéricos.');
            return;
        }

        if (identificationType === 'phone' && !validatePhoneVisual(identificationValue)) {
            setInputError('Telefone inválido. Digite um número com DDD (10 ou 11 dígitos).');
            return;
        }

        if (identificationType === 'email' && !validateEmailVisual(identificationValue)) {
            setInputError('E-mail em formato inválido.');
            return;
        }

        setInputError(null);

        const found = await onPerformSearch();
        if (found) {
            // Contributor identified/logged in successfully!
            // Show confirmation screen or continue smoothly
        } else {
            // Not found in database -> Show quick register form pre-filled with the identifier
            setShowRegisterForm(true);
            if (identificationType === 'cpf') {
                onUpdateContributor({ cpf: identificationValue });
            } else if (identificationType === 'phone') {
                onUpdateContributor({ phone: identificationValue });
            } else if (identificationType === 'email') {
                onUpdateContributor({ email: identificationValue });
            }
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!contributor.name.trim()) errors.name = 'Nome completo é obrigatório.';
        if (!contributor.cpf.trim() || !validateCpfVisual(contributor.cpf)) {
            errors.cpf = 'CPF válido é obrigatório.';
        }
        if (!contributor.phone.trim() || !validatePhoneVisual(contributor.phone)) {
            errors.phone = 'Telefone/WhatsApp válido é obrigatório.';
        }
        if (!contributor.email.trim() || !validateEmailVisual(contributor.email)) {
            errors.email = 'E-mail válido é obrigatório.';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setFormErrors({});

        const success = await onSaveContributor();
        if (success) {
            onContinue();
        }
    };

    // --- LEFT COLUMN: HERO & BIBLICAL CONSCIENTIZATION ---
    const renderHeroSection = () => (
        <div className="space-y-6 lg:pr-4">
            {/* Header Brand */}
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl"></div>
                    <img 
                        src={logoImg} 
                        className="h-14 sm:h-16 w-auto object-contain drop-shadow-md" 
                        alt="Logo IgGestor" 
                    />
                </div>
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                        IgGestor
                    </h2>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-blue dark:text-blue-400 block">
                        Portal Oficial do Contribuinte
                    </span>
                </div>
            </div>

            {/* Certified Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">
                    Plataforma Segura • Certificada
                </span>
            </div>

            {/* Title */}
            <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 dark:text-white leading-[1.15] tracking-tight">
                    Fidelidade, Gratidão &amp; <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue via-indigo-600 to-amber-600 dark:from-blue-400 dark:to-amber-400">
                        Adoração a Deus.
                    </span>
                </h1>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    As contribuições e entregas voluntárias são atos de culto, consagração e amor ao Senhor, reconhecendo que d&apos;Ele vem toda a nossa provisão.
                </p>
            </div>

            {/* Sound Biblical Verses Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-500/5 via-blue-500/5 to-slate-100/50 dark:from-slate-800/80 dark:to-slate-900/80 border border-amber-500/20 dark:border-slate-700/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
                    <BookOpen className="w-5 h-5 shrink-0" />
                    <h3 className="text-xs font-black uppercase tracking-wider">
                        Fundamentos Bíblicos do Contribuir
                    </h3>
                </div>

                <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    <div className="pl-3 border-l-2 border-amber-500/60 space-y-1">
                        <p className="italic">
                            &ldquo;Honra ao Senhor com os teus bens, e com a primeira parte de todos os teus ganhos; E se encherão os teus celeiros, e transbordarão de vinho os teus lagares.&rdquo;
                        </p>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">
                            — Provérbios 3:9-10
                        </span>
                    </div>

                    <div className="pl-3 border-l-2 border-brand-blue/60 space-y-1">
                        <p className="italic">
                            &ldquo;Cada um contribua segundo propôs no seu coração; não com tristeza, ou por necessidade; porque Deus ama ao que dá com alegria.&rdquo;
                        </p>
                        <span className="text-[10px] font-bold text-brand-blue dark:text-blue-400 block">
                            — 2 Coríntios 9:7
                        </span>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Contribua com alegria e inteireza de coração. Suas contribuições sustentam o Reino de Deus, fortalecem a obra da igreja local e impulsionam missões que levam o Evangelho além das fronteiras, alcançando vidas até os confins da terra, em gesto de gratidão, culto e louvor ao Senhor.
                    </p>
                </div>
            </div>

            {/* Trust Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                        <Heart className="w-4 h-4" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Gratidão &amp; Culto</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Atitude voluntária e louvor</span>
                    </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Obra Local &amp; Global</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Igreja e confins da terra</span>
                    </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
                        <Lock className="w-4 h-4" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Segurança</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Dados protegidos</span>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- RIGHT COLUMN: LOGIN / IDENTIFICATION FORMS ---
    return (
        <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Hero / Left column */}
                <div className="lg:col-span-7 xl:col-span-7">
                    {renderHeroSection()}
                </div>

                {/* Form / Right column */}
                <div className="lg:col-span-5 xl:col-span-5">
                    {/* STATE 1: ALREADY LOGGED IN / IDENTIFIED */}
                    {mockSearchFound && contributor.name ? (
                        <PortalCard
                            title="Bem-vindo(a) de Volta!"
                            subtitle="Sua identificação como contribuinte foi confirmada no sistema."
                            className="shadow-xl border-slate-200 dark:border-slate-700"
                        >
                            <div className="space-y-6">
                                <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-slate-700 flex flex-col items-center text-center space-y-3">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-blue to-amber-500 text-white flex items-center justify-center font-black text-2xl shadow-md ring-4 ring-white dark:ring-slate-800 shrink-0">
                                        {contributor.name ? contributor.name.charAt(0).toUpperCase() : 'C'}
                                    </div>

                                    <div className="space-y-1 w-full">
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Contribuinte Conectado
                                        </span>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-white pt-1 truncate">
                                            {contributor.name}
                                        </h3>
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            Congregação: <span className="text-slate-700 dark:text-slate-200">{contributor.congregation || 'Sede Central'}</span>
                                        </p>
                                    </div>

                                    <div className="w-full pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-300 text-left">
                                        {contributor.cpf && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] text-slate-400">CPF:</span>
                                                <span className="font-bold">{contributor.cpf}</span>
                                            </div>
                                        )}
                                        {contributor.phone && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] text-slate-400">Telefone:</span>
                                                <span className="font-bold">{contributor.phone}</span>
                                            </div>
                                        )}
                                        {contributor.email && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] text-slate-400">E-mail:</span>
                                                <span className="font-bold truncate max-w-[180px]">{contributor.email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2.5 pt-1">
                                    <PortalButton
                                        variant="primary"
                                        size="md"
                                        className="w-full py-3 text-sm font-bold shadow-md bg-gradient-to-r from-brand-blue to-amber-500 hover:from-blue-600 hover:to-amber-600"
                                        onClick={onContinue}
                                    >
                                        Continuar para Contribuição &rarr;
                                    </PortalButton>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            onMockSearchToggle(false);
                                            onValueChange('');
                                            setShowRegisterForm(false);
                                        }}
                                        className="w-full py-2 text-xs font-bold text-slate-500 hover:text-brand-blue dark:text-slate-400 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" /> Entrar com outro cadastro
                                    </button>
                                </div>
                            </div>
                        </PortalCard>
                    ) : showRegisterForm ? (
                        /* STATE 2: REGISTRATION FORM (NEW CONTRIBUTOR) */
                        <PortalCard
                            title="Completar Cadastro"
                            subtitle="Informe seus dados para registrar e vincular suas ofertas com transparência."
                            className="shadow-xl border-slate-200 dark:border-slate-700"
                        >
                            <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                                        Seus dados serão vinculados com segurança ao sistema da igreja para emissão dos comprovantes.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Nome Completo *
                                    </label>
                                    <div className="relative">
                                        <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            autoFocus
                                            value={contributor.name}
                                            onChange={(e) => onUpdateContributor({ name: e.target.value })}
                                            placeholder="Digite seu nome completo"
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                                formErrors.name ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                            }`}
                                        />
                                    </div>
                                    {formErrors.name && <p className="text-xs font-semibold text-rose-500 mt-1">{formErrors.name}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        CPF *
                                    </label>
                                    <input
                                        type="text"
                                        value={contributor.cpf}
                                        onChange={(e) => onUpdateContributor({ cpf: formatCpf(e.target.value) })}
                                        placeholder="000.000.000-00"
                                        className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                            formErrors.cpf ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                        }`}
                                    />
                                    {formErrors.cpf && <p className="text-xs font-semibold text-rose-500 mt-1">{formErrors.cpf}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Telefone / WhatsApp *
                                    </label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={contributor.phone}
                                            onChange={(e) => onUpdateContributor({ phone: formatPhone(e.target.value) })}
                                            placeholder="(11) 98765-4321"
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                                formErrors.phone ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                            }`}
                                        />
                                    </div>
                                    {formErrors.phone && <p className="text-xs font-semibold text-rose-500 mt-1">{formErrors.phone}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Endereço de E-mail *
                                    </label>
                                    <div className="relative">
                                        <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="email"
                                            value={contributor.email}
                                            onChange={(e) => onUpdateContributor({ email: e.target.value })}
                                            placeholder="seu.email@exemplo.com"
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 ${
                                                formErrors.email ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                            }`}
                                        />
                                    </div>
                                    {formErrors.email && <p className="text-xs font-semibold text-rose-500 mt-1">{formErrors.email}</p>}
                                </div>

                                {apiError && (
                                    <p className="text-xs font-semibold text-rose-500 mt-1 flex items-center gap-1">
                                        ⚠️ {apiError}
                                    </p>
                                )}

                                <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowRegisterForm(false)}
                                        className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-2 cursor-pointer"
                                    >
                                        &larr; Voltar
                                    </button>

                                    <PortalButton
                                        variant="primary"
                                        size="md"
                                        className="w-full sm:w-auto px-6 py-2.5 font-bold text-sm shadow-sm bg-gradient-to-r from-brand-blue to-amber-500 hover:from-blue-600 hover:to-amber-600"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? 'Salvando...' : 'Salvar e Continuar &rarr;'}
                                    </PortalButton>
                                </div>
                            </form>
                        </PortalCard>
                    ) : (
                        /* STATE 3: IDENTIFICATION SEARCH LOGIN FORM */
                        <PortalCard
                            title="Identificação do Contribuinte"
                            subtitle="Digite seu CPF, Telefone ou E-mail para acessar o portal de ofertas."
                            className="shadow-xl border-slate-200 dark:border-slate-700"
                        >
                            <form onSubmit={handleSearchAndContinue} className="space-y-5">
                                {/* Type selector tabs */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                        Método de Entrada
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { onTypeChange('cpf'); setInputError(null); }}
                                            className={`py-2.5 px-2 rounded-xl border font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                                                identificationType === 'cpf'
                                                    ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            🪪 CPF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { onTypeChange('phone'); setInputError(null); }}
                                            className={`py-2.5 px-2 rounded-xl border font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                                                identificationType === 'phone'
                                                    ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            📱 Celular
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { onTypeChange('email'); setInputError(null); }}
                                            className={`py-2.5 px-2 rounded-xl border font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                                                identificationType === 'email'
                                                    ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            ✉️ E-mail
                                        </button>
                                    </div>
                                </div>

                                {/* Dynamic Input */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        {identificationType === 'cpf' && 'Número do CPF'}
                                        {identificationType === 'phone' && 'Celular / WhatsApp com DDD'}
                                        {identificationType === 'email' && 'E-mail Cadastrado'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={identificationType === 'email' ? 'email' : 'text'}
                                            value={identificationValue}
                                            onChange={handleInputChange}
                                            placeholder={
                                                identificationType === 'cpf' ? '000.000.000-00' :
                                                identificationType === 'phone' ? '(11) 98765-4321' :
                                                'seu.email@exemplo.com'
                                            }
                                            className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${
                                                inputError 
                                                    ? 'border-rose-500 focus:ring-rose-500/20' 
                                                    : 'border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-blue-500/20'
                                            }`}
                                        />
                                    </div>
                                    {inputError && (
                                        <p className="text-xs font-semibold text-rose-500 mt-1.5 flex items-center gap-1">
                                            ⚠️ {inputError}
                                        </p>
                                    )}
                                    {apiError && (
                                        <p className="text-xs font-semibold text-rose-500 mt-1.5 flex items-center gap-1">
                                            ⚠️ {apiError}
                                        </p>
                                    )}
                                </div>

                                {/* Realtime Security Info */}
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-tight">
                                        Sua identificação é encriptada e validada em tempo real com o sistema financeiro da igreja.
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <PortalButton
                                        variant="primary"
                                        size="md"
                                        className="w-full py-3 text-sm font-bold shadow-md bg-gradient-to-r from-brand-blue to-amber-500 hover:from-blue-600 hover:to-amber-600 cursor-pointer"
                                        disabled={isSearching}
                                    >
                                        {isSearching ? (
                                            <div className="flex items-center gap-2 justify-center">
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Buscando Cadastro...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 justify-center">
                                                <span>Entrar e Continuar</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        )}
                                    </PortalButton>
                                </div>
                            </form>
                        </PortalCard>
                    )}
                </div>
            </div>
        </div>
    );
};

