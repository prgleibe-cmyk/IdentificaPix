import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { CreditCardIcon, XMarkIcon } from '../Icons';

export const PaymentMethodsList: React.FC = () => {
    const { paymentMethods, addPaymentMethod, removePaymentMethod } = useContext(AppContext);
    const [newMethod, setNewMethod] = useState('');

    const handleAddMethod = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMethod.trim()) return;
        addPaymentMethod(newMethod);
        setNewMethod('');
    };
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-brand-blue dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                        <CreditCardIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Formas de Recebimento</h3>
                        <span className="text-[9px] font-bold text-brand-blue mt-1 block uppercase">{paymentMethods.length} ativas</span>
                    </div>
                </div>
            </div>
            
            <div className="flex-shrink-0 mb-3">
                <form onSubmit={handleAddMethod} className="relative">
                    <input
                        type="text"
                        value={newMethod}
                        onChange={(e) => setNewMethod(e.target.value)}
                        placeholder="Ex: PIX, CARTÃO, DINHEIRO..."
                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white py-2 pl-4 pr-16 font-medium transition-all text-[11px] outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />
                    <button type="submit" disabled={!newMethod.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-brand-blue text-white text-[9px] font-bold uppercase rounded-lg shadow-md active:scale-95 transition-all">OK</button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-1">
                {paymentMethods.map((method: string) => (
                    <div key={method} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl shadow-sm hover:border-brand-blue/30 transition-all group">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{method}</span>
                        <button onClick={() => removePaymentMethod(method)} className="p-1 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};