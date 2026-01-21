
import React, { useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { 
    XMarkIcon, 
    BoltIcon, 
    BanknotesIcon, 
    UserIcon, 
    TrashIcon, 
    CheckCircleIcon, 
    ArrowUturnLeftIcon, 
    ArrowPathIcon, 
    CloudArrowUpIcon, 
    PlusCircleIcon, 
    UploadIcon, 
    EnvelopeIcon, 
    EllipsisVerticalIcon 
} from '../Icons';
import { FileUploader, FileUploaderHandle } from '../FileUploader';
import { GmailModal } from '../../features/gmail/GmailModal';
import { processFileContent } from '../../services/processingService';
import { LaunchService } from '../../services/LaunchService';
import { useAuth } from '../../contexts/AuthContext';

const BankRow: React.FC<{ 
    bank: any, 
    isUploaded: boolean, 
    handleStatementUpload: any, 
    setIsGmailModalOpen: any, 
    removeBankStatementFile: any,
    triggerUpdate: () => void 
}> = ({ bank, isUploaded, handleStatementUpload, setIsGmailModalOpen, removeBankStatementFile, triggerUpdate }) => {
    
    const { fileModels, effectiveIgnoreKeywords, setBankStatementFile } = useContext(AppContext);
    const { user } = useAuth();
    const { showToast } = useUI();

    const [menuOpen, setMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    
    const uploaderRef = useRef<FileUploaderHandle>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const uploadModeRef = useRef<'replace' | 'append'>('replace');

    const toggleMenu = () => {
        if (menuOpen) {
            setMenuOpen(false);
        } else if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({ top: rect.bottom + window.scrollY + 5, left: rect.right - 224 + window.scrollX });
            setMenuOpen(true);
        }
    };

    const handleAppend = async (content: string, fileName: string, rawFile: File) => {
        if (!user) return;
        setIsUploading(true);
        try {
            const result = await processFileContent(content, fileName, fileModels, effectiveIgnoreKeywords);
            const newTransactions = result.transactions;

            if (newTransactions.length === 0) {
                showToast("Nenhuma transação válida encontrada.", "error");
                setIsUploading(false);
                return;
            }

            const launchResult = await LaunchService.launchToBank(user.id, bank.id, newTransactions);

            if (launchResult.added > 0) {
                setBankStatementFile((prevFiles: any[]) => {
                    const existingIndex = prevFiles.findIndex((f: any) => f.bankId === bank.id);
                    if (existingIndex === -1) {
                        return [...prevFiles, { bankId: bank.id, content, fileName, rawFile, processedTransactions: newTransactions }];
                    }
                    const currentFile = prevFiles[existingIndex];
                    const mergedTransactions = [...(currentFile.processedTransactions || []), ...newTransactions];
                    const newFiles = [...prevFiles];
                    newFiles[existingIndex] = { ...currentFile, processedTransactions: mergedTransactions };
                    return newFiles;
                });
                showToast(`${launchResult.added} transações adicionadas!`, "success");
            }
            
            // Notifica o componente pai para rodar a comparação final UM ÚNICA VEZ
            setTimeout(() => triggerUpdate(), 500);

        } catch (e: any) {
            showToast("Erro ao adicionar: " + e.message, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUploadWrapper = async (content: string, fileName: string, rawFile: File) => {
        setIsUploading(true);
        if (uploadModeRef.current === 'replace') {
            await handleStatementUpload(content, fileName, bank.id, rawFile);
        } else {
            await handleAppend(content, fileName, rawFile);
        }
        setIsUploading(false);
        setMenuOpen(false);
    };

    const triggerUpload = (mode: 'replace' | 'append') => {
        uploadModeRef.current = mode;
        uploaderRef.current?.open();
        setMenuOpen(false);
    };

    return (
        <div className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 relative ${isUploaded ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
            <div className="hidden"><FileUploader ref={uploaderRef} id={`update-bank-${bank.id}`} title="Up" onFileUpload={handleFileUploadWrapper} isUploaded={false} uploadedFileName={null} onParsingStatusChange={setIsUploading} /></div>
            <div className="flex flex-col min-w-0"><span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{bank.name}</span>{isUploaded ? <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircleIcon className="w-3 h-3" /> Lista Viva Ativa</span> : <span className="text-[10px] text-slate-400 italic">Nenhum extrato</span>}</div>
            <div className="relative">
                {isUploading ? <div className="p-2"><svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div> : 
                <button ref={buttonRef} onClick={toggleMenu} className={`p-2 rounded-full border ${menuOpen ? 'bg-blue-50 text-brand-blue border-blue-200' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200'}`}>{isUploaded ? <EllipsisVerticalIcon className="w-5 h-5 stroke-[1.5]" /> : <CloudArrowUpIcon className="w-5 h-5 stroke-[1.5]" />}</button>}
                {menuOpen && createPortal(<div style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }} className="w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-in"><div className="flex flex-col py-1"><button onClick={() => triggerUpload('append')} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 w-full text-left"><div className="p-1.5 bg-blue-50 rounded-lg text-blue-500"><PlusCircleIcon className="w-3.5 h-3.5" /></div><div><span className="block">Adicionar arquivo</span><span className="text-[9px] font-normal text-slate-400">Somar à lista atual</span></div></button><button onClick={() => triggerUpload('replace')} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 w-full text-left"><div className="p-1.5 bg-amber-50 rounded-lg text-amber-500"><ArrowPathIcon className="w-3.5 h-3.5" /></div><div><span className="block">Substituir tudo</span><span className="text-[9px] font-normal text-slate-400">Trocar lista atual</span></div></button><div className="h-px bg-slate-100 my-1 mx-4"></div><button onClick={() => { if(isUploaded) removeBankStatementFile(bank.id); setMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold w-full text-left text-red-500 hover:bg-red-50"><div className="p-1.5 rounded-lg bg-red-50"><TrashIcon className="w-3.5 h-3.5" /></div><span>Remover extrato</span></button></div></div>, document.body)}
            </div>
        </div>
    );
};

export const UpdateReportFilesModal: React.FC = () => {
    const { 
        isUpdateFilesModalOpen, closeUpdateFilesModal, banks, churches, activeBankFiles, contributorFiles,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile, handleCompare
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const { showToast, setIsLoading } = useUI();
    const [isLocalProcessing, setIsLocalProcessing] = useState(false);
    const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);

    if (!isUpdateFilesModalOpen) return null;

    const handleFinalRun = async () => {
        setIsLocalProcessing(true);
        try {
            await handleCompare();
            showToast("Relatório atualizado com sucesso.", "success");
            closeUpdateFilesModal();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLocalProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-700 animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-purple-500/30"><BoltIcon className="w-5 h-5" /></div>
                        <div><h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">Atualizar Fontes</h3><p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Acumule arquivos para este relatório.</p></div>
                    </div>
                    <button type="button" onClick={closeUpdateFilesModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"><XMarkIcon className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/20 dark:bg-slate-900/10">
                    <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 p-6 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-4 text-brand-blue"><BanknotesIcon className="w-5 h-5" /><h4 className="font-bold text-sm uppercase">Banco (Lista Viva)</h4></div>
                        <div className="space-y-3">
                            {banks.map(bank => (
                                <BankRow key={bank.id} bank={bank} isUploaded={activeBankFiles.some(f => f.bankId === bank.id)} handleStatementUpload={handleStatementUpload} setIsGmailModalOpen={setIsGmailModalOpen} removeBankStatementFile={removeBankStatementFile} triggerUpdate={() => {}} />
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-4 text-brand-teal"><UserIcon className="w-5 h-5" /><h4 className="font-bold text-sm uppercase tracking-wide">Listas de Membros</h4></div>
                        <div className="space-y-3">
                            {churches.map(church => {
                                const isUploaded = !!contributorFiles.find(f => f.churchId === church.id);
                                return (
                                    <div key={church.id} className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 ${isUploaded ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            {church.logoUrl && <img src={church.logoUrl} alt="" className="w-5 h-5 rounded object-cover shadow-sm" />}
                                            <div className="flex flex-col min-w-0"><span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{church.name}</span>{isUploaded && <span className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium"><CheckCircleIcon className="w-3 h-3" /> Carregada</span>}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <FileUploader id={`update-church-${church.id}`} title={isUploaded ? "Trocar" : "Carregar"} onFileUpload={(content, fileName, rawFile) => handleContributorsUpload(content, fileName, church.id)} isUploaded={false} uploadedFileName={null} />
                                            {isUploaded && <button onClick={() => removeContributorFile(church.id)} className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"><TrashIcon className="w-3.5 h-3.5" /></button>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-800">
                    <button type="button" onClick={closeUpdateFilesModal} className="px-6 py-2.5 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white transition-all uppercase tracking-wide">{t('common.cancel')}</button>
                    <button type="button" onClick={handleFinalRun} disabled={isLocalProcessing} className="flex items-center gap-2 px-8 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-full shadow-lg transition-all uppercase tracking-wide">
                        {isLocalProcessing ? <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <><ArrowUturnLeftIcon className="w-3.5 h-3.5" />Processar Acúmulo</>}
                    </button>
                </div>
            </div>
            {isGmailModalOpen && <GmailModal onClose={() => setIsGmailModalOpen(false)} onSuccess={() => {}} />}
        </div>
    );
};
