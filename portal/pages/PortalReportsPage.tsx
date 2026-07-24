import React, { useState, useEffect, useMemo } from 'react';
import { PortalChurch, ContributorMockProfile } from '../types/portal';
import { PortalContainer } from '../components/PortalContainer';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { formatCurrencyBrl } from '../utils/portalFormatters';
import { 
    FileText, 
    Search, 
    Calendar, 
    CheckCircle2, 
    Clock, 
    QrCode, 
    UserCheck, 
    Printer, 
    Download, 
    ArrowLeft, 
    PlusCircle, 
    DollarSign, 
    RefreshCw,
    X,
    Copy,
    Check
} from 'lucide-react';

interface PortalReportsPageProps {
    church?: PortalChurch | null;
    onNavigate: (route: string) => void;
}

interface ContributionRecord {
    id: string;
    church_id?: string;
    contributor_id?: string;
    amount: number;
    description: string;
    status: 'pending' | 'confirmed' | 'pago' | 'cancelled' | string;
    created_at: string;
    updated_at?: string;
    referenceCode?: string;
}

export const PortalReportsPage: React.FC<PortalReportsPageProps> = ({ church, onNavigate }) => {
    const [contributor, setContributor] = useState<ContributorMockProfile | null>(null);
    const [records, setRecords] = useState<ContributionRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [periodFilter, setPeriodFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedPixRecord, setSelectedPixRecord] = useState<ContributionRecord | null>(null);
    const [copiedPix, setCopiedPix] = useState<boolean>(false);
    const [receiptRecord, setReceiptRecord] = useState<ContributionRecord | null>(null);

    // Load stored contributor from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem('iggestor_portal_contributor');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.id || parsed.name || parsed.cpf)) {
                    setContributor(parsed);
                }
            }
        } catch (err) {
            console.error('[PortalReportsPage] Erro ao carregar perfil do contribuinte:', err);
        }
    }, []);

    // Fetch contributions for contributor
    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const churchId = church?.id || '00000000-0000-0000-0000-000000000001';
            const contribId = contributor?.id;

            let url = `/api/v1/contribution-requests?church_id=${churchId}`;
            if (contribId) {
                url += `&contributor_id=${contribId}`;
            }

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    const mapped = data.map((item: any) => ({
                        id: item.id,
                        church_id: item.church_id,
                        contributor_id: item.contributor_id,
                        amount: Number(item.amount) || 0,
                        description: item.description || 'Contribuição Voluntária',
                        status: item.status || 'pending',
                        created_at: item.created_at || new Date().toISOString(),
                        updated_at: item.updated_at,
                        referenceCode: `IG-${item.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`
                    }));
                    setRecords(mapped);
                }
            }
        } catch (err) {
            console.error('[PortalReportsPage] Erro ao buscar histórico:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [church?.id, contributor?.id]);

    const handleClearContributor = () => {
        try {
            localStorage.removeItem('iggestor_portal_contributor');
        } catch (_) {}
        setContributor(null);
        setRecords([]);
    };

    // Filter logic
    const filteredRecords = useMemo(() => {
        return records.filter(item => {
            // Status match
            if (filterStatus === 'confirmed' && item.status !== 'confirmed' && item.status !== 'pago') {
                return false;
            }
            if (filterStatus === 'pending' && item.status !== 'pending') {
                return false;
            }

            // Search term match
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const desc = item.description.toLowerCase();
                const ref = (item.referenceCode || '').toLowerCase();
                if (!desc.includes(term) && !ref.includes(term)) {
                    return false;
                }
            }

            // Period filter
            if (periodFilter !== 'all') {
                const date = new Date(item.created_at);
                const now = new Date();
                if (periodFilter === '30days') {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    if (date < thirtyDaysAgo) return false;
                } else if (periodFilter === 'month') {
                    if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) {
                        return false;
                    }
                } else if (periodFilter === 'last_month') {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    if (date.getMonth() !== lastMonth.getMonth() || date.getFullYear() !== lastMonth.getFullYear()) {
                        return false;
                    }
                } else if (periodFilter === 'year') {
                    if (date.getFullYear() !== now.getFullYear()) {
                        return false;
                    }
                } else if (periodFilter === 'custom') {
                    if (startDate) {
                        const start = new Date(`${startDate}T00:00:00`);
                        if (date < start) return false;
                    }
                    if (endDate) {
                        const end = new Date(`${endDate}T23:59:59`);
                        if (date > end) return false;
                    }
                }
            }

            return true;
        });
    }, [records, filterStatus, searchTerm, periodFilter, startDate, endDate]);

    // Summary Statistics
    const stats = useMemo(() => {
        const confirmedList = records.filter(r => r.status === 'confirmed' || r.status === 'pago');
        const totalAmount = confirmedList.reduce((acc, curr) => acc + curr.amount, 0);
        const totalCount = records.length;
        const lastRecord = records.length > 0 ? records[0] : null;

        return {
            totalAmount,
            totalCount,
            lastRecord
        };
    }, [records]);

    const handlePrint = () => {
        window.print();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedPix(true);
        setTimeout(() => setCopiedPix(false), 2000);
    };

    return (
        <PortalContainer maxWidth="7xl">
            <div className="space-y-6">
                {/* Header & Back Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                            <span>Portal do Contribuinte</span>
                            <span>•</span>
                            <span className="text-brand-orange font-bold">Relatório & Histórico</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            Minhas Contribuições
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                            Acompanhe seu extrato detalhado de dízimos, ofertas e doações.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <PortalButton
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigate('home')}
                            icon={PlusCircle}
                        >
                            Nova Contribuição
                        </PortalButton>
                        <PortalButton
                            variant="secondary"
                            size="sm"
                            onClick={handlePrint}
                            icon={Printer}
                        >
                            Imprimir
                        </PortalButton>
                    </div>
                </div>

                {/* Contributor Card Banner */}
                {contributor ? (
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 text-white p-5 rounded-2xl shadow-xl border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-brand-orange/20 border border-brand-orange/40 flex items-center justify-center text-brand-orange font-black text-xl shadow-inner shrink-0">
                                {contributor.name ? contributor.name.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                        {contributor.name || 'Contribuinte Identificado'}
                                    </h2>
                                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                                        <UserCheck className="w-3 h-3" /> Identificado
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1">
                                    {contributor.cpf && <span>CPF: <strong>{contributor.cpf}</strong></span>}
                                    {contributor.phone && <span>Tel: <strong>{contributor.phone}</strong></span>}
                                    {contributor.email && <span>Email: <strong>{contributor.email}</strong></span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 border-t sm:border-t-0 border-slate-700/60 pt-3 sm:pt-0 shrink-0">
                            <button
                                onClick={handleClearContributor}
                                className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                                Sair / Alterar CPF
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                                    Identifique-se para ver seu histórico completo
                                </h3>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                    Informe seu CPF ou telefone para listar as contribuições vinculadas ao seu cadastro.
                                </p>
                            </div>
                        </div>
                        <PortalButton
                            variant="primary"
                            size="sm"
                            onClick={() => onNavigate('identify')}
                        >
                            Identificar-me Agora
                        </PortalButton>
                    </div>
                )}

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <PortalCard className="p-5 flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Total Confirmado
                            </span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                {formatCurrencyBrl(stats.totalAmount)}
                            </div>
                        </div>
                    </PortalCard>

                    <PortalCard className="p-5 flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Total de Intenções
                            </span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                {stats.totalCount} {stats.totalCount === 1 ? 'registro' : 'registros'}
                            </div>
                        </div>
                    </PortalCard>

                    <PortalCard className="p-5 flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Última Oferta
                            </span>
                            <div className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                {stats.lastRecord ? (
                                    <>
                                        {formatCurrencyBrl(stats.lastRecord.amount)}{' '}
                                        <span className="text-xs font-normal text-slate-500">
                                            ({new Date(stats.lastRecord.created_at).toLocaleDateString('pt-BR')})
                                        </span>
                                    </>
                                ) : (
                                    'Nenhuma'
                                )}
                            </div>
                        </div>
                    </PortalCard>
                </div>

                {/* Filter and Search Bar */}
                <PortalCard className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por código ou descrição..."
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Status Filter */}
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                            >
                                <option value="all">Todos os Status</option>
                                <option value="confirmed">Confirmados / Pagos</option>
                                <option value="pending">Pendentes</option>
                            </select>

                            {/* Period Filter */}
                            <select
                                value={periodFilter}
                                onChange={(e) => setPeriodFilter(e.target.value)}
                                className="py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                            >
                                <option value="all">Todo o Período</option>
                                <option value="30days">Últimos 30 Dias</option>
                                <option value="month">Este Mês</option>
                                <option value="last_month">Mês Anterior</option>
                                <option value="year">Este Ano</option>
                                <option value="custom">Personalizado (Datas)</option>
                            </select>

                            <button
                                onClick={fetchHistory}
                                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                title="Atualizar"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Custom Date Range Picker inputs when 'custom' is selected */}
                    {periodFilter === 'custom' && (
                        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <span className="font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                                Período Específico:
                            </span>
                            <div className="flex items-center gap-1.5">
                                <label className="font-bold text-slate-600 dark:text-slate-400">De:</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <label className="font-bold text-slate-600 dark:text-slate-400">Até:</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                />
                            </div>
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); }}
                                    className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 underline cursor-pointer ml-auto sm:ml-0"
                                >
                                    Limpar Datas
                                </button>
                            )}
                        </div>
                    )}
                </PortalCard>

                {/* History Table */}
                <PortalCard className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
                    {isLoading ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-brand-orange" />
                            <p className="text-sm font-semibold">Carregando relatório de contribuições...</p>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                                Nenhuma contribuição encontrada
                            </h3>
                            <p className="text-xs text-slate-500 max-w-md">
                                {searchTerm || filterStatus !== 'all'
                                    ? 'Tente remover os filtros ou buscar com outro termo.'
                                    : 'Ainda não constam registros de ofertas para este contribuinte.'}
                            </p>
                            <PortalButton
                                variant="primary"
                                size="sm"
                                className="mt-2"
                                onClick={() => onNavigate('home')}
                                icon={PlusCircle}
                            >
                                Realizar Oferta Agora
                            </PortalButton>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-extrabold text-[11px] uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                                        <th className="py-3 px-4">Referência / Data</th>
                                        <th className="py-3 px-4">Descrição / Finalidade</th>
                                        <th className="py-3 px-4 text-right">Valor</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
                                    {filteredRecords.map((item) => {
                                        const isConfirmed = item.status === 'confirmed' || item.status === 'pago';
                                        const isPending = item.status === 'pending';

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <div className="font-mono text-xs font-bold text-brand-blue dark:text-blue-400">
                                                        {item.referenceCode}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        {new Date(item.created_at).toLocaleString('pt-BR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                                        {item.description}
                                                    </span>
                                                </td>

                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    <span className="font-extrabold text-slate-900 dark:text-white text-base">
                                                        {formatCurrencyBrl(item.amount)}
                                                    </span>
                                                </td>

                                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                    {isConfirmed ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                            Pago / Confirmado
                                                        </span>
                                                    ) : isPending ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                                                            Pendente Pix
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                            {item.status}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    {isPending ? (
                                                        <button
                                                            onClick={() => setSelectedPixRecord(item)}
                                                            className="inline-flex items-center gap-1 py-1 px-3 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                                                        >
                                                            <QrCode className="w-3.5 h-3.5" />
                                                            Pagar Pix
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setReceiptRecord(item)}
                                                            className="inline-flex items-center gap-1 py-1 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                            Comprovante
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </PortalCard>
            </div>

            {/* Pix Payment Dialog for Pending Items */}
            {selectedPixRecord && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative space-y-4">
                        <button
                            onClick={() => setSelectedPixRecord(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center">
                            <div className="w-12 h-12 bg-orange-100 text-brand-orange rounded-2xl flex items-center justify-center mx-auto mb-2">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                Pagamento Pix Pendente
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Ref: <strong>{selectedPixRecord.referenceCode}</strong>
                            </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-center space-y-1">
                            <span className="text-xs font-bold text-slate-500 uppercase">Valor da Contribuição</span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                {formatCurrencyBrl(selectedPixRecord.amount)}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                {selectedPixRecord.description}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Chave Copia e Cola Pix:
                            </span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={`00020126360014BR.GOV.BCB.PIX0114000000000000005204000053039865405${selectedPixRecord.amount.toFixed(2)}5802BR5913${church?.name || 'Igreja'}6009SAO PAULO62070503***6304`}
                                    className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none"
                                />
                                <button
                                    onClick={() => copyToClipboard(`00020126360014BR.GOV.BCB.PIX0114000000000000005204000053039865405${selectedPixRecord.amount.toFixed(2)}5802BR5913${church?.name || 'Igreja'}6009SAO PAULO62070503***6304`)}
                                    className="p-2.5 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                                >
                                    {copiedPix ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copiedPix ? 'Copiado!' : 'Copiar'}
                                </button>
                            </div>
                        </div>

                        <PortalButton
                            variant="secondary"
                            size="md"
                            className="w-full"
                            onClick={() => setSelectedPixRecord(null)}
                        >
                            Fechar
                        </PortalButton>
                    </div>
                </div>
            )}

            {/* Formal Contribution Receipt Modal */}
            {receiptRecord && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative space-y-5">
                        <button
                            onClick={() => setReceiptRecord(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center border-b border-slate-100 dark:border-slate-800 pb-4">
                            <img src="/logo.png?v=15" alt="Logo" className="h-10 mx-auto mb-2 object-contain" />
                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                Comprovante de Contribuição
                            </h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                {church?.name || 'Igreja Sede Central'}
                            </p>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-500">Código de Referência:</span>
                                <span className="font-mono font-black text-brand-blue">{receiptRecord.referenceCode}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-500">Contribuinte:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{contributor?.name || 'Doador Voluntário'}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-500">CPF:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{contributor?.cpf || '-'}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-500">Finalidade / Categoria:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{receiptRecord.description}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-500">Data e Hora:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {new Date(receiptRecord.created_at).toLocaleString('pt-BR')}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                                <span className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">Valor Contribuído:</span>
                                <span className="font-black text-emerald-700 dark:text-emerald-400 text-base">
                                    {formatCurrencyBrl(receiptRecord.amount)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <PortalButton
                                variant="outline"
                                size="md"
                                className="flex-1"
                                onClick={() => window.print()}
                                icon={Printer}
                            >
                                Imprimir Comprovante
                            </PortalButton>
                            <PortalButton
                                variant="primary"
                                size="md"
                                className="flex-1"
                                onClick={() => setReceiptRecord(null)}
                            >
                                Concluído
                            </PortalButton>
                        </div>
                    </div>
                </div>
            )}
        </PortalContainer>
    );
};
