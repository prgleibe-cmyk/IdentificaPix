import React, { useContext, useState, useEffect } from 'react';
import { ArrowLeft, Building2, CreditCard, Landmark, PlusCircle, Tag, Users, X } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { BanksList } from '../register/BanksList';
import { ChurchesList } from '../register/ChurchesList';
import { ContributionTypesList } from '../register/ContributionTypesList';
import { PaymentMethodsList } from '../register/PaymentMethodsList';
import { ContributorsList } from '../register/ContributorsList';
import { BankModal, ChurchModal } from '../register/RegisterModals';

export type QuickRegisterEntity = 'contributors' | 'churches' | 'banks' | 'contribution' | 'payment';

interface QuickRegisterModalProps {
    entity: QuickRegisterEntity | null;
    onClose: () => void;
}

export const QuickRegisterModal: React.FC<QuickRegisterModalProps> = ({ entity, onClose }) => {
    const { banks, churches, editingBank, editingChurch, deletingItem } = useContext(AppContext);
    const { subscription, refreshSubscription, isSecondaryUser } = useAuth();
    const { t } = useTranslation();

    const [showNewBankForm, setShowNewBankForm] = useState(false);
    const [showNewChurchForm, setShowNewChurchForm] = useState(false);

    useEffect(() => {
        setShowNewBankForm(false);
        setShowNewChurchForm(false);
        if (entity === 'banks' || entity === 'churches') {
            refreshSubscription();
        }
    }, [entity, refreshSubscription]);

    const hasNestedOverlayOpen = showNewBankForm || showNewChurchForm || !!editingBank || !!editingChurch || !!deletingItem;

    useEffect(() => {
        if (!entity) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !hasNestedOverlayOpen && !document.querySelector('[data-register-overlay="true"]')) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [entity, hasNestedOverlayOpen, onClose]);

    if (!entity) return null;
    if (isSecondaryUser && (entity === 'banks' || entity === 'churches')) return null;

    const bankLimitReached = banks.length >= (subscription.maxBanks || 1);
    const churchLimitReached = churches.length >= (subscription.maxChurches || 1);

    const headerMeta: Record<QuickRegisterEntity, { title: string; subtitle: string; icon: React.ReactNode }> = {
        contributors: {
            title: 'Empresas e Pessoas',
            subtitle: 'Adicione, edite ou exclua contribuintes e favorecidos sem perder o lançamento.',
            icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" />
        },
        churches: {
            title: 'Igrejas e Congregações',
            subtitle: 'Gerencie congregações sem sair da tela de lançamento.',
            icon: <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
        },
        banks: {
            title: 'Contas e Caixas',
            subtitle: 'Cadastre, edite ou exclua contas bancárias e caixas físicos.',
            icon: <Landmark className="w-4 h-4 sm:w-5 sm:h-5" />
        },
        contribution: {
            title: 'Descrição (Entrada / Saída)',
            subtitle: 'Gerencie categorias e descrições disponíveis no lançamento.',
            icon: <Tag className="w-4 h-4 sm:w-5 sm:h-5" />
        },
        payment: {
            title: 'Formas de Recebimento / Pagamento',
            subtitle: 'Adicione, edite ou remova formas de pagamento.',
            icon: <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
        }
    };

    const meta = headerMeta[entity];

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-2.5 sm:p-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={() => {
                if (!hasNestedOverlayOpen && !document.querySelector('[data-register-overlay="true"]')) {
                    onClose();
                }
            }}
        >
            <div
                className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-elevated w-full max-w-4xl h-[min(84vh,calc(100dvh-5rem))] md:h-[min(84vh,calc(100dvh-3rem))] max-h-[780px] flex flex-col overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            {meta.icon}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                {meta.title}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {meta.subtitle}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/90 dark:border-slate-700 shadow-xs active:scale-95"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Voltar ao lançamento</span>
                            <span className="sm:hidden">Voltar</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            aria-label="Fechar painel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                {(entity === 'banks' || entity === 'churches') ? (
                    <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 overflow-hidden">
                        <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
                            <span className={`text-xs font-bold ${(entity === 'banks' ? bankLimitReached : churchLimitReached) ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {entity === 'banks'
                                    ? `Registrados: ${banks.length} / ${subscription.maxBanks || 1}`
                                    : `Registradas: ${churches.length} / ${subscription.maxChurches || 1}`}
                            </span>
                            {!(entity === 'banks' ? bankLimitReached : churchLimitReached) && (
                                <button
                                    type="button"
                                    onClick={() => entity === 'banks' ? setShowNewBankForm(true) : setShowNewChurchForm(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
                                >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    <span>{t('common.new') || 'Novo'}</span>
                                </button>
                            )}
                        </div>
                        <div className="flex-1 min-h-0">
                            {entity === 'banks' ? <BanksList /> : <ChurchesList />}
                        </div>
                    </div>
                ) : (
                    <div
                        className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar p-4 sm:p-5"
                        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                    >
                        {entity === 'contributors' && <ContributorsList embedded />}
                        {entity === 'contribution' && <ContributionTypesList embedded />}
                        {entity === 'payment' && <PaymentMethodsList embedded />}
                    </div>
                )}

                {/* Modais internos de criação (preenchem apenas o quadro sobreposto) */}
                {!isSecondaryUser && showNewBankForm && (
                    <BankModal onCancel={() => setShowNewBankForm(false)} />
                )}
                {!isSecondaryUser && showNewChurchForm && (
                    <ChurchModal onCancel={() => setShowNewChurchForm(false)} />
                )}
            </div>
        </div>
    );
};
