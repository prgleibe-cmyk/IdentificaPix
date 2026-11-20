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
}) => {
    const [isCustomType, setIsCustomType] = React.useState(
        manualType !== '' && !contributionKeywords.includes(manualType) && manualType !== 'OUTROS'
    );
    const [isCustomPaymentMethod, setIsCustomPaymentMethod] = React.useState(
        manualPaymentMethod !== '' && !paymentMethods.includes(manualPaymentMethod) && manualPaymentMethod !== 'OUTROS'
    );

    React.useEffect(() => {
        if (manualType !== '' && !contributionKeywords.includes(manualType) && manualType !== 'OUTROS') {
            setIsCustomType(true);
        } else {
            setIsCustomType(false);
        }
    }, [manualType, contributionKeywords]);

    React.useEffect(() => {
        if (manualPaymentMethod !== '' && !paymentMethods.includes(manualPaymentMethod) && manualPaymentMethod !== 'OUTROS') {
            setIsCustomPaymentMethod(true);
        } else {
            setIsCustomPaymentMethod(false);
        }
    }, [manualPaymentMethod, paymentMethods]);

    return (
        <div className={`p-3 rounded-xl border transition-colors ${isAiProposed ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/80 dark:border-orange-900/50' : 'bg-slate-50/80 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800'}`}>
            {!isReverseMode && (
                <div className="mb-2.5">
                    <label className={`block text-[11px] font-medium mb-1 flex items-center gap-1 ${isAiProposed ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {isAiProposed && <SparklesIcon className="w-3 h-3" />} Destinar para Igreja
                    </label>
                    <div className="relative group">
                        <BuildingOfficeIcon className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${isAiProposed ? 'text-orange-500' : 'text-slate-400'}`} />
                        <select value={manualChurchId} onChange={(e) => setManualChurchId(e.target.value)} className={`w-full bg-white dark:bg-slate-900 border rounded-lg py-2 pl-9 pr-7 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors appearance-none cursor-pointer ${isAiProposed ? 'border-orange-300 dark:border-orange-800' : 'border-slate-200 dark:border-slate-700'}`}>
                            <option value="" disabled>Selecione a igreja</option>
                            {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDownIcon className={`w-3.5 h-3.5 ${isAiProposed ? 'text-orange-400' : 'text-slate-400'}`} /></div>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={`text-[11px] font-medium flex items-center gap-1 ${isAiProposed ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            <TagIcon className="w-3 h-3" /> Descrição
                        </label>
                        <select
                            value=""
                            onChange={(e) => {
                                if (e.target.value) setManualType(e.target.value);
                            }}
                            className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[10px] font-medium py-0.5 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer outline-none"
                            title="Escolher modelo"
                        >
                            <option value="" disabled>Modelos</option>
                            {contributionKeywords.map((k: string) => <option key={k} value={k}>{k}</option>)}
                            <option value="OUTROS">OUTROS</option>
                        </select>
                    </div>
                    <input 
                        type="text" 
                        value={manualType} 
                        onChange={(e) => setManualType(e.target.value)}
                        placeholder="Digite a descrição..." 
                        className={`w-full bg-white dark:bg-slate-900 border rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors ${isAiProposed ? 'border-orange-300 dark:border-orange-800' : 'border-slate-200 dark:border-slate-700'}`}
                    />
                </div>
                <div>
                    <label className={`block text-[11px] font-medium mb-1 flex items-center gap-1 ${isAiProposed ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-300'}`}><CreditCardIcon className="w-3 h-3" /> Forma</label>
                    {isCustomPaymentMethod ? (
                        <div className="relative flex gap-1">
                            <input 
                                type="text" 
                                value={manualPaymentMethod} 
                                onChange={(e) => setManualPaymentMethod(e.target.value.toUpperCase())}
                                placeholder="Digite a forma..." 
                                className={`w-full bg-white dark:bg-slate-900 border rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors ${isAiProposed ? 'border-orange-300 dark:border-orange-800' : 'border-slate-200 dark:border-slate-700'}`}
                                autoFocus
                            />
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsCustomPaymentMethod(false);
                                    setManualPaymentMethod('');
                                }}
                                className="px-2 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-semibold rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap cursor-pointer"
                                title="Voltar para a lista"
                            >
                                Lista
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <select 
                                value={manualPaymentMethod} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '__CUSTOM__') {
                                        setIsCustomPaymentMethod(true);
                                        setManualPaymentMethod('');
                                    } else {
                                        setManualPaymentMethod(val);
                                    }
                                }} 
                                className={`w-full bg-white dark:bg-slate-900 border rounded-lg py-1.5 pl-2.5 pr-6 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors appearance-none cursor-pointer ${isAiProposed ? 'border-orange-300 dark:border-orange-800' : 'border-slate-200 dark:border-slate-700'}`}
                            >
                                <option value="">Sem forma</option>
                                {paymentMethods.map((m: string) => <option key={m} value={m}>{m}</option>)}
                                <option value="OUTROS">OUTROS</option>
                                <option value="__CUSTOM__">Outro (Digitar manual...)</option>
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDownIcon className="w-3 h-3 text-slate-400" /></div>
                        </div>
                    )}
                </div>
            </div>
            <button onClick={(e) => { e.preventDefault(); onSave(); }} disabled={!manualChurchId} className="w-full mt-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                <CheckCircleIcon className="w-4 h-4" /> Confirmar Identidade
            </button>
        </div>
    );
};
