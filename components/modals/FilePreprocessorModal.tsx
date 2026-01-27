
import React, { useState, useMemo, useContext, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext'; 
import { useAuth } from '../../contexts/AuthContext';
import { modelService } from '../../services/modelService';
import { FileModel, Transaction } from '../../types';
import { SparklesIcon, TableCellsIcon, ShieldCheckIcon } from '../Icons';

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

    const [uploadedFile, setUploadedFile] = useState<{ content: string, fileName: string, rawFile?: File, base64?: string } | null>(null);

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
        activeMapping, setActiveMapping, detectedFingerprint, rawBase64
    } = useFileProcessing({ activeFile, initialModel, isPdf });

    const {
        processedTransactions, isSimulating, editingRowIndex, editingRowData, 
        setEditingRowData, startEdit, saveRow, cancelEdit, runSimulation
    } = useSimulation({ 
        gridData, 
        activeMapping, 
        cleaningKeywords, 
        rawBase64: activeFile?.base64 || rawBase64 
    });

    const {
        isInferringMapping, learnedPatternSource, setLearnedPatternSource, handleApplyCorrectionPattern
    } = useAIPatternTeacher({ 
        gridData, 
        setGridData, 
        setActiveMapping, 
        showToast,
        fullFileText: activeFile?.content,
        rawBase64: activeFile?.base64 || rawBase64
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
            const learnedKeywords = activeMapping.ignoredKeywords || [];
            
            const modelData: any = { 
                name: finalName, 
                user_id: user.id, 
                version: initialModel ? initialModel.version : 1, 
                lineage_id: initialModel ? initialModel.lineage_id : `mod-${Date.now()}`, 
                is_active: true, 
                fingerprint: { ...detectedFingerprint }, 
                mapping: { ...activeMapping }, 
                parsingRules: { ignoredKeywords: learnedKeywords, rowFilters: [] }, 
                snippet: finalSnippet, 
                status: approvalStatus 
            };
            
            let saved;
            if (initialModel?.id) {
                // REFINAMENTO: Atualiza o registro existente
                saved = await modelService.updateModel(initialModel.id, modelData);
                if (saved) showToast("Contrato de modelo atualizado!", "success");
            } else {
                // CRIAÇÃO: Insere um novo registro
                saved = await modelService.saveModel(modelData);
                if (saved) showToast("Novo modelo salvo com sucesso!", "success");
            }

            if (saved) {
                if (fetchModels) await fetchModels();
                if (onSuccess) onSuccess(saved as FileModel, []);
                onClose();
            }
        } catch (e: any) { 
            showToast("Erro ao salvar padrão.", "error"); 
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

                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <MappingControls mapping={activeMapping} setMapping={setActiveMapping} columnCount={gridData[0]?.length || 0} onSimulate={runSimulation} gridData={gridData} />
                </div>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                    <section className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0B1120] relative">
                        {isGridLoading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3"></div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lendo arquivo...</p></div>
                        ) : !activeFile ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                                <TableCellsIcon className="w-16 h-16 text-indigo-500 mb-4 opacity-20" />
                                <FileUploader id="pre-up" title="Selecionar Documento" onFileUpload={(c,f,r,b) => setUploadedFile({content:c, fileName:f, rawFile:r, base64:b})} isUploaded={false} uploadedFileName={null} useLocalLoadingOnly={true} />
                            </div>
                        ) : (isPdf && activeFile.rawFile) ? <PDFRenderer file={activeFile.rawFile} /> : <SpreadsheetRenderer data={gridData} detectedMapping={activeMapping} />}
                    </section>

                    <section className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0F172A] relative">
                        <TeachingBanner isVisible={!!learnedPatternSource} isProcessing={isInferringMapping} onApply={() => handleApplyCorrectionPattern('BLOCK')} />
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <SimulatedResultsTable 
                                transactions={processedTransactions} 
                                activeMapping={!!activeMapping} 
                                isTestMode={mode === 'test'} 
                                isSimulating={isSimulating}
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
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-4">Nomear Padrão</h3>
                            <input type="text" autoFocus value={modelName} onChange={e => setModelName(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white mb-6 outline-none font-bold shadow-inner" placeholder="Ex: Extrato Itaú PJ" />
                            <div className="flex gap-3">
                                <button onClick={() => setShowNameModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold uppercase text-[10px] text-slate-600">Voltar</button>
                                <button onClick={() => { setShowNameModal(false); handlePersistModel(pendingAction, modelName); }} disabled={isSavingModel || !modelName.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-[10px] shadow-lg active:scale-95 transition-all">Salvar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
