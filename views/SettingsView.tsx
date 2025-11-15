import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { SettingsTab, Language } from '../types';
import { 
    BrainIcon, 
    SearchIcon, 
    TrashIcon, 
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
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${ isActive ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'}`}>
        {label}
    </button>
);

const PreferencesTab: React.FC = () => {
    const { theme, toggleTheme, openDeleteConfirmation } = useContext(AppContext);
    const { t, language, setLanguage } = useTranslation();

    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
    };

    const dataManagementItems = [
        {
            type: 'uploaded-files' as const,
            icon: <DocumentDuplicateIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
            title: t('settings.dataManagement.uploadedFiles'),
            description: t('settings.dataManagement.uploadedFiles.desc'),
        },
        {
            type: 'match-results' as const,
            icon: <ArrowsRightLeftIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
            title: t('settings.dataManagement.matchResults'),
            description: t('settings.dataManagement.matchResults.desc'),
        },
    ];

    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            {/* Appearance Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3 mb-6">
                    <PaintBrushIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('settings.appearance')}</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.theme')}</label>
                        <div className="mt-2 flex items-center space-x-2">
                            <button onClick={toggleTheme} className="flex items-center justify-center w-32 p-2 border rounded-md transition-colors border-slate-300 dark:border-slate-600">
                                {theme === 'light' ? 
                                    <><SunIcon className="w-5 h-5 mr-2 text-yellow-500" /> Claro</> : 
                                    <><MoonIcon className="w-5 h-5 mr-2 text-sky-400" /> Escuro</>
                                }
                            </button>
                        </div>
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.language')}</label>
                        <div className="mt-2">
                            <select onChange={(e) => handleLanguageChange(e.target.value as Language)} value={language} className="block w-full max-w-xs rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm">
                                <option value="pt">🇧🇷 Português</option>
                                <option value="en">🇺🇸 English</option>
                                <option value="es">🇪🇸 Español</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

             {/* Data Management Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3 mb-4">
                    <CircleStackIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('settings.dataManagement')}</h3>
                </div>
                <div className="space-y-4">
                    {dataManagementItems.map(item => (
                        <div key={item.type} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                            <div className="flex items-start space-x-4">
                                {item.icon}
                                <div>
                                    <h4 className="font-medium text-slate-800 dark:text-slate-200">{item.title}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => openDeleteConfirmation({ type: item.type, id: item.type, name: item.title })}
                                className="flex-shrink-0 ml-4 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900/70"
                            >
                                {t('settings.dataManagement.clear')}
                            </button>
                        </div>
                    ))}
                </div>

                 {/* Danger Zone for full reset */}
                <div className="mt-8 pt-6 border-t border-red-500/30">
                     <div className="p-4 border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 rounded-r-md">
                        <div className="flex items-start space-x-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-red-800 dark:text-red-300">{t('settings.dangerZone')}</h4>
                                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                                    {t('settings.dangerZone.desc')}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 text-right">
                            <button 
                                onClick={() => openDeleteConfirmation({ type: 'all-data', id: 'all-data', name: 'todos os dados' })}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                            >
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
        <div className="space-y-8">
            {/* Custom Keywords Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('settings.keywords')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.keywords.desc')}
                </p>
                
                <form onSubmit={handleAddKeyword} className="flex items-center gap-2 mb-4">
                    <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        placeholder="Adicionar nova palavra ou expressão"
                        className="flex-grow block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"
                    />
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:bg-slate-400" disabled={!newKeyword.trim()}>
                        Adicionar
                    </button>
                </form>

                <div className="p-2 border dark:border-slate-700 rounded-md min-h-[8rem] bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex flex-wrap gap-2">
                        {customIgnoreKeywords.map(keyword => (
                            <div key={keyword} className="flex items-center bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full px-3 py-1 text-sm font-medium animate-simple-fade-in">
                                <span>{keyword}</span>
                                <button
                                    onClick={() => removeIgnoreKeyword(keyword)}
                                    className="ml-2 -mr-1 p-0.5 rounded-full text-blue-500 hover:text-blue-800 hover:bg-blue-200 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-700/50 transition-colors"
                                    aria-label={`Remover ${keyword}`}
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                         {customIgnoreKeywords.length === 0 && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 p-4 text-center w-full">Nenhuma palavra-chave configurada.</p>
                        )}
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
        <>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{t('settings.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{t('settings.subtitle')}</p>

            <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                <div className="flex space-x-2">
                    <TabButton label={t('settings.tabPreferences')} isActive={activeTab === 'preferences'} onClick={() => setActiveTab('preferences')} />
                    <TabButton label={t('settings.tabAutomation')} isActive={activeTab === 'automation'} onClick={() => setActiveTab('automation')} />
                </div>
            </div>

            {activeTab === 'preferences' && <PreferencesTab />}
            {activeTab === 'automation' && <AutomationTab />}
        </>
    );
};