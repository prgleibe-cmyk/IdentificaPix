
import React, { useContext, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { FileUploader } from '../components/FileUploader';
import { WrenchScrewdriverIcon, BoltIcon, WhatsAppIcon, InformationCircleIcon, TrashIcon } from '../components/Icons';
import { InitialComparisonModal } from '../components/modals/InitialComparisonModal';

export const UploadView: React.FC = () => {
    const { 
        banks, churches, bankStatementFile, contributorFiles, 
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile,
        openLabManually, resetReconciliation
    } = useContext(AppContext);
    
    const { user, systemSettings } = useAuth();
    const { t } = useTranslation();
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    // ADMIN CHECK
    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';

    const handleContactSupport = () => {
        window.open(`https://wa.me/${systemSettings.supportNumber}?text=Olá, tenho um arquivo que o sistema não reconheceu. Poderiam criar um padrão para ele?`, '_blank');
    };

    const showProcessButton = !!(bankStatementFile && bankStatementFile.content);
    const hasAnyFile = !!bankStatementFile || contributorFiles.length > 0;

    const handleReset = () => {
        if (window.confirm("Isso limpará todos os arquivos e resultados da sessão atual. Deseja iniciar uma nova conciliação?")) {
            resetReconciliation();
        }
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-1 relative">
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight">{t('upload.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px]">{t('upload.subtitle')}</p>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* BOTÃO NOVA CONCILIAÇÃO (Limpar Tudo) */}
                    {hasAnyFile && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-white rounded-full text-[10px] font-bold uppercase tracking-wide transition-all shadow-md hover:shadow-red-500/30 hover:-translate-y-0.5 active:translate-y-0 transform active:scale-[0.98] bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 border border-white/10"
                        >
                            <TrashIcon className="w-3 h-3 text-white" />
                            <span>Nova Conciliação</span>
                        </button>
                    )}

                    {/* BOTÃO DO LAB: APENAS PARA ADMIN */}
                    {isAdmin && bankStatementFile && (
                        <button 
                            onClick={() => openLabManually()}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-white rounded-full text-[10px] font-bold uppercase tracking-wide transition-all shadow-md hover:shadow-violet-500/30 hover:-translate-y-0.5 active:translate-y-0 transform active:scale-[0.98] bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border border-white/10"
                        >
                            <WrenchScrewdriverIcon className="w-3 h-3 text-white" />
                            <span>Lab Arquivos (Admin)</span>
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex-1 min-h-0 pb-16">
                
                {/* NOTICE CARD: Arquivo não reconhecido (Highlight Colors) */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-700/60 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4 shadow-lg shadow-amber-500/5 animate-fade-in-up relative overflow-hidden group">
                    {/* Decorative Blob */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10 group-hover:bg-amber-400/20 transition-colors"></div>

                    <div className="flex items-start gap-4 relative z-10">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 shrink-0 shadow-sm">
                            <InformationCircleIcon className="w-6 h-6 stroke-[2]" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase tracking-wide mb-1 flex items-center gap-2">
                                {t('upload.support.title')}
                            </h4>
                            <p className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-snug max-w-2xl font-bold">
                                {t('upload.support.desc')}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleContactSupport}
                        className="relative z-10 flex items-center gap-2 px-5 py-2 bg-white hover:bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-300 text-emerald-700 dark:bg-slate-800 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded-full text-[10px] font-black uppercase tracking-wide shadow-sm hover:shadow-md transition-all whitespace-nowrap group/btn"
                    >
                        <WhatsAppIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-500 group-hover/btn:scale-110 transition-transform" />
                        <span className="hidden sm:inline">{t('upload.support.action')}</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full max-h-[calc(100%-100px)]">
                    
                    {/* BANK STATEMENTS COLUMN */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="flex-shrink-0 mb-3 relative z-10">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] border border-blue-100">1</span>
                                <h3 className="font-bold text-sm text-slate-800 dark:text-white tracking-tight">{t('upload.statementTitle')}</h3>
                            </div>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 pl-7">{t('upload.statementSubtitle')}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar z-10 space-y-1.5">
                            {banks.map(bank => {
                                const isThisUploaded = bankStatementFile?.bankId === bank.id && !!bankStatementFile?.content;
                                return (
                                    <div key={bank.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-blue-200 transition-all gap-2 group/item">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 border shrink-0">
                                                {bank.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate group-hover/item:text-blue-600">{bank.name}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {/* Botão de Lab específico do Admin */}
                                            {isAdmin && isThisUploaded && (
                                                <button 
                                                    onClick={() => openLabManually({ 
                                                        content: bankStatementFile!.content, 
                                                        fileName: bankStatementFile!.fileName, 
                                                        type: 'statement', 
                                                        id: bank.id,
                                                        rawFile: bankStatementFile!.rawFile 
                                                    })}
                                                    className="p-1.5 rounded-full bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-900/50 transition-colors shadow-sm"
                                                    title="Configurar Modelo no Laboratório"
                                                >
                                                    <WrenchScrewdriverIcon className="w-3 h-3" />
                                                </button>
                                            )}
                                            <FileUploader
                                                id={`bank-uploader-${bank.id}`}
                                                title={t('upload.upload')}
                                                onFileUpload={(content, name, raw) => handleStatementUpload(content, name, bank.id, raw)}
                                                isUploaded={isThisUploaded}
                                                uploadedFileName={isThisUploaded ? bankStatementFile!.fileName : null}
                                                disabled={!!(bankStatementFile?.bankId && bankStatementFile.content) && bankStatementFile.bankId !== bank.id}
                                                onDelete={removeBankStatementFile}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* CONTRIBUTORS LIST COLUMN */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                        <div className="flex-shrink-0 mb-3 relative z-10">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] border border-indigo-100">2</span>
                                <h3 className="font-bold text-sm text-slate-800 dark:text-white tracking-tight">{t('upload.contributorsTitle')}</h3>
                            </div>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 pl-7">{t('upload.contributorsSubtitle')}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar z-10 space-y-1.5">
                            {churches.map(church => {
                                const file = contributorFiles.find(f => f.churchId === church.id);
                                const isThisUploaded = !!file;
                                return (
                                    <div key={church.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 transition-all gap-2 group/item">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {church.logoUrl ? (
                                                <img src={church.logoUrl} alt="Logo" className="w-6 h-6 rounded-lg object-cover border bg-white shrink-0" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 border shrink-0">
                                                    {church.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate group-hover/item:text-indigo-600">{church.name}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {isAdmin && isThisUploaded && (
                                                <button 
                                                    onClick={() => openLabManually({ 
                                                        content: file!.content, 
                                                        fileName: file!.fileName, 
                                                        type: 'contributor', 
                                                        id: church.id 
                                                    })}
                                                    className="p-1.5 rounded-full bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-900/50 transition-colors shadow-sm"
                                                    title="Configurar Modelo no Laboratório"
                                                >
                                                    <WrenchScrewdriverIcon className="w-3 h-3" />
                                                </button>
                                            )}
                                            <FileUploader
                                                id={`church-uploader-${church.id}`}
                                                title={t('upload.upload')}
                                                onFileUpload={(content, name, raw) => handleContributorsUpload(content, name, church.id)}
                                                isUploaded={isThisUploaded}
                                                uploadedFileName={file?.fileName || null}
                                                onDelete={() => removeContributorFile(church.id)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {showProcessButton && (
                <div className="absolute bottom-4 right-6 z-30 animate-fade-in-up">
                    <button
                        onClick={() => setIsConfigModalOpen(true)}
                        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 border border-white/10"
                    >
                        <BoltIcon className="w-4 h-4" />
                        <span>Configurar & Processar</span>
                    </button>
                </div>
            )}

            {isConfigModalOpen && (
                <InitialComparisonModal onClose={() => setIsConfigModalOpen(false)} />
            )}
        </div>
    );
};
