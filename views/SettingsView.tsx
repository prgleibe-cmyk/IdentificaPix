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
} from '../components/Icons';

const TabButton: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button 
        onClick={onClick} 
        className={`px-5 py-2 text-xs font-bold rounded-xl transition-all duration-200 flex-1 sm:flex-none text-center ${ isActive ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
    >
        {label}
    </button>
);

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
            icon: <DocumentDuplicateIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />,
            title: t('settings.dataManagement.uploadedFiles'),
            description: t('settings.dataManagement.uploadedFiles.desc'),
        },
        {
            type: 'match-results' as const,
            icon: <ArrowsRightLeftIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />,
            title: t('settings.dataManagement.matchResults'),
            description: t('settings.dataManagement.matchResults.desc'),
        },
    ];

    return (
        <div className="h-full overflow-y-auto pr-2 custom-scrollbar pb-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                
                {/* Column 1: Appearance */}
                <div className="space-y-4">
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-700 h-full">
                        <div className="flex items-center space-x-3 mb-5 pb-3 border-b border-slate-200/60 dark:border-slate-700">
                            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg text-white shadow-md">
                                <PaintBrushIcon className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('settings.appearance')}</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider opacity-80">{t('settings.theme')}</label>
                                <button onClick={toggleTheme} className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-200 group">
                                    <span className="flex items-center font-bold text-sm text-slate-700 dark:text-slate-200">
                                        {theme === 'light' ? 
                                            <><SunIcon className="w-4 h-4 mr-3 text-yellow-500" /> Modo Claro</> : 
                                            <><MoonIcon className="w-4 h-4 mr-3 text-blue-400" /> Modo Escuro</>
                                        }
                                    </span>
                                    <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                </button>
                            </div>
                            <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider opacity-80">{t('settings.language')}</label>
                                <select onChange={(e) => handleLanguageChange(e.target.value as Language)} value={language} className="block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 font-medium transition-all hover:border-slate-300 cursor-pointer text-sm">
                                    <option value="pt">🇧🇷 Português</option>
                                    <option value="en">🇺🇸 English</option>
                                    <option value="es">🇪🇸 Español</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Data Management & Danger Zone */}
                <div className="space-y-4">
                    {/* Data Management */}
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-700">
                        <div className="flex items-center space-x-3 mb-5 pb-3 border-b border-slate-200/60 dark:border-slate-700">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg text-white shadow-md">
                                <CircleStackIcon className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('settings.dataManagement')}</h3>
                        </div>
                        <div className="space-y-3">
                            {dataManagementItems.map(item => (
                                <div key={item.type} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 group">
                                    <div className="flex items-start space-x-3 mb-3 sm:mb-0">
                                        <div className="mt-0.5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors">
                                            {item.icon}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{item.description}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => openDeleteConfirmation({ type: item.type, id: item.type, name: item.title })}
                                        className="flex-shrink-0 px-3 py-1.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors uppercase tracking-wide"
                                    >
                                        {t('settings.dataManagement.clear')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="p-5 border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 rounded-2xl relative overflow-hidden group hover:border-red-300 dark:hover:border-red-800 transition-colors duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-red-200 dark:group-hover:bg-red-900/30 transition-colors"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="flex-shrink-0 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="flex-grow">
                                <h4 className="font-bold text-red-800 dark:text-red-200 text-sm">{t('settings.dangerZone')}</h4>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                                    Ação irreversível. Apaga todos os dados.
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                <button 
                                    onClick={() => openDeleteConfirmation({ type: 'all-data', id: 'all-data', name: 'todos os dados' })}
                                    className="px-4 py-2 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md hover:-translate-y-0.5 transition-all uppercase tracking-wide"
                                >
                                    {t('settings.clearAllData')}
                                </button>
                            </div>
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
        <div className="h-full flex flex-col pb-2">
            {/* Custom Keywords Section - Full Height with Internal Scroll */}
            <div className="flex-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-700 flex flex-col min-h-0">
                
                {/* Header (Fixed) */}
                <div className="flex-shrink-0 flex items-center space-x-3 mb-4 pb-3 border-b border-slate-200/60 dark:border-slate-700">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg text-white shadow-md">
                        <BrainIcon className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('settings.keywords')}</h3>
                </div>
                
                {/* Input Area (Fixed) */}
                <div className="flex-shrink-0 mb-4">
                    <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed bg-purple-50 dark:bg-purple-900/10 p-3 rounded-xl border border-purple-100 dark:border-purple-800/30 mb-4">
                        {t('settings.keywords.desc')}
                    </p>
                    
                    <form onSubmit={handleAddKeyword} className="flex items-center gap-2">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                placeholder="Adicionar palavra ou expressão..."
                                className="block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-inner focus:border-purple-500 focus:ring-purple-500 py-2.5 px-4 font-medium placeholder:text-slate-400 transition-all backdrop-blur-sm text-sm"
                            />
                        </div>
                        <button type="submit" className="px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95" disabled={!newKeyword.trim()}>
                            Adicionar
                        </button>
                    </form>
                </div>

                {/* List Area (Scrollable) */}
                <div className="flex-1 min-h-0 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 relative flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-300 to-transparent opacity-50 z-10 pointer-events-none"></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <div className="flex flex-wrap gap-2">
                            {customIgnoreKeywords.map(keyword => (
                                <div key={keyword} className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm group hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all duration-200">
                                    <span>{keyword}</span>
                                    <button
                                        onClick={() => removeIgnoreKeyword(keyword)}
                                        className="ml-2 p-0.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-60 group-hover:opacity-100"
                                        aria-label={`Remover ${keyword}`}
                                    >
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                             {customIgnoreKeywords.length === 0 && (
                                <div className="flex flex-col items-center justify-center w-full h-full min-h-[100px] text-slate-400">
                                    <SearchIcon className="w-6 h-6 opacity-30 mb-2" />
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

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-5.5rem)] animate-fade-in gap-5 pb-2">
            {/* Fixed Header Section */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-indigo-800 dark:from-white dark:to-indigo-200 tracking-tight">{t('settings.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{t('settings.subtitle')}</p>
                </div>
                
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                     <TabButton label={t('settings.tabPreferences')} isActive={activeTab === 'preferences'} onClick={() => setActiveTab('preferences')} />
                     <TabButton label={t('settings.tabAutomation')} isActive={activeTab === 'automation'} onClick={() => setActiveTab('automation')} />
                </div>
            </div>

            {/* Content Section (Scrollable Container) */}
            <div className="flex-1 min-h-0">
                 <div className="h-full max-w-7xl mx-auto">
                    {activeTab === 'preferences' && <PreferencesTab />}
                    {activeTab === 'automation' && <AutomationTab />}
                 </div>
            </div>
        </div>
    );
};
