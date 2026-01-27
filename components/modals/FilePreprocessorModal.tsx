
import React, { useState, useMemo, useContext, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext'; 
import { useAuth } from '../../contexts/AuthContext';
import { modelService } from '../../services/modelService';
import { FileModel, Transaction } from '../../types';
import { CloudArrowUpIcon, DocumentArrowDownIcon, SparklesIcon, TableCellsIcon, ShieldCheckIcon, BrainIcon, BoltIcon, PencilIcon } from '../Icons';

// Sub-componentes
import { SpreadsheetRenderer } from './preprocessor/SpreadsheetRenderer';
import { PDFRenderer } from './preprocessor/PDFRenderer';
import { SimulatedResultsTable } from './preprocessor/SimulatedResultsTable';
import { MappingControls } from './preprocessor/MappingControls';
import { TeachingBanner } from './preprocessor/TeachingBanner';
import { PreprocessorHeader } from './preprocessor/PreprocessorHeader';

// Hooks
import { useFileProcessing } from '../../hooks/useFileProcessing';
import { useSimulation } from '../../hooks/useSimulation';
import { useAIPatternTeacher } from '../../hooks/useAIPatternTeacher';
import { FileUploader } from '../FileUploader';

export const FilePreprocessorModal: React.FC<{ 
    onClose: () => void; 
    initialFile?: any;
    initialModel?: FileModel; 
    onSuccess?: (model: FileModel, data: Transaction[]) => void;
    mode?: 'create' | 'test' | 'refine'; 
}> = ({ onClose, initialFile, initialModel, onSuccess, mode = 'create' }) => {
    const { showToast } = useUI();
    const { user } = useAuth(); 
    const context = useContext(AppContext);
    
    const effectiveIgnoreKeywords = context?.effectiveIgnoreKeywords || [];
    const contributionKeywords = context?.contributionKeywords || [];
    const fetchModels = context?.fetchModels;

    const [uploadedFile, setUploadedFile] = useState<{ content: string, fileName: string, rawFile?: File } | null>(null);

    useEffect(() => {
        if (mode === 'refine' && initialModel && !uploadedFile && !initialFile) {
            setUploadedFile({
                content: initialModel.snippet || "",
                fileName: initialModel.name,
                rawFile: undefined
            });
        }
    }, [mode, initialModel, uploadedFile, initialFile]);
    
    const activeFile = initialFile || uploadedFile || null;
    const isPdf = useMemo(() => /\.pdf$/i.test(activeFile?.fileName || ''), [activeFile]);
    
    const cleaningKeywords = useMemo(() => [
        ...(effectiveIgnoreKeywords || []), 
        ...(contributionKeywords || [])
    ], [effectiveIgnoreKeywords, contributionKeywords]);

    const { 
        gridData, setGridData, isGridLoading,
        activeMapping, setActiveMapping, detectedFingerprint 
    } = useFileProcessing({ activeFile, initialModel, isPdf });

    const {
        processedTransactions, editingRowIndex, editingRowData, 
        setEditingRowData, startEdit, saveRow, cancelEdit, runSimulation
    } = useSimulation({ gridData, activeMapping, cleaningKeywords });

    const {
        isInferringMapping, learnedPatternSource, setLearnedPatternSource, handleApplyCorrectionPattern
    } = useAIPatternTeacher({ 
        gridData, 
        setGridData, 
        setActiveMapping, 
        showToast,
        fullFileText: activeFile?.content 
    });

    const [isSavingModel, setIsSavingModel] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<'draft' | 'approved'>('draft');
    const [modelName, setModelName] = useState(initialModel?.name || '');

    const handlePersistModel = useCallback(async (approvalStatus: 'draft' | 'approved', finalName: string) => {
        if (!activeMapping || !detectedFingerprint || !user) return;
        
        setIsSavingModel(true);
        try {
            const finalSnippet = gridData.map(row => row.join(';')).join('\n');
            
            // Extrai as palavras aprendidas do mapeamento temporário para as parsingRules permanentes
            const learnedKeywords = activeMapping.ignoredKeywords || [];
            
            const modelData: any = { 
                name: finalName, 
                user_id: user.id, 
                version: initialModel ? initialModel.version + 1 : 1, 
                lineage_id: initialModel ? initialModel.lineage_id : `mod-${Date.now()}`, 
                is_active: true, 
                fingerprint: {
                    ...detectedFingerprint,
                    delimiter: detectedFingerprint.delimiter || ';'
                }, 
                mapping: {
                    ...activeMapping,
                    ignoredKeywords: undefined // Remove do mapeamento principal para manter limpo
                }, 
                parsingRules: { 
                    ignoredKeywords: learnedKeywords, 
                    rowFilters: [] 
                }, 
                snippet: finalSnippet, 
                status: approvalStatus 
            };
            
            const saved = await modelService.saveModel(modelData);
            if (saved) {
                showToast(approvalStatus === 'approved' ? "Modelo certificado e salvo!" : "Rascunho salvo.", "success");
                if (fetchModels) await fetchModels();
                if (onSuccess) onSuccess(saved as FileModel, []);
                onClose();
            } else {
                throw new Error("Falha na persistência");
            }
        } catch (e: any) { 
            showToast("Erro ao salvar padrão no servidor.", "error"); 
        } finally { setIsSavingModel(false); }
    }, [activeMapping, detectedFingerprint, user, gridData, initialModel, onSuccess, onClose, showToast, fetchModels]);

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#050B14]/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in overflow-hidden">
            <div className="bg-white dark:bg-[#0F172A] w-full max-w-[1600px] h-full max-h-[95dvh] rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-scale-in relative">
                
                <PreprocessorHeader 
                    fileName={activeFile?.fileName || 'Laboratório de IA'} 
                    canApprove={processedTransactions.length > 0} 
                    onApprove={() => { setPendingAction('approved'); setShowNameModal(true); }}
                    onClose={onClose}
                />

                {activeFile && (
                    <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-30 shrink-0">
                        <div className="flex items-center gap-6">
                            <MappingControls 
                                mapping={activeMapping} 
                                setMapping={setActiveMapping} 
                                columnCount={gridData[0]?.length || 0} 
                                onSimulate={runSimulation}
                                gridData={gridData}
                            />
                        </div>
                        
                        <div className="hidden lg:flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-1.5 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm font-mono text-[9px]">
                            <span className="text-slate-400 uppercase font-black">DNA:</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{detectedFingerprint?.headerHash || '---'}</span>
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                    <section className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0B1120] relative">
                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center gap-2 z-20 shrink-0">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Documento Bruto</span>
                        </div>
                        <div className="flex-1 relative">
                            {isGridLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3"></div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lendo arquivo...</p></div>
                            ) : !activeFile ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-4 text-indigo-500"><TableCellsIcon className="w-8 h-8" /></div>
                                    <h4 className="text-sm font-black text-slate-800 dark:text-white mb-2 uppercase">Selecionar Arquivo de Treino</h4>
                                    <FileUploader id="pre-up" title="Selecionar Documento" onFileUpload={(c,f,r) => setUploadedFile({content:c, fileName:f, rawFile:r})} isUploaded={false} uploadedFileName={null} useLocalLoadingOnly={true} />
                                </div>
                            ) : (isPdf && activeFile.rawFile) ? <PDFRenderer file={activeFile.rawFile} /> : <SpreadsheetRenderer data={gridData} detectedMapping={activeMapping} />}
                        </div>
                    </section>

                    <section className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0F172A] relative">
                         <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4 text-indigo-500" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resultado da Extração</span>
                            </div>
                        </div>

                        <TeachingBanner isVisible={!!learnedPatternSource} isProcessing={isInferringMapping} onApply={() => handleApplyCorrectionPattern()} />
                        
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <SimulatedResultsTable 
                                transactions={processedTransactions} 
                                activeMapping={!!activeMapping} 
                                isTestMode={mode === 'test'} 
                                editingRowIndex={editingRowIndex} 
                                editingRowData={editingRowData} 
                                onStartEdit={startEdit} 
                                onSaveRow={() => saveRow((raw, corr) => setLearnedPatternSource({ originalRaw: raw, corrected: corr }))} 
                                onCancelEdit={cancelEdit} 
                                onUpdateEditingData={setEditingRowData} 
                            />
                        </div>
                    </section>
                </div>
                
                {showNameModal && (
                    <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-2xl w-full max-w-sm border border-white/10 animate-scale-in text-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Nomear Padrão</h3>
                            <p className="text-xs text-slate-500 mb-6 font-medium">Como deseja chamar este layout?</p>
                            <input type="text" autoFocus value={modelName} onChange={e => setModelName(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white mb-6 outline-none font-bold shadow-inner" />
                            <div className="flex gap-3">
                                <button onClick={() => setShowNameModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">Voltar</button>
                                <button onClick={() => { setShowNameModal(false); handlePersistModel(pendingAction, modelName); }} disabled={isSavingModel || !modelName.trim()} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold uppercase text-[10px] shadow-lg shadow-indigo-500/30 transition-all active:scale-95">
                                    {isSavingModel ? 'Gravando...' : 'Aprovar e Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
