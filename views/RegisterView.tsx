import React, { useContext, useState, useEffect, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import {
    Building2,
    CreditCard,
    Landmark,
    PlusCircle,
    RefreshCw,
    Tag,
    Users
} from 'lucide-react';

// Subcomponents
import { RegisterTabButton } from '../components/register/RegisterTabButton';
import { BanksList } from '../components/register/BanksList';
import { ChurchesList } from '../components/register/ChurchesList';
import { ContributionTypesList } from '../components/register/ContributionTypesList';
import { PaymentMethodsList } from '../components/register/PaymentMethodsList';
import { BankModal, ChurchModal } from '../components/register/RegisterModals';
import { ContributorsList } from '../components/register/ContributorsList';

type RegisterTab = 'banks' | 'churches' | 'contribution' | 'payment' | 'contributors';

/**
 * REGISTER VIEW (REFACTORED V3)
 * Orchestrates entity management: Banks, Churches, and Meta-data.
 */
export const RegisterView: React.FC = memo(() => {
    const { t } = useTranslation();
    const { subscription, refreshSubscription, isSecondaryUser } = useAuth();
    const { banks, churches } = useContext(AppContext);

    const [showNewBankForm, setShowNewBankForm] = useState(false);
    const [showNewChurchForm, setShowNewChurchForm] = useState(false);
    const [activeTab, setActiveTab] = useState<RegisterTab>(() => isSecondaryUser ? 'contribution' : 'banks');

    useEffect(() => {
        refreshSubscription();
    }, [refreshSubscription]);

    useEffect(() => {
        if (isSecondaryUser && (activeTab === 'banks' || activeTab === 'churches')) {
            setActiveTab('contribution');
        }
    }, [isSecondaryUser, activeTab]);

    const bankLimitReached = banks.length >= (subscription.maxBanks || 1);
    const churchLimitReached = churches.length >= (subscription.maxChurches || 1);

    return (
        <div className="px-2 py-3 md:px-4 w-full max-w-7xl mx-auto space-y-4 flex flex-col min-h-full animate-fade-in pb-8 md:pb-6">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <PlusCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                {t('register.title')}
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                Gerencie contas, igrejas, descrições, formas de pagamento e empresas/pessoas.
                            </p>
                        </div>
                    </div>

                    {!isSecondaryUser && (
                        <button
                            type="button"
                            onClick={() => refreshSubscription()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/90 dark:border-slate-700 shadow-xs active:scale-95"
                            title="Atualizar limites"
                        >
                            <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            <span>Atualizar limites</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/70 p-1 rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-x-auto flex-nowrap custom-scrollbar flex-shrink-0">
                {!isSecondaryUser && (
                    <>
                        <RegisterTabButton id="banks" label={t('register.manageBanks')} icon={Landmark} colorTheme="blue" isActive={activeTab === 'banks'} onClick={setActiveTab} />
                        <RegisterTabButton id="churches" label={t('register.manageChurches')} icon={Building2} colorTheme="violet" isActive={activeTab === 'churches'} onClick={setActiveTab} />
                    </>
                )}
                <RegisterTabButton id="contribution" label="Descrição (Entrada/Saída)" icon={Tag} colorTheme="emerald" isActive={activeTab === 'contribution'} onClick={setActiveTab} />
                <RegisterTabButton id="payment" label="Formas de Receb/Pagto" icon={CreditCard} colorTheme="amber" isActive={activeTab === 'payment'} onClick={setActiveTab} />
                <RegisterTabButton id="contributors" label="Empresas/Pessoas" icon={Users} colorTheme="slate" isActive={activeTab === 'contributors'} onClick={setActiveTab} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 min-h-[420px] flex-1 flex flex-col relative overflow-hidden">

                    {/* Dynamic Headers per Tab */}
                    {!isSecondaryUser && activeTab === 'banks' && (
                        <div className="flex flex-wrap justify-between items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-900/50 flex items-center justify-center shrink-0">
                                    <Landmark className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">{t('register.manageBanks')}</h3>
                                    <span className={`text-xs font-semibold mt-0.5 ${bankLimitReached ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        Registrados: {banks.length} / {subscription.maxBanks || 1}
                                    </span>
                                </div>
                            </div>
                            {!bankLimitReached && (
                                <button
                                    type="button"
                                    onClick={() => setShowNewBankForm(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
                                >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    <span>{t('common.new')}</span>
                                </button>
                            )}
                        </div>
                    )}

                    {!isSecondaryUser && activeTab === 'churches' && (
                        <div className="flex flex-wrap justify-between items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/70 dark:border-violet-900/50 flex items-center justify-center shrink-0">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">{t('register.manageChurches')}</h3>
                                    <span className={`text-xs font-semibold mt-0.5 ${churchLimitReached ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        Registradas: {churches.length} / {subscription.maxChurches || 1}
                                    </span>
                                </div>
                            </div>
                            {!churchLimitReached && (
                                <button
                                    type="button"
                                    onClick={() => setShowNewChurchForm(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
                                >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    <span>{t('common.new')}</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Tab Views */}
                    <div className="flex-1 min-h-0">
                        {!isSecondaryUser && activeTab === 'banks' && <BanksList />}
                        {!isSecondaryUser && activeTab === 'churches' && <ChurchesList />}
                        {activeTab === 'contribution' && <ContributionTypesList />}
                        {activeTab === 'payment' && <PaymentMethodsList />}
                        {activeTab === 'contributors' && <ContributorsList />}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {!isSecondaryUser && showNewBankForm && <BankModal onCancel={() => setShowNewBankForm(false)} />}
            {!isSecondaryUser && showNewChurchForm && <ChurchModal onCancel={() => setShowNewChurchForm(false)} />}
        </div>
    );
});