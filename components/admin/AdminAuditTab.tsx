
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useUI } from '../../contexts/UIContext';
import { formatCurrency } from '../../utils/formatters';
import { MagnifyingGlassIcon } from '../Icons';
import { AdminStatusBadge } from './AdminStatusBadge';

export const AdminAuditTab: React.FC = () => {
    const { showToast } = useUI();
    const [paymentsList, setPaymentsList] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchPayments = async () => {
            setIsLoadingData(true);
            try {
                const { data: payments, error } = await supabase
                    .from('payments')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (payments && payments.length > 0) {
                    const userIds = [...new Set(payments.map(p => p.user_id))];
                    const { data: profiles } = await supabase.from('profiles').select('id, email, name').in('id', userIds);
                    
                    const enriched = payments.map(p => ({
                        ...p,
                        profile: profiles?.find(prof => prof.id === p.user_id) || { email: 'Desconhecido', name: '---' }
                    }));
                    setPaymentsList(enriched);
                } else {
                    setPaymentsList([]);
                }
            } catch (error: any) {
                console.error("Erro ao buscar pagamentos:", error);
                showToast("Erro ao carregar auditoria: " + error.message, "error");
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchPayments();
    }, [showToast]);

    const filteredPayments = paymentsList.filter(p => 
        (p.profile?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in relative h-full flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Auditoria de Pagamentos ({filteredPayments.length})</h3>
                <div className="relative">
                    <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder="Buscar em pagamentos..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-blue outline-none w-full md:w-64 font-medium"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-xs text-left">
                    <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 sticky top-0 font-bold backdrop-blur-sm z-10">
                        <tr>
                            <th className="px-3 py-2">Data</th>
                            <th className="px-3 py-2">Usuário</th>
                            <th className="px-3 py-2 text-right">Valor</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-3 py-2">Notas</th>
                            <th className="px-3 py-2 text-center">Recibo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {isLoadingData ? (
                            <tr><td colSpan={6} className="text-center py-8">Carregando...</td></tr>
                        ) : filteredPayments.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhum pagamento registrado.</td></tr>
                        ) : (
                            filteredPayments.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-3 py-2 text-[10px] font-mono text-slate-500">
                                        {new Date(p.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2">
                                        <p className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[150px]">{p.profile?.email}</p>
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-white">
                                        {formatCurrency(p.amount)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <AdminStatusBadge status={p.status} />
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-500 max-w-xs truncate" title={p.notes}>
                                        {p.notes || '-'}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {p.receipt_url ? (
                                            <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline text-[10px] font-bold uppercase">Ver</a>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
