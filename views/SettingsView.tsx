
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
    TrashIcon
} from '../components/Icons';

const PreferencesTab: React.FC = () => {
    const { openDeleteConfirmation } = useContext(AppContext);
    const { theme, toggleTheme } = useUI();
    const { t, language, setLanguage } = useTranslation();

    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
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
                
                {/* Column 1: Appearance & Interface */}
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
                            {/* Theme Toggle */}
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

                            {/* Language Selector */}
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

                {/* Column 2: Data & Danger */}
                <div className="space-y-4 md:space-y-6">
                    {/* Data Management */}
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
                    </div>

                    {/* Danger Zone */}
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
    const { 
        customIgnoreKeywords, 
        addIgnoreKeyword, 
        removeIgnoreKeyword 
    } = useContext(AppContext);
    const { t } = useTranslation();
    const [newKeyword, setNewKeyword] = useState('');

    const handleAddKeyword = (e: React.FormEvent) => {
        e.preventDefault();
        addIgnoreKeyword(newKeyword);
        setNewKeyword('');
    };
    
    return (
        <div className="h-full flex flex-col pb-6">
            <div className="flex-1 bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col min-h-0">
                
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/50">
                            <BrainIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('settings.keywords')}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Refine a inteligência de identificação</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-md border border-purple-100 dark:border-purple-800">
                        {customIgnoreKeywords.length} regras
                    </span>
                </div>
                
                {/* Info & Input */}
                <div className="flex-shrink-0 mb-5 space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        <WrenchScrewdriverIcon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <p>{t('settings.keywords.desc')}</p>
                    </div>
                    
                    <form onSubmit={handleAddKeyword} className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <PlusCircleIcon className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="Adicionar nova palavra-chave (ex: Dízimo, Oferta)..."
                            className="block w-full rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 py-3 pl-10 pr-24 font-medium transition-all text-xs outline-none"
                        />
                        <button 
                            type="submit" 
                            disabled={!newKeyword.trim()}
                            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[10px] font-bold uppercase tracking-wide rounded-full shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                        >
                            Adicionar
                        </button>
                    </form>
                </div>

                {/* Tags List */}
                <div className="flex-1 min-h-0 border border-slate-100 dark:border-slate-700/50 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 relative flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <div className="flex flex-wrap gap-2">
                            {customIgnoreKeywords.map(keyword => (
                                <div key={keyword} className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-full text-[11px] font-bold shadow-sm group hover:border-purple-300 dark:hover:border-purple-500 transition-all">
                                    <span>{keyword}</span>
                                    <button
                                        onClick={() => removeIgnoreKeyword(keyword)}
                                        className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                        aria-label={`Remover ${keyword}`}
                                    >
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                             {customIgnoreKeywords.length === 0 && (
                                <div className="flex flex-col items-center justify-center w-full h-full min-h-[150px] text-slate-400 opacity-50">
                                    <SearchIcon className="w-8 h-8 mb-2" />
                                    <p className="text-xs font-medium">Nenhuma palavra-chave configurada.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export const SettingsView: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsTab>('preferences');

    const TabButton = ({ id, label, icon: Icon, colorTheme }: { id: SettingsTab, label: string, icon: any, colorTheme: 'blue' | 'purple' }) => {
        const isActive = activeTab === id;
        
        const themes = {
            blue: {
                active: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
                inactive: 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-300 dark:hover:bg-blue-500/10'
            },
            purple: {
                active: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
                inactive: 'text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:text-slate-400 dark:hover:text-purple-300 dark:hover:bg-purple-500/10'
            }
        };

        const style = themes[colorTheme];

        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`
                    flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border
                    ${isActive 
                        ? `${style.active} shadow-sm` 
                        : `bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 ${style.inactive}`
                    }
                `}
            >
                <Icon className={`w-3.5 h-3.5 ${isActive ? '' : 'opacity-70'}`} />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-5.5rem)] animate-fade-in gap-4 pb-2">
            {/* Header Compacto */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('settings.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1">{t('settings.subtitle')}</p>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                     <TabButton id="preferences" label={t('settings.tabPreferences')} icon={WrenchScrewdriverIcon} colorTheme="blue" />
                     <TabButton id="automation" label={t('settings.tabAutomation')} icon={BrainIcon} colorTheme="purple" />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0">
                 <div className="h-full w-full">
                    {activeTab === 'preferences' && <PreferencesTab />}
                    {activeTab === 'automation' && <AutomationTab />}
                 </div>
            </div>
        </div>
    );
};
