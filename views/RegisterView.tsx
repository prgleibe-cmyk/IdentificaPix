import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { 
    BuildingOfficeIcon, 
    UserIcon, 
    ArrowsRightLeftIcon, 
    BanknotesIcon, 
    PlusCircleIcon, 
    CreditCardIcon 
} from '../components/Icons';

// Subcomponents
import { RegisterTabButton } from '../components/register/RegisterTabButton';
import { BanksList } from '../components/register/BanksList';
import { ChurchesList } from '../components/register/ChurchesList';
import { ContributionTypesList } from '../components/register/ContributionTypesList';
import { PaymentMethodsList } from '../components/register/PaymentMethodsList';
import { BankModal, ChurchModal } from '../components/register/RegisterModals';

type RegisterTab = 'banks' | 'churches' | 'contribution' | 'payment';

/**
 * REGISTER VIEW (REFACTORED V3)
 * Orchestrates entity management: Banks, Churches, and Meta-data.
 */
export const RegisterView: React.FC = () => {
    const { t } = useTranslation();
    const { subscription, refreshSubscription } = useAuth(); 
    const { banks, churches } = useContext(AppContext);
    
    const [showNewBankForm, setShowNewBankForm] = useState(false);
    const [showNewChurchForm, setShowNewChurchForm] = useState(false);
    const [activeTab, setActiveTab] = useState<RegisterTab>('banks');

    useEffect(() => {
        refreshSubscription();
    }, [refreshSubscription]);

    const bankLimitReached = banks.length >= (subscription.maxBanks || 1);
    const churchLimitReached = churches.length >= (subscription.maxChurches || 1);

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            {/* Header Section */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mt-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight">{t('register.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px]">{t('register.subtitle')}</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-full border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
                    <RegisterTabButton id="banks" label={t('register.manageBanks')} icon={BuildingOfficeIcon} colorTheme="blue" isActive={activeTab === 'banks'} onClick={setActiveTab} />
                    <RegisterTabButton id="churches" label={t('register.manageChurches')} icon={UserIcon} colorTheme="violet" isActive={activeTab === 'churches'} onClick={setActiveTab} />
                    <RegisterTabButton id="contribution" label="Tipo Contribuição" icon={BanknotesIcon} colorTheme="emerald" isActive={activeTab === 'contribution'} onClick={setActiveTab} />
                    <RegisterTabButton id="payment" label="Forma Recebimento" icon={CreditCardIcon} colorTheme="amber" isActive={activeTab === 'payment'} onClick={setActiveTab} />
                </div>

                <button 
                    onClick={() => refreshSubscription()} 
                    className="hidden md:block p-1.5 text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" 
                    title="Atualizar limites"
                >
                    <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                </button>
            </div>
            
            {/* Main Content Area */}
            <div className="flex-1 min-h-0">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 h-full flex flex-col hover:shadow-soft transition-all duration-500 relative overflow-hidden animate-fade-in-up">
                    
                    {/* Dynamic Headers per Tab */}
                    {activeTab === 'banks' && (
                        <div className="flex justify-between items-center mb-6 flex-shrink-0 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-brand-blue dark:text-blue-400 border border-blue-100 dark:border-blue-800"><BuildingOfficeIcon className="w-6 h-6" /></div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">{t('register.manageBanks')}</h3>
                                    <span className={`text-xs font-bold mt-1 ${bankLimitReached ? 'text-red-500' : 'text-emerald-500'}`}>Registrados: {banks.length} / {subscription.maxBanks || 1}</span>
                                </div>
                            </div>
                            {!bankLimitReached && (
                                <button onClick={() => setShowNewBankForm(true)} className="flex items-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 rounded-full shadow-md shadow-blue-500/30 hover:-translate-y-0.5 transition-all tracking-wide uppercase">
                                    <PlusCircleIcon className="w-3.5 h-3.5" /><span>{t('common.new')}</span>
                                </button>
                            )}
                        </div>
                    )}

                    {activeTab === 'churches' && (
                        <div className="flex justify-between items-center mb-6 flex-shrink-0 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800"><UserIcon className="w-6 h-6" /></div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">{t('register.manageChurches')}</h3>
                                    <span className={`text-xs font-bold mt-1 ${churchLimitReached ? 'text-red-500' : 'text-emerald-500'}`}>Registradas: {churches.length} / {subscription.maxChurches || 1}</span>
                                </div>
                            </div>
                            {!churchLimitReached && (
                                <button onClick={() => setShowNewChurchForm(true)} className="flex items-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-indigo-700 to-indigo-500 hover:from-indigo-800 hover:to-indigo-600 rounded-full shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 transition-all tracking-wide uppercase">
                                    <PlusCircleIcon className="w-3.5 h-3.5" /><span>{t('common.new')}</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Tab Views */}
                    <div className="flex-1 min-h-0">
                        {activeTab === 'banks' && <BanksList />}
                        {activeTab === 'churches' && <ChurchesList />}
                        {activeTab === 'contribution' && <ContributionTypesList />}
                        {activeTab === 'payment' && <PaymentMethodsList />}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showNewBankForm && <BankModal onCancel={() => setShowNewBankForm(false)} />}
            {showNewChurchForm && <ChurchModal onCancel={() => setShowNewChurchForm(false)} />}
        </div>
    );
};