
import React, { useState, useEffect } from 'react';
import { paymentService } from '../../services/paymentService';
import { profileService } from '../../services/profileService';
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
                const payments = await paymentService.getPaymentsFromDb();

                if (payments && payments.length > 0) {
                    const profiles = await profileService.getAllProfiles();
                    
                    const enriched = payments.map((p: any) => ({
                        ...p,
                        profile: profiles?.find((prof: any) => prof.id === p.user_id) || { email: 'Desconhecido', name: '---' }
                    }));
                    setPaymentsList(enriched);
                } else {
                    setPaymentsList([]);
                }
            } catch (error: any) {
                console.error("Erro ao buscar pagamentos:", error);
                showToast("Erro ao carregar auditoria: " + (error.message || 'Erro desconhecido'), "error");
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
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 overflow-hidden animate-fade-in relative h-full flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Auditoria de Pagamentos (<span className="tabular-nums">{filteredPayments.length}</span>)
                </h3>
                <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder="Buscar em pagamentos..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors w-full md:w-64"
                    />
                </div>
            </div>
            <div
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                className="flex-1 overflow-auto custom-scrollbar"
            >
                <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/90 dark:bg-slate-950/60 sticky top-0 font-semibold backdrop-blur-sm z-10 border-b border-slate-200/80 dark:border-slate-800">
                        <tr>
                            <th className="px-4 py-3">Data</th>
                            <th className="px-4 py-3">Usuário</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3">Notas</th>
                            <th className="px-4 py-3 text-center">Recibo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {isLoadingData ? (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">Carregando...</td></tr>
                        ) : filteredPayments.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">Nenhum pagamento registrado.</td></tr>
                        ) : (
                            filteredPayments.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {new Date(p.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[180px]">{p.profile?.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                                        {formatCurrency(p.amount)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <AdminStatusBadge status={p.status} />
                                    </td>
                                    <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate" title={p.notes}>
                                        {p.notes || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {p.receipt_url ? (
                                            <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-orange-600 dark:text-orange-400 hover:underline text-xs font-semibold">Ver</a>
                                        ) : (
                                            <span className="text-slate-300 dark:text-slate-600">-</span>
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
