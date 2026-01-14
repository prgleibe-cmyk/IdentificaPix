
import React, { useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // Importação do Portal
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
import { consolidationService } from '../../services/ConsolidationService';
import { Transaction } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

// --- SUB-COMPONENT: BANK ROW (LISTA VIVA MANAGER) ---

const BankRow: React.FC<{ 
    bank: any, 
    isUploaded: boolean, 
    handleStatementUpload: any, 
    setIsGmailModalOpen: any, 
    removeBankStatementFile: any,
    triggerUpdate: () => void 
}> = ({ bank, isUploaded, handleStatementUpload, setIsGmailModalOpen, removeBankStatementFile, triggerUpdate }) => {
    
    // CONTEXT ACCESS FOR APPEND LOGIC
    const { fileModels, effectiveIgnoreKeywords, setBankStatementFile } = useContext(AppContext);
    const { user } = useAuth();
    const { showToast } = useUI();

    const [menuOpen, setMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // Estado para posicionamento do menu flutuante
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    
    const uploaderRef = useRef<FileUploaderHandle>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null); // Ref para o botão
    
    // Garante acesso à versão mais recente da função de update para evitar stale closures
    const triggerUpdateRef = useRef(triggerUpdate);
    useEffect(() => {
        triggerUpdateRef.current = triggerUpdate;
    }, [triggerUpdate]);
    
    // Controla o modo do upload: 'replace' (substituir) ou 'append' (adicionar)
    const uploadModeRef = useRef<'replace' | 'append'>('replace');

    // Toggle inteligente com cálculo de posição
    const toggleMenu = () => {
        if (menuOpen) {
            setMenuOpen(false);
        } else if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Calcula posição fixa na tela. 224px é a largura do menu (w-56)
            setMenuPosition({
                top: rect.bottom + window.scrollY + 5,
                left: rect.right - 224 + window.scrollX
            });
            setMenuOpen(true);
        }
    };

    // Fecha menu ao clicar fora ou rolar
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false);
            }
        };
        const handleScroll = () => {
            if (menuOpen) setMenuOpen(false);
        };

        if (menuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [menuOpen]);

    const closeMenu = () => setMenuOpen(false);

    // LOGICA DE APPEND MANUAL (Sincronizada com DB com Fallback)
    const handleAppend = async (content: string, fileName: string, rawFile: File) => {
        setIsUploading(true);
        try {
            // 1. Processa o novo arquivo (Extrai transações novas)
            const result = processFileContent(content, fileName, fileModels, effectiveIgnoreKeywords);
            const newTransactions = result.transactions;

            if (newTransactions.length === 0) {
                showToast("Nenhuma transação válida encontrada no arquivo.", "error");
                setIsUploading(false);
                return;
            }

            // 2. Persistência (Consolidação) - Tenta salvar no banco
            if (user) {
                try {
                    const consolidationData = newTransactions.map(t => ({
                        transaction_date: t.date,
                        amount: t.amount,
                        description: t.description,
                        type: (t.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                        pix_key: null,
                        source: 'file' as 'file',
                        user_id: user.id,
                        bank_id: bank.id // Vincula ao banco
                    }));
                    
                    // Aguarda a inserção para garantir integridade, mas catch qualquer erro (modo offline/fallback)
                    await consolidationService.addTransactions(consolidationData);
                } catch (dbError) {
                    console.warn("[Append] Falha na persistência remota. Continuando com estado local.", dbError);
                }
            }

            // 3. Atualiza Estado Global (Visual) - AGORA COM ARRAY
            setBankStatementFile((prevFiles: any[]) => {
                const existingIndex = prevFiles.findIndex((f: any) => f.bankId === bank.id);
                
                // Se não havia arquivo para este banco, cria (mesmo sendo modo append)
                if (existingIndex === -1) {
                    return [...prevFiles, {
                        bankId: bank.id,
                        content: content,
                        fileName: fileName,
                        rawFile: rawFile,
                        processedTransactions: newTransactions
                    }];
                }

                // Se já existe, mescla com o atual
                const currentFile = prevFiles[existingIndex];
                const currentTransactions = currentFile.processedTransactions || [];
                
                // Deduplicação Lógica Rigorosa (Data + Valor + Nome Limpo)
                // Garante unicidade contra a lista existente e internamente na nova lista
                const getSignature = (t: any) => `${t.date}|${t.amount}|${t.cleanedDescription}`;
                const existingSignatures = new Set(currentTransactions.map((t: any) => getSignature(t)));
                
                const uniqueNewTransactions = newTransactions.filter(t => {
                    const sig = getSignature(t);
                    if (existingSignatures.has(sig)) return false;
                    existingSignatures.add(sig); // Bloqueia duplicatas subsequentes na mesma importação
                    return true;
                });

                if (uniqueNewTransactions.length === 0) {
                    showToast("Todas as transações deste arquivo já existem na lista.", "error");
                    return prevFiles; 
                }

                const mergedTransactions = [...currentTransactions, ...uniqueNewTransactions];
                showToast(`${uniqueNewTransactions.length} novas transações adicionadas!`, "success");

                const updatedFile = {
                    ...currentFile, 
                    content: currentFile.content + '\n' + content, 
                    fileName: `${currentFile.fileName} + ${fileName}`,
                    processedTransactions: mergedTransactions
                };

                const newFiles = [...prevFiles];
                newFiles[existingIndex] = updatedFile;
                return newFiles;
            });
            
            // 4. Dispara atualização da Lista Viva
            setTimeout(() => {
                triggerUpdateRef.current();
            }, 800);

        } catch (e: any) {
            console.error(e);
            showToast("Erro ao adicionar arquivo: " + e.message, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUploadWrapper = async (content: string, fileName: string, rawFile: File) => {
        if (uploadModeRef.current === 'replace') {
            setIsUploading(true);
            handleStatementUpload(content, fileName, bank.id, rawFile);
            
            // Aguarda propagação do estado e banco antes de atualizar a lista visual
            setTimeout(() => {
                triggerUpdateRef.current();
                setIsUploading(false);
            }, 1000);
        } else {
            await handleAppend(content, fileName, rawFile);
        }
        closeMenu();
    };

    const triggerUpload = (mode: 'replace' | 'append') => {
        uploadModeRef.current = mode;
        uploaderRef.current?.open();
        closeMenu();
    };

    return (
        <div className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 relative group ${isUploaded ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
            
            {/* Hidden Uploader Component */}
            <div className="hidden">
                <FileUploader 
                    ref={uploaderRef}
                    id={`update-bank-${bank.id}`}
                    title="Upload Hidden"
                    onFileUpload={handleFileUploadWrapper}
                    isUploaded={false}
                    uploadedFileName={null}
                    onParsingStatusChange={setIsUploading}
                />
            </div>

            <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{bank.name}</span>
                {isUploaded ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircleIcon className="w-3 h-3" /> Lista Viva Ativa
                    </span>
                ) : (
                    <span className="text-[10px] text-slate-400 italic">Nenhum extrato vinculado</span>
                )}
            </div>
            
            <div className="relative">
                {isUploading ? (
                    <div className="p-2">
                        <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                ) : (
                    <button 
                        ref={buttonRef}
                        onClick={toggleMenu}
                        className={`
                            p-2 rounded-full transition-all duration-200 border relative z-10
                            ${menuOpen 
                                ? 'bg-blue-50 dark:bg-slate-700 text-brand-blue border-blue-200 dark:border-blue-700 shadow-md ring-2 ring-blue-100 dark:ring-blue-900/30' 
                                : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-brand-blue border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                            }
                        `}
                        title="Opções do Extrato"
                    >
                        {isUploaded ? <EllipsisVerticalIcon className="w-5 h-5 stroke-[1.5]" /> : <CloudArrowUpIcon className="w-5 h-5 stroke-[1.5]" />}
                    </button>
                )}

                {/* Context Menu (Dropdown) - RENDERIZADO VIA PORTAL */}
                {menuOpen && createPortal(
                    <div 
                        ref={menuRef}
                        style={{ 
                            position: 'fixed', 
                            top: menuPosition.top, 
                            left: menuPosition.left,
                            zIndex: 9999 
                        }}
                        className="w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-scale-in ring-1 ring-black/5"
                    >
                        <div className="flex flex-col py-1">
                            
                            {/* ADICIONAR (APPEND) */}
                            <button 
                                onClick={() => triggerUpload('append')}
                                className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors group/item"
                            >
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500 group-hover/item:text-blue-600">
                                    <PlusCircleIcon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <span className="block">Adicionar arquivo</span>
                                    <span className="text-[9px] font-normal text-slate-400">Somar à lista atual</span>
                                </div>
                            </button>

                            {/* SUBSTITUIR (REPLACE) */}
                            <button 
                                onClick={() => triggerUpload('replace')}
                                className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors group/item"
                            >
                                <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-500 group-hover/item:text-amber-600">
                                    <ArrowPathIcon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <span className="block">Substituir tudo</span>
                                    <span className="text-[9px] font-normal text-slate-400">Trocar lista atual</span>
                                </div>
                            </button>

                            {/* GMAIL */}
                            <button 
                                onClick={() => { setIsGmailModalOpen(true); closeMenu(); }}
                                className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors group/item"
                            >
                                <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-500 group-hover/item:text-red-600">
                                    <EnvelopeIcon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <span className="block">Importar Gmail</span>
                                    <span className="text-[9px] font-normal text-slate-400">Buscar comprovantes</span>
                                </div>
                            </button>

                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                            
                            {/* EXCLUIR */}
                            <button 
                                onClick={() => { if(isUploaded) removeBankStatementFile(bank.id); closeMenu(); }}
                                disabled={!isUploaded}
                                className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold w-full text-left transition-colors group/item ${!isUploaded ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                            >
                                <div className={`p-1.5 rounded-lg ${!isUploaded ? 'bg-slate-100' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}>
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </div>
                                <span>Remover extrato</span>
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
};

export const UpdateReportFilesModal: React.FC = () => {
    const { 
        isUpdateFilesModalOpen, 
        closeUpdateFilesModal,
        banks, 
        churches,
        activeBankFiles, // CHANGED
        contributorFiles,
        handleStatementUpload,
        handleContributorsUpload,
        removeBankStatementFile,
        removeContributorFile,
        handleCompare
    } = useContext(AppContext);
    
    // Garante acesso à versão atualizada do handleCompare
    const handleCompareRef = useRef(handleCompare);
    useEffect(() => {
        handleCompareRef.current = handleCompare;
    }, [handleCompare]);
    
    const { t } = useTranslation();
    const { showToast } = useUI();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);

    if (!isUpdateFilesModalOpen) return null;

    const handleRun = async () => {
        setIsProcessing(true);
        try {
            await handleCompare();
            showToast("Relatório atualizado com os novos dados.", "success");
            closeUpdateFilesModal();
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGmailSuccess = (csvContent: string) => {
        // Para o Gmail, criamos um arquivo virtual
        const virtualFile = new File([csvContent], "gmail_import.csv", { type: "text/csv" });
        // O handleStatementUpload agora cuida de determinar o bankId ou criar um virtual
        handleStatementUpload(
            csvContent, 
            `Gmail Import - ${new Date().toLocaleDateString()}`, 
            'gmail-virtual-bank', 
            virtualFile
        );
        
        // Atualiza lista viva após importação do Gmail
        setTimeout(() => {
            handleCompareRef.current();
        }, 1000);
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
                    
                    {/* Column 1: Bank Statement (Lista Viva) */}
                    <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 p-6 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-4 text-brand-blue dark:text-blue-400">
                            <BanknotesIcon className="w-5 h-5" />
                            <h4 className="font-bold text-sm uppercase tracking-wide">Banco (Lista Viva)</h4>
                        </div>

                        <div className="space-y-3">
                            {banks.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Nenhum banco cadastrado.</p>
                            ) : (
                                banks.map(bank => {
                                    const isUploaded = activeBankFiles.some(f => f.bankId === bank.id);
                                    return (
                                        <BankRow 
                                            key={bank.id}
                                            bank={bank}
                                            isUploaded={isUploaded}
                                            handleStatementUpload={handleStatementUpload}
                                            setIsGmailModalOpen={setIsGmailModalOpen}
                                            removeBankStatementFile={removeBankStatementFile}
                                            triggerUpdate={handleCompare}
                                        />
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Column 2: Contributors (Listas de Membros) */}
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-4 text-brand-teal dark:text-teal-400">
                            <UserIcon className="w-5 h-5" />
                            <h4 className="font-bold text-sm uppercase tracking-wide">Listas de Membros</h4>
                        </div>

                        <div className="space-y-3">
                            {churches.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Nenhuma igreja cadastrada.</p>
                            ) : (
                                churches.map(church => {
                                    const uploadedFile = contributorFiles.find(f => f.churchId === church.id);
                                    const isUploaded = !!uploadedFile;
                                    
                                    return (
                                        <div key={church.id} className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 ${isUploaded ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                {church.logoUrl && <img src={church.logoUrl} alt="" className="w-5 h-5 rounded object-cover shadow-sm" />}
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{church.name}</span>
                                                    {isUploaded && (
                                                        <span className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                                                            <CheckCircleIcon className="w-3 h-3" /> Lista carregada
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <FileUploader 
                                                    id={`update-church-${church.id}`}
                                                    title={isUploaded ? "Trocar" : "Carregar"}
                                                    onFileUpload={(content, fileName, rawFile) => handleContributorsUpload(content, fileName, church.id, rawFile)}
                                                    isUploaded={false} // Force render button
                                                    uploadedFileName={null}
                                                />
                                                {isUploaded && (
                                                    <button 
                                                        onClick={() => removeContributorFile(church.id)} 
                                                        className="group flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-100 dark:bg-slate-700 dark:border-slate-600 text-slate-400 hover:text-red-500 transition-all active:scale-95"
                                                        title="Excluir lista"
                                                    >
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
                                <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                                Processar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Gmail Sync Modal */}
            {isGmailModalOpen && (
                <GmailModal 
                    onClose={() => setIsGmailModalOpen(false)} 
                    onSuccess={handleGmailSuccess} 
                />
            )}
        </div>
    );
};
