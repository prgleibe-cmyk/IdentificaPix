
// ... existing imports ...
import React, { useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // Importação do Portal
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
    ExclamationTriangleIcon, 
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
import { GmailButton } from '../features/gmail/GmailButton';
import { GmailModal } from '../features/gmail/GmailModal';
import { InitialComparisonModal } from '../components/modals/InitialComparisonModal';
import { processFileContent } from '../services/processingService';
import { consolidationService } from '../services/ConsolidationService';

// --- SMART BANK CARD COMPONENT (BLINDADO) ---
// Gerencia a lógica de upload, append, replace e menu flutuante isolado
const SmartBankCard: React.FC<{ bank: any }> = ({ bank }) => {
    const { 
        activeBankFiles,
        selectedBankIds,
        toggleBankSelection,
        handleStatementUpload, 
        removeBankStatementFile,
        fileModels,
        effectiveIgnoreKeywords,
        setBankStatementFile
    } = useContext(AppContext);
    
    const { user } = useAuth();
    const { showToast } = useUI();
    const { t } = useTranslation();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
    
    // --- LÓGICA DRAGGABLE BLINDADA ---
    // Posição manual (x, y). Se null, usa CSS para centralizar.
    const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    
    const uploaderRef = useRef<FileUploaderHandle>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const uploadModeRef = useRef<'replace' | 'append'>('replace');

    // Filtra todos os arquivos deste banco
    const bankFiles = activeBankFiles.filter(f => f.bankId === bank.id);
    const isUploaded = bankFiles.length > 0;
    const isSelected = selectedBankIds.includes(bank.id);
    
    const totalTransactions = bankFiles.reduce((acc, f) => acc + (f.processedTransactions?.length || 0), 0);

    const toggleMenu = () => {
        if (isMenuOpen) {
            setIsMenuOpen(false);
            setMenuPos(null); // Reseta posição ao fechar
        } else {
            setIsMenuOpen(true);
            setMenuPos(null); // Abre centralizado por padrão
        }
    };

    // Manipuladores de Arraste (Mouse Events)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (menuRef.current) {
            setIsDragging(true);
            const rect = menuRef.current.getBoundingClientRect();
            // Calcula o offset do mouse em relação ao topo/esquerda da janela
            dragStartRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }
    };

    // Efeito global para mover o menu (funciona mesmo se o mouse sair da div)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                e.preventDefault(); // Evita seleção de texto
                const newX = e.clientX - dragStartRef.current.x;
                const newY = e.clientY - dragStartRef.current.y;
                setMenuPos({ x: newX, y: newY });
            }
        };

        const handleMouseUp = () => {
            if (isDragging) setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // Fecha menu ao clicar fora (Click Outside)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Se estiver arrastando, ignora clique fora
            if (isDragging) return;
            
            // Verifica se o clique foi fora do menu
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                // Pequeno delay para permitir que cliques em botões dentro do menu funcionem antes de fechar
                // Mas especificamente para clique FORA
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            // Timeout para evitar que o clique que abriu o menu já o feche imediatamente
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen, isDragging]);

    // --- LÓGICA DE APPEND (LISTA VIVA) ---
    const handleAppend = async (content: string, fileName: string, rawFile: File) => {
        setIsUploading(true);
        try {
            const result = processFileContent(content, fileName, fileModels, effectiveIgnoreKeywords);
            const newTransactions = result.transactions;

            if (newTransactions.length === 0) {
                showToast("Nenhuma transação válida encontrada.", "error");
                return;
            }

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
                        bank_id: bank.id
                    }));
                    await consolidationService.addTransactions(consolidationData);
                } catch (e) {
                    console.warn("Falha na persistência remota (Offline mode)", e);
                }
            }

            setBankStatementFile((prevFiles: any[]) => {
                return [...prevFiles, {
                    bankId: bank.id,
                    content,
                    fileName,
                    rawFile,
                    processedTransactions: newTransactions
                }];
            });
            
            showToast(`${newTransactions.length} transações adicionadas!`, "success");

        } catch (e: any) {
            console.error(e);
            showToast("Erro ao adicionar: " + e.message, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUploadWrapper = async (content: string, fileName: string, rawFile: File) => {
        if (uploadModeRef.current === 'replace') {
            setIsUploading(true);
            handleStatementUpload(content, fileName, bank.id, rawFile);
            setTimeout(() => setIsUploading(false), 500);
        } else {
            await handleAppend(content, fileName, rawFile);
        }
        setIsMenuOpen(false);
    };

    const triggerUpload = (mode: 'replace' | 'append') => {
        uploadModeRef.current = mode;
        uploaderRef.current?.open();
        setIsMenuOpen(false);
    };

    const handleGmailSuccess = (csvContent: string) => {
        const virtualFile = new File([csvContent], "gmail_import.csv", { type: "text/csv" });
        if (isUploaded) {
            handleAppend(csvContent, `Gmail - ${new Date().toLocaleDateString()}`, virtualFile);
        } else {
            handleStatementUpload(csvContent, `Gmail - ${new Date().toLocaleDateString()}`, bank.id, virtualFile);
        }
    };

    const removeSpecificFile = async (fileToRemove: any) => {
        setIsUploading(true);
        setIsMenuOpen(false); // Fecha o menu para feedback visual imediato
        
        try {
            // 1. Identificar arquivos que DEVEM permanecer
            const remainingFiles = bankFiles.filter(f => f !== fileToRemove);

            // 2. Sincronizar com o Banco de Dados (Source of Truth)
            // IMPORTANTE: Primeiro deleta tudo, depois reinsere o que sobra.
            // Isso garante que o estado do banco seja EXATAMENTE igual ao estado desejado.
            if (user) {
                // Passo A: Resetar (Deletar tudo deste banco)
                await consolidationService.deletePendingTransactions(user.id, bank.id);
                
                // Passo B: Reconstruir (Adicionar os arquivos restantes)
                if (remainingFiles.length > 0) {
                    const allTxs = remainingFiles.flatMap(f => f.processedTransactions || []);
                    if (allTxs.length > 0) {
                        const consolidationData = allTxs.map(t => ({
                            transaction_date: t.date,
                            amount: t.amount,
                            description: t.description,
                            type: (t.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                            pix_key: null,
                            source: 'file' as 'file',
                            user_id: user.id,
                            bank_id: bank.id
                        }));
                        await consolidationService.addTransactions(consolidationData);
                    }
                }
            }

            // 3. Se o banco confirmou (sem erro), atualiza a UI
            setBankStatementFile((prev: any[]) => prev.filter(f => f !== fileToRemove));
            showToast("Arquivo removido e sincronizado.", "success");

        } catch (e: any) {
            console.error("Sync error during removal:", e);
            // Se falhar o banco, NÃO atualiza a UI para evitar estado zumbi.
            // O usuário verá o arquivo lá e saberá que deve tentar de novo.
            showToast("Erro ao remover: Falha na sincronização com o servidor.", "error");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 group relative ${isUploaded ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800'}`}>
            
            {/* Hidden Uploader */}
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

            {/* Selection Checkbox */}
            {isUploaded && (
                <div className="flex items-center">
                    <div 
                        onClick={() => toggleBankSelection(bank.id)}
                        className={`
                            w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all
                            ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-emerald-200 hover:border-emerald-400'}
                        `}
                    >
                        {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div className="flex flex-col min-w-0 flex-1">
                <span className={`font-bold text-sm truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}`}>{bank.name}</span>
                {isUploaded ? (
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide">
                            Lista Viva Ativa
                        </span>
                        <span className="text-[9px] text-slate-400">
                            ({totalTransactions} txs • {bankFiles.length} arqs)
                        </span>
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-400 italic mt-0.5">Nenhum arquivo</span>
                )}
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-2">
                {isUploading ? (
                    <div className="p-2">
                        <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                ) : !isUploaded ? (
                    <button 
                        onClick={() => triggerUpload('replace')}
                        className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-brand-blue hover:text-brand-blue rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm transition-all"
                    >
                        {t('upload.statementButton')}
                    </button>
                ) : (
                    // Menu de Ações (Botão Trigger)
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleMenu(); }}
                        className={`p-2 rounded-full transition-all border ${isMenuOpen ? 'bg-blue-50 border-blue-200 text-brand-blue' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                        <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                )}

                {/* MENU RENDERIZADO VIA PORTAL (BLINDAGEM TOTAL) */}
                {isMenuOpen && createPortal(
                    <div 
                        ref={menuRef}
                        style={{ 
                            position: 'fixed', 
                            // Se menuPos existe, usa ele (drag). Se não, centraliza (default).
                            left: menuPos ? menuPos.x : '50%', 
                            top: menuPos ? menuPos.y : '50%',
                            transform: menuPos ? 'none' : 'translate(-50%, -50%)',
                            zIndex: 9999,
                            width: '280px',
                            cursor: 'default'
                        }}
                        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-scale-in ring-1 ring-black/5 flex flex-col"
                    >
                        {/* Header de Arraste */}
                        <div 
                            onMouseDown={handleMouseDown}
                            className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between cursor-move select-none active:cursor-grabbing group"
                        >
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <ArrowsRightLeftIcon className="w-3 h-3 rotate-45 group-hover:text-brand-blue transition-colors" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Gerenciar Extratos</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Conteúdo do Menu */}
                        <div className="flex flex-col py-1">
                            <button onClick={() => triggerUpload('append')} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors group/item">
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500 group-hover/item:text-blue-600"><PlusCircleIcon className="w-4 h-4" /></div>
                                <div><span className="block">Adicionar arquivo</span><span className="text-[9px] font-normal text-slate-400">Somar à lista atual</span></div>
                            </button>
                            
                            <button onClick={() => triggerUpload('replace')} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors group/item">
                                <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-500 group-hover/item:text-amber-600"><ArrowPathIcon className="w-4 h-4" /></div>
                                <div><span className="block">Substituir tudo</span><span className="text-[9px] font-normal text-slate-400">Começar do zero</span></div>
                            </button>
                            
                            <button onClick={() => { setIsGmailModalOpen(true); setIsMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors group/item">
                                <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-500 group-hover/item:text-red-600"><EnvelopeIcon className="w-4 h-4" /></div>
                                <div><span className="block">Importar Gmail</span><span className="text-[9px] font-normal text-slate-400">Buscar comprovantes</span></div>
                            </button>
                            
                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                            
                            <div className="px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Arquivos Ativos ({bankFiles.length}):</div>
                            <div className="max-h-32 overflow-y-auto custom-scrollbar">
                                {bankFiles.map((file, idx) => (
                                    <div key={`${idx}-${file.fileName}`} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 group/file">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <DocumentDuplicateIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[140px]" title={file.fileName}>{file.fileName}</span>
                                        </div>
                                        <button 
                                            onClick={() => removeSpecificFile(file)}
                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover/file:opacity-100"
                                            title="Excluir este arquivo"
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                            
                            <button onClick={() => { removeBankStatementFile(bank.id); setIsMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-xs font-bold w-full text-left transition-colors group/item text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500"><TrashIcon className="w-3.5 h-3.5" /></div>
                                <span>Excluir Tudo</span>
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {isGmailModalOpen && <GmailModal onClose={() => setIsGmailModalOpen(false)} onSuccess={handleGmailSuccess} />}
        </div>
    );
};

export const UploadView: React.FC = () => {
    const { user } = useAuth();
    const { 
        banks, 
        churches, 
        activeBankFiles, 
        selectedBankIds, 
        contributorFiles, 
        handleContributorsUpload, 
        removeContributorFile,
        resetReconciliation,
        activeReportId 
    } = useContext(AppContext);
    const { t } = useTranslation();
    const [showConfig, setShowConfig] = useState(false);

    // Texto dinâmico do botão
    const hasFiles = activeBankFiles.length > 0;
    const hasSelection = selectedBankIds.length > 0;
    const canProcess = hasSelection || !!activeReportId;

    let actionButtonText = "Configurar & Processar";
    if (activeReportId) actionButtonText = "Atualizar Relatório Ativo";
    else if (hasFiles && !hasSelection) actionButtonText = "Selecione um Banco";
    else if (hasSelection) actionButtonText = `Processar (${selectedBankIds.length})`;

    const actionButtonStyle = activeReportId 
        ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-orange-500/30" 
        : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/30";

    return (
        <div className="flex flex-col h-full animate-fade-in gap-6 pb-4 px-1">
            {/* 1. Cabeçalho com Botões de Ação */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('upload.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('upload.subtitle')}</p>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                    <button 
                        onClick={resetReconciliation}
                        className="relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-lg shadow-rose-500/20 hover:-translate-y-0.5 transition-all active:scale-95 group border border-white/10"
                    >
                        <TrashIcon className="w-3.5 h-3.5 stroke-[2]" />
                        <span className="hidden sm:inline">Nova Conciliação</span>
                    </button>
                    <GmailButton />
                </div>
            </div>

            {/* 2. Box de Suporte */}
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
                    
                    {/* COLUNA 1: BANCOS (COM SMART CARD BLINDADO) */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-brand-blue dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                    <BanknotesIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">1. {t('upload.statementTitle')}</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight max-w-[250px]">Carregue e selecione os bancos para conciliar.</p>
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
                                banks.map(bank => (
                                    <SmartBankCard key={bank.id} bank={bank} />
                                ))
                            )}
                        </div>
                    </div>

                    {/* COLUNA 2: IGREJAS (LISTAS DE MEMBROS) */}
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
                                                {isUploaded && (
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
                    disabled={!canProcess} 
                    className={`flex items-center gap-3 px-8 py-3.5 text-white rounded-full shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-xs font-bold uppercase tracking-widest group border border-white/10 ${actionButtonStyle}`}
                >
                    <BoltIcon className="w-5 h-5 group-hover:text-white transition-colors" />
                    {actionButtonText}
                </button>
            </div>

            {/* Modal de Configuração */}
            {showConfig && <InitialComparisonModal onClose={() => setShowConfig(false)} />}
        </div>
    );
};
