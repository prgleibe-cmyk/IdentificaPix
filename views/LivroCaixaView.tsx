import React, { useState, useContext, useMemo, useRef, useEffect, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { ExportService } from '../services/ExportService';
import { ChurchClosingModal } from '../components/modals/ChurchClosingModal';
import { AttachmentPreviewModal } from '../components/financial/AttachmentPreviewModal';
import { QuickAttachModal } from '../components/modals/QuickAttachModal';
import { ServiceReceiptModal } from '../components/modals/ServiceReceiptModal';
import { preloadAllAttachmentsMap } from '../services/expenseAttachmentService';
import { getMonthClosingRecord } from '../services/monthClosingService';
import { ExpenseAttachment, MonthClosingRecord } from '../types/domain';
import { 
    BookOpen, 
    Building2, 
    Landmark,
    Search, 
    Download, 
    Printer, 
    RefreshCw, 
    ChevronDown, 
    ArrowUpRight, 
    ArrowDownRight, 
    DollarSign, 
    FileText, 
    FileSpreadsheet, 
    FileCode,
    Filter,
    Calendar,
    Sparkles,
    RotateCcw,
    CheckCircle2,
    ArrowRight,
    Check,
    ChevronLeft,
    ChevronRight,
    Tag,
    Paperclip,
    Plus,
    Receipt,
    FileSignature
} from 'lucide-react';

export const LivroCaixaView: React.FC = memo(() => {
    const { showToast } = useUI();
    const context = useContext(AppContext);
    const { user, subscription, isSecondaryUser } = useAuth();

    const now = useMemo(() => new Date(), []);
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectionMode, setSelectionMode] = useState<'month' | 'dates'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const ITEMS_PER_PAGE = 50;

    const monthsList = [
        { val: 1, name: 'Janeiro' },
        { val: 2, name: 'Fevereiro' },
        { val: 3, name: 'Março' },
        { val: 4, name: 'Abril' },
        { val: 5, name: 'Maio' },
        { val: 6, name: 'Junho' },
        { val: 7, name: 'Julho' },
        { val: 8, name: 'Agosto' },
        { val: 9, name: 'Setembro' },
        { val: 10, name: 'Outubro' },
        { val: 11, name: 'Novembro' },
        { val: 12, name: 'Dezembro' }
    ];

    const currentYear = new Date().getFullYear();
    const yearsList = useMemo(() => {
        const list = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
        if (!list.includes(selectedYear)) list.push(selectedYear);
        return Array.from(new Set(list)).sort((a, b) => b - a);
    }, [currentYear, selectedYear]);
    
    // Multi-select church filter
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
    const [isChurchDropdownOpen, setIsChurchDropdownOpen] = useState<boolean>(false);

    // Multi-select bank filter
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [isBankDropdownOpen, setIsBankDropdownOpen] = useState<boolean>(false);

    // Export dropdown state
    const [showExportLivroCaixa, setShowExportLivroCaixa] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [isClosingModalOpen, setIsClosingModalOpen] = useState<boolean>(false);
    const [previewAttachment, setPreviewAttachment] = useState<ExpenseAttachment | null>(null);
    const [quickAttachTx, setQuickAttachTx] = useState<any | null>(null);
    const [serviceReceiptTx, setServiceReceiptTx] = useState<any | null>(null);
    const [attachmentFilter, setAttachmentFilter] = useState<'all' | 'with_attachments' | 'without_attachments'>('all');
    const [attachmentsMap, setAttachmentsMap] = useState<Map<string, ExpenseAttachment[]>>(new Map());
    const [monthClosingRecord, setMonthClosingRecord] = useState<MonthClosingRecord | null>(null);

    useEffect(() => {
        let isMounted = true;
        preloadAllAttachmentsMap().then(map => {
            if (isMounted) setAttachmentsMap(map);
        });

        const handleAttUpdate = () => {
            preloadAllAttachmentsMap().then(map => {
                if (isMounted) setAttachmentsMap(map);
            });
        };

        window.addEventListener('expense_attachments_updated', handleAttUpdate);
        return () => {
            isMounted = false;
            window.removeEventListener('expense_attachments_updated', handleAttUpdate);
        };
    }, []);

    const churchDropdownRef = useRef<HTMLDivElement>(null);
    const bankDropdownRef = useRef<HTMLDivElement>(null);
    const exportLivroCaixaRef = useRef<HTMLDivElement>(null);

    const perms = (subscription?.permissions || {}) as Record<string, any>;
    const canDownload = !isSecondaryUser || (perms.baixar_arquivo !== false && perms.downloadFile !== false);
    const canPrint = !isSecondaryUser || (perms.imprimir !== false && perms.printReport !== false);

    const allowedChurchIds = useMemo(() => {
        if (!isSecondaryUser) return null;
        return subscription?.congregationIds || [];
    }, [isSecondaryUser, subscription?.congregationIds]);

    const allowedBankIds = useMemo(() => {
        if (!isSecondaryUser) return null;
        return subscription?.bankIds || [];
    }, [isSecondaryUser, subscription?.bankIds]);

    const churches = useMemo(() => {
        const raw = context?.churches || [];
        if (!isSecondaryUser || !allowedChurchIds || allowedChurchIds.length === 0) return raw;
        return raw.filter((c: any) => allowedChurchIds.includes(c.id));
    }, [context?.churches, isSecondaryUser, allowedChurchIds]);

    // Carrega registro de fechamento homologado e assinado digitalmente para a congregação e período ativo
    useEffect(() => {
        let isMounted = true;
        const churchId = selectedChurchIds.length === 1 ? selectedChurchIds[0] : (churches.length === 1 ? churches[0].id : null);
        if (!churchId) {
            setMonthClosingRecord(null);
            return;
        }

        const m = selectionMode === 'month' ? selectedMonth : (customStartDate ? parseInt(customStartDate.split('-')[1], 10) : selectedMonth);
        const y = selectionMode === 'month' ? selectedYear : (customStartDate ? parseInt(customStartDate.split('-')[0], 10) : selectedYear);

        if (m && y) {
            getMonthClosingRecord(churchId, y, m).then(record => {
                if (isMounted) setMonthClosingRecord(record);
            });
        }

        const handleClosingUpdate = (e: any) => {
            const updated = e?.detail as MonthClosingRecord | undefined;
            if (updated && updated.churchId === churchId && updated.year === y && updated.month === m) {
                if (isMounted) setMonthClosingRecord(updated);
            } else if (m && y) {
                getMonthClosingRecord(churchId, y, m).then(record => {
                    if (isMounted) setMonthClosingRecord(record);
                });
            }
        };

        window.addEventListener('month_closing_updated', handleClosingUpdate);
        return () => {
            isMounted = false;
            window.removeEventListener('month_closing_updated', handleClosingUpdate);
        };
    }, [selectedChurchIds, churches, selectionMode, selectedMonth, selectedYear, customStartDate]);

    const banks = useMemo(() => {
        const raw = context?.banks || [];
        if (!isSecondaryUser || !allowedBankIds || allowedBankIds.length === 0) return raw;
        return raw.filter((b: any) => allowedBankIds.includes(b.id));
    }, [context?.banks, isSecondaryUser, allowedBankIds]);

    const reportData = useMemo(() => {
        const raw = context?.reportData || [];
        if (!attachmentsMap || attachmentsMap.size === 0) return raw;
        return raw.map((item: any) => {
            const atts = attachmentsMap.get(item.id);
            if (atts && atts.length > 0) {
                return { ...item, attachments: atts };
            }
            return item;
        });
    }, [context?.reportData, attachmentsMap]);

    const expenseAttachmentStats = useMemo(() => {
        let totalExpenses = 0;
        let withAttachments = 0;
        let pendingAttachments = 0;

        reportData.forEach((item: any) => {
            const isExp = item.type === 'expense' || Number(item.amount) < 0 || (item.category && String(item.category).toLowerCase().includes('saida'));
            if (isExp) {
                totalExpenses++;
                const atts = item.attachments || attachmentsMap.get(item.id) || item.raw?.attachments || item.raw?.transaction?.attachments || [];
                if (atts && atts.length > 0) {
                    withAttachments++;
                } else {
                    pendingAttachments++;
                }
            }
        });

        return { totalExpenses, withAttachments, pendingAttachments };
    }, [reportData, attachmentsMap]);
    const isHydratingFromCloud = typeof context?.isHydrating === 'boolean'
        ? context.isHydrating
        : Boolean(context?.isHydratingFromCloud?.current || context?.isHydrating?.current);

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (churchDropdownRef.current && !churchDropdownRef.current.contains(event.target as Node)) {
                setIsChurchDropdownOpen(false);
            }
            if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
                setIsBankDropdownOpen(false);
            }
            if (exportLivroCaixaRef.current && !exportLivroCaixaRef.current.contains(event.target as Node)) {
                setShowExportLivroCaixa(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatBRL = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    const formatDateBRL = (dateStr: string) => {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const getChurchName = (cId: string) => {
        return churches.find((c: any) => c.id === cId)?.name || 'Igreja Sede';
    };

    const getBankName = (bId: string) => {
        const found = banks.find((b: any) => b.id === bId);
        return found?.account_name || found?.name || 'Banco';
    };

    const toggleChurchSelection = (churchId: string) => {
        if (churchId === 'ALL') {
            setSelectedChurchIds([]);
            return;
        }
        setSelectedChurchIds(prev => {
            if (prev.includes(churchId)) {
                return prev.filter(id => id !== churchId);
            } else {
                return [...prev, churchId];
            }
        });
    };

    const toggleBankSelection = (bankId: string) => {
        if (bankId === 'ALL') {
            setSelectedBankIds([]);
            return;
        }
        setSelectedBankIds(prev => {
            if (prev.includes(bankId)) {
                return prev.filter(id => id !== bankId);
            } else {
                return [...prev, bankId];
            }
        });
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (typeof context?.triggerSync === 'function') {
                context.triggerSync();
            }
            if (typeof context?.hydrate === 'function') {
                await context.hydrate();
            }
            showToast('Livro Caixa recarregado com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao recarregar Livro Caixa:', err);
            showToast('Erro ao recarregar os dados.', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const startSelected = context?.searchFilters?.dateRange?.start;
    const endSelected = context?.searchFilters?.dateRange?.end;

    // Auto-inicializar e sincronizar com o período definido nos filtros globais
    useEffect(() => {
        if (!startSelected || !endSelected) {
            const m = now.getMonth() + 1;
            const y = now.getFullYear();
            setSelectedMonth(m);
            setSelectedYear(y);
            const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            if (context?.setSearchFilters) {
                context.setSearchFilters((prev: any) => ({
                    ...prev,
                    dateRange: { start: startDate, end: endDate }
                }));
            }
        } else {
            const startParts = startSelected.split('-');
            const endParts = endSelected.split('-');
            if (startParts.length === 3 && endParts.length === 3) {
                const y = Number(startParts[0]);
                const m = Number(startParts[1]);
                const lastDay = new Date(y, m, 0).getDate();
                const isFullMonth = startParts[2] === '01' && Number(endParts[2]) === lastDay && Number(endParts[1]) === m && Number(endParts[0]) === y;
                if (isFullMonth) {
                    setSelectedMonth(m);
                    setSelectedYear(y);
                    setSelectionMode('month');
                } else {
                    setCustomStartDate(startSelected);
                    setCustomEndDate(endSelected);
                    setSelectionMode('dates');
                }
            } else {
                setCustomStartDate(startSelected);
                setCustomEndDate(endSelected);
            }
        }
    }, [startSelected, endSelected, now]);

    const handleMonthYearSelect = (month: number, year: number) => {
        setSelectedMonth(month);
        setSelectedYear(year);
        if (context?.setSearchFilters) {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            context.setSearchFilters((prev: any) => ({
                ...prev,
                dateRange: { start: startDate, end: endDate }
            }));
        }
    };

    const handleCustomDatesChange = (start: string, end: string) => {
        setCustomStartDate(start);
        setCustomEndDate(end);
        if (start && end && context?.setSearchFilters) {
            context.setSearchFilters((prev: any) => ({
                ...prev,
                dateRange: { start, end }
            }));
        }
    };

    // Auto-initialize custom dates when switching to period mode
    useEffect(() => {
        if (selectionMode === 'dates') {
            if (!customStartDate) {
                const start = startSelected || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
                setCustomStartDate(start);
            }
            if (!customEndDate) {
                const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
                const end = endSelected || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                setCustomEndDate(end);
            }
        }
    }, [selectionMode, customStartDate, customEndDate, selectedYear, selectedMonth, startSelected, endSelected]);

    // Filter reportData
    const filteredReportData = useMemo(() => {
        return reportData.filter((item: any) => {
            if (isSecondaryUser && allowedChurchIds && allowedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                if (itemChurchId && !allowedChurchIds.includes(itemChurchId)) return false;
            }

            if (selectedChurchIds.length > 0) {
                const itemChurchId = item.churchId;
                const itemChurchName = item.church;
                const matchesAny = selectedChurchIds.some(cId => {
                    if (itemChurchId && itemChurchId === cId) return true;
                    const chObj = churches.find((c: any) => c.id === cId);
                    return chObj && (itemChurchName === chObj.name || itemChurchId === chObj.id);
                });
                if (!matchesAny) return false;
            }

            if (selectedBankIds.length > 0) {
                const itemBankId = item.bankId || item.raw?.transaction?.bank_id || item.raw?.bankId;
                const itemBankName = item.bankName;
                const matchesAny = selectedBankIds.some(bId => {
                    if (itemBankId && itemBankId === bId) return true;
                    const bObj = banks.find((b: any) => b.id === bId);
                    if (!bObj) return false;
                    const bName = (bObj.account_name || bObj.name || '').toLowerCase();
                    if (itemBankName && itemBankName.toLowerCase() === bName) return true;
                    return false;
                });
                if (!matchesAny) return false;
            }

            if (item.date) {
                const itemDateIso = item.date.includes('T') ? item.date.split('T')[0] : item.date;
                if (selectionMode === 'month') {
                    const parts = itemDateIso.split('-');
                    if (parts.length === 3) {
                        const txYear = Number(parts[0]);
                        const txMonth = Number(parts[1]);
                        if (txYear !== selectedYear || txMonth !== selectedMonth) return false;
                    }
                } else if (selectionMode === 'dates') {
                    if (customStartDate && itemDateIso < customStartDate) return false;
                    if (customEndDate && itemDateIso > customEndDate) return false;
                }
            }

            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase();
                const textToSearch = [
                    item.desc, item.description, item.historico,
                    item.payer, item.contribuinte, item.nome,
                    item.category, item.categoria,
                    getChurchName(item.churchId)
                ].filter(Boolean).join(' ').toLowerCase();

                if (!textToSearch.includes(query)) return false;
            }

            if (attachmentFilter !== 'all') {
                const isExp = item.type === 'expense' || Number(item.amount) < 0 || (item.category && String(item.category).toLowerCase().includes('saida'));
                if (!isExp) return false;
                const atts = item.attachments || attachmentsMap.get(item.id) || item.raw?.attachments || item.raw?.transaction?.attachments || [];
                const hasAtts = atts && atts.length > 0;
                if (attachmentFilter === 'with_attachments' && !hasAtts) return false;
                if (attachmentFilter === 'without_attachments' && hasAtts) return false;
            }

            return true;
        });
    }, [reportData, selectedChurchIds, selectedBankIds, selectionMode, selectedMonth, selectedYear, customStartDate, customEndDate, searchTerm, isSecondaryUser, allowedChurchIds, churches, banks, attachmentFilter, attachmentsMap]);

    const financialTotals = useMemo(() => {
        let income = 0;
        let expenses = 0;

        filteredReportData.forEach((tx: any) => {
            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            const isExp = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));

            if (isExp) {
                expenses += amt;
            } else {
                income += amt;
            }
        });

        return {
            income,
            expenses,
            balance: income - expenses,
            totalTransactions: filteredReportData.length
        };
    }, [filteredReportData]);

    const totalPages = Math.ceil(filteredReportData.length / ITEMS_PER_PAGE) || 1;

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedMonth, selectedYear, customStartDate, customEndDate, selectionMode, selectedChurchIds, selectedBankIds, searchTerm]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredReportData.length, totalPages, currentPage]);

    const paginatedReportData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredReportData.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredReportData, currentPage]);

    // Detalhado RESUMO financeiro do Livro Caixa
    const summaryBreakdown = useMemo(() => {
        let saldoAnterior = 0;
        let entradasDinheiro = 0;
        let entradasPix = 0;
        let entradasOutras = 0;
        let transfRecebidas = 0;

        let saidasDinheiro = 0;
        let saidasPix = 0;
        let saidasBoletoFaturas = 0;
        let saidasOutras = 0;
        let transfEnviadas = 0;

        // Data de corte para o Saldo Anterior
        const effectiveStartDate = selectionMode === 'dates'
            ? customStartDate
            : (selectedYear && selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01` : '');

        // Cálculo do Saldo Anterior (respeitando rigorosamente os filtros de igreja e banco ativos)
        if (effectiveStartDate) {
            reportData.forEach((item: any) => {
                if (isSecondaryUser && allowedChurchIds && allowedChurchIds.length > 0) {
                    const itemChurchId = item.churchId || item.church;
                    if (itemChurchId && !allowedChurchIds.includes(itemChurchId)) return;
                }

                if (selectedChurchIds.length > 0) {
                    const itemChurchId = item.churchId;
                    const itemChurchName = item.church;
                    const matchesAny = selectedChurchIds.some(cId => {
                        if (itemChurchId && itemChurchId === cId) return true;
                        const chObj = churches.find((c: any) => c.id === cId);
                        return chObj && (itemChurchName === chObj.name || itemChurchId === chObj.id);
                    });
                    if (!matchesAny) return;
                }

                if (selectedBankIds.length > 0) {
                    const itemBankId = item.bankId || item.raw?.transaction?.bank_id || item.raw?.bankId;
                    const itemBankName = item.bankName;
                    const matchesAny = selectedBankIds.some(bId => {
                        if (itemBankId && itemBankId === bId) return true;
                        const bObj = banks.find((b: any) => b.id === bId);
                        if (!bObj) return false;
                        const bName = (bObj.account_name || bObj.name || '').toLowerCase();
                        if (itemBankName && itemBankName.toLowerCase() === bName) return true;
                        return false;
                    });
                    if (!matchesAny) return;
                }

                const itemDate = item.date ? (item.date.includes('T') ? item.date.split('T')[0] : item.date) : '';
                if (itemDate && itemDate < effectiveStartDate) {
                    const amt = Math.abs(Number(item.amount) || Number(item.val) || 0);
                    const isExp = item.type === 'expense' || Number(item.amount) < 0 || (item.category && item.category.toLowerCase().includes('saida'));
                    if (isExp) {
                        saldoAnterior -= amt;
                    } else {
                        saldoAnterior += amt;
                    }
                }
            });
        }

        filteredReportData.forEach((item: any) => {
            const amt = Math.abs(Number(item.amount) || Number(item.val) || 0);
            const pm = (item.paymentMethod || item.forma || '').toString().toUpperCase();
            const cat = (item.category || item.categoria || '').toString().toUpperCase();
            const desc = (item.desc || item.description || item.historico || '').toString().toUpperCase();
            const isExp = item.type === 'expense' || Number(item.amount) < 0 || cat.includes('SAIDA') || cat.includes('SAÍDA');

            const isTransf = pm.includes('TRANSFER') || pm.includes('TED') || pm.includes('DOC') || cat.includes('TRANSFER') || desc.includes('TRANSFER');

            if (isExp) {
                if (isTransf) {
                    transfEnviadas += amt;
                } else if (pm.includes('DINHEIRO') || pm.includes('ESPÉCIE') || pm.includes('ESPECIE')) {
                    saidasDinheiro += amt;
                } else if (pm.includes('PIX')) {
                    saidasPix += amt;
                } else if (pm.includes('BOLETO') || pm.includes('FATURA') || pm.includes('CARTÃO') || pm.includes('CARTAO')) {
                    saidasBoletoFaturas += amt;
                } else {
                    saidasOutras += amt;
                }
            } else {
                if (isTransf) {
                    transfRecebidas += amt;
                } else if (pm.includes('DINHEIRO') || pm.includes('ESPÉCIE') || pm.includes('ESPECIE')) {
                    entradasDinheiro += amt;
                } else if (pm.includes('PIX')) {
                    entradasPix += amt;
                } else {
                    entradasOutras += amt;
                }
            }
        });

        const totalEntradas = entradasDinheiro + entradasPix + entradasOutras;
        const totalSaidas = saidasDinheiro + saidasPix + saidasBoletoFaturas + saidasOutras;

        const totalEntradasPlusTransf = totalEntradas + transfRecebidas;
        const totalSaidasPlusTransf = totalSaidas + transfEnviadas;

        const saldoDinheiro = entradasDinheiro - saidasDinheiro;
        const saldoPix = entradasPix - saidasPix;

        const saldoFinal = saldoAnterior + totalEntradasPlusTransf - totalSaidasPlusTransf;

        return {
            saldoAnterior,
            entradasDinheiro,
            entradasPix,
            totalEntradas,
            saidasDinheiro,
            saidasPix,
            saidasBoletoFaturas,
            totalSaidas,
            transfRecebidas,
            transfEnviadas,
            totalEntradasPlusTransf,
            totalSaidasPlusTransf,
            saldoDinheiro,
            saldoPix,
            saldoFinal
        };
    }, [reportData, filteredReportData, selectionMode, customStartDate, selectedYear, selectedMonth, selectedChurchIds, selectedBankIds, isSecondaryUser, allowedChurchIds, churches, banks]);

    // Resumo analítico agrupado por Destino / Finalidade / Categoria / Descrição / Rateio
    const descriptionBreakdown = useMemo(() => {
        const incomeMap = new Map<string, { label: string; total: number; count: number }>();
        const expenseMap = new Map<string, { label: string; total: number; count: number }>();

        filteredReportData.forEach((tx: any) => {
            const isBaseExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && String(tx.category).toLowerCase().includes('saida'));
            const txSplits = (Array.isArray(tx.splits) && tx.splits.length > 0)
                ? tx.splits
                : (Array.isArray(tx.raw?.splits) && tx.raw.splits.length > 0)
                    ? tx.raw.splits
                    : null;

            if (txSplits && txSplits.length > 0) {
                // Se a transação possui rateio, computa cada fatia com seu respectivo destino/categoria/observação
                txSplits.forEach((s: any) => {
                    const splitAmt = Math.abs(Number(s.amount) || 0);
                    if (splitAmt <= 0) return;

                    const isSplitExpense = s.amount < 0 || isBaseExpense;
                    const rawLabel = (
                        s.contributionType ||
                        s.category ||
                        s.categoria ||
                        s.destino ||
                        s.observacao ||
                        s.description ||
                        tx.category ||
                        tx.categoria ||
                        tx.contributionType ||
                        tx.desc ||
                        tx.description ||
                        (isSplitExpense ? 'Despesas Gerais' : 'Dízimos & Ofertas')
                    ).toString().trim();
                    const cleanKey = rawLabel.toUpperCase();
                    const targetMap = isSplitExpense ? expenseMap : incomeMap;

                    const existing = targetMap.get(cleanKey);
                    if (existing) {
                        existing.total += splitAmt;
                        existing.count += 1;
                    } else {
                        targetMap.set(cleanKey, { label: rawLabel, total: splitAmt, count: 1 });
                    }
                });
            } else {
                // Transação direta sem rateio
                const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                if (amt <= 0) return;

                // Prioriza Destino / Finalidade / Categoria / Tipo de Contribuição
                const catCandidate = (
                    tx.contributionType ||
                    tx.category ||
                    tx.categoria ||
                    tx.purpose ||
                    tx.proposito ||
                    tx.categoryName ||
                    tx.type_name ||
                    ''
                ).toString().trim();

                let rawLabel = catCandidate;
                const upperCandidate = catCandidate.toUpperCase();

                if (!upperCandidate || upperCandidate === 'GERAL' || upperCandidate === 'DIVERSOS') {
                    rawLabel = (
                        tx.desc ||
                        tx.description ||
                        tx.historico ||
                        (isBaseExpense ? 'Despesas Gerais' : 'Dízimos & Ofertas')
                    ).toString().trim();
                }

                const cleanKey = rawLabel.toUpperCase();
                const targetMap = isBaseExpense ? expenseMap : incomeMap;

                const existing = targetMap.get(cleanKey);
                if (existing) {
                    existing.total += amt;
                    existing.count += 1;
                } else {
                    targetMap.set(cleanKey, { label: rawLabel, total: amt, count: 1 });
                }
            }
        });

        const incomes = Array.from(incomeMap.values()).sort((a, b) => b.total - a.total);
        const expenses = Array.from(expenseMap.values()).sort((a, b) => b.total - a.total);
        const totalIncome = incomes.reduce((acc, curr) => acc + curr.total, 0);
        const totalExpense = expenses.reduce((acc, curr) => acc + curr.total, 0);

        return {
            incomes,
            expenses,
            totalIncome,
            totalExpense
        };
    }, [filteredReportData]);

    // Histórico de transações com o mesmo escopo de igreja e banco (para cálculo exato em relatórios e PDF)
    const scopedAllReportData = useMemo(() => {
        return reportData.filter((item: any) => {
            if (isSecondaryUser && allowedChurchIds && allowedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                if (itemChurchId && !allowedChurchIds.includes(itemChurchId)) return false;
            }

            if (selectedChurchIds.length > 0) {
                const itemChurchId = item.churchId;
                const itemChurchName = item.church;
                const matchesAny = selectedChurchIds.some(cId => {
                    if (itemChurchId && itemChurchId === cId) return true;
                    const chObj = churches.find((c: any) => c.id === cId);
                    return chObj && (itemChurchName === chObj.name || itemChurchId === chObj.id);
                });
                if (!matchesAny) return false;
            }

            if (selectedBankIds.length > 0) {
                const itemBankId = item.bankId || item.raw?.transaction?.bank_id || item.raw?.bankId;
                const itemBankName = item.bankName;
                const matchesAny = selectedBankIds.some(bId => {
                    if (itemBankId && itemBankId === bId) return true;
                    const bObj = banks.find((b: any) => b.id === bId);
                    if (!bObj) return false;
                    const bName = (bObj.account_name || bObj.name || '').toLowerCase();
                    if (itemBankName && itemBankName.toLowerCase() === bName) return true;
                    return false;
                });
                if (!matchesAny) return false;
            }

            return true;
        });
    }, [reportData, selectedChurchIds, selectedBankIds, isSecondaryUser, allowedChurchIds, churches, banks]);

    const handleExportLivroCaixa = (format: 'pdf' | 'excel' | 'csv' | 'ofx') => {
        setShowExportLivroCaixa(false);
        if (!canDownload) {
            showToast('Você não tem permissão para baixar arquivos ou relatórios.', 'error');
            return;
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        const effectiveStartDate = selectionMode === 'dates'
            ? customStartDate
            : (selectedYear && selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01` : '');
        
        if (format === 'pdf') {
            ExportService.downloadLivroCaixaPdf(
                filteredReportData, 
                churches, 
                'Livro Caixa - Extrato Analítico', 
                `livro_caixa_${dateStr}.pdf`, 
                selectedChurchIds[0], 
                scopedAllReportData, 
                effectiveStartDate, 
                selectionMode,
                monthClosingRecord
            );
        } else if (format === 'excel') {
            ExportService.downloadLivroCaixaExcel(filteredReportData, churches, `livro_caixa_${dateStr}.xlsx`);
        } else if (format === 'csv') {
            ExportService.downloadLivroCaixaCsv(filteredReportData, churches, `livro_caixa_${dateStr}.csv`);
        } else if (format === 'ofx') {
            ExportService.downloadLivroCaixaOfx(filteredReportData, churches, `livro_caixa_${dateStr}.ofx`);
        }
        showToast(`Livro Caixa exportado em formato ${format.toUpperCase()} com sucesso!`, 'success');
    };

    const handlePrint = () => {
        if (!canPrint) {
            showToast('Você não tem permissão para imprimir relatórios.', 'error');
            return;
        }
        const effectiveStartDate = selectionMode === 'dates'
            ? customStartDate
            : (selectedYear && selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01` : '');
        ExportService.printLivroCaixa(
            filteredReportData, 
            churches, 
            scopedAllReportData, 
            effectiveStartDate, 
            selectionMode, 
            selectedChurchIds[0],
            monthClosingRecord
        );
    };

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full min-h-full flex flex-col animate-fade-in pb-8 md:pb-4">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white shadow-md shadow-orange-500/20 shrink-0">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                Livro Caixa
                            </h1>
                            <p className="text-xs text-slate-400">
                                Detalhamento individualizado de todas as entradas e saídas financeiras da igreja.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {monthClosingRecord && (
                            <div 
                                onClick={() => !isSecondaryUser && setIsClosingModalOpen(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                                    !isSecondaryUser ? 'cursor-pointer hover:opacity-90' : ''
                                } ${
                                    monthClosingRecord.signatures && monthClosingRecord.signatures.length > 0
                                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                        : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                                }`}
                                title={monthClosingRecord.integrityHash ? `Hash SHA-256: ${monthClosingRecord.integrityHash}` : 'Mês Fechado'}
                            >
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div className="flex flex-col text-left">
                                    <span className="text-[10px] uppercase tracking-wider font-black leading-tight">
                                        Mês Fechado
                                    </span>
                                    <span className="text-[9.5px] font-medium opacity-90 leading-tight">
                                        {monthClosingRecord.signatures && monthClosingRecord.signatures.length > 0
                                            ? `✓ ${monthClosingRecord.signatures.length} Assinatura(s) Digital(is)`
                                            : 'Sem assinaturas digitais'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {!isSecondaryUser && (
                            <button
                                type="button"
                                onClick={() => setIsClosingModalOpen(true)}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-xl shadow-xs hover:opacity-95 transition-all tracking-wider uppercase cursor-pointer border border-orange-400/30 active:scale-95 shrink-0 self-start sm:self-auto"
                                title="Realizar Fechamento & Assinaturas Digitais"
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                <span>{monthClosingRecord ? 'Ver / Editar Fechamento' : 'Fechamento'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
                {/* Control & Filter Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-orange-500" />
                            Lançamentos de Caixa
                        </h3>
                        <p className="text-xs text-slate-400">Histórico de entradas e saídas registradas.</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                        {/* Search */}
                        <div className="relative flex-1 md:w-52">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar no Livro Caixa..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-3 py-1.5 w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        {/* Date Range Filter Box (Mês / Período) */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs shadow-xs">
                            <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 p-0.5 rounded-lg font-bold shadow-xs border border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('month')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        selectionMode === 'month'
                                            ? 'bg-orange-500 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    Mês
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('dates')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        selectionMode === 'dates'
                                            ? 'bg-orange-500 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    Período
                                </button>
                            </div>

                            {selectionMode === 'month' ? (
                                <div className="flex items-center gap-1">
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => handleMonthYearSelect(Number(e.target.value), selectedYear)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white px-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                                    >
                                        {monthsList.map(m => (
                                            <option key={m.val} value={m.val}>{m.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => handleMonthYearSelect(selectedMonth, Number(e.target.value))}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white px-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                                    >
                                        {yearsList.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => handleCustomDatesChange(e.target.value, customEndDate)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white px-2 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                                    />
                                    <span className="text-slate-400 font-bold text-[10px] uppercase">até</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => handleCustomDatesChange(customStartDate, e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white px-2 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Multi-Select Church Filter */}
                        <div className="relative" ref={churchDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsChurchDropdownOpen(!isChurchDropdownOpen)}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Building2 className="w-3.5 h-3.5 text-orange-500" />
                                <span>
                                    {selectedChurchIds.length === 0 
                                        ? 'Todas as Igrejas' 
                                        : selectedChurchIds.length === 1 
                                        ? getChurchName(selectedChurchIds[0]) 
                                        : `${selectedChurchIds.length} Igrejas Selecionadas`}
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </button>

                            {isChurchDropdownOpen && (
                                <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 p-3 z-50 text-xs space-y-2 animate-scale-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
                                        <span className="font-bold text-slate-800 dark:text-white uppercase text-[10px]">Filtrar por Igrejas</span>
                                        {selectedChurchIds.length > 0 && (
                                            <button 
                                                onClick={() => setSelectedChurchIds([])}
                                                className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline cursor-pointer"
                                            >
                                                Selecionar Todas
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pt-1">
                                        <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedChurchIds.length === 0}
                                                onChange={() => setSelectedChurchIds([])}
                                                className="accent-orange-500 rounded cursor-pointer"
                                            />
                                            <span className="font-bold text-slate-800 dark:text-white">Todas as Igrejas</span>
                                        </label>

                                        {churches.map((c: any) => {
                                            const isChecked = selectedChurchIds.includes(c.id);
                                            return (
                                                <label key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleChurchSelection(c.id)}
                                                        className="accent-orange-500 rounded cursor-pointer"
                                                    />
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{c.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Multi/Single Select Bank Filter */}
                        <div className="relative" ref={bankDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Landmark className="w-3.5 h-3.5 text-blue-500" />
                                <span>
                                    {selectedBankIds.length === 0 
                                        ? 'Todos os Bancos' 
                                        : selectedBankIds.length === 1 
                                        ? getBankName(selectedBankIds[0]) 
                                        : `${selectedBankIds.length} Bancos Selecionados`}
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </button>

                            {isBankDropdownOpen && (
                                <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 p-3 z-50 text-xs space-y-2 animate-scale-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
                                        <span className="font-bold text-slate-800 dark:text-white uppercase text-[10px]">Filtrar por Banco</span>
                                        {selectedBankIds.length > 0 && (
                                            <button 
                                                onClick={() => setSelectedBankIds([])}
                                                className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                                            >
                                                Selecionar Todos
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pt-1">
                                        <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedBankIds.length === 0}
                                                onChange={() => setSelectedBankIds([])}
                                                className="accent-blue-500 rounded cursor-pointer"
                                            />
                                            <span className="font-bold text-slate-800 dark:text-white">Todos os Bancos</span>
                                        </label>

                                        {banks.length === 0 ? (
                                            <div className="p-2 text-slate-400 text-center italic text-[11px]">
                                                Nenhum banco cadastrado.
                                            </div>
                                        ) : (
                                            banks.map((b: any) => {
                                                const isChecked = selectedBankIds.includes(b.id);
                                                const bName = b.account_name || b.name || 'Banco Sem Nome';
                                                return (
                                                    <label key={b.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleBankSelection(b.id)}
                                                            className="accent-blue-500 rounded cursor-pointer"
                                                        />
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{bName}</span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Recarregar Button (Icon-Only) */}
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing || isHydratingFromCloud}
                            className="p-2 bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                            title="Recarregar dados do Livro Caixa"
                            aria-label="Recarregar dados do Livro Caixa"
                            id="btn-refresh-livro-caixa"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isHydratingFromCloud ? 'animate-spin text-orange-500' : ''}`} />
                        </button>

                        {/* Export & Print Menu */}
                        <div className="relative" ref={exportLivroCaixaRef}>
                            <button
                                onClick={() => setShowExportLivroCaixa(!showExportLivroCaixa)}
                                className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Exportar Livro Caixa</span>
                                <ChevronDown className="w-3 h-3 ml-0.5" />
                            </button>

                            {showExportLivroCaixa && (
                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 py-2 z-50 text-xs text-slate-700 dark:text-slate-200 animate-scale-in">
                                    <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Formatos Livro Caixa</div>
                                    <button
                                        onClick={() => handleExportLivroCaixa('pdf')}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                    >
                                        <FileText className="w-4 h-4 text-red-500" />
                                        <span>Baixar como PDF</span>
                                    </button>
                                    <button
                                        onClick={() => handleExportLivroCaixa('excel')}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                        <span>Baixar como Excel (.xlsx)</span>
                                    </button>
                                    <button
                                        onClick={() => handleExportLivroCaixa('csv')}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                                        <span>Baixar como CSV</span>
                                    </button>
                                    <button
                                        onClick={() => handleExportLivroCaixa('ofx')}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                    >
                                        <FileCode className="w-4 h-4 text-purple-500" />
                                        <span>Baixar como OFX (ERP/Contábil)</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handlePrint}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Imprimir Relatório"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir</span>
                        </button>
                    </div>
                </div>

                {/* Compact & Discrete Financial Totals Strip */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Entradas:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(financialTotals.income)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Saídas:</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatBRL(financialTotals.expenses)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Saldo Operacional:</span>
                        <span className={`font-mono font-extrabold ${financialTotals.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatBRL(financialTotals.balance)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-[10px] font-black uppercase tracking-wider">Registros:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{financialTotals.totalTransactions}</span>
                    </div>
                </div>

                {/* Livro Caixa Table (Extrato Analítico) */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>Extrato Analítico ({financialTotals.totalTransactions} registros)</span>
                        </div>

                        {/* Filtro de Comprovantes / Documentos das Saídas */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <button
                                type="button"
                                onClick={() => { setAttachmentFilter('all'); setCurrentPage(1); }}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    attachmentFilter === 'all'
                                        ? 'bg-orange-500 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                Todos
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAttachmentFilter('with_attachments'); setCurrentPage(1); }}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    attachmentFilter === 'with_attachments'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                title="Filtrar saídas com fatura ou comprovante anexado"
                            >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Com Comprovante ({expenseAttachmentStats.withAttachments})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAttachmentFilter('without_attachments'); setCurrentPage(1); }}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    attachmentFilter === 'without_attachments'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : expenseAttachmentStats.pendingAttachments > 0
                                            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                title="Filtrar saídas pendentes de comprovante"
                            >
                                <Paperclip className="w-3 h-3" />
                                <span>Sem Comprovante ({expenseAttachmentStats.pendingAttachments})</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
                        <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                            <thead className="bg-slate-100/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 uppercase font-black text-[10px] tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3">Contribuinte / Favorecido</th>
                                    <th className="px-4 py-3">Igreja</th>
                                    <th className="px-4 py-3">Descrição</th>
                                    <th className="px-4 py-3">Forma</th>
                                    <th className="px-4 py-3">Categoria</th>
                                    <th className="px-4 py-3 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {paginatedReportData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                                            Nenhum lançamento encontrado no Livro Caixa para os filtros selecionados.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedReportData.map((tx: any, idx: number) => {
                                        const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
                                        const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                                        const tipoLabel = tx.contributionType || tx.tipo || (tx.type === 'expense' ? 'Despesa' : tx.type === 'income' ? 'Receita' : isExpense ? 'Despesa' : 'Entrada');
                                        const formaLabel = tx.paymentMethod || tx.forma || tx.formaPagamento || tx.payment_method || tx.raw?.payment_method || 'Pix';
                                        const payerName = tx.payer || tx.contribuinte || tx.nome || tx.title || 'Lançamento de Caixa';
                                        const descText = tx.desc || tx.description || tx.historico || '';
                                        const txAttachments: ExpenseAttachment[] = tx.attachments || tx.raw?.attachments || tx.raw?.transaction?.attachments || [];
                                        const nfAtt = txAttachments.find(a => a.documentRole === 'nota_fiscal' || (a.extractedData && a.extractedData.documentType === 'nota_fiscal'));
                                        const invoiceAtt = txAttachments.find(a => a.documentRole === 'fatura' || (a.extractedData && (a.extractedData.documentType === 'fatura' || a.extractedData.documentType === 'boleto')));
                                        const serviceReceiptAtt = txAttachments.find(a => a.documentRole === 'recibo' || a.extractedData?.documentType === 'recibo');
                                        const receiptAtt = txAttachments.find(a => a !== serviceReceiptAtt && (a.documentRole === 'comprovante' || (a.extractedData && (a.extractedData.documentType === 'comprovante_pix' || a.extractedData.documentType === 'comprovante_pagamento'))));
                                        const identifiedCount = (nfAtt ? 1 : 0) + (invoiceAtt ? 1 : 0) + (receiptAtt ? 1 : 0) + (serviceReceiptAtt ? 1 : 0);

                                        return (
                                            <tr key={tx.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                                                    {tx.reference_date && tx.bank_date && tx.reference_date !== tx.bank_date ? (
                                                        <div className="flex flex-col leading-tight">
                                                            <span className="font-bold text-slate-800 dark:text-slate-100" title={`Data de Referência (Competência): ${formatDateBRL(tx.date)}`}>
                                                                {formatDateBRL(tx.date)}
                                                            </span>
                                                            <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-normal mt-0.5" title={`Data no Banco: ${formatDateBRL(tx.bank_date)}`}>
                                                                <span className="text-[8.5px] uppercase font-semibold text-slate-400 mr-0.5">Banco:</span>
                                                                {formatDateBRL(tx.bank_date)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>{formatDateBRL(tx.date)}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="font-bold text-slate-800 dark:text-slate-100 uppercase flex items-center gap-1.5">
                                                        <span>{payerName}</span>
                                                    </div>
                                                    {descText && (
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1 max-w-sm">
                                                            {descText}
                                                        </div>
                                                    )}
                                                    {isExpense && (
                                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                            {nfAtt && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewAttachment(nfAtt)}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-200 transition-colors border border-indigo-300/80 dark:border-indigo-800/80 cursor-pointer shadow-2xs"
                                                                    title="Clique para visualizar a Nota Fiscal (NF-e/NFC-e)"
                                                                >
                                                                    <Receipt className="w-2.5 h-2.5" />
                                                                    <span>NF</span>
                                                                </button>
                                                            )}
                                                            {invoiceAtt && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewAttachment(invoiceAtt)}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 transition-colors border border-amber-300/80 dark:border-amber-800/80 cursor-pointer shadow-2xs"
                                                                    title="Clique para visualizar o Boleto / Fatura"
                                                                >
                                                                    <FileText className="w-2.5 h-2.5" />
                                                                    <span>Boleto/Fatura</span>
                                                                </button>
                                                            )}
                                                            {receiptAtt && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewAttachment(receiptAtt)}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors border border-emerald-300/80 dark:border-emerald-800/80 cursor-pointer shadow-2xs"
                                                                    title="Clique para visualizar o Comprovante de Pagamento"
                                                                >
                                                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                                                    <span>Comprovante</span>
                                                                </button>
                                                            )}
                                                            {serviceReceiptAtt && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewAttachment(serviceReceiptAtt)}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-200 transition-colors border border-amber-300 dark:border-amber-800 cursor-pointer shadow-2xs"
                                                                    title="Clique para visualizar o Recibo de Prestação de Serviços Assinado"
                                                                >
                                                                    <FileSignature className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
                                                                    <span>Recibo</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setServiceReceiptTx(tx)}
                                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer shadow-2xs ${
                                                                    serviceReceiptAtt
                                                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80'
                                                                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60'
                                                                }`}
                                                                title="Emitir ou Assinar Digitalmente o Recibo de Pagamento para o Prestador de Serviço"
                                                            >
                                                                <FileSignature className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                                                <span>{serviceReceiptAtt ? 'Novo Recibo' : 'Emitir Recibo'}</span>
                                                            </button>
                                                            {txAttachments.length > identifiedCount && (
                                                                <span className="text-[9px] text-slate-400 font-bold">
                                                                    +{txAttachments.length - identifiedCount} anexo(s)
                                                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setQuickAttachTx(tx)}
                                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                                                                    txAttachments.length === 0
                                                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                                                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                                }`}
                                                                title={txAttachments.length === 0 ? "Nenhum comprovante anexado. Clique para anexar fatura ou comprovante." : "Gerenciar ou anexar mais documentos"}
                                                            >
                                                                {txAttachments.length === 0 ? (
                                                                    <>
                                                                        <Paperclip className="w-2.5 h-2.5" />
                                                                        <span>Anexar</span>
                                                                    </>
                                                                ) : (
                                                                    <Plus className="w-2.5 h-2.5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full uppercase whitespace-nowrap">
                                                        {tx.church || getChurchName(tx.churchId)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase whitespace-nowrap ${
                                                        isExpense 
                                                            ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30' 
                                                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30'
                                                    }`}>
                                                        {tipoLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/50 uppercase whitespace-nowrap">
                                                        {formaLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                        {tx.category || tx.categoria || 'Geral'}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-2.5 text-right font-mono font-bold whitespace-nowrap ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {isExpense ? `- ${formatBRL(amt)}` : `+ ${formatBRL(amt)}`}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredReportData.length > ITEMS_PER_PAGE && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                            <span className="text-[11px]">
                                Exibindo <span className="font-mono text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-mono text-slate-900 dark:text-white">{Math.min(filteredReportData.length, currentPage * ITEMS_PER_PAGE)}</span> de <span className="font-mono text-slate-900 dark:text-white">{filteredReportData.length}</span> lançamentos
                            </span>

                            <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                                >
                                    Primeira
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                                    title="Página Anterior"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-2 font-mono text-[11px] text-slate-800 dark:text-white">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                                    title="Próxima Página"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                                >
                                    Última
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* RESUMO DE CAIXA DETALHADO (NO FINAL DO RELATÓRIO) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-4 bg-brand-orange rounded-full"></div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">RESUMO</h3>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">Demonstrativo Analítico do Caixa</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                        {/* Bloco Entradas & Créditos */}
                        <div className="space-y-2 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <div className="font-black text-emerald-800 dark:text-emerald-400 uppercase text-[10px] tracking-wider mb-2 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-1.5">Entradas e Créditos</div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                                <span>Total de entradas em dinheiro:</span>
                                <strong className="font-mono text-emerald-600 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.entradasDinheiro)}</strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                                <span>Total de entradas em Pix:</span>
                                <strong className="font-mono text-emerald-600 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.entradasPix)}</strong>
                            </div>
                            <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-100 pt-1 border-t border-emerald-200/40">
                                <span>Total de entradas:</span>
                                <strong className="font-mono text-emerald-700 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.totalEntradas)}</strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-1">
                                <span>Total de transf. recebidas:</span>
                                <strong className="font-mono text-emerald-600 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.transfRecebidas)}</strong>
                            </div>
                            <div className="flex justify-between items-center font-extrabold text-emerald-800 dark:text-emerald-300 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 text-[11px]">
                                <span>Total Entradas + Transf.:</span>
                                <span className="font-mono ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.totalEntradasPlusTransf)}</span>
                            </div>
                        </div>

                        {/* Bloco Saídas & Débitos */}
                        <div className="space-y-2 bg-rose-50/30 dark:bg-rose-950/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30">
                            <div className="font-black text-rose-800 dark:text-rose-400 uppercase text-[10px] tracking-wider mb-2 border-b border-rose-200/60 dark:border-rose-800/40 pb-1.5">Saídas e Débitos</div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                                <span>Total de saídas em dinheiro:</span>
                                <strong className="font-mono text-rose-600 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.saidasDinheiro)}</strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                                <span>Total de saídas em Pix:</span>
                                <strong className="font-mono text-rose-600 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.saidasPix)}</strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                                <span>Saídas boleto, faturas:</span>
                                <strong className="font-mono text-rose-600 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.saidasBoletoFaturas)}</strong>
                            </div>
                            <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-100 pt-1 border-t border-rose-200/40">
                                <span>Total de saídas:</span>
                                <strong className="font-mono text-rose-700 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.totalSaidas)}</strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-1">
                                <span>Total de transf. enviadas:</span>
                                <strong className="font-mono text-rose-600 ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.transfEnviadas)}</strong>
                            </div>
                            <div className="flex justify-between items-center font-extrabold text-rose-800 dark:text-rose-300 pt-2 border-t border-rose-200/80 dark:border-rose-800/60 text-[11px]">
                                <span>Total Saídas + Transf.:</span>
                                <span className="font-mono ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.totalSaidasPlusTransf)}</span>
                            </div>
                        </div>

                        {/* Bloco Saldos */}
                        <div className="space-y-3 bg-amber-50/40 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/30 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="font-black text-amber-800 dark:text-amber-400 uppercase text-[10px] tracking-wider mb-2 border-b border-amber-200/60 dark:border-amber-800/40 pb-1.5">Saldos do Período</div>
                                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 py-0.5">
                                    <span className="font-bold">Saldo em Dinheiro:</span>
                                    <strong className={`font-mono ml-2 whitespace-nowrap ${summaryBreakdown.saldoDinheiro >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatBRL(summaryBreakdown.saldoDinheiro)}
                                    </strong>
                                </div>
                                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 py-0.5">
                                    <span className="font-bold">Saldo em Pix:</span>
                                    <strong className={`font-mono ml-2 whitespace-nowrap ${summaryBreakdown.saldoPix >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatBRL(summaryBreakdown.saldoPix)}
                                    </strong>
                                </div>
                                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 py-0.5 border-t border-amber-200/40 pt-1">
                                    <span className="font-bold">Saldo Anterior:</span>
                                    <strong className="font-mono ml-2 whitespace-nowrap">{formatBRL(summaryBreakdown.saldoAnterior)}</strong>
                                </div>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-300/80 dark:border-amber-800 shadow-xs flex justify-between items-center gap-2">
                                <span className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-tight">Saldo final:</span>
                                <span className={`text-base font-black font-mono whitespace-nowrap ${summaryBreakdown.saldoFinal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {formatBRL(summaryBreakdown.saldoFinal)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Demonstrativo Detalhado de Saldo Dinheiro e Saldo Pix */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                        {/* Resumo Dinheiro */}
                        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-emerald-800/40">
                                <span className="font-black uppercase tracking-wider text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                    Resumo em Dinheiro (Espécie)
                                </span>
                                <span className={`text-xs font-mono font-black ${summaryBreakdown.saldoDinheiro >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'}`}>
                                    Saldo: {formatBRL(summaryBreakdown.saldoDinheiro)}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Entrada</span>
                                    <strong className="font-mono text-emerald-600 block text-[11.5px] mt-0.5">{formatBRL(summaryBreakdown.entradasDinheiro)}</strong>
                                </div>
                                <div className="bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">(-) Total Pago</span>
                                    <strong className="font-mono text-rose-600 block text-[11.5px] mt-0.5">{formatBRL(summaryBreakdown.saidasDinheiro)}</strong>
                                </div>
                                <div className="bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-right">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">(=) Saldo Dinheiro</span>
                                    <strong className={`font-mono block text-[11.5px] mt-0.5 ${summaryBreakdown.saldoDinheiro >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatBRL(summaryBreakdown.saldoDinheiro)}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* Resumo Pix */}
                        <div className="bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/70 dark:border-teal-900/40 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-teal-200/60 dark:border-teal-800/40">
                                <span className="font-black uppercase tracking-wider text-[11px] text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                    Resumo em Pix
                                </span>
                                <span className={`text-xs font-mono font-black ${summaryBreakdown.saldoPix >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-rose-600 dark:text-rose-400'}`}>
                                    Saldo: {formatBRL(summaryBreakdown.saldoPix)}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-teal-100 dark:border-teal-900/30">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Valor Entrada</span>
                                    <strong className="font-mono text-teal-600 dark:text-teal-400 block text-[11.5px] mt-0.5">{formatBRL(summaryBreakdown.entradasPix)}</strong>
                                </div>
                                <div className="bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-teal-100 dark:border-teal-900/30">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">(-) Valor Saída</span>
                                    <strong className="font-mono text-rose-600 block text-[11.5px] mt-0.5">{formatBRL(summaryBreakdown.saidasPix)}</strong>
                                </div>
                                <div className="bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-teal-100 dark:border-teal-900/30 text-right">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">(=) Saldo Pix</span>
                                    <strong className={`font-mono block text-[11.5px] mt-0.5 ${summaryBreakdown.saldoPix >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatBRL(summaryBreakdown.saldoPix)}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RESUMO POR DESTINO / FINALIDADE (DESCRIÇÃO & RATEIOS) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-4 bg-brand-blue rounded-full"></div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                RESUMO POR DESTINO / FINALIDADE (DESCRIÇÃO)
                            </h3>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                            Totalização por Descrição e Rateios Específicos
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                        {/* Coluna Entradas por Descrição */}
                        <div className="bg-emerald-50/20 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100/80 dark:border-emerald-900/30 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-200/60 dark:border-emerald-800/40">
                                    <div className="flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-400 uppercase text-[10px] tracking-wider">
                                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Entradas por Destino / Descrição</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                        {descriptionBreakdown.incomes.length} {descriptionBreakdown.incomes.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </div>

                                {descriptionBreakdown.incomes.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400 italic text-xs">
                                        Nenhuma entrada registrada no período.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                                        {descriptionBreakdown.incomes.map((item, idx) => {
                                            const pct = descriptionBreakdown.totalIncome > 0 
                                                ? Math.round((item.total / descriptionBreakdown.totalIncome) * 100) 
                                                : 0;

                                            return (
                                                <div 
                                                    key={idx}
                                                    className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-950/60 rounded-xl hover:border-emerald-300 transition-colors shadow-2xs"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                                        <span className="font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0 border border-emerald-200/60 dark:border-emerald-800/40">
                                                            {item.count}x
                                                        </span>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-bold text-slate-800 dark:text-slate-100 uppercase text-[11.5px] truncate" title={item.label}>
                                                                {item.label}
                                                            </span>
                                                            <span className="text-[9.5px] text-slate-400 font-medium mt-0.5">
                                                                {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'} ({pct}% do total)
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right whitespace-nowrap pl-2">
                                                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                                                            {formatBRL(item.total)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center font-extrabold text-emerald-800 dark:text-emerald-300 pt-3 mt-3 border-t border-emerald-200/80 dark:border-emerald-800/60 text-xs">
                                <span>Total Entradas:</span>
                                <span className="font-mono text-sm ml-2 whitespace-nowrap">{formatBRL(descriptionBreakdown.totalIncome)}</span>
                            </div>
                        </div>

                        {/* Coluna Saídas por Descrição */}
                        <div className="bg-rose-50/20 dark:bg-rose-950/10 p-4 rounded-xl border border-rose-100/80 dark:border-rose-900/30 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-200/60 dark:border-rose-800/40">
                                    <div className="flex items-center gap-1.5 font-black text-rose-800 dark:text-rose-400 uppercase text-[10px] tracking-wider">
                                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                                        <span>Saídas por Destino / Descrição</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full">
                                        {descriptionBreakdown.expenses.length} {descriptionBreakdown.expenses.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </div>

                                {descriptionBreakdown.expenses.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400 italic text-xs">
                                        Nenhuma saída registrada no período.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                                        {descriptionBreakdown.expenses.map((item, idx) => {
                                            const pct = descriptionBreakdown.totalExpense > 0 
                                                ? Math.round((item.total / descriptionBreakdown.totalExpense) * 100) 
                                                : 0;

                                            return (
                                                <div 
                                                    key={idx}
                                                    className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/80 border border-rose-100 dark:border-rose-950/60 rounded-xl hover:border-rose-300 transition-colors shadow-2xs"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                                        <span className="font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 shrink-0 border border-rose-200/60 dark:border-rose-800/40">
                                                            {item.count}x
                                                        </span>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-bold text-slate-800 dark:text-slate-100 uppercase text-[11.5px] truncate" title={item.label}>
                                                                {item.label}
                                                            </span>
                                                            <span className="text-[9.5px] text-slate-400 font-medium mt-0.5">
                                                                {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'} ({pct}% do total)
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right whitespace-nowrap pl-2">
                                                        <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                                                            {formatBRL(item.total)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center font-extrabold text-rose-800 dark:text-rose-300 pt-3 mt-3 border-t border-rose-200/80 dark:border-rose-800/60 text-xs">
                                <span>Total Saídas:</span>
                                <span className="font-mono text-sm ml-2 whitespace-nowrap">{formatBRL(descriptionBreakdown.totalExpense)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ChurchClosingModal
                isOpen={isClosingModalOpen}
                onClose={() => setIsClosingModalOpen(false)}
                currentChurchId={selectedChurchIds.length === 1 ? selectedChurchIds[0] : null}
                initialMonth={selectedMonth}
                initialYear={selectedYear}
            />

            <AttachmentPreviewModal
                isOpen={!!previewAttachment}
                attachment={previewAttachment}
                onClose={() => setPreviewAttachment(null)}
            />

            <QuickAttachModal
                isOpen={!!quickAttachTx}
                transaction={quickAttachTx}
                onClose={() => setQuickAttachTx(null)}
                onSaved={(txId, atts) => {
                    setAttachmentsMap(prev => {
                        const next = new Map(prev);
                        next.set(txId, atts);
                        return next;
                    });
                    showToast('Comprovante(s) salvo(s) com sucesso!', 'success');
                }}
            />

            <ServiceReceiptModal
                isOpen={!!serviceReceiptTx}
                transaction={serviceReceiptTx}
                church={churches.find((c: any) => c.id === serviceReceiptTx?.churchId || c.name === serviceReceiptTx?.church) || (selectedChurchIds.length === 1 ? churches.find((c: any) => c.id === selectedChurchIds[0]) : churches[0])}
                onClose={() => setServiceReceiptTx(null)}
                onReceiptGenerated={(att) => {
                    if (serviceReceiptTx?.id) {
                        setAttachmentsMap(prev => {
                            const next = new Map(prev);
                            const currentList = next.get(serviceReceiptTx.id) || [];
                            next.set(serviceReceiptTx.id, [...currentList, att]);
                            return next;
                        });
                        showToast('Recibo assinado e anexado com sucesso ao Livro Caixa!', 'success');
                    }
                }}
            />
        </div>
    );
});
