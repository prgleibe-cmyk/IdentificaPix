
import React, { useContext, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { FileUploader } from '../components/FileUploader';
import { 
    BanknotesIcon, 
    UserIcon, 
    TrashIcon, 
    InformationCircleIcon, 
    ExclamationTriangleIcon,
    ArrowPathIcon,
    WrenchScrewdriverIcon,
    BoltIcon,
    WhatsAppIcon
} from '../components/Icons';
import { GmailButton } from '../features/gmail/GmailButton';
import { InitialComparisonModal } from '../components/modals/InitialComparisonModal';

export const UploadView: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';

    const { 
        banks, 
        churches, 
        bankStatementFile, 
        contributorFiles, 
        handleStatementUpload, 
        handleContributorsUpload, 
        removeBankStatementFile, 
        removeContributorFile,
        openLabManually,
        resetReconciliation
    } = useContext(AppContext);
    const { t } = useTranslation();
    const [showConfig, setShowConfig] = useState(false);

    return (
        <div className="flex flex-col h-full animate-fade-in gap-6 pb-4 px-1">
            {/* 1. Cabeçalho com Botões de Ação */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('upload.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('upload.subtitle')}</p>
                </div>
                
                {/* BOTÕES DE AÇÃO PADRONIZADOS */}
                <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                    
                    <button 
                        onClick={resetReconciliation}
                        className="relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-lg shadow-rose-500/20 hover:-translate-y-0.5 transition-all active:scale-95 group border border-white/10"
                    >
                        <TrashIcon className="w-3.5 h-3.5 stroke-[2]" />
                        <span className="hidden sm:inline">Nova Conciliação</span>
                    </button>

                    {isAdmin && (
                        <button 
                            onClick={() => openLabManually()}
                            className="relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all active:scale-95 group border border-white/10"
                        >
                            <WrenchScrewdriverIcon className="w-3.5 h-3.5 stroke-[2]" />
                            <span className="hidden sm:inline">Lab (Admin)</span>
                        </button>
                    )}

                    {/* Botão do Gmail (Componente Próprio) */}
                    <GmailButton />
                </div>
            </div>

            {/* 2. Box de Suporte (Topo) */}
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm flex-shrink-0">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 dark:bg-amber-800/30 rounded-full text-amber-600 dark:text-amber-400 hidden sm:block">
                        <InformationCircleIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide mb-1">
                            {t('upload.support.title')}
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed max-w-3xl">
                            {t('upload.support.desc')}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => window.open('https://wa.me/5565996835098', '_blank')}
                    className="flex-shrink-0 flex items-center gap-2 px-6 py-2.5 bg-transparent border border-[#128C7E] text-[#128C7E] hover:bg-[#128C7E]/10 dark:text-[#25D366] dark:border-[#25D366] dark:hover:bg-[#25D366]/10 rounded-full text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap"
                >
                    <WhatsAppIcon className="w-4 h-4 fill-current" />
                    {t('upload.support.action')}
                </button>
            </div>

            {/* 3. Grid de Upload */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                    
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-brand-blue dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                    <BanknotesIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">1. {t('upload.statementTitle')}</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight max-w-[250px]">{t('upload.statementSubtitle')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 relative z-10">
                            {banks.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl p-6">
                                    <ExclamationTriangleIcon className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-xs">Nenhum banco cadastrado.</p>
                                    <p className="text-[10px] opacity-70">Cadastre um banco para liberar o upload.</p>
                                </div>
                            ) : (
                                banks.map(bank => {
                                    const isUploaded = bankStatementFile?.bankId === bank.id;
                                    return (
                                        <div key={bank.id} className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 ${isUploaded ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800'}`}>
                                            <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{bank.name}</span>
                                            
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <FileUploader 
                                                    id={`bank-${bank.id}`}
                                                    title={t('upload.statementButton')}
                                                    onFileUpload={(content, fileName, rawFile) => handleStatementUpload(content, fileName, bank.id, rawFile)}
                                                    isUploaded={isUploaded}
                                                    uploadedFileName={isUploaded ? bankStatementFile?.fileName : null}
                                                    disabled={!!bankStatementFile && bankStatementFile.bankId !== bank.id}
                                                    onDelete={removeBankStatementFile}
                                                />
                                                {isUploaded && isAdmin && (
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => openLabManually()} 
                                                            className="p-1.5 text-slate-400 hover:text-brand-blue bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors"
                                                            title="Inspecionar no Laboratório"
                                                        >
                                                            <ArrowPathIcon className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={removeBankStatementFile} 
                                                            className="p-1.5 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors"
                                                            title="Remover arquivo"
                                                        >
                                                            <TrashIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                {isUploaded && !isAdmin && (
                                                    <button 
                                                        onClick={removeBankStatementFile} 
                                                        className="p-1.5 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors"
                                                        title="Remover arquivo"
                                                    >
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                    <UserIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">2. {t('upload.contributorsTitle')}</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight max-w-[250px]">{t('upload.contributorsSubtitle')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 relative z-10">
                            {churches.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl p-6">
                                    <ExclamationTriangleIcon className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-xs">Nenhuma igreja cadastrada.</p>
                                    <p className="text-[10px] opacity-70">Cadastre uma igreja para liberar o upload.</p>
                                </div>
                            ) : (
                                churches.map(church => {
                                    const uploadedFile = contributorFiles.find(f => f.churchId === church.id);
                                    const isUploaded = !!uploadedFile;
                                    
                                    return (
                                        <div key={church.id} className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 ${isUploaded ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800'}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                {church.logoUrl && <img src={church.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover bg-white" />}
                                                <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{church.name}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <FileUploader 
                                                    id={`church-${church.id}`}
                                                    title={t('upload.contributorsButton')}
                                                    onFileUpload={(content, fileName, rawFile) => handleContributorsUpload(content, fileName, church.id, rawFile)}
                                                    isUploaded={isUploaded}
                                                    uploadedFileName={isUploaded ? uploadedFile.fileName : null}
                                                    onDelete={() => removeContributorFile(church.id)}
                                                />
                                                {isUploaded && isAdmin && (
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => openLabManually({ content: uploadedFile.content, fileName: uploadedFile.fileName, type: 'contributor', id: church.id })} 
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors"
                                                            title="Inspecionar no Laboratório"
                                                        >
                                                            <ArrowPathIcon className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => removeContributorFile(church.id)} 
                                                            className="p-1.5 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors"
                                                            title="Remover arquivo"
                                                        >
                                                            <TrashIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                {isUploaded && !isAdmin && (
                                                    <button 
                                                        onClick={() => removeContributorFile(church.id)} 
                                                        className="p-1.5 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors"
                                                        title="Remover arquivo"
                                                    >
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* 4. Botão de Ação (Rodapé) */}
            <div className="flex justify-end pt-2 flex-shrink-0">
                <button
                    onClick={() => setShowConfig(true)}
                    disabled={!bankStatementFile}
                    className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-full shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-xs font-bold uppercase tracking-widest group border border-white/10"
                >
                    <BoltIcon className="w-5 h-5 group-hover:text-white transition-colors" />
                    Configurar & Processar
                </button>
            </div>

            {/* Modal de Configuração (Próximo Passo) */}
            {showConfig && <InitialComparisonModal onClose={() => setShowConfig(false)} />}
        </div>
    );
};
