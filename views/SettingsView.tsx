
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { SettingsTab, Language } from '../types';
import { ContractTermsModal } from '../components/modals/ContractTermsModal';
import { 
    BrainIcon, 
    SearchIcon, 
    PaintBrushIcon, 
    CircleStackIcon, 
    ExclamationTriangleIcon,
    MoonIcon,
    SunIcon,
    DocumentDuplicateIcon,
    ArrowsRightLeftIcon,
    XMarkIcon,
    WrenchScrewdriverIcon,
    PlusCircleIcon,
    GlobeAltIcon,
    TrashIcon,
    BanknotesIcon,
    CalendarIcon,
    DocumentTextIcon,
    ShieldCheckIcon
} from '../components/Icons';

const PreferencesTab: React.FC = () => {
    const { openDeleteConfirmation, deleteOldReports, savedReports } = useContext(AppContext);
    const { theme, toggleTheme } = useUI();
    const { t } = useTranslation();
    const [monthsToKeep, setMonthsToKeep] = useState(6);
    const [isTermsOpen, setIsTermsOpen] = useState(false);

    const handleCleanOldReports = () => {
        const date = new Date();
        date.setMonth(date.getMonth() - monthsToKeep);
        if (window.confirm(`Isso excluirá TODOS os relatórios anteriores a ${date.toLocaleDateString()}. Confirmar?`)) {
            deleteOldReports(date);
        }
    };

    const dataManagementItems = [
        {
            type: 'uploaded-files' as const,
            icon: <DocumentDuplicateIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />,
            title: t('settings.dataManagement.uploadedFiles'),
            description: t('settings.dataManagement.uploadedFiles.desc'),
            color: 'orange'
        },
        {
            type: 'match-results' as const,
            icon: <ArrowsRightLeftIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
            title: t('settings.dataManagement.matchResults'),
            description: t('settings.dataManagement.matchResults.desc'),
            color: 'emerald'
        },
        {
            type: 'learned-associations' as const,
            icon: <BrainIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
            title: t('settings.dataManagement.learnedAssociations'),
            description: t('settings.dataManagement.learnedAssociations.desc'),
            color: 'amber'
        },
    ];

    return (
        <div className="h-full overflow-y-auto pr-1 custom-scrollbar pb-6" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
                
                <div className="space-y-4 md:space-y-5">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800">
                        <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center shrink-0">
                                <PaintBrushIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{t('settings.appearance')}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Personalize sua experiência visual</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={toggleTheme} 
                                className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-orange-500 dark:hover:border-orange-500 transition-colors group cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-orange-500/20 text-orange-400'} transition-colors`}>
                                        {theme === 'light' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">Tema do Sistema</span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{theme === 'light' ? 'Modo Claro Ativo' : 'Modo Escuro Ativo'}</span>
                                    </div>
                                </div>
                                <div className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${theme === 'dark' ? 'bg-orange-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                                    <div className="bg-white w-5 h-5 rounded-full shadow-xs"></div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Legal & Terms Card */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800">
                        <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center shrink-0">
                                <ShieldCheckIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Licença e Propriedade</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Termos legais, LGPD e dados do proprietário</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsTermsOpen(true)}
                            className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-orange-500 dark:hover:border-orange-500 transition-colors group cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-900/40">
                                    <DocumentTextIcon className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">Ver Termos de Uso e Licença</span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Gleibe Oliveira da Silva (Proprietário PF)</span>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 group-hover:translate-x-0.5 transition-transform">→</span>
                        </button>
                    </div>
                </div>

                <ContractTermsModal
                    isOpen={isTermsOpen}
                    onClose={() => setIsTermsOpen(false)}
                />

                <div className="space-y-4 md:space-y-5">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800">
                        <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-9 h-9 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center shrink-0">
                                <CircleStackIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{t('settings.dataManagement')}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Limpeza e manutenção de registros</p>
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            {dataManagementItems.map(item => (
                                <div key={item.type} className="flex items-center justify-between p-3 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 transition-colors group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs shrink-0">
                                            {item.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">{item.title}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">{item.description}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => openDeleteConfirmation({ type: item.type, id: item.type, name: item.title })}
                                        className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-200 transition-colors shadow-2xs cursor-pointer"
                                    >
                                        {t('settings.dataManagement.clear')}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Manutenção de Espaço</h4>
                            <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Excluir Relatórios Antigos</span>
                                    </div>
                                    <span className="text-[11px] font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md tabular-nums">
                                        {savedReports.length} salvos
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        value={monthsToKeep} 
                                        onChange={(e) => setMonthsToKeep(parseInt(e.target.value))}
                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                                    >
                                        <option value="3">Anteriores a 3 meses</option>
                                        <option value="6">Anteriores a 6 meses</option>
                                        <option value="12">Anteriores a 1 ano</option>
                                    </select>
                                    <button 
                                        onClick={handleCleanOldReports}
                                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-rose-50/60 dark:bg-rose-950/20 p-5 rounded-xl border border-rose-200/80 dark:border-rose-900/40">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-rose-100 dark:bg-rose-900/40 rounded-lg text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-rose-900 dark:text-rose-200 text-xs mb-0.5">{t('settings.dangerZone')}</h4>
                                    <p className="text-[11px] text-rose-700 dark:text-rose-300/80 leading-tight max-w-[240px]">
                                        Ação irreversível. Apaga todos os dados e reseta o sistema.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => openDeleteConfirmation({ type: 'all-data', id: 'all-data', name: 'todos os dados' })}
                                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                                {t('settings.clearAllData')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SettingsView: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col min-h-full gap-4 pb-8 md:pb-4">
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                        <WrenchScrewdriverIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{t('settings.title')}</h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Preferências visuais, termos legais e manutenção de dados</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white shadow-xs text-xs font-semibold">
                        <WrenchScrewdriverIcon className="w-3.5 h-3.5 text-white" />
                        <span>{t('settings.tabPreferences')}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <div className="h-full w-full">
                    <PreferencesTab />
                </div>
            </div>
        </div>
    );
};
