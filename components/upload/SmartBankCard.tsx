
import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { FileUploader } from '../FileUploader';
import { CheckCircleIcon, EllipsisVerticalIcon } from '../Icons';
import { useSmartBankCard } from '../../hooks/useSmartBankCard';
import { BankManagerMenu } from './BankManagerMenu';
import { resolveBankKey, resolveBankBrand, resolveBankColors, resolveBankFormats } from '../../utils/bankHelper';

interface SmartBankCardProps {
    bank: any;
}

export const SmartBankCard: React.FC<SmartBankCardProps> = ({ bank }) => {
    const { 
        selectedBankIds,
        toggleBankSelection,
        removeBankStatementFile,
        handleStatementUpload // Adicionado para referência direta caso necessário
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const ctrl = useSmartBankCard({ bank });

    const isUploaded = ctrl.bankFiles.length > 0;
    const isSelected = selectedBankIds.includes(bank.id);

    return (
        <div className={`p-4 rounded-3xl border transition-all duration-300 flex items-center justify-between gap-4 group relative min-h-[96px] ${
            isUploaded 
                ? isSelected 
                    ? 'bg-emerald-50/70 border-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-600 shadow-sm' 
                    : 'bg-emerald-50/20 border-emerald-200/60 dark:bg-emerald-950/5 dark:border-emerald-800/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10'
                : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-brand-blue/30 dark:hover:border-brand-blue/40 shadow-sm hover:shadow-md'
        }`}>
            <div className="hidden">
                <FileUploader 
                    ref={ctrl.uploaderRef}
                    id={`bank-${bank.id}`}
                    title="Upload"
                    onFileUpload={(content, fileName, rawFile, base64) => handleStatementUpload(content, fileName, bank.id, rawFile, base64)}
                    isUploaded={false}
                    uploadedFileName={null}
                    onParsingStatusChange={ctrl.setIsUploading}
                    bank={bank}
                />
            </div>

            <div className="flex items-center gap-4 min-w-0 flex-1">
                {isUploaded && (
                    <div 
                        onClick={() => toggleBankSelection(bank.id)}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center cursor-pointer transition-all shrink-0 shadow-sm ${
                            isSelected 
                                ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600' 
                                : 'bg-white dark:bg-slate-800 border-slate-250 dark:border-slate-600 hover:border-emerald-400'
                        }`}
                    >
                        {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                    </div>
                )}

                {(() => {
                    const key = resolveBankKey(bank);
                    const colors = resolveBankColors(bank);
                    const isGeneric = key === 'GENERIC';
                    const formats = resolveBankFormats(bank);

                    return (
                        <>
                            <div 
                                className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xs border overflow-hidden shrink-0 shadow-inner p-1 transition-transform duration-250 group-hover:scale-[1.03]"
                                style={{
                                    backgroundColor: isGeneric ? undefined : colors.bg,
                                    borderColor: isGeneric ? undefined : colors.border,
                                    color: isGeneric ? undefined : colors.text
                                }}
                            >
                                {isGeneric ? (
                                    <div className="w-full h-full bg-slate-50 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400 flex items-center justify-center rounded-xl border border-slate-200/50 dark:border-slate-700 font-black text-xl">
                                        {bank.name.charAt(0).toUpperCase()}
                                    </div>
                                ) : (
                                    resolveBankBrand(bank)
                                )}
                            </div>

                            <div className="flex flex-col min-w-0 flex-1 py-1">
                                <span className={`font-black text-sm tracking-tight truncate ${
                                    isSelected 
                                        ? 'text-emerald-800 dark:text-emerald-300' 
                                        : 'text-slate-800 dark:text-slate-100'
                                }`}>
                                    {bank.account_name ?? bank.name}
                                </span>
                                {isUploaded ? (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                            Lista Viva
                                        </span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                                            {ctrl.totalTransactions} txs
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1.5 mt-1 min-w-0">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {formats.map((fmt) => (
                                                <span 
                                                    key={fmt} 
                                                    className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md border uppercase shrink-0 tracking-wider ${
                                                        isGeneric 
                                                            ? "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/30 dark:border-slate-700 dark:text-slate-400" 
                                                            : ""
                                                    }`}
                                                    style={isGeneric ? undefined : {
                                                        backgroundColor: colors.bg,
                                                        borderColor: colors.border,
                                                        color: colors.text
                                                    }}
                                                >
                                                    {fmt}
                                                </span>
                                            ))}
                                        </div>
                                        <span className="text-[10px] text-slate-400 italic font-medium">Nenhum arquivo</span>
                                    </div>
                                )}
                                {resolveBankKey(bank) === 'SICOOB' && (
                                    <span className="text-[9px] text-amber-600 dark:text-amber-500 font-bold mt-1">
                                        Banco Sicoob: somente arquivos PDF são aceitos.
                                    </span>
                                )}
                                {resolveBankKey(bank) === 'SICREDI' && (
                                    <span className="text-[9px] text-amber-600 dark:text-amber-500 font-bold mt-1">
                                        Banco Sicredi: somente arquivos OFX são aceitos.
                                    </span>
                                )}
                            </div>
                        </>
                    );
                })()}
            </div>

            <div className="flex items-center gap-2">
                {ctrl.isUploading ? (
                    <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : !isUploaded ? (
                    <button 
                        onClick={() => ctrl.triggerUpload('replace')} 
                        className="px-3.5 py-2 bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-850 text-slate-700 dark:text-slate-200 hover:text-brand-blue dark:hover:text-brand-blue border border-slate-250 dark:border-slate-600 hover:border-brand-blue/50 dark:hover:border-brand-blue/50 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:shadow active:scale-[0.98] transition-all"
                    >
                        {t('upload.statementButton')}
                    </button>
                ) : (
                    <button 
                        onClick={() => ctrl.setIsMenuOpen(!ctrl.isMenuOpen)} 
                        className={`p-2 rounded-xl transition-all border ${
                            ctrl.isMenuOpen 
                                ? 'bg-blue-50/80 border-blue-200 text-brand-blue' 
                                : 'bg-white dark:bg-slate-800 border-slate-250 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:border-slate-350 shadow-sm'
                        }`}
                    >
                        <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
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
