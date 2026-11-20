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
import { GmailSyncModal } from './GmailSyncModal';
import { processFileContent } from '../../services/processingService';
import { LaunchService } from '../../services/LaunchService';
import { useAuth } from '../../contexts/AuthContext';
import { resolveBankKey, resolveBankBrand, resolveBankColors } from '../../utils/bankHelper';

const BankRow: React.FC<{ 
    bank: any, 
    isUploaded: boolean, 
    handleStatementUpload: any, 
    setIsGmailModalOpen: any, 
    removeBankStatementFile: any,
    triggerUpdate: () => void 
}> = ({ bank, isUploaded, handleStatementUpload, setIsGmailModalOpen, removeBankStatementFile, triggerUpdate }) => {
    
    const { setModelRequiredData, persistTransactions } = useContext(AppContext);
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

    const handleAppend = async (content: string, fileName: string, rawFile: File, base64?: string) => {
        if (!user) return;
        setIsUploading(true);
        try {
            const result = await processFileContent(content, fileName, [], base64, bank);
            const isSicoobBypass = result.strategyName === 'Sicoob Bypass Validation';

            if (isSicoobBypass) {
                showToast("Bypass Sicoob validado com sucesso!", "success");
                triggerUpdate();
                return;
            }
            
            if (result.status === 'MODEL_REQUIRED') {
                if (setModelRequiredData) {
                    setModelRequiredData({ ...result, fileName, bankId: bank.id });
                }
                setIsUploading(false);
                return;
            }

            const newTransactions = result.transactions;

            if (!newTransactions || newTransactions.length === 0) {
                showToast("Nenhuma transação válida encontrada.", "error");
                setIsUploading(false);
                return;
            }

            // 🛡️ FUNIL CENTRAL: O persistTransactions cuida do dedupe e do hydrate automático da UI
            const launchResult = await persistTransactions(bank.id, newTransactions);

            if (launchResult.added > 0) {
                showToast(`${launchResult.added} transações adicionadas!`, "success");
            } else {
                showToast("Nenhuma transação nova detectada (duplicatas ignoradas).", "success");
            }
            
            triggerUpdate();

        } catch (e: any) {
            showToast("Erro ao adicionar: " + e.message, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUploadWrapper = async (content: string, fileName: string, rawFile: File, base64?: string) => {
        setIsUploading(true);
        if (uploadModeRef.current === 'replace') {
            await handleStatementUpload(content, fileName, bank.id, rawFile, base64);
        } else {
            await handleAppend(content, fileName, rawFile, base64);
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
        <div className={`p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 relative ${isUploaded ? 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/60' : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs'}`}>
            <div className="hidden"><FileUploader ref={uploaderRef} id={`update-bank-${bank.id}`} title="Up" onFileUpload={handleFileUploadWrapper} isUploaded={false} uploadedFileName={null} onParsingStatusChange={setIsUploading} bank={bank} /></div>
            
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {(() => {
                    const key = resolveBankKey(bank);
                    const colors = resolveBankColors(bank);
                    const isGeneric = key === 'GENERIC';

                    return (
                        <>
                            <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border overflow-hidden shrink-0"
                                style={{
                                    backgroundColor: isGeneric ? undefined : colors.bg,
                                    borderColor: isGeneric ? undefined : colors.border,
                                    color: isGeneric ? undefined : colors.text
                                }}
                            >
                                {isGeneric ? (
                                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700">
                                        {bank.name.charAt(0).toUpperCase()}
                                    </div>
                                ) : (
                                    resolveBankBrand(bank)
                                )}
                            </div>

                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">{bank.account_name ?? bank.name}</span>
                                {isUploaded ? (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                                        <CheckCircleIcon className="w-3 h-3 shrink-0" /> Lista Viva Ativa
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic">Nenhum extrato</span>
                                )}
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                                    Formato aceito: Exclusivamente arquivo OFX (.ofx).
                                </span>
                            </div>
                        </>
                    );
                })()}
            </div>

            <div className="relative">
                {isUploading ? <div className="p-2"><svg className="animate-spin h-5 w-5 text-orange-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div> : 
                <button ref={buttonRef} onClick={toggleMenu} className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${menuOpen ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>{isUploaded ? <EllipsisVerticalIcon className="w-5 h-5" /> : <CloudArrowUpIcon className="w-5 h-5" />}</button>}
                {menuOpen && createPortal(<div style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }} className="w-56 bg-white dark:bg-slate-900 rounded-xl shadow-elevated border border-slate-200/90 dark:border-slate-700 overflow-hidden animate-scale-in"><div className="flex flex-col py-1"><button onClick={() => triggerUpload('append')} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 w-full text-left transition-colors cursor-pointer"><div className="p-1.5 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400"><PlusCircleIcon className="w-3.5 h-3.5" /></div><div><span className="block">Adicionar arquivo</span><span className="text-[9px] font-normal text-slate-400">Somar à lista atual</span></div></button><button onClick={() => triggerUpload('replace')} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 w-full text-left transition-colors cursor-pointer"><div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400"><ArrowPathIcon className="w-3.5 h-3.5" /></div><div><span className="block">Substituir tudo</span><span className="text-[9px] font-normal text-slate-400">Trocar lista atual</span></div></button><div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-4"></div><button onClick={() => { if(isUploaded) removeBankStatementFile(bank.id); setMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold w-full text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"><div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40"><TrashIcon className="w-3.5 h-3.5" /></div><span>Remover extrato</span></button></div></div>, document.body)}
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
    const { showToast } = useUI();
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
        <>
            <div className="glass-overlay animate-fade-in">
                <div className="glass-modal animate-scale-in">
                    <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg text-orange-600 dark:text-orange-400 flex items-center justify-center"><BoltIcon className="w-5 h-5" /></div>
                            <div><h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Atualizar Fontes</h3><p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Acumule arquivos para este relatório.</p></div>
                        </div>
                        <button type="button" onClick={closeUpdateFilesModal} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"><XMarkIcon className="w-5 h-5" /></button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/40 dark:bg-slate-950/30">
                        <div
                            className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 p-5 overflow-y-auto custom-scrollbar"
                            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                        >
                            <div className="flex items-center gap-2 mb-3.5 text-slate-800 dark:text-slate-100"><BanknotesIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" /><h4 className="font-semibold text-xs uppercase tracking-wider">Banco (Lista Viva)</h4></div>
                            <div className="space-y-2.5">
                                {banks.map(bank => (
                                    <BankRow key={bank.id} bank={bank} isUploaded={activeBankFiles.some(f => f.bankId === bank.id)} handleStatementUpload={handleStatementUpload} setIsGmailModalOpen={setIsGmailModalOpen} removeBankStatementFile={removeBankStatementFile} triggerUpdate={() => {}} />
                                ))}
                            </div>
                        </div>
                        <div
                            className="flex-1 flex flex-col p-5 overflow-y-auto custom-scrollbar"
                            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                        >
                            <div className="flex items-center gap-2 mb-3.5 text-slate-800 dark:text-slate-100"><UserIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" /><h4 className="font-semibold text-xs uppercase tracking-wider">Listas de Membros</h4></div>
                            <div className="space-y-2.5">
                                {churches.map(church => {
                                    const isUploaded = !!contributorFiles.find(f => f.churchId === church.id);
                                    return (
                                        <div key={church.id} className={`p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${isUploaded ? 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/60' : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs'}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                {church.logoUrl && <img src={church.logoUrl} alt="" className="w-5 h-5 rounded object-cover shadow-xs" />}
                                                <div className="flex flex-col min-w-0"><span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">{church.name}</span>{isUploaded && <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircleIcon className="w-3 h-3" /> Carregada</span>}</div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <FileUploader id={`update-church-${church.id}`} title={isUploaded ? "Trocar" : "Carregar"} onFileUpload={(content, fileName) => handleContributorsUpload(content, fileName, church.id)} isUploaded={false} uploadedFileName={null} />
                                                {isUploaded && <button onClick={() => removeContributorFile(church.id)} className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"><TrashIcon className="w-3.5 h-3.5" /></button>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 flex justify-end gap-2.5 bg-slate-50/70 dark:bg-slate-900 shrink-0">
                        <button type="button" onClick={closeUpdateFilesModal} className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors cursor-pointer">{t('common.cancel')}</button>
                        <button type="button" onClick={handleFinalRun} disabled={isLocalProcessing} className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50">
                            {isLocalProcessing ? <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <><ArrowUturnLeftIcon className="w-3.5 h-3.5" />Processar Acúmulo</>}
                        </button>
                    </div>
                </div>
            </div>
            {isGmailModalOpen && <GmailSyncModal onClose={() => setIsGmailModalOpen(false)} />}
        </>
    );
};