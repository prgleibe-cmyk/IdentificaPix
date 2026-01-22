
import React, { useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { FileUploader, FileUploaderHandle } from '../components/FileUploader';
import { 
    BanknotesIcon, 
    UserIcon, 
    TrashIcon, 
    InformationCircleIcon, 
    BoltIcon, 
    WhatsAppIcon, 
    EllipsisVerticalIcon, 
    PlusCircleIcon, 
    ArrowPathIcon, 
    EnvelopeIcon, 
    CheckCircleIcon, 
    DocumentDuplicateIcon, 
    ArrowsRightLeftIcon, 
    XMarkIcon 
} from '../components/Icons';
import { GmailModal } from '../features/gmail/GmailModal';
import { InitialComparisonModal } from '../components/modals/InitialComparisonModal';
import { processFileContent } from '../services/processingService';
import { LaunchService } from '../services/LaunchService';

// --- SMART BANK CARD COMPONENT ---
const SmartBankCard: React.FC<{ bank: any }> = ({ bank }) => {
    const { 
        activeBankFiles,
        selectedBankIds,
        toggleBankSelection,
        handleStatementUpload, 
        removeBankStatementFile,
        fileModels,
        effectiveIgnoreKeywords,
        setBankStatementFile,
        hydrate
    } = useContext(AppContext);
    
    const { user } = useAuth();
    const { showToast } = useUI();
    const { t } = useTranslation();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    
    const uploaderRef = useRef<FileUploaderHandle>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const uploadModeRef = useRef<'replace' | 'append'>('replace');

    const bankFiles = activeBankFiles.filter(f => f.bankId === bank.id);
    const isUploaded = bankFiles.length > 0;
    const isSelected = selectedBankIds.includes(bank.id);
    const totalTransactions = bankFiles.reduce((acc, f) => acc + (f.processedTransactions?.length || 0), 0);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
        setMenuPos(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (menuRef.current) {
            setIsDragging(true);
            const rect = menuRef.current.getBoundingClientRect();
            dragStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setMenuPos({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
            }
        };
        const handleMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleAppend = async (content: string, fileName: string, rawFile: File) => {
        if (!user) return;
        setIsUploading(true);
        try {
            const result = await processFileContent(content, fileName, fileModels, effectiveIgnoreKeywords);
            const newTransactions = result.transactions;

            if (newTransactions.length === 0) {
                showToast("Nenhuma transação encontrada no arquivo.", "error");
                setIsUploading(false);
                return;
            }

            const launchResult = await LaunchService.launchToBank(user.id, bank.id, newTransactions);
            
            // Critical fix: Always hydrate to sync UI with database state
            await hydrate();

            if (launchResult.added > 0) {
                showToast(`${launchResult.added} transações adicionadas!`, "success");
            } else {
                showToast("Lista atualizada (registros já existiam no sistema).", "success");
            }
        } catch (e: any) {
            showToast("Erro ao adicionar: " + e.message, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUploadWrapper = async (content: string, fileName: string, rawFile: File) => {
        setIsUploading(true);
        try {
            if (uploadModeRef.current === 'replace') {
                await handleStatementUpload(content, fileName, bank.id, rawFile);
            } else {
                await handleAppend(content, fileName, rawFile);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsUploading(false);
            setIsMenuOpen(false);
        }
    };

    const triggerUpload = (mode: 'replace' | 'append') => {
        uploadModeRef.current = mode;
        uploaderRef.current?.open();
        setIsMenuOpen(false);
    };

    const removeSpecificFile = async (fileToRemove: any) => {
        if (!user) return;
        setIsUploading(true);
        setIsMenuOpen(false);
        
        try {
            const remainingFiles = bankFiles.filter(f => f !== fileToRemove);
            await LaunchService.clearBankLaunch(user.id, bank.id);
            
            if (remainingFiles.length > 0) {
                const allTxs = remainingFiles.flatMap(f => f.processedTransactions || []);
                if (allTxs.length > 0) {
                    await LaunchService.launchToBank(user.id, bank.id, allTxs);
                }
            }

            setBankStatementFile((prev: any[]) => prev.filter(f => f !== fileToRemove));
            showToast("Arquivo removido.", "success");
        } catch (e: any) {
            showToast("Erro ao remover arquivo.", "error");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 group relative ${isUploaded ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800'}`}>
            <div className="hidden">
                <FileUploader 
                    ref={uploaderRef}
                    id={`bank-${bank.id}`}
                    title="Upload"
                    onFileUpload={handleFileUploadWrapper}
                    isUploaded={false}
                    uploadedFileName={null}
                    onParsingStatusChange={setIsUploading}
                />
            </div>

            {isUploaded && (
                <div 
                    onClick={() => toggleBankSelection(bank.id)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-emerald-200 hover:border-emerald-400'}`}
                >
                    {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                </div>
            )}

            <div className="flex flex-col min-w-0 flex-1">
                <span className={`font-bold text-sm truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}`}>{bank.name}</span>
                {isUploaded ? (
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide">Lista Viva</span>
                        <span className="text-[9px] text-slate-400">({totalTransactions} txs)</span>
                    </div>
                ) : <span className="text-[10px] text-slate-400 italic mt-0.5">Nenhum arquivo</span>}
            </div>

            <div className="flex items-center gap-2">
                {isUploading ? (
                    <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : !isUploaded ? (
                    <button onClick={() => triggerUpload('replace')} className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-brand-blue hover:text-brand-blue rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm transition-all">{t('upload.statementButton')}</button>
                ) : (
                    <button onClick={toggleMenu} className={`p-2 rounded-full transition-all border ${isMenuOpen ? 'bg-blue-50 border-blue-200 text-brand-blue' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}><EllipsisVerticalIcon className="w-5 h-5" /></button>
                )}

                {isMenuOpen && createPortal(
                    <div ref={menuRef} style={{ position: 'fixed', left: menuPos ? menuPos.x : '50%', top: menuPos ? menuPos.y : '50%', transform: menuPos ? 'none' : 'translate(-50%, -50%)', zIndex: 9999, width: '280px' }} className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-scale-in">
                        <div onMouseDown={handleMouseDown} className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between cursor-move select-none">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><ArrowsRightLeftIcon className="w-3 h-3 rotate-45" /><span className="text-[10px] font-bold uppercase tracking-wider">Gerenciar Extratos</span></div>
                            <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="flex flex-col py-1">
                            <button onClick={() => triggerUpload('append')} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors">
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500"><PlusCircleIcon className="w-4 h-4" /></div>
                                <div><span className="block">Adicionar arquivo</span><span className="text-[9px] font-normal text-slate-400">Somar à lista atual</span></div>
                            </button>
                            <button onClick={() => triggerUpload('replace')} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors">
                                <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-500"><ArrowPathIcon className="w-4 h-4" /></div>
                                <div><span className="block">Substituir tudo</span><span className="text-[9px] font-normal text-slate-400">Começar do zero</span></div>
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                            <div className="px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Arquivos Ativos ({bankFiles.length}):</div>
                            <div className="max-h-32 overflow-y-auto custom-scrollbar">
                                {bankFiles.map((file, idx) => (
                                    <div key={`${idx}-${file.fileName}`} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 group/file">
                                        <div className="flex items-center gap-2 min-w-0"><DocumentDuplicateIcon className="w-3 h-3 text-slate-400 shrink-0" /><span className="text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[140px]">{file.fileName}</span></div>
                                        <button onClick={() => removeSpecificFile(file)} className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover/file:opacity-100"><TrashIcon className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                            <button onClick={() => { removeBankStatementFile(bank.id); setIsMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-xs font-bold w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500"><TrashIcon className="w-3.5 h-3.5" /></div>
                                <span>Excluir Tudo</span>
                            </button>
                        </div>
                    </div>, document.body
                )}
            </div>
        </div>
    );
};

export const UploadView: React.FC = () => {
    const { 
        banks, churches, contributorFiles, handleContributorsUpload, removeContributorFile,
        resetReconciliation, activeReportId, selectedBankIds
    } = useContext(AppContext);
    const { t } = useTranslation();
    const [showConfig, setShowConfig] = useState(false);

    const hasSelection = selectedBankIds.length > 0;
    const canProcess = hasSelection || !!activeReportId;

    return (
        <div className="flex flex-col h-full animate-fade-in gap-6 pb-4 px-1">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('upload.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('upload.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={resetReconciliation} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-lg shadow-rose-500/20 transition-all border border-white/10"><TrashIcon className="w-3.5 h-3.5" /><span className="hidden sm:inline">Nova Conciliação</span></button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden group">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-brand-blue border border-blue-100 dark:border-blue-800"><BanknotesIcon className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm">1. {t('upload.statementTitle')}</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Vincule os extratos bancários para começar.</p>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
                            {banks.map(bank => (
                                <SmartBankCard key={bank.id} bank={bank} />
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden group">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 border border-indigo-100 dark:border-indigo-800"><UserIcon className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm">2. {t('upload.contributorsTitle')}</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{t('upload.contributorsSubtitle')}</p>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
                            {churches.map(church => {
                                const isUploaded = !!contributorFiles.find(f => f.churchId === church.id);
                                return (
                                    <div key={church.id} className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 ${isUploaded ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'}`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            {church.logoUrl && <img src={church.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover bg-white" />}
                                            <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{church.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <FileUploader id={`church-${church.id}`} title={t('upload.contributorsButton')} onFileUpload={(content, fileName) => handleContributorsUpload(content, fileName, church.id)} isUploaded={isUploaded} uploadedFileName={null} />
                                            {isUploaded && <button onClick={() => removeContributorFile(church.id)} className="p-1.5 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors"><TrashIcon className="w-3 h-3" /></button>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end pt-2 flex-shrink-0">
                <button onClick={() => setShowConfig(true)} disabled={!canProcess} className="flex items-center gap-3 px-8 py-3.5 text-white rounded-full shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-amber-500 to-orange-600 border border-white/10">
                    <BoltIcon className="w-5 h-5" />
                    {activeReportId ? "Atualizar Relatório" : "Configurar & Processar"}
                </button>
            </div>
            {showConfig && <InitialComparisonModal onClose={() => setShowConfig(false)} />}
        </div>
    );
};
