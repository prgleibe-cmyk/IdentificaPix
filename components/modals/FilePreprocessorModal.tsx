
import React, { useState, useMemo, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext'; 
import { useAuth } from '../../contexts/AuthContext';
import { modelService } from '../../services/modelService';
import { FileModel, Transaction } from '../../types';

// Sub-componentes
import { PDFRenderer } from './preprocessor/PDFRenderer';
import { ImageRenderer } from './preprocessor/ImageRenderer';
import { SpreadsheetRenderer } from './preprocessor/SpreadsheetRenderer';
import { SimulatedResultsTable } from './preprocessor/SimulatedResultsTable';
import { MappingControls } from './preprocessor/MappingControls';
import { TeachingBanner } from './preprocessor/TeachingBanner';
import { PreprocessorHeader } from './preprocessor/PreprocessorHeader';

// Hooks
import { useFileProcessing } from '../../hooks/useFileProcessing';
import { useSimulation } from '../../hooks/useSimulation';
import { useAIPatternTeacher } from '../../hooks/useAIPatternTeacher';

export const FilePreprocessorModal: React.FC<{ 
    onClose: () => void; 
    initialFile?: any;
    initialModel?: FileModel; 
    onSuccess?: (model: FileModel, data: Transaction[]) => void;
    mode?: 'create' | 'test' | 'refine'; 
}> = ({ onClose, initialFile, initialModel, onSuccess, mode = 'create' }) => {
    const { showToast } = useUI();
    const { user } = useAuth(); 
    const { effectiveIgnoreKeywords, contributionKeywords } = useContext(AppContext);
    
    const activeFile = initialFile || null;
    const isPdf = useMemo(() => activeFile?.fileName?.toLowerCase().endsWith('.pdf'), [activeFile]);
    const isImage = useMemo(() => /\.(jpg|jpeg|png|webp)$/i.test(activeFile?.fileName || ''), [activeFile]);
    const cleaningKeywords = useMemo(() => [...effectiveIgnoreKeywords, ...contributionKeywords], [effectiveIgnoreKeywords, contributionKeywords]);

    // --- 🧠 LOGIC HOOKS ---
    const { 
        gridData, setGridData, isGridLoading, isAiProcessing, 
        activeMapping, setActiveMapping, detectedFingerprint 
    } = useFileProcessing({ activeFile, initialModel, isImage, isPdf });

    const {
        processedTransactions, editingRowIndex, editingRowData, 
        setEditingRowData, startEdit, saveRow, cancelEdit, runSimulation
    } = useSimulation({ gridData, activeMapping, cleaningKeywords });

    const {
        isInferringMapping, learnedPatternSource, setLearnedPatternSource, handleApplyCorrectionPattern
    } = useAIPatternTeacher({ gridData, setGridData, setActiveMapping, showToast });

    // --- 🏗️ PERSISTENCE STATE ---
    const [isSavingModel, setIsSavingModel] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<'draft' | 'approved'>('draft');
    const [modelName, setModelName] = useState(initialModel?.name || '');

    const handlePersistModel = useCallback(async (approvalStatus: 'draft' | 'approved', finalName: string) => {
        if (!activeMapping || !detectedFingerprint || !user) return;
        setIsSavingModel(true);
        try {
            const finalSnippet = activeFile?.content?.substring(0, 5000) || gridData.slice(0, 50).map(row => row.join(';')).join('\n');
            const saved = await modelService.saveModel({ 
                name: finalName, 
                user_id: user.id, 
                version: initialModel ? initialModel.version + 1 : 1, 
                lineage_id: initialModel ? initialModel.lineage_id : `mod-${Date.now()}`, 
                is_active: true, 
                fingerprint: detectedFingerprint, 
                mapping: activeMapping, 
                parsingRules: { ignoredKeywords: initialModel?.parsingRules?.ignoredKeywords || [], rowFilters: [] }, 
                snippet: finalSnippet, 
                lastUsedAt: new Date().toISOString(), 
                status: approvalStatus, 
                approvedBy: approvalStatus === 'approved' ? user.id : undefined, 
                approvedAt: approvalStatus === 'approved' ? new Date().toISOString() : undefined 
            });
            
            showToast(approvalStatus === 'approved' ? "Modelo aprovado!" : "Modelo salvo.", "success");
            if (onSuccess && saved) onSuccess(saved as FileModel, processedTransactions.filter(t => t.isValid));
            else onClose();
        } catch (e: any) { 
            showToast("Erro ao salvar modelo.", "error"); 
        } finally { 
            setIsSavingModel(false); 
        }
    }, [activeMapping, detectedFingerprint, user, activeFile, gridData, initialModel, processedTransactions, onSuccess, onClose, showToast]);

    const canApprove = processedTransactions.length > 0 && mode !== 'test';

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#050B14]/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in overflow-hidden">
            <div className="bg-white dark:bg-[#0F172A] w-full max-w-[1600px] h-full max-h-[95dvh] rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-scale-in relative">
                
                <PreprocessorHeader 
                    fileName={activeFile?.fileName || 'Novo Layout'} 
                    canApprove={canApprove} 
                    onApprove={() => { setPendingAction('approved'); setShowNameModal(true); }}
                    onClose={onClose}
                />

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                    <section className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120]">
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex gap-3 items-center z-20 shrink-0">
                            <MappingControls mapping={activeMapping} setMapping={setActiveMapping} columnCount={gridData[0]?.length || 0} onSimulate={runSimulation} />
                        </div>
                        <div className="flex-1 relative overflow-hidden">
                            {isPdf && activeFile?.rawFile && !isAiProcessing ? <PDFRenderer file={activeFile.rawFile} /> : 
                             isImage && activeFile?.rawFile && !isAiProcessing ? <ImageRenderer file={activeFile.rawFile} /> : 
                             <SpreadsheetRenderer data={gridData} isLoading={isGridLoading} detectedMapping={activeMapping} isAiProcessed={isAiProcessing} />}
                        </div>
                    </section>

                    <section className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0F172A]">
                        <TeachingBanner isVisible={!!learnedPatternSource} isProcessing={isInferringMapping} onApply={handleApplyCorrectionPattern} />
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <SimulatedResultsTable 
                                transactions={processedTransactions} activeMapping={!!activeMapping} isTestMode={mode === 'test'} 
                                editingRowIndex={editingRowIndex} editingRowData={editingRowData} onStartEdit={startEdit} 
                                onSaveRow={() => saveRow((original, corrected) => setLearnedPatternSource({ originalRaw: original, corrected }))} 
                                onCancelEdit={cancelEdit} onUpdateEditingData={setEditingRowData} 
                            />
                        </div>
                    </section>
                </div>
                
                {showNameModal && (
                    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-white/10 animate-scale-in text-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Identificar Padrão</h3>
                            <input type="text" autoFocus value={modelName} onChange={e => setModelName(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white mb-6 outline-none font-bold" />
                            <div className="flex gap-3">
                                <button onClick={() => setShowNameModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold uppercase text-[10px]">Cancelar</button>
                                <button onClick={() => { setShowNameModal(false); handlePersistModel(pendingAction, modelName); }} disabled={isSavingModel || !modelName.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-[10px]">{isSavingModel ? 'Salvando...' : 'Confirmar'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
