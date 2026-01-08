
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { 
    XMarkIcon, 
    BoltIcon, 
    BanknotesIcon, 
    UserIcon, 
    ArrowPathIcon,
    TrashIcon
} from '../Icons';
import { FileUploader } from '../FileUploader';

export const UpdateReportFilesModal: React.FC = () => {
    const { 
        isUpdateFilesModalOpen, 
        closeUpdateFilesModal,
        banks, 
        churches,
        bankStatementFile,
        contributorFiles,
        handleStatementUpload,
        handleContributorsUpload,
        removeBankStatementFile,
        removeContributorFile,
        handleCompare
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const { showToast } = useUI();
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isUpdateFilesModalOpen) return null;

    const handleRun = async () => {
        setIsProcessing(true);
        try {
            await handleCompare();
            showToast("Relatório atualizado com os novos arquivos.", "success");
            closeUpdateFilesModal();
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-700 animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-purple-500/30">
                            <BoltIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Gerenciar Fontes de Dados</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Adicione ou substitua arquivos para atualizar este relatório.</p>
                        </div>
                    </div>
                    <button type="button" onClick={closeUpdateFilesModal} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Split View */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/20 dark:bg-slate-900/10">
                    
                    {/* Column 1: Bank Statement */}
                    <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 p-6 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-4 text-brand-blue dark:text-blue-400">
                            <BanknotesIcon className="w-5 h-5" />
                            <h4 className="font-bold text-sm uppercase tracking-wide">Extrato Bancário</h4>
                        </div>
                        
                        <div className="space-y-3">
                            {banks.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Nenhum banco cadastrado.</p>
                            ) : (
                                banks.map(bank => {
                                    const isUploaded = bankStatementFile?.bankId === bank.id;
                                    return (
                                        <div key={bank.id} className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${isUploaded ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                            <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{bank.name}</span>
                                            <div className="flex items-center gap-2">
                                                <FileUploader 
                                                    id={`update-bank-${bank.id}`}
                                                    title="Substituir"
                                                    onFileUpload={(content, fileName, rawFile) => handleStatementUpload(content, fileName, bank.id, rawFile)}
                                                    isUploaded={isUploaded}
                                                    uploadedFileName={isUploaded ? bankStatementFile?.fileName : null}
                                                    disabled={!!bankStatementFile && bankStatementFile.bankId !== bank.id}
                                                    onDelete={removeBankStatementFile}
                                                />
                                                {isUploaded && (
                                                    <button onClick={removeBankStatementFile} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Remover">
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Column 2: Contributors */}
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-4 text-brand-teal dark:text-teal-400">
                            <UserIcon className="w-5 h-5" />
                            <h4 className="font-bold text-sm uppercase tracking-wide">Listas de Contribuintes</h4>
                        </div>

                        <div className="space-y-3">
                            {churches.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Nenhuma igreja cadastrada.</p>
                            ) : (
                                churches.map(church => {
                                    const uploadedFile = contributorFiles.find(f => f.churchId === church.id);
                                    const isUploaded = !!uploadedFile;
                                    
                                    return (
                                        <div key={church.id} className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${isUploaded ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                {church.logoUrl && <img src={church.logoUrl} alt="" className="w-5 h-5 rounded object-cover" />}
                                                <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{church.name}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <FileUploader 
                                                    id={`update-church-${church.id}`}
                                                    title="Adicionar"
                                                    onFileUpload={(content, fileName, rawFile) => handleContributorsUpload(content, fileName, church.id, rawFile)}
                                                    isUploaded={isUploaded}
                                                    uploadedFileName={isUploaded ? uploadedFile.fileName : null}
                                                    onDelete={() => removeContributorFile(church.id)}
                                                />
                                                {isUploaded && (
                                                    <button onClick={() => removeContributorFile(church.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Remover">
                                                        <TrashIcon className="w-3.5 h-3.5" />
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

                {/* Footer */}
                <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-800">
                    <button type="button" onClick={closeUpdateFilesModal} className="px-6 py-2.5 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all uppercase tracking-wide">
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleRun} 
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-8 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-full shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-all uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processando...
                            </>
                        ) : (
                            <>
                                <ArrowPathIcon className="w-3.5 h-3.5" />
                                Processar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
