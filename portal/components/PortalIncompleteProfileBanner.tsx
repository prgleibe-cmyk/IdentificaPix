import React, { useState } from 'react';
import { ContributorMockProfile } from '../types/portal';
import { checkProfileCompleteness } from '../utils/portalProfileCompleteness';
import { 
    AlertTriangle, 
    CheckCircle2, 
    Sparkles, 
    ArrowRight, 
    User, 
    Phone, 
    Mail, 
    Calendar, 
    MapPin, 
    Church,
    Edit3,
    Check,
    Clock,
    RefreshCw
} from 'lucide-react';

interface PortalIncompleteProfileBannerProps {
    contributor: ContributorMockProfile | null | undefined;
    onOpenEditModal: () => void;
    onConfirmProfile?: () => Promise<boolean | void>;
    compact?: boolean;
    className?: string;
}

export const PortalIncompleteProfileBanner: React.FC<PortalIncompleteProfileBannerProps> = ({
    contributor,
    onOpenEditModal,
    onConfirmProfile,
    compact = false,
    className = ''
}) => {
    const [isConfirmingLocally, setIsConfirmingLocally] = useState<boolean>(false);
    const [confirmedFeedback, setConfirmedFeedback] = useState<boolean>(false);

    if (!contributor || (!contributor.name && !contributor.cpf)) {
        return null;
    }

    const completeness = checkProfileCompleteness(contributor);

    const handleOneClickConfirm = async () => {
        if (isConfirmingLocally || !onConfirmProfile) return;
        setIsConfirmingLocally(true);
        try {
            await onConfirmProfile();
            setConfirmedFeedback(true);
            setTimeout(() => {
                setConfirmedFeedback(false);
            }, 3000);
        } catch (err) {
            console.error('Erro ao confirmar perfil:', err);
        } finally {
            setIsConfirmingLocally(false);
        }
    };

    const renderFieldIcon = (iconName: string) => {
        switch (iconName) {
            case 'user': return <User className="w-3 h-3 shrink-0" />;
            case 'phone': return <Phone className="w-3 h-3 shrink-0" />;
            case 'mail': return <Mail className="w-3 h-3 shrink-0" />;
            case 'calendar': return <Calendar className="w-3 h-3 shrink-0" />;
            case 'mapPin': return <MapPin className="w-3 h-3 shrink-0" />;
            case 'church': return <Church className="w-3 h-3 shrink-0" />;
            default: return <Sparkles className="w-3 h-3 shrink-0" />;
        }
    };

    // Feedback message right after 1-click confirmation
    if (confirmedFeedback) {
        return (
            <div className={`p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 animate-in fade-in zoom-in-95 duration-200 ${className}`}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-black">
                            Cadastro Confirmado com Sucesso!
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                            Seus dados estão válidos para os próximos 6 meses. Obrigado!
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // 1. SEMIANNUAL / 6-MONTH PERIODIC REVIEW BANNER
    if (completeness.needsPeriodicReview) {
        return (
            <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-sky-500/10 border-2 border-blue-500/30 dark:border-blue-500/30 shadow-sm space-y-3.5 ${className}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-slate-800 dark:text-white">
                                    Confirmação Semestral de Cadastro
                                </h4>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                                    A cada 6 meses
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                                Já faz mais de 6 meses desde a última verificação. Seus dados de contato e endereço continuam os mesmos?
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                        {onConfirmProfile && (
                            <button
                                type="button"
                                onClick={handleOneClickConfirm}
                                disabled={isConfirmingLocally}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                {isConfirmingLocally ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Tudo Certo (Confirmar)</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onOpenEditModal}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
                        >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Revisar / Atualizar</span>
                        </button>
                    </div>
                </div>

                {/* Quick snapshot of current contact info */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xs p-2.5 rounded-xl border border-blue-500/15 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Dados atuais:</span>
                    {contributor.phone && (
                        <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3 text-blue-600" /> {contributor.phone}
                        </span>
                    )}
                    {contributor.email && (
                        <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3 text-blue-600" /> {contributor.email}
                        </span>
                    )}
                    {(contributor.address_street || contributor.address_city) && (
                        <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600" /> {contributor.address_street ? `${contributor.address_street}` : ''} {contributor.address_city ? `• ${contributor.address_city}` : ''}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // 2. COMPLETE PROFILE STATUS
    if (completeness.isComplete && completeness.score >= 95) {
        return (
            <div className={`p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 ${className}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xs font-black truncate">
                            Cadastro 100% Completo &amp; Atualizado
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            Seus dados estão sincronizados para envio de comprovantes e relatórios.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onOpenEditModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 rounded-xl transition-colors shrink-0 cursor-pointer border border-emerald-500/30"
                >
                    <Edit3 className="w-3.5 h-3.5" />
                    Atualizar Dados
                </button>
            </div>
        );
    }

    // 3. COMPACT INCOMPLETE BANNER
    if (compact) {
        return (
            <div className={`p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 ${className}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-black">
                        <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-amber-900 dark:text-amber-300">
                                Cadastro Incompleto ({completeness.score}%)
                            </span>
                        </div>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 truncate">
                            {completeness.missingFields.length} {completeness.missingFields.length === 1 ? 'dado pendente' : 'dados pendentes'} para receber comprovantes.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onOpenEditModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-sm transition-transform active:scale-95 shrink-0 cursor-pointer"
                >
                    Completar
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    // 4. FULL INCOMPLETE BANNER
    return (
        <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 border-2 border-amber-500/30 dark:border-amber-500/30 shadow-sm space-y-3.5 ${className}`}>
            {/* Top Bar with score */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-800 dark:text-white">
                                Seu Cadastro está Incompleto
                            </h4>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                                {completeness.score}% Preenchido
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                            Complete seus dados para receber comprovantes automáticos no WhatsApp e e-mail.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onOpenEditModal}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-black rounded-xl shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 shrink-0 cursor-pointer"
                >
                    <Edit3 className="w-4 h-4" />
                    Completar Meu Cadastro
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200/80 dark:bg-slate-700/80 h-2 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(10, completeness.score)}%` }}
                />
            </div>

            {/* Missing Fields Badges */}
            {completeness.missingFields.length > 0 && (
                <div className="pt-1">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                        Dados que faltam você preencher ou atualizar:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {completeness.missingFields.map((field) => (
                            <button
                                key={field.key}
                                type="button"
                                onClick={onOpenEditModal}
                                title={field.hint}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                                    field.importance === 'critical'
                                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                }`}
                            >
                                {renderFieldIcon(field.iconName)}
                                <span>{field.label}</span>
                                <span className="text-[9px] opacity-75 font-semibold">
                                    {field.importance === 'critical' ? '(Obrigatório)' : '(Pendente)'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
