
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { FileUploader } from '../components/FileUploader';
import { SearchIcon, WrenchScrewdriverIcon } from '../components/Icons';
import { ComparisonSettingsForm } from '../components/shared/ComparisonSettingsForm';
import { FilePreprocessorModal } from '../components/modals/FilePreprocessorModal';

export const UploadView: React.FC = () => {
    const { 
        banks, 
        churches, 
        bankStatementFile, 
        contributorFiles, 
        handleStatementUpload, 
        handleContributorsUpload,
        removeBankStatementFile,
        removeContributorFile,
        isCompareDisabled,
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const [bankSearch, setBankSearch] = useState('');
    const [churchSearch, setChurchSearch] = useState('');
    const [isPreprocessorOpen, setIsPreprocessorOpen] = useState(false);

    const filteredBanks = useMemo(() => banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase())), [banks, bankSearch]);
    const filteredChurches = useMemo(() => churches.filter(c => c.name.toLowerCase().includes(churchSearch.toLowerCase())), [churches, churchSearch]);

    return (
        <div className="flex flex-col h-full animate-fade-in gap-4 pb-2">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-indigo-800 dark:from-white dark:to-indigo-200 tracking-tight">{t('upload.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('upload.subtitle')}</p>
                </div>
                <button 
                    onClick={() => setIsPreprocessorOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 border border-transparent"
                    title="Abrir Laboratório de Arquivos para corrigir PDFs ou formatar dados antes de carregar."
                >
                    <WrenchScrewdriverIcon className="w-4 h-4 text-white" />
                    Preparar Arquivo
                </button>
            </div>
            
            {/* Main Content Area - Elastic Height with Internal Scroll */}
            <div className="flex-1 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                    
                    {/* Bank Statement Upload Section */}
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-700 flex flex-col overflow-hidden relative group transition-all h-full">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-100/50 dark:bg-blue-900/10 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none group-hover:bg-blue-200/50 dark:group-hover:bg-blue-900/20 transition-colors"></div>
                        
                        <div className="flex-shrink-0 mb-4 relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30">1</span>
                                <h3 className="font-bold text-base text-slate-800 dark:text-white tracking-tight">{t('upload.statementTitle')}</h3>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-8 leading-relaxed line-clamp-1">{t('upload.statementSubtitle')}</p>
                        </div>
                        
                        <div className="flex-shrink-0 relative mb-4 z-10">
                            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                            <input type="text" placeholder={t('register.searchBank')} value={bankSearch} onChange={e => setBankSearch(e.target.value)} className="pl-9 p-2.5 block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 text-xs focus:border-blue-500 focus:ring-blue-500 transition-all shadow-inner backdrop-blur-sm" />
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar z-10 space-y-2.5 min-h-0">
                            {filteredBanks.map(bank => (
                                <div key={bank.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-300 gap-2 group/item backdrop-blur-sm">
                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors pl-1">{bank.name}</span>
                                    <FileUploader
                                        id={`bank-uploader-${bank.id}`}
                                        title={t('upload.upload')}
                                        onFileUpload={(content, name) => handleStatementUpload(content, name, bank.id)}
                                        isUploaded={bankStatementFile?.bankId === bank.id && !!bankStatementFile.content}
                                        uploadedFileName={bankStatementFile?.bankId === bank.id ? bankStatementFile.fileName : null}
                                        disabled={!!bankStatementFile && bankStatementFile.bankId !== bank.id}
                                        onDelete={bankStatementFile?.bankId === bank.id ? removeBankStatementFile : undefined}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contributor Lists Upload Section */}
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-700 flex flex-col overflow-hidden relative group transition-all h-full">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-100/50 dark:bg-indigo-900/10 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none group-hover:bg-indigo-200/50 dark:group-hover:bg-indigo-900/20 transition-colors"></div>

                        <div className="flex-shrink-0 mb-4 relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/30">2</span>
                                <h3 className="font-bold text-base text-slate-800 dark:text-white tracking-tight">
                                    {t('upload.contributorsTitle')}
                                    <span className="text-[10px] font-normal text-slate-400 ml-2">(Opcional)</span>
                                </h3>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-8 leading-relaxed line-clamp-1">{t('upload.contributorsSubtitle')}</p>
                        </div>

                        <div className="flex-shrink-0 relative mb-4 z-10">
                            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                            <input type="text" placeholder={t('register.searchChurch')} value={churchSearch} onChange={e => setChurchSearch(e.target.value)} className="pl-9 p-2.5 block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 text-xs focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-inner backdrop-blur-sm" />
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar z-10 space-y-2.5 min-h-0">
                            {filteredChurches.map(church => {
                                const uploadedFile = contributorFiles.find(f => f.churchId === church.id);
                                return (
                                    <div key={church.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 gap-2 group/item backdrop-blur-sm">
                                        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors pl-1">{church.name}</span>
                                        <FileUploader
                                            id={`church-uploader-${church.id}`}
                                            title={t('upload.upload')}
                                            onFileUpload={(content, name) => handleContributorsUpload(content, name, church.id)}
                                            isUploaded={!!uploadedFile}
                                            uploadedFileName={uploadedFile?.fileName ?? null}
                                            onDelete={uploadedFile ? () => removeContributorFile(church.id) : undefined}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Comparison Settings Footer - Fixed at bottom */}
            {!isCompareDisabled && (
                <div className="flex-shrink-0 bg-gradient-to-r from-white/95 to-slate-50/95 dark:from-slate-800/95 dark:to-slate-900/95 backdrop-blur-2xl px-5 py-3 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden z-30 animate-fade-in-up ring-1 ring-indigo-500/5">
                    {/* Decorative subtle glow */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500 opacity-20"></div>
                    <ComparisonSettingsForm />
                </div>
            )}

            {isPreprocessorOpen && <FilePreprocessorModal onClose={() => setIsPreprocessorOpen(false)} />}
        </div>
    );
};
