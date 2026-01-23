
import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { FileUploader } from '../FileUploader';
import { CheckCircleIcon, EllipsisVerticalIcon } from '../Icons';
import { useSmartBankCard } from '../../hooks/useSmartBankCard';
import { BankManagerMenu } from './BankManagerMenu';

interface SmartBankCardProps {
    bank: any;
}

export const SmartBankCard: React.FC<SmartBankCardProps> = ({ bank }) => {
    const { 
        selectedBankIds,
        toggleBankSelection,
        removeBankStatementFile
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const ctrl = useSmartBankCard({ bank });

    const isUploaded = ctrl.bankFiles.length > 0;
    const isSelected = selectedBankIds.includes(bank.id);

    return (
        <div className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 group relative ${isUploaded ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800'}`}>
            <div className="hidden">
                <FileUploader 
                    ref={ctrl.uploaderRef}
                    id={`bank-${bank.id}`}
                    title="Upload"
                    onFileUpload={ctrl.handleFileUploadWrapper}
                    isUploaded={false}
                    uploadedFileName={null}
                    onParsingStatusChange={ctrl.setIsUploading}
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
                        <span className="text-[9px] text-slate-400">({ctrl.totalTransactions} txs)</span>
                    </div>
                ) : <span className="text-[10px] text-slate-400 italic mt-0.5">Nenhum arquivo</span>}
            </div>

            <div className="flex items-center gap-2">
                {ctrl.isUploading ? (
                    <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : !isUploaded ? (
                    <button onClick={() => ctrl.triggerUpload('replace')} className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-brand-blue hover:text-brand-blue rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm transition-all">{t('upload.statementButton')}</button>
                ) : (
                    <button onClick={() => ctrl.setIsMenuOpen(!ctrl.isMenuOpen)} className={`p-2 rounded-full transition-all border ${ctrl.isMenuOpen ? 'bg-blue-50 border-blue-200 text-brand-blue' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}><EllipsisVerticalIcon className="w-5 h-5" /></button>
                )}

                {ctrl.isMenuOpen && createPortal(
                    <BankManagerMenu 
                        menuRef={ctrl.menuRef}
                        menuPos={ctrl.menuPos}
                        onMouseDown={ctrl.handleMouseDown}
                        onClose={() => ctrl.setIsMenuOpen(false)}
                        onTriggerUpload={ctrl.triggerUpload}
                        bankFiles={ctrl.bankFiles}
                        onRemoveSpecific={ctrl.removeSpecificFile}
                        onRemoveAll={() => { removeBankStatementFile(bank.id); ctrl.setIsMenuOpen(false); }}
                    />, document.body
                )}
            </div>
        </div>
    );
};
