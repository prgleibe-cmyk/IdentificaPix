
import React from 'react';
import { BuildingOfficeIcon, TagIcon, CreditCardIcon, CheckCircleIcon, ChevronDownIcon, SparklesIcon } from '../../Icons';

interface SmartEditFormProps {
    isReverseMode: boolean;
    isAiProposed: boolean;
    manualChurchId: string;
    setManualChurchId: (v: string) => void;
    manualType: string;
    setManualType: (v: string) => void;
    manualPaymentMethod: string;
    setManualPaymentMethod: (v: string) => void;
    churches: any[];
    contributionKeywords: string[];
    paymentMethods: string[];
    onSave: () => void;
}

export const SmartEditForm: React.FC<SmartEditFormProps> = ({
    isReverseMode, isAiProposed, manualChurchId, setManualChurchId,
    manualType, setManualType, manualPaymentMethod, setManualPaymentMethod,
    churches, contributionKeywords, paymentMethods, onSave
}) => (
    <div className={`p-3 rounded-xl border transition-all duration-500 ${isAiProposed ? 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-slate-50/50 border-slate-100 dark:border-slate-800'}`}>
        {!isReverseMode && (
            <div className="mb-2">
                <label className={`block text-[8px] font-bold uppercase tracking-widest mb-1 ml-1 flex items-center gap-1 ${isAiProposed ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                    {isAiProposed && <SparklesIcon className="w-2.5 h-2.5" />} Destinar para Igreja
                </label>
                <div className="relative group">
                    <BuildingOfficeIcon className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${isAiProposed ? 'text-purple-500' : 'text-slate-400'}`} />
                    <select value={manualChurchId} onChange={(e) => setManualChurchId(e.target.value)} className={`w-full bg-white dark:bg-slate-950 border rounded-lg py-1.5 pl-9 pr-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-blue outline-none transition-all appearance-none ${isAiProposed ? 'border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100' : 'border-slate-200 dark:border-slate-800'}`}>
                        <option value="" disabled>Selecione a igreja</option>
                        {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDownIcon className={`w-3 h-3 ${isAiProposed ? 'text-purple-400' : 'text-slate-400'}`} /></div>
                </div>
            </div>
        )}
        <div className="grid grid-cols-2 gap-2">
            <div>
                <label className={`block text-[8px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 ${isAiProposed ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-500'}`}><TagIcon className="w-2.5 h-2.5" /> Tipo</label>
                <div className="relative">
                    <select value={manualType} onChange={(e) => setManualType(e.target.value)} className={`w-full bg-white dark:bg-slate-950 border rounded-lg py-1.5 px-3 text-[10px] font-bold focus:ring-2 focus:ring-brand-blue outline-none transition-all appearance-none ${isAiProposed ? 'border-purple-300 dark:border-purple-700' : 'border-indigo-200 dark:border-indigo-800 text-slate-700 dark:text-slate-200'}`}>
                        <option value="">Sem categoria</option>
                        {contributionKeywords.map((k: string) => <option key={k} value={k}>{k}</option>)}
                        <option value="OUTROS">OUTROS</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDownIcon className="w-2.5 h-2.5" /></div>
                </div>
            </div>
            <div>
                <label className={`block text-[8px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 ${isAiProposed ? 'text-purple-600 dark:text-purple-400' : 'text-blue-500'}`}><CreditCardIcon className="w-2.5 h-2.5" /> Forma</label>
                <div className="relative">
                    <select value={manualPaymentMethod} onChange={(e) => setManualPaymentMethod(e.target.value)} className={`w-full bg-white dark:bg-slate-950 border rounded-lg py-1.5 px-3 text-[10px] font-bold focus:ring-2 focus:ring-brand-blue outline-none transition-all appearance-none ${isAiProposed ? 'border-purple-300 dark:border-purple-700' : 'border-blue-200 dark:border-blue-800 text-slate-700 dark:text-slate-200'}`}>
                        <option value="">Sem forma</option>
                        {paymentMethods.map((m: string) => <option key={m} value={m}>{m}</option>)}
                        <option value="OUTROS">OUTROS</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDownIcon className="w-2.5 h-2.5" /></div>
                </div>
            </div>
        </div>
        <button onClick={(e) => { e.preventDefault(); onSave(); }} disabled={!manualChurchId} className={`w-full mt-3 py-2 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 ${isAiProposed ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/20' : 'bg-brand-blue hover:bg-blue-600'}`}>
            <CheckCircleIcon className="w-3.5 h-3.5" /> Confirmar Identidade
        </button>
    </div>
);
