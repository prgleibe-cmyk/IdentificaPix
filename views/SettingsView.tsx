import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { SettingsTab, Language } from '../types';
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
    CalendarIcon
} from '../components/Icons';

const PreferencesTab: React.FC = () => {
    // ... (Mantém lógica interna)
    const { openDeleteConfirmation, deleteOldReports, savedReports } = useContext(AppContext);
    const { theme, toggleTheme } = useUI();
    const { t, language, setLanguage } = useTranslation();
    const [monthsToKeep, setMonthsToKeep] = useState(6);

    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
    };

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
            icon: <DocumentDuplicateIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
            title: t('settings.dataManagement.uploadedFiles'),
            description: t('settings.dataManagement.uploadedFiles.desc'),
            color: 'blue'
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
            icon: <BrainIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
            title: t('settings.dataManagement.learnedAssociations'),
            description: t('settings.dataManagement.learnedAssociations.desc'),
            color: 'purple'
        },
    ];

    return (
        <div className="h-full overflow-y-auto pr-1 custom-scrollbar pb-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                
                <div className="space-y-4 md:space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center space-x-3 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700/50">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                                <PaintBrushIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('settings.appearance')}</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Personalize sua experiência visual</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={toggleTheme} 
                                className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand-blue dark:hover:border-brand-blue transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'} transition-colors`}>
                                        {theme === 'light' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Tema do Sistema</span>
                                        <span className="text-[10px] text-slate-500 font-medium">{theme === 'light' ? 'Modo Claro Ativo' : 'Modo Escuro Ativo'}</span>
                                    </div>
                                </div>
                                <div className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${theme === 'dark' ? 'bg-brand-blue justify-end' : 'bg-slate-300 justify-start'}`}>
                                    <div className="bg-white w-5 h-5 rounded-full shadow-sm"></div>
                                </div>
                            </button>

                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-emerald-600 dark:text-emerald-400 pointer-events-none">
                                    <GlobeAltIcon className="w-4 h-4" />
                                </div>
                                <select 
                                    onChange={(e) => handleLanguageChange(e.target.value as Language)} 
                                    value={language} 
                                    className="block w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-brand-graphite dark:text-white text-xs font-bold shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none cursor-pointer appearance-none hover:border-emerald-200 transition-all"
                                >
                                    <option value="pt">Português (Brasil)</option>
                                    <option value="en">English (US)</option>
                                    <option value="es">Español</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                        {language.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 md:space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center space-x-3 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700/50">
                            <div className="p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/50">
                                <CircleStackIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('settings.dataManagement')}</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Limpeza e manutenção de registros</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {dataManagementItems.map(item => (
                                <div key={item.type} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/50 rounded-2xl hover:border-brand-blue/30 dark:hover:border-brand-blue/30 transition-all group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm group-hover:scale-105 transition-transform`}>
                                            {item.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{item.title}</h4>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{item.description}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => openDeleteConfirmation({ type: item.type, id: item.type, name: item.title })}
                                        className="flex-shrink-0 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-red-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-100 transition-all uppercase tracking-wide shadow-sm"
                                    >
                                        {t('settings.dataManagement.clear')}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Nova Seção: Manutenção de Relatórios Antigos */}
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Manutenção de Espaço</h4>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Excluir Relatórios Antigos</span>
                                    </div>
                                    <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                        {savedReports.length} salvos
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        value={monthsToKeep} 
                                        onChange={(e) => setMonthsToKeep(parseInt(e.target.value))}
                                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                                    >
                                        <option value="3">Anteriores a 3 meses</option>
                                        <option value="6">Anteriores a 6 meses</option>
                                        <option value="12">Anteriores a 1 ano</option>
                                    </select>
                                    <button 
                                        onClick={handleCleanOldReports}
                                        className="px-4 py-1.5 bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-red-50/50 dark:bg-red-900/10 p-5 rounded-[1.5rem] border border-red-100 dark:border-red-900/30 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-100/50 dark:bg-red-900/20 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-red-200/50 transition-colors"></div>
                        
                        <div className="flex items-center justify-between relative z-10 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-red-900 dark:text-red-100 text-xs mb-0.5">{t('settings.dangerZone')}</h4>
                                    <p className="text-[10px] text-red-700 dark:text-red-300/80 leading-tight max-w-[200px]">
                                        Ação irreversível. Apaga todos os dados e reseta o sistema.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => openDeleteConfirmation({ type: 'all-data', id: 'all-data', name: 'todos os dados' })}
                                className="px-4 py-2 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-full shadow-lg shadow-red-500/20 hover:-translate-y-0.5 transition-all uppercase tracking-wide whitespace-nowrap"
                            >
                                <TrashIcon className="w-3 h-3 inline mr-1.5" />
                                {t('settings.clearAllData')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AutomationTab: React.FC = () => {
    // ... (Mantém lógica interna)
    const { 
        contributionKeywords, addContributionKeyword, removeContributionKeyword
    } = useContext(AppContext);
    const [newType, setNewType] = useState('');

    const handleAddType = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newType.trim()) return;
        addContributionKeyword(newType);
        setNewType('');
    };
    
    return (
        <div className="h-full flex flex-col pb-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                            <BanknotesIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Tipos de Contribuição</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Gerencie palavras que identificam colunas de tipo (Ex: Dízimo, Oferta)</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-800">
                        {contributionKeywords.length} ativos
                    </span>
                </div>
                
                <div className="flex-shrink-0 mb-5 space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        <PlusCircleIcon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <p>Adicione nomes que, se presentes na maioria das linhas de uma coluna, identificarão essa coluna como o "Tipo" da contribuição.</p>
                    </div>
                    <form onSubmit={handleAddType} className="relative">
                        <input
                            type="text"
                            value={newType}
                            onChange={(e) => setNewType(e.target.value)}
                            placeholder="Novo tipo (ex: MISSÃO, CAMPANHA)..."
                            className="block w-full rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white py-3 pl-5 pr-24 font-medium transition-all text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <button type="submit" disabled={!newType.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded-full shadow-md">Cadastrar</button>
                    </form>
                </div>

                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                    {contributionKeywords.map(keyword => (
                        <div key={keyword} className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold">
                            <span>{keyword}</span>
                            <button onClick={() => removeContributionKeyword(keyword)} className="p-1 rounded-full text-emerald-400 hover:text-red-500"><XMarkIcon className="w-3 h-3" /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


export const SettingsView: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsTab>('preferences');

    // TAB BUTTON COMPONENT - PILL STYLE
    const SettingsTabButton = ({ 
        id, 
        label, 
        icon: Icon, 
        colorTheme 
    }: { 
        id: SettingsTab, 
        label: string, 
        icon: any, 
        colorTheme: 'blue' | 'violet' 
    }) => {
        const isActive = activeTab === id;
        
        let activeClass = "";
        let iconClass = "";

        switch (colorTheme) {
            case 'blue':
                activeClass = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30";
                iconClass = isActive ? "text-white" : "text-blue-500";
                break;
            case 'violet':
                activeClass = "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/30";
                iconClass = isActive ? "text-white" : "text-violet-500";
                break;
        }

        const baseClass = "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700";

        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`
                    relative flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-wide
                    ${isActive ? `${activeClass} transform scale-105 z-10 border-transparent` : baseClass}
                `}
            >
                <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-1rem)] animate-fade-in gap-2 pb-1">
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-1 mt-1 min-h-[40px]">
                <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none whitespace-nowrap">{t('settings.title')}</h2>
                
                {/* TABS CONTAINER - PILL STYLE */}
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-full border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar">
                     <SettingsTabButton 
                        id="preferences"
                        label={t('settings.tabPreferences')} 
                        icon={WrenchScrewdriverIcon} 
                        colorTheme="blue"
                     />
                     <SettingsTabButton 
                        id="automation"
                        label={t('settings.tabAutomation')} 
                        icon={BrainIcon} 
                        colorTheme="violet"
                     />
                </div>
            </div>

            <div className="flex-1 min-h-0">
                 <div className="h-full w-full">
                    {activeTab === 'preferences' && <PreferencesTab />}
                    {activeTab === 'automation' && <AutomationTab />}
                 </div>
            </div>
        </div>
    );
};