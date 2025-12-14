
import React, { useContext, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { FileUploader } from '../components/FileUploader';
import { WrenchScrewdriverIcon, BoltIcon } from '../components/Icons';
import { FilePreprocessorModal } from '../components/modals/FilePreprocessorModal';
import { InitialComparisonModal } from '../components/modals/InitialComparisonModal';

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
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const [isPreprocessorOpen, setIsPreprocessorOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    // O botão só aparece se houver pelo menos o extrato bancário (essencial para conciliação)
    const showProcessButton = !!bankStatementFile;

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-1 relative">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight">{t('upload.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px]">{t('upload.subtitle')}</p>
                </div>
                <button 
                    onClick={() => setIsPreprocessorOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-white rounded-full text-[10px] font-bold uppercase tracking-wide transition-all shadow-md hover:shadow-violet-500/30 hover:-translate-y-0.5 active:translate-y-0 transform active:scale-[0.98] bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border border-white/10"
                    title="Abrir Laboratório de Arquivos"
                >
                    <WrenchScrewdriverIcon className="w-3 h-3 text-white" />
                    <span className="hidden sm:inline">Lab Arquivos</span>
                    <span className="sm:hidden">Lab</span>
                </button>
            </div>
            
            {/* Main Content Area - Elastic Height with Internal Scroll */}
            <div className="flex-1 min-h-0 pb-16"> {/* Added padding-bottom for the floating button space */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full">
                    
                    {/* Bank Statement Upload Section */}
                    <div 
                        className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden relative group transition-all duration-500 hover:shadow-soft animate-fade-in-up fill-mode-backwards"
                        style={{ animationDelay: '0ms' }}
                    >
                        <div className="flex-shrink-0 mb-3 relative z-10 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-[10px] border border-blue-100 dark:border-blue-800">1</span>
                                    <h3 className="font-bold text-sm text-slate-800 dark:text-white tracking-tight">{t('upload.statementTitle')}</h3>
                                </div>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400 pl-7 leading-none">{t('upload.statementSubtitle')}</p>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar z-10 space-y-1.5 min-h-0">
                            {banks.map(bank => (
                                <div key={bank.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300 gap-2 group/item hover:shadow-sm">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                                            {bank.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors">{bank.name}</span>
                                    </div>
                                    <FileUploader
                                        id={`bank-uploader-${bank.id}`}
                                        title={t('upload.upload')}
                                        onFileUpload={(content, name) => handleStatementUpload(content, name, bank.id)}
                                        isUploaded={bankStatementFile?.bankId === bank.id && !!bankStatementFile.content}
                                        uploadedFileName={bankStatementFile?.bankId === bank.id ? bankStatementFile.fileName : null}
                                        disabled={!!bankStatementFile && bankStatementFile.bankId !== bank.id}
                                        onDelete={removeBankStatementFile}
                                    />
                                </div>
                            ))}
                            {banks.length === 0 && (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500 italic text-[10px]">
                                    Nenhum banco encontrado.
                                </div>
                            )}
                        </div>
                        
                        {/* Decorative Background Elements */}
                        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
                    </div>

                    {/* Contributor Files Upload Section */}
                    <div 
                        className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden relative group transition-all duration-500 hover:shadow-soft animate-fade-in-up fill-mode-backwards"
                        style={{ animationDelay: '100ms' }}
                    >
                        <div className="flex-shrink-0 mb-3 relative z-10 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] border border-indigo-100 dark:border-indigo-800">2</span>
                                    <h3 className="font-bold text-sm text-slate-800 dark:text-white tracking-tight">{t('upload.contributorsTitle')}</h3>
                                </div>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400 pl-7 leading-none">{t('upload.contributorsSubtitle')}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar z-10 space-y-1.5 min-h-0">
                            {churches.map(church => {
                                const file = contributorFiles.find(f => f.churchId === church.id);
                                return (
                                    <div key={church.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300 gap-2 group/item hover:shadow-sm">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {church.logoUrl ? (
                                                <img src={church.logoUrl} alt="Logo" className="w-6 h-6 rounded-lg object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                                                    {church.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors">{church.name}</span>
                                        </div>
                                        <FileUploader
                                            id={`church-uploader-${church.id}`}
                                            title={t('upload.upload')}
                                            onFileUpload={(content, name) => handleContributorsUpload(content, name, church.id)}
                                            isUploaded={!!file}
                                            uploadedFileName={file?.fileName || null}
                                            onDelete={() => removeContributorFile(church.id)}
                                        />
                                    </div>
                                );
                            })}
                             {churches.length === 0 && (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500 italic text-[10px]">
                                    Nenhuma igreja encontrada.
                                </div>
                            )}
                        </div>
                        
                        {/* Decorative Background Elements */}
                        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
                    </div>
                </div>
            </div>

            {/* Floating Action Button for Configuration - STANDARD DEEP BLUE STYLE */}
            {showProcessButton && (
                <div className="absolute bottom-4 right-6 z-30 animate-fade-in-up">
                    <button
                        onClick={() => setIsConfigModalOpen(true)}
                        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-2xl shadow-blue-900/30 hover:shadow-blue-900/50 transition-all transform hover:-translate-y-1 active:translate-y-0 active:scale-95 border border-white/10"
                    >
                        <BoltIcon className="w-4 h-4" />
                        <span>Configurar & Processar</span>
                    </button>
                </div>
            )}

            {/* Modals */}
            {isPreprocessorOpen && (
                <FilePreprocessorModal onClose={() => setIsPreprocessorOpen(false)} />
            )}
            
            {isConfigModalOpen && (
                <InitialComparisonModal onClose={() => setIsConfigModalOpen(false)} />
            )}
        </div>
    );
};
