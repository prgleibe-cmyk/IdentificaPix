import React, { useState, useContext, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { ContributorsReportSection, ContributorsReportHandle } from '../components/reports/ContributorsReportSection';
import { ExportService } from '../services/ExportService';
import { 
    Users, 
    FileText, 
    Building2, 
    BookOpen, 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Calendar, 
    Search, 
    ArrowRight, 
    ArrowLeft,
    SlidersHorizontal,
    PieChart, 
    AlertCircle, 
    CheckCircle2, 
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Table2,
    ChevronDown,
    ChevronUp,
    Check,
    RotateCcw,
    RefreshCw,
    Tag,
    X,
    ChevronLeft,
    ChevronRight,
    Landmark
} from 'lucide-react';
import { BuildingOfficeIcon } from '../components/Icons';
import { PeriodSelector, PeriodSelectionMode, DEFAULT_MONTHS_LIST } from '../components/reports/PeriodSelector';
import { ExportPrintActions } from '../components/reports/ExportPrintActions';

export const RelatoriosView: React.FC = memo(() => {
    const { setActiveView, showToast } = useUI();
    const context = useContext(AppContext);

    // Active sub-tab state
    const [activeTab, setActiveTab] = useState<'contributors' | 'balancete' | 'churches' | 'expenses'>('contributors');

    // Filter configuration screen state (opens initial filter screen before generating report)
    const [hasGenerated, setHasGenerated] = useState<boolean>(false);

    // Balancete Sub-type state (Sintético, Analítico, Contábil)
    const [balanceteType, setBalanceteType] = useState<'sintetico' | 'analitico' | 'contabil'>('sintetico');

    // Global filters for financial reports
    const now = useMemo(() => new Date(), []);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectionMode, setSelectionMode] = useState<PeriodSelectionMode>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [balanceteCurrentPage, setBalanceteCurrentPage] = useState<number>(1);
    const BALANCETE_ITEMS_PER_PAGE = 50;

    const currentYear = now.getFullYear();
    const yearsList = useMemo(() => {
        const list = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
        if (!list.includes(selectedYear)) list.push(selectedYear);
        return Array.from(new Set(list)).sort((a, b) => b - a);
    }, [currentYear, selectedYear]);
    
    // Multi-select church & bank filters
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
    const [isChurchDropdownOpen, setIsChurchDropdownOpen] = useState<boolean>(false);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [isBankDropdownOpen, setIsBankDropdownOpen] = useState<boolean>(false);

    // Expenses / Categories tab multi-category filter & drilldown state
    const [categoryTypeFilter, setCategoryTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
    const [categoryPaymentMethodFilter, setCategoryPaymentMethodFilter] = useState<string>('all');
    const [categoryRoleFilter, setCategoryRoleFilter] = useState<string>('all');
    const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);
    const [expenseCategorySearch, setExpenseCategorySearch] = useState<string>('');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);

    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Header Report Dropdowns state
    const [isBalanceteMenuOpen, setIsBalanceteMenuOpen] = useState<boolean>(false);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState<boolean>(false);

    const isHydratingFromCloud = context?.isHydratingFromCloud || context?.isHydrating || false;

    const hasActiveSearchFilters = Boolean(
        context?.searchFilters && (
            context.searchFilters.dateRange?.start ||
            context.searchFilters.dateRange?.end ||
            context.searchFilters.filterBy !== 'none' ||
            (context.searchFilters.churchIds && context.searchFilters.churchIds.length > 0) ||
            context.searchFilters.contributorName ||
            context.searchFilters.amountRange?.min ||
            context.searchFilters.amountRange?.max
        )
    );

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (typeof context?.triggerSync === 'function') {
                context.triggerSync();
            }
            if (typeof context?.hydrate === 'function') {
                await context.hydrate();
            }
            showToast('Relatório recarregado com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao recarregar relatório:', err);
            showToast('Erro ao recarregar os dados do relatório.', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const churchDropdownRef = useRef<HTMLDivElement>(null);
    const bankDropdownRef = useRef<HTMLDivElement>(null);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const contributorsReportRef = useRef<ContributorsReportHandle>(null);
    const balanceteMenuRef = useRef<HTMLDivElement>(null);
    const categoryMenuRef = useRef<HTMLDivElement>(null);

    const { user, subscription, isSecondaryUser } = useAuth();

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

    const churchNameMap = useMemo(() => {
        const map = new Map<string, string>();
        (churches || []).forEach((c: any) => {
            if (c.id) map.set(c.id, c.name);
        });
        return map;
    }, [churches]);

    const banks = useMemo(() => {
        const raw = context?.banks || [];
        let list = raw;
        if (isSecondaryUser && allowedBankIds && allowedBankIds.length > 0) {
            list = list.filter((b: any) => allowedBankIds.includes(b.id));
        }
        if (context?.bankList && context.bankList.length > 0) {
            const validBankIds = new Set(context.bankList.map((b: any) => b.id));
            const filteredByRegistered = list.filter((b: any) => validBankIds.has(b.id));
            if (filteredByRegistered.length > 0) return filteredByRegistered;
        }
        return list;
    }, [context?.banks, context?.bankList, isSecondaryUser, allowedBankIds]);

    const reportData = context?.reportData || [];
    const contributorFiles = context?.contributorFiles || [];

    // Click outside listener for dropdown popovers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (churchDropdownRef.current && !churchDropdownRef.current.contains(event.target as Node)) {
                setIsChurchDropdownOpen(false);
            }
            if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
                setIsBankDropdownOpen(false);
            }
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
            if (balanceteMenuRef.current && !balanceteMenuRef.current.contains(event.target as Node)) {
                setIsBalanceteMenuOpen(false);
            }
            if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
                setIsCategoryMenuOpen(false);
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
        const b = banks.find((item: any) => item.id === bId);
        return b ? (b.account_name || b.name || 'Banco') : 'Banco';
    };

    // Toggle multi-select church & bank filters
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

    const handleMonthYearSelect = (month: number, year: number) => {
        setSelectedMonth(month);
        setSelectedYear(year);
    };

    const handleCustomDatesChange = (start: string, end: string) => {
        setCustomStartDate(start);
        setCustomEndDate(end);
    };

    const handlePeriodModeChange = (mode: PeriodSelectionMode) => {
        setSelectionMode(mode);
        if (mode === 'dates' && (!customStartDate || !customEndDate)) {
            const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
            const end = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            if (!customStartDate) setCustomStartDate(start);
            if (!customEndDate) setCustomEndDate(end);
        }
    };

    // Filter reportData by search, multi-church, multi-bank, and period filters
    const filteredReportData = useMemo(() => {
        const targetMonthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const customStartIso = customStartDate ? customStartDate.split('T')[0] : null;
        const customEndIso = customEndDate ? customEndDate.split('T')[0] : null;
        const lowerSearch = searchTerm.trim().toLowerCase();

        return reportData.filter((item: any) => {
            // Secondary user church restriction
            if (isSecondaryUser && allowedChurchIds && allowedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                const txSplits = (Array.isArray(item.splits) && item.splits.length > 0) ? item.splits : null;
                const matchesAllowed = allowedChurchIds.some(cId => {
                    if (itemChurchId === cId) return true;
                    const chName = churchNameMap.get(cId);
                    if (chName && (item.church === chName || item.churchId === cId)) return true;
                    if (txSplits && txSplits.length > 0) {
                        return txSplits.some((s: any) => s.churchId === cId || (chName && s.churchName === chName));
                    }
                    return false;
                });
                if (!matchesAllowed) return false;
            }

            // Multi-church filter
            if (selectedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                const txSplits = (Array.isArray(item.splits) && item.splits.length > 0) ? item.splits : null;
                const matchesAny = selectedChurchIds.some(cId => {
                    if (itemChurchId === cId) return true;
                    const chName = churchNameMap.get(cId);
                    if (chName && (item.church === chName || item.churchId === cId)) return true;
                    if (txSplits && txSplits.length > 0) {
                        return txSplits.some((s: any) => s.churchId === cId || (chName && s.churchName === chName));
                    }
                    return false;
                });
                if (!matchesAny) return false;
            }

            // Multi-bank filter
            if (selectedBankIds.length > 0) {
                const itemBankId = item.bankId || item.raw?.transaction?.bank_id || item.raw?.bankId;
                const itemBankName = item.bankName;
                const matchesBank = selectedBankIds.some(bId => {
                    if (itemBankId && itemBankId === bId) return true;
                    const bObj = banks.find((b: any) => b.id === bId);
                    if (!bObj) return false;
                    const bName = (bObj.account_name || bObj.name || '').toLowerCase();
                    return Boolean(itemBankName && itemBankName.toLowerCase() === bName);
                });
                if (!matchesBank) return false;
            }

            // Search query
            if (lowerSearch) {
                const desc = (item.desc || item.description || item.historico || '').toLowerCase();
                const payer = (item.payer || item.contribuinte || item.nome || '').toLowerCase();
                const cat = (item.category || item.categoria || '').toLowerCase();
                const val = String(item.amount || item.val || '');
                const ch = (item.church || '').toLowerCase();
                if (!desc.includes(lowerSearch) && !payer.includes(lowerSearch) && !cat.includes(lowerSearch) && !val.includes(lowerSearch) && !ch.includes(lowerSearch)) {
                    return false;
                }
            }

            // Date filter (Fast string comparison without Date instance allocations)
            if (item.date && selectionMode !== 'all') {
                const itemIso = String(item.date).split(/[T ]/)[0];
                if (selectionMode === 'month') {
                    if (!itemIso.startsWith(targetMonthPrefix)) return false;
                } else if (selectionMode === 'dates') {
                    if (customStartIso && itemIso < customStartIso) return false;
                    if (customEndIso && itemIso > customEndIso) return false;
                }
            }

            return true;
        });
    }, [reportData, selectedChurchIds, selectedBankIds, banks, searchTerm, selectionMode, selectedMonth, selectedYear, customStartDate, customEndDate, churchNameMap, isSecondaryUser, allowedChurchIds]);

    const balanceteTotalPages = Math.ceil(filteredReportData.length / BALANCETE_ITEMS_PER_PAGE) || 1;

    useEffect(() => {
        setBalanceteCurrentPage(1);
    }, [selectionMode, selectedMonth, selectedYear, customStartDate, customEndDate, selectedChurchIds, selectedBankIds, searchTerm, balanceteType]);

    useEffect(() => {
        if (balanceteCurrentPage > balanceteTotalPages && balanceteTotalPages > 0) {
            setBalanceteCurrentPage(balanceteTotalPages);
        }
    }, [filteredReportData.length, balanceteTotalPages, balanceteCurrentPage]);

    const paginatedBalanceteData = useMemo(() => {
        const start = (balanceteCurrentPage - 1) * BALANCETE_ITEMS_PER_PAGE;
        return filteredReportData.slice(start, start + BALANCETE_ITEMS_PER_PAGE);
    }, [filteredReportData, balanceteCurrentPage]);

    // Financial totals
    const financialTotals = useMemo(() => {
        let income = 0;
        let expenses = 0;
        let pending = 0;
        let pendingCount = 0;

        filteredReportData.forEach((tx: any) => {
            const txSplits = (Array.isArray(tx.splits) && tx.splits.length > 0)
                ? tx.splits
                : (Array.isArray(tx.raw?.splits) && tx.raw.splits.length > 0)
                    ? tx.raw.splits
                    : null;
            const isBaseExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const isPending = tx.status === 'pending' || tx.unidentified || tx.isPending;

            if (txSplits && txSplits.length > 0) {
                txSplits.forEach((s: any) => {
                    const splitAmt = Math.abs(Number(s.amount) || 0);
                    const isSplitExpense = s.amount < 0 || isBaseExpense;
                    if (isPending) {
                        pending += splitAmt;
                    }
                    if (isSplitExpense) {
                        expenses += splitAmt;
                    } else {
                        income += splitAmt;
                    }
                });
                if (isPending) {
                    pendingCount++;
                }
            } else {
                const amount = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                if (isPending) {
                    pending += amount;
                    pendingCount++;
                }
                if (isBaseExpense) {
                    expenses += amount;
                } else {
                    income += amount;
                }
            }
        });

        return {
            income,
            expenses,
            balance: income - expenses,
            pending,
            pendingCount,
            totalTransactions: filteredReportData.length
        };
    }, [filteredReportData]);

    // Church summaries - single-pass aggregation
    const churchSummaries = useMemo(() => {
        const totalSystemIncome = financialTotals.income || 1;
        
        const churchDataMap = new Map<string, { txCount: number; totalIncome: number; totalExpenses: number }>();
        
        (reportData || []).forEach((tx: any) => {
            const txSplits = (Array.isArray(tx.splits) && tx.splits.length > 0)
                ? tx.splits
                : (Array.isArray(tx.raw?.splits) && tx.raw.splits.length > 0)
                    ? tx.raw.splits
                    : null;
            const isBaseExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));

            if (txSplits && txSplits.length > 0) {
                txSplits.forEach((s: any) => {
                    const cId = s.churchId || s.church || tx.churchId || tx.church;
                    if (!cId) return;
                    let entry = churchDataMap.get(cId);
                    if (!entry) {
                        entry = { txCount: 0, totalIncome: 0, totalExpenses: 0 };
                        churchDataMap.set(cId, entry);
                    }
                    entry.txCount++;
                    const amt = Math.abs(Number(s.amount) || 0);
                    const isSplitExpense = s.amount < 0 || isBaseExpense;
                    if (isSplitExpense) {
                        entry.totalExpenses += amt;
                    } else {
                        entry.totalIncome += amt;
                    }
                });
            } else {
                const cId = tx.churchId || tx.church;
                if (!cId) return;
                let entry = churchDataMap.get(cId);
                if (!entry) {
                    entry = { txCount: 0, totalIncome: 0, totalExpenses: 0 };
                    churchDataMap.set(cId, entry);
                }
                entry.txCount++;
                const amt = Number(tx.amount) || Number(tx.val) || 0;
                const isExpense = isBaseExpense || amt < 0;
                if (isExpense) {
                    entry.totalExpenses += Math.abs(amt);
                } else {
                    entry.totalIncome += amt;
                }
            }
        });

        const contributorCountByChurch = new Map<string, number>();
        (contributorFiles || []).forEach((f: any) => {
            const id = f.churchId || f.church?.id;
            if (id) {
                contributorCountByChurch.set(id, f.contributors?.length || 0);
            }
        });

        return churches.map((church: any) => {
            const entry = churchDataMap.get(church.id) || churchDataMap.get(church.name) || { txCount: 0, totalIncome: 0, totalExpenses: 0 };
            const contributorCount = contributorCountByChurch.get(church.id) || 0;
            const sharePercent = Math.min(100, Math.round((entry.totalIncome / totalSystemIncome) * 100));

            return {
                id: church.id,
                name: church.name,
                cnpJ: church.cnpj || church.cnpjCpf || 'N/A',
                city: church.city || 'N/A',
                txCount: entry.txCount,
                totalIncome: entry.totalIncome,
                totalExpenses: entry.totalExpenses,
                netBalance: entry.totalIncome - entry.totalExpenses,
                contributorCount,
                sharePercent
            };
        });
    }, [churches, reportData, contributorFiles, financialTotals.income]);

    // Group expenses by category
    const expenseCategories = useMemo(() => {
        const map: { [key: string]: { category: string; amount: number; count: number } } = {};
        
        filteredReportData.forEach((tx: any) => {
            const isBaseExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const txSplits = (Array.isArray(tx.splits) && tx.splits.length > 0)
                ? tx.splits
                : (Array.isArray(tx.raw?.splits) && tx.raw.splits.length > 0)
                    ? tx.raw.splits
                    : null;

            if (txSplits && txSplits.length > 0) {
                txSplits.forEach((s: any) => {
                    const splitAmt = Math.abs(Number(s.amount) || 0);
                    if (splitAmt <= 0) return;
                    const isSplitExpense = s.amount < 0 || isBaseExpense;
                    if (isSplitExpense) {
                        const catName = s.contributionType || s.category || s.categoria || s.destino || tx.category || tx.categoria || 'Despesas Gerais / Manutenção';
                        if (!map[catName]) {
                            map[catName] = { category: catName, amount: 0, count: 0 };
                        }
                        map[catName].amount += splitAmt;
                        map[catName].count += 1;
                    }
                });
            } else if (isBaseExpense) {
                const catName = tx.category || tx.categoria || 'Despesas Gerais / Manutenção';
                const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                if (!map[catName]) {
                    map[catName] = { category: catName, amount: 0, count: 0 };
                }
                map[catName].amount += amt;
                map[catName].count += 1;
            }
        });

        return Object.values(map).sort((a, b) => b.amount - a.amount);
    }, [filteredReportData]);

    // Group income by category
    const incomeCategories = useMemo(() => {
        const map: { [key: string]: { category: string; amount: number; count: number } } = {};
        
        filteredReportData.forEach((tx: any) => {
            const isBaseExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const txSplits = (Array.isArray(tx.splits) && tx.splits.length > 0)
                ? tx.splits
                : (Array.isArray(tx.raw?.splits) && tx.raw.splits.length > 0)
                    ? tx.raw.splits
                    : null;

            if (txSplits && txSplits.length > 0) {
                txSplits.forEach((s: any) => {
                    const splitAmt = Math.abs(Number(s.amount) || 0);
                    if (splitAmt <= 0) return;
                    const isSplitExpense = s.amount < 0 || isBaseExpense;
                    if (!isSplitExpense) {
                        const catName = s.contributionType || s.category || s.categoria || s.destino || tx.category || tx.categoria || 'Dízimos & Ofertas';
                        if (!map[catName]) {
                            map[catName] = { category: catName, amount: 0, count: 0 };
                        }
                        map[catName].amount += splitAmt;
                        map[catName].count += 1;
                    }
                });
            } else if (!isBaseExpense) {
                const catName = tx.category || tx.categoria || 'Dízimos & Ofertas';
                const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                if (!map[catName]) {
                    map[catName] = { category: catName, amount: 0, count: 0 };
                }
                map[catName].amount += amt;
                map[catName].count += 1;
            }
        });

        return Object.values(map).sort((a, b) => b.amount - a.amount);
    }, [filteredReportData]);

    // Helper to resolve transaction category name
    const getTxCategory = useCallback((tx: any) => {
        const rawCat = tx.category || tx.categoria || tx.contributionType || tx.purpose || tx.proposito || tx.categoryName || tx.type_name;
        if (rawCat && String(rawCat).trim()) {
            return String(rawCat).trim();
        }
        const isExp = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && String(tx.category).toLowerCase().includes('saida'));
        return isExp ? 'Despesas Gerais / Manutenção' : 'Dízimos & Ofertas';
    }, []);

    // Helper to resolve payment method
    const getTxPaymentMethod = useCallback((tx: any) => {
        const pm = tx.paymentMethod || tx.formaPagamento || tx.payment_method || tx.paymentType || tx.metodo || tx.transaction?.paymentMethod;
        if (pm && String(pm).trim()) return String(pm).trim().toUpperCase();
        return 'NÃO INFORMADO';
    }, []);

    // Memoized map for contributor roles
    const contributorRoleMap = useMemo(() => {
        const map = new Map<string, string>();
        (contributorFiles || []).forEach((file: any) => {
            (file.contributors || []).forEach((c: any) => {
                const name = (c.name || c.cleanedName || '').toLowerCase().trim();
                const role = c.cargo || c.vinculo || c.role || c.type || c.position;
                if (name && role && !map.has(name)) {
                    map.set(name, String(role).trim());
                }
            });
        });
        return map;
    }, [contributorFiles]);

    // Helper to resolve contributor role / cargo / vínculo
    const getTxRole = useCallback((tx: any) => {
        const directRole = tx.cargo || tx.vinculo || tx.role || tx.contributorRole || tx.position;
        if (directRole && String(directRole).trim()) return String(directRole).trim();
        const payerName = (tx.payer || tx.contribuinte || tx.nome || '').toLowerCase().trim();
        if (payerName) {
            const mapped = contributorRoleMap.get(payerName);
            if (mapped) return mapped;
        }
        return 'Não Especificado';
    }, [contributorRoleMap]);

    // Master list of all system categories (from transactions, reference data, and defaults)
    const allSystemCategoryNames = useMemo(() => {
        const set = new Set<string>();
        
        reportData.forEach((tx: any) => {
            const cat = getTxCategory(tx);
            if (cat) set.add(cat);
        });

        if (context?.contributionTypes && Array.isArray(context.contributionTypes)) {
            context.contributionTypes.forEach((ct: any) => {
                if (ct.name) set.add(ct.name);
                if (ct.category) set.add(ct.category);
            });
        }

        set.add('Dízimos & Ofertas');
        set.add('Despesas Gerais / Manutenção');

        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [reportData, context?.contributionTypes, getTxCategory]);

    // Available payment methods in system/data
    const availablePaymentMethods = useMemo(() => {
        const set = new Set<string>();
        if (context?.paymentMethods && Array.isArray(context.paymentMethods)) {
            context.paymentMethods.forEach((pm: string) => set.add(pm.toUpperCase()));
        }
        reportData.forEach((tx: any) => {
            const pm = getTxPaymentMethod(tx);
            if (pm && pm !== 'NÃO INFORMADO') set.add(pm);
        });
        ['PIX', 'DINHEIRO', 'BOLETO', 'CARTÃO', 'TRANSFERÊNCIA'].forEach(p => set.add(p));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [context?.paymentMethods, reportData, getTxPaymentMethod]);

    // Available roles/cargos/vínculos in system/data
    const availableRoles = useMemo(() => {
        const set = new Set<string>();
        reportData.forEach((tx: any) => {
            const r = getTxRole(tx);
            if (r && r !== 'Não Especificado') set.add(r);
        });
        contributorFiles.forEach((file: any) => {
            file.contributors?.forEach((c: any) => {
                const r = c.cargo || c.vinculo || c.role || c.type || c.position;
                if (r && String(r).trim()) set.add(String(r).trim());
            });
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [reportData, contributorFiles, getTxRole]);

    // Filter transactions by type, payment method, and role for category tab
    const categoryFilteredTransactions = useMemo(() => {
        return filteredReportData.filter((tx: any) => {
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && String(tx.category).toLowerCase().includes('saida'));

            if (categoryTypeFilter === 'expense' && !isExpense) return false;
            if (categoryTypeFilter === 'income' && isExpense) return false;

            if (categoryPaymentMethodFilter !== 'all') {
                const pm = getTxPaymentMethod(tx);
                if (pm.toLowerCase() !== categoryPaymentMethodFilter.toLowerCase()) return false;
            }

            if (categoryRoleFilter !== 'all') {
                const role = getTxRole(tx);
                if (role.toLowerCase() !== categoryRoleFilter.toLowerCase()) return false;
            }

            return true;
        });
    }, [filteredReportData, categoryTypeFilter, categoryPaymentMethodFilter, categoryRoleFilter, getTxPaymentMethod, getTxRole]);

    // Aggregate category summaries
    const categorySummaries = useMemo(() => {
        const map: { 
            [key: string]: { 
                category: string; 
                amount: number; 
                count: number; 
                incomeAmount: number; 
                expenseAmount: number; 
                transactions: any[];
                typeLabel: 'entrada' | 'saida' | 'misto';
            } 
        } = {};

        categoryFilteredTransactions.forEach((tx: any) => {
            const catName = getTxCategory(tx);
            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && String(tx.category).toLowerCase().includes('saida'));

            if (!map[catName]) {
                map[catName] = {
                    category: catName,
                    amount: 0,
                    count: 0,
                    incomeAmount: 0,
                    expenseAmount: 0,
                    transactions: [],
                    typeLabel: isExpense ? 'saida' : 'entrada'
                };
            }

            map[catName].amount += amt;
            map[catName].count += 1;
            if (isExpense) {
                map[catName].expenseAmount += amt;
            } else {
                map[catName].incomeAmount += amt;
            }
            map[catName].transactions.push(tx);
        });

        Object.values(map).forEach(item => {
            if (item.incomeAmount > 0 && item.expenseAmount > 0) {
                item.typeLabel = 'misto';
            } else if (item.expenseAmount > 0) {
                item.typeLabel = 'saida';
            } else {
                item.typeLabel = 'entrada';
            }
        });

        return Object.values(map).sort((a, b) => b.amount - a.amount);
    }, [categoryFilteredTransactions, getTxCategory]);

    // Filter displayed category cards by search and selected categories
    const displayedCategoryCards = useMemo(() => {
        return categorySummaries.filter(cat => {
            if (selectedExpenseCategories.length > 0 && !selectedExpenseCategories.includes(cat.category)) {
                return false;
            }
            if (expenseCategorySearch.trim()) {
                const term = expenseCategorySearch.toLowerCase();
                return cat.category.toLowerCase().includes(term);
            }
            return true;
        });
    }, [categorySummaries, selectedExpenseCategories, expenseCategorySearch]);

    // Total metrics for displayed category cards
    const categoryTotals = useMemo(() => {
        const totalAmount = displayedCategoryCards.reduce((sum, cat) => sum + cat.amount, 0);
        const totalIncome = displayedCategoryCards.reduce((sum, cat) => sum + cat.incomeAmount, 0);
        const totalExpenses = displayedCategoryCards.reduce((sum, cat) => sum + cat.expenseAmount, 0);
        const totalCount = displayedCategoryCards.reduce((sum, cat) => sum + cat.count, 0);
        return {
            totalAmount,
            totalIncome,
            totalExpenses,
            totalCount,
            categoriesCount: displayedCategoryCards.length
        };
    }, [displayedCategoryCards]);

    // Toggle category selection in filter
    const toggleExpenseCategory = (catName: string) => {
        setSelectedExpenseCategories(prev => 
            prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
        );
    };

    // Expand/collapse category drilldown
    const toggleExpandCategory = (catName: string) => {
        setExpandedCategory(prev => prev === catName ? null : catName);
    };

    // Export Handler for Livro Caixa / Resumo
    const handleExportLivroCaixa = (format: 'pdf' | 'excel' | 'csv' | 'ofx') => {
        if (!canDownload) {
            showToast('Você não tem permissão para baixar arquivos ou relatórios.', 'error');
            return;
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        
        if (format === 'pdf') {
            ExportService.downloadLivroCaixaPdf(filteredReportData, churches, 'Livro Caixa - Extrato Analítico', `livro_caixa_${dateStr}.pdf`, selectedChurchIds[0]);
        } else if (format === 'excel') {
            ExportService.downloadLivroCaixaExcel(filteredReportData, churches, `livro_caixa_${dateStr}.xlsx`);
        } else if (format === 'csv') {
            ExportService.downloadLivroCaixaCsv(filteredReportData, churches, `livro_caixa_${dateStr}.csv`);
        } else if (format === 'ofx') {
            ExportService.downloadLivroCaixaOfx(filteredReportData, churches, `livro_caixa_${dateStr}.ofx`);
        }
        showToast(`Livro Caixa exportado em formato ${format.toUpperCase()} com sucesso!`, 'success');
    };

    // Export Handler for Balancete
    const handleExportBalancete = (format: 'pdf' | 'excel' | 'csv' | 'ofx') => {
        if (!canDownload) {
            showToast('Você não tem permissão para baixar arquivos ou relatórios.', 'error');
            return;
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        const typeName = balanceteType === 'sintetico' ? 'Sintético' : balanceteType === 'analitico' ? 'Analítico' : 'Contábil';
        const title = `Balancete ${typeName} Financeiro`;
        const filename = `balancete_${balanceteType}_${dateStr}`;

        if (format === 'pdf') {
            ExportService.downloadBalancetePdf(
                financialTotals, 
                expenseCategories, 
                title, 
                `${filename}.pdf`, 
                churches, 
                selectedChurchIds[0],
                balanceteType,
                filteredReportData,
                incomeCategories
            );
        } else if (format === 'excel') {
            ExportService.downloadBalanceteExcel(
                financialTotals, 
                expenseCategories, 
                `${filename}.xlsx`, 
                balanceteType, 
                filteredReportData, 
                incomeCategories
            );
        } else if (format === 'csv') {
            ExportService.downloadBalanceteCsv(
                financialTotals, 
                expenseCategories, 
                `${filename}.csv`, 
                balanceteType, 
                filteredReportData, 
                incomeCategories
            );
        } else if (format === 'ofx') {
            ExportService.downloadBalanceteOfx(financialTotals, expenseCategories, `${filename}.ofx`);
        }
        showToast(`Balancete ${typeName} exportado em formato ${format.toUpperCase()} com sucesso!`, 'success');
    };

    const handlePrint = () => {
        if (!canPrint) {
            showToast('Você não tem permissão para imprimir relatórios.', 'error');
            return;
        }
        if (activeTab === 'balancete') {
            const typeName = balanceteType === 'sintetico' ? 'Sintético' : balanceteType === 'analitico' ? 'Analítico' : 'Contábil';
            ExportService.printBalanceteHtml(
                financialTotals,
                expenseCategories,
                incomeCategories,
                filteredReportData,
                churches,
                `Balancete ${typeName} Financeiro`,
                selectedChurchIds[0],
                balanceteType
            );
        } else {
            window.print();
        }
    };

    const handleTopExport = (format: 'pdf' | 'excel' | 'csv' | 'ofx') => {
        if (activeTab === 'contributors') {
            contributorsReportRef.current?.downloadFormat(format);
        } else if (activeTab === 'balancete') {
            handleExportBalancete(format);
        } else {
            handleExportLivroCaixa(format);
        }
    };

    const handleTopPrint = () => {
        if (activeTab === 'contributors') {
            contributorsReportRef.current?.print();
        } else {
            handlePrint();
        }
    };

    const activeReportSummary =
        activeTab === 'contributors'
            ? 'Dizimistas & Contribuintes'
            : activeTab === 'balancete'
            ? `Balancete (${balanceteType === 'sintetico' ? 'Sintético' : balanceteType === 'analitico' ? 'Analítico' : 'Contábil'})`
            : activeTab === 'churches'
            ? 'Resumo por Igreja'
            : `Categorias (${categoryTypeFilter === 'all' ? 'Todas' : categoryTypeFilter === 'income' ? 'Receitas' : 'Despesas'})`;

    const activePeriodSummary =
        selectionMode === 'all'
            ? 'Todo o Período'
            : selectionMode === 'month'
            ? `${DEFAULT_MONTHS_LIST.find(m => m.val === selectedMonth)?.name || ''}/${selectedYear}`
            : customStartDate && customEndDate
            ? `${formatDateBRL(customStartDate)} até ${formatDateBRL(customEndDate)}`
            : 'Período Personalizado';

    const activeChurchSummary =
        selectedChurchIds.length === 0
            ? 'Todas as Igrejas'
            : selectedChurchIds.length === 1
            ? getChurchName(selectedChurchIds[0])
            : `${selectedChurchIds.length} igrejas`;

    const activeBankSummary =
        selectedBankIds.length === 0
            ? 'Todos os Bancos'
            : selectedBankIds.length === 1
            ? getBankName(selectedBankIds[0])
            : `${selectedBankIds.length} bancos`;

    // If report has not been generated yet, show the Clean Unified Configuration Panel
    if (!hasGenerated) {
        return (
            <div className="px-1 py-3 md:px-2 w-full space-y-3 max-w-full min-h-full flex flex-col animate-fade-in pb-8 md:pb-4">
                {/* Cabeçalho Compacto Padrão */}
                <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <FileText className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Relatórios
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                Escolha o tipo de relatório, filtre período, igreja ou banco e gere a visualização.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Painel Único de Seleção e Filtros */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 rounded-xl shadow-xs space-y-3">
                    {/* Linha 1: Tipo de Relatório em Pills Compactos (padrão Financeiro) */}
                    <div className="grid grid-cols-2 sm:inline-flex items-stretch sm:items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700/70 w-full sm:w-auto">
                        {/* Tab 1: Dizimistas & Contribuintes */}
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('contributors');
                                setIsBalanceteMenuOpen(false);
                                setIsCategoryMenuOpen(false);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer whitespace-nowrap min-w-0 ${
                                activeTab === 'contributors'
                                    ? 'bg-orange-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Dizimistas</span>
                        </button>

                        {/* Tab 2: Balancete Financeiro (Dropdown) */}
                        <div className="relative flex" ref={balanceteMenuRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTab !== 'balancete') {
                                        setActiveTab('balancete');
                                    }
                                    setIsBalanceteMenuOpen(!isBalanceteMenuOpen);
                                    setIsCategoryMenuOpen(false);
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer whitespace-nowrap min-w-0 ${
                                    activeTab === 'balancete'
                                        ? 'bg-orange-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <PieChart className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                    {activeTab === 'balancete'
                                        ? `Balancete · ${balanceteType === 'sintetico' ? 'Sintético' : balanceteType === 'analitico' ? 'Analítico' : 'Contábil'}`
                                        : 'Balancete'}
                                </span>
                                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isBalanceteMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isBalanceteMenuOpen && (
                                <div className="absolute left-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-800 rounded-xl shadow-elevated border border-slate-200/90 dark:border-slate-700 p-1.5 z-50 text-xs animate-scale-in">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('balancete');
                                            setBalanceteType('sintetico');
                                            setIsBalanceteMenuOpen(false);
                                        }}
                                        className={`w-full p-2 rounded-lg text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'balancete' && balanceteType === 'sintetico'
                                                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Sintético (Resumo)</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Visão acumulada por grupo</div>
                                        </div>
                                        {activeTab === 'balancete' && balanceteType === 'sintetico' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('balancete');
                                            setBalanceteType('analitico');
                                            setIsBalanceteMenuOpen(false);
                                        }}
                                        className={`w-full p-2 rounded-lg text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'balancete' && balanceteType === 'analitico'
                                                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Analítico (Extrato)</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Extrato completo de lançamentos</div>
                                        </div>
                                        {activeTab === 'balancete' && balanceteType === 'analitico' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('balancete');
                                            setBalanceteType('contabil');
                                            setIsBalanceteMenuOpen(false);
                                        }}
                                        className={`w-full p-2 rounded-lg text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'balancete' && balanceteType === 'contabil'
                                                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Contábil (Razão)</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Formato contábil estruturado</div>
                                        </div>
                                        {activeTab === 'balancete' && balanceteType === 'contabil' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Tab 3: Resumo por Igreja */}
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('churches');
                                setIsBalanceteMenuOpen(false);
                                setIsCategoryMenuOpen(false);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer whitespace-nowrap min-w-0 ${
                                activeTab === 'churches'
                                    ? 'bg-orange-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <BuildingOfficeIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Resumo por Igreja</span>
                        </button>

                        {/* Tab 4: Categorias (Dropdown) */}
                        <div className="relative flex" ref={categoryMenuRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTab !== 'expenses') {
                                        setActiveTab('expenses');
                                    }
                                    setIsCategoryMenuOpen(!isCategoryMenuOpen);
                                    setIsBalanceteMenuOpen(false);
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer whitespace-nowrap min-w-0 ${
                                    activeTab === 'expenses'
                                        ? 'bg-orange-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <Tag className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                    {activeTab === 'expenses'
                                        ? `Categorias · ${categoryTypeFilter === 'all' ? 'Todas' : categoryTypeFilter === 'income' ? 'Receitas' : 'Despesas'}`
                                        : 'Categorias'}
                                </span>
                                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isCategoryMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isCategoryMenuOpen && (
                                <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-800 rounded-xl shadow-elevated border border-slate-200/90 dark:border-slate-700 p-1.5 z-50 text-xs animate-scale-in">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('expenses');
                                            setCategoryTypeFilter('all');
                                            setIsCategoryMenuOpen(false);
                                        }}
                                        className={`w-full p-2 rounded-lg text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'expenses' && categoryTypeFilter === 'all'
                                                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Todas as Categorias</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Receitas e despesas combinadas</div>
                                        </div>
                                        {activeTab === 'expenses' && categoryTypeFilter === 'all' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('expenses');
                                            setCategoryTypeFilter('income');
                                            setIsCategoryMenuOpen(false);
                                        }}
                                        className={`w-full p-2 rounded-lg text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'expenses' && categoryTypeFilter === 'income'
                                                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Apenas Receitas</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Entradas, dízimos e ofertas</div>
                                        </div>
                                        {activeTab === 'expenses' && categoryTypeFilter === 'income' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('expenses');
                                            setCategoryTypeFilter('expense');
                                            setIsCategoryMenuOpen(false);
                                        }}
                                        className={`w-full p-2 rounded-lg text-left font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'expenses' && categoryTypeFilter === 'expense'
                                                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Apenas Despesas</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Saídas e contas pagas</div>
                                        </div>
                                        {activeTab === 'expenses' && categoryTypeFilter === 'expense' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Linha 2: Barra Padrão de Filtros (Busca + Período + Igrejas + Bancos) */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                        {/* Busca por palavra-chave */}
                        <div className="relative w-full sm:w-56 md:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar contribuinte, histórico..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-8 pl-8 pr-7 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 placeholder:text-slate-400 shadow-2xs transition-colors"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                    title="Limpar busca"
                                    aria-label="Limpar busca"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Seletor de Período Padrão */}
                        <PeriodSelector
                            mode={selectionMode}
                            onModeChange={handlePeriodModeChange}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            onMonthYearChange={handleMonthYearSelect}
                            customStart={customStartDate}
                            customEnd={customEndDate}
                            onCustomDatesChange={handleCustomDatesChange}
                            monthsList={DEFAULT_MONTHS_LIST}
                            yearsList={yearsList}
                        />

                        {/* Filtro Igrejas (padrão Livro Caixa) */}
                        <div className="relative" ref={churchDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsChurchDropdownOpen(!isChurchDropdownOpen)}
                                className={`h-8 px-2.5 border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 ${
                                    selectedChurchIds.length > 0
                                        ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <BuildingOfficeIcon className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                                <span className="truncate max-w-[140px]">
                                    {selectedChurchIds.length === 0
                                        ? 'Todas as Igrejas'
                                        : selectedChurchIds.length === 1
                                        ? getChurchName(selectedChurchIds[0])
                                        : `${selectedChurchIds.length} Igrejas`}
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </button>

                            {isChurchDropdownOpen && (
                                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-elevated border border-slate-200/90 dark:border-slate-700 p-3 z-50 text-xs space-y-2 animate-scale-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wide">FILTRAR POR IGREJAS</span>
                                        {selectedChurchIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedChurchIds([])}
                                                className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold hover:underline cursor-pointer"
                                            >
                                                Limpar
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1 pt-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                                        <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedChurchIds.length === 0}
                                                onChange={() => setSelectedChurchIds([])}
                                                className="accent-orange-600 rounded cursor-pointer w-4 h-4 text-orange-600"
                                            />
                                            <span className="font-semibold text-slate-800 dark:text-white text-xs">Todas as Igrejas</span>
                                        </label>

                                        {churches.map((c: any) => {
                                            const isChecked = selectedChurchIds.includes(c.id);
                                            return (
                                                <label key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleChurchSelection(c.id)}
                                                        className="accent-orange-600 rounded cursor-pointer w-4 h-4 text-orange-600"
                                                    />
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium text-xs uppercase truncate">
                                                        {c.name}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Filtro Bancos (padrão Livro Caixa) */}
                        <div className="relative" ref={bankDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                                className={`h-8 px-2.5 border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 ${
                                    selectedBankIds.length > 0
                                        ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Landmark className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                                <span className="truncate max-w-[140px]">
                                    {selectedBankIds.length === 0
                                        ? 'Todos os Bancos'
                                        : selectedBankIds.length === 1
                                        ? getBankName(selectedBankIds[0])
                                        : `${selectedBankIds.length} Bancos`}
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </button>

                            {isBankDropdownOpen && (
                                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-elevated border border-slate-200/90 dark:border-slate-700 p-3 z-50 text-xs space-y-2 animate-scale-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wide">FILTRAR POR BANCO</span>
                                        {selectedBankIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedBankIds([])}
                                                className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold hover:underline cursor-pointer"
                                            >
                                                Limpar
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1 pt-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                                        <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedBankIds.length === 0}
                                                onChange={() => setSelectedBankIds([])}
                                                className="accent-orange-600 rounded cursor-pointer w-4 h-4 text-orange-600"
                                            />
                                            <span className="font-semibold text-slate-800 dark:text-white text-xs">Todos os Bancos</span>
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
                                                            className="accent-orange-600 rounded cursor-pointer w-4 h-4 text-orange-600"
                                                        />
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium text-xs uppercase truncate">
                                                            {bName}
                                                        </span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Linha 3: Rodapé Integrado (Resumo discreto + CTA Gerar Relatório) */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{activeReportSummary}</span>
                            <span className="mx-1.5 text-slate-300 dark:text-slate-600">•</span>
                            <span>{activePeriodSummary}</span>
                            <span className="mx-1.5 text-slate-300 dark:text-slate-600">•</span>
                            <span>{activeChurchSummary}</span>
                            <span className="mx-1.5 text-slate-300 dark:text-slate-600">•</span>
                            <span>{activeBankSummary}</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setHasGenerated(true)}
                            className="w-full sm:w-auto h-9 px-5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-xs tracking-wide shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
                        >
                            <FileText className="w-4 h-4" />
                            <span>Gerar Relatório</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Generated Report View
    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full min-h-full flex flex-col animate-fade-in pb-8 md:pb-4">
            {/* Top Bar on Generated Report Screen */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 flex-shrink-0">
                {/* Left: Active Report Title & Parameter Summary Badges */}
                <div className="flex items-center gap-2.5 min-w-0">
                    <button
                        type="button"
                        onClick={() => setHasGenerated(false)}
                        className="w-8 h-8 bg-slate-100 dark:bg-slate-800 hover:bg-orange-600 hover:text-white dark:hover:bg-orange-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center justify-center cursor-pointer shrink-0"
                        title="Voltar e alterar parâmetros do relatório"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                                {activeTab === 'contributors' && 'Relatório de Dizimistas & Contribuintes'}
                                {activeTab === 'balancete' && `Balancete Financeiro (${balanceteType === 'sintetico' ? 'Sintético' : balanceteType === 'analitico' ? 'Analítico' : 'Contábil'})`}
                                {activeTab === 'churches' && 'Resumo Comparativo por Igreja'}
                                {activeTab === 'expenses' && `Relatório por Categoria (${categoryTypeFilter === 'all' ? 'Todas' : categoryTypeFilter === 'income' ? 'Receitas' : 'Despesas'})`}
                            </h1>

                            <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/40 rounded-md text-[10px] font-semibold uppercase tracking-wide">
                                Relatório Gerado
                            </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2 flex-wrap leading-snug">
                            <span>Período: {activePeriodSummary}</span>
                            <span>•</span>
                            <span>Igreja: {activeChurchSummary}</span>
                            <span>•</span>
                            <span>Banco: {activeBankSummary}</span>
                        </p>
                    </div>
                </div>

                {/* Right: Actions (Search, Change Parameters, Refresh, Export/Print) */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                    {/* Search Bar */}
                    <div className="relative max-w-xs min-w-[150px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar no relatório..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="h-8 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 font-medium transition-colors"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setHasGenerated(false)}
                        className="h-8 px-3 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Alterar Parâmetros</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing || isHydratingFromCloud}
                        className="w-8 h-8 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-2xs"
                        title="Recarregar banco de dados"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isHydratingFromCloud ? 'animate-spin text-orange-600' : ''}`} />
                    </button>

                    <ExportPrintActions
                        onDownloadCsv={() => handleTopExport('csv')}
                        onDownloadExcel={() => handleTopExport('excel')}
                        onDownloadPdf={() => handleTopExport('pdf')}
                        onDownloadOfx={() => handleTopExport('ofx')}
                        onPrint={handleTopPrint}
                        downloadTitle="Exportar Relatório"
                        printTitle="Imprimir Relatório"
                        menuTitle="Formatos de Exportação"
                    />
                </div>
            </div>

            {/* Main Section Content */}
            <div className="flex-1 min-h-0">
                {/* TAB 1: Contribuintes & Dízimos */}
                {activeTab === 'contributors' && (
                    <ContributorsReportSection ref={contributorsReportRef} hideExportPrint={true} />
                )}

                {/* TAB 2: Balancete (Sintético, Analítico e Contábil) */}
                {activeTab === 'balancete' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs h-full flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
                        {/* Header & Controls */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                    <PieChart className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    Balancete Financeiro IgGestor
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Apurativo do exercício financeiro em três visões: Sintética, Analítica e Contábil.</p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing || isHydratingFromCloud}
                                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs font-semibold shadow-2xs"
                                    title="Recarregar dados do Balancete"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isHydratingFromCloud ? 'animate-spin text-orange-600' : ''}`} />
                                    <span>Recarregar</span>
                                </button>
                            </div>
                        </div>

                        {/* Balancete Type Selector Pills */}
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/70 dark:border-slate-700/60 w-full sm:w-auto self-start">
                            <button
                                onClick={() => setBalanceteType('sintetico')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                                    balanceteType === 'sintetico'
                                        ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <PieChart className="w-3.5 h-3.5" />
                                <span>Balancete Sintético</span>
                            </button>

                            <button
                                onClick={() => setBalanceteType('analitico')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                                    balanceteType === 'analitico'
                                        ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <Table2 className="w-3.5 h-3.5" />
                                <span>Balancete Analítico</span>
                            </button>

                            <button
                                onClick={() => setBalanceteType('contabil')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                                    balanceteType === 'contabil'
                                        ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Balancete Contábil</span>
                            </button>
                        </div>

                        {/* Top Key Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-950 bg-emerald-50/40 dark:bg-emerald-950/20">
                                <span className="text-[10px] uppercase font-semibold tracking-wide text-emerald-700 dark:text-emerald-400 block">Receitas Brutas</span>
                                <span className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5 block">{formatBRL(financialTotals.income)}</span>
                            </div>

                            <div className="p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-950 bg-rose-50/40 dark:bg-rose-950/20">
                                <span className="text-[10px] uppercase font-semibold tracking-wide text-rose-700 dark:text-rose-400 block">Despesas & Custos</span>
                                <span className="text-lg font-bold tabular-nums text-rose-700 dark:text-rose-300 mt-0.5 block">{formatBRL(financialTotals.expenses)}</span>
                            </div>

                            <div className={`p-3.5 rounded-xl border ${financialTotals.balance >= 0 ? 'border-slate-200/90 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40' : 'border-amber-200/80 dark:border-amber-950 bg-amber-50/40 dark:bg-amber-950/20'}`}>
                                <span className="text-[10px] uppercase font-semibold tracking-wide text-slate-600 dark:text-slate-400 block">Resultado Operacional</span>
                                <span className={`text-lg font-bold tabular-nums ${financialTotals.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-amber-700 dark:text-amber-300'} mt-0.5 block`}>{formatBRL(financialTotals.balance)}</span>
                            </div>

                            <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-950 bg-amber-50/40 dark:bg-amber-950/20">
                                <span className="text-[10px] uppercase font-semibold tracking-wide text-amber-700 dark:text-amber-400 block">Pendentes Conciliação</span>
                                <span className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300 mt-0.5 block">{formatBRL(financialTotals.pending)}</span>
                            </div>
                        </div>

                        {/* TYPE 1: BALANCETE SINTÉTICO */}
                        {balanceteType === 'sintetico' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                                {/* Entradas Demonstrative */}
                                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
                                        <h4 className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 tracking-wide flex items-center gap-1.5">
                                            <ArrowUpRight className="w-4 h-4" />
                                            Demonstrativo Sintético de Entradas
                                        </h4>
                                        <span className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatBRL(financialTotals.income)}</span>
                                    </div>

                                    {incomeCategories.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma entrada registrada no período.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {incomeCategories.map((cat, idx) => {
                                                const perc = financialTotals.income > 0 ? Math.round((cat.amount / financialTotals.income) * 100) : 0;
                                                return (
                                                    <div key={idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                                                        <div className="flex justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                            <span>{cat.category}</span>
                                                            <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(cat.amount)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                                                            <span>{cat.count} lançamentos</span>
                                                            <span>{perc}% das entradas</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${perc}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Saídas Demonstrative */}
                                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
                                        <h4 className="text-xs font-bold uppercase text-rose-700 dark:text-rose-400 tracking-wide flex items-center gap-1.5">
                                            <ArrowDownRight className="w-4 h-4" />
                                            Demonstrativo Sintético de Saídas por Categoria
                                        </h4>
                                        <span className="text-xs font-bold tabular-nums text-rose-700 dark:text-rose-400">{formatBRL(financialTotals.expenses)}</span>
                                    </div>

                                    {expenseCategories.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma saída registrada no período.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {expenseCategories.map((cat, idx) => {
                                                const perc = financialTotals.expenses > 0 ? Math.round((cat.amount / financialTotals.expenses) * 100) : 0;
                                                return (
                                                    <div key={idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                                                        <div className="flex justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                            <span>{cat.category}</span>
                                                            <span className="tabular-nums font-bold text-rose-600 dark:text-rose-400">{formatBRL(cat.amount)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                                                            <span>{cat.count} lançamentos</span>
                                                            <span>{perc}% das saídas</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${perc}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TYPE 2: BALANCETE ANALÍTICO */}
                        {balanceteType === 'analitico' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                        Detalhamento Item a Item do Balancete Analítico
                                    </span>
                                    <span className="tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                                        {filteredReportData.length} lançamentos encontrados
                                    </span>
                                </div>

                                <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                                    <div className="overflow-x-auto custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200/90 dark:border-slate-800">
                                                    <th className="py-2.5 px-3">Data</th>
                                                    <th className="py-2.5 px-3">Histórico</th>
                                                    <th className="py-2.5 px-3">Contribuinte / Favorecido</th>
                                                    <th className="py-2.5 px-3">Descrição / Categoria</th>
                                                    <th className="py-2.5 px-3">Igreja</th>
                                                    <th className="py-2.5 px-3 text-center">Tipo</th>
                                                    <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                                {paginatedBalanceteData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                                                            Nenhum lançamento encontrado para o período/filtro selecionado.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedBalanceteData.map((tx: any, idx: number) => {
                                                        const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
                                                        const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                                                        const isManualTx = tx.isManual || tx.source === 'manual' || tx.raw?.transaction?.source === 'manual' || tx.raw?.transaction?.isManual === true || (tx.raw as any)?.isManual === true || String(tx.id).startsWith('ghost-manual-') || (tx.row_hash && tx.row_hash.includes('|bmanual|'));

                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                                                <td className="py-2.5 px-3 tabular-nums text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                                                                    {!isManualTx && tx.reference_date && tx.bank_date && tx.reference_date !== tx.bank_date ? (
                                                                        <div className="flex flex-col leading-tight">
                                                                            <span className="font-semibold text-slate-800 dark:text-white" title={`Data de Referência (Competência): ${formatDateBRL(tx.date)}`}>
                                                                                {formatDateBRL(tx.date)}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5" title={`Data no Banco: ${formatDateBRL(tx.bank_date)}`}>
                                                                                <span className="text-[9px] uppercase font-semibold text-slate-400 mr-0.5">Banco:</span>
                                                                                {formatDateBRL(tx.bank_date)}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span>{tx.date ? formatDateBRL(tx.date) : '---'}</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-white uppercase">{tx.desc || tx.description || tx.historico || 'Lançamento'}</td>
                                                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{tx.payer || tx.contribuinte || tx.nome || '---'}</td>
                                                                <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{tx.category || tx.categoria || 'Geral'}</td>
                                                                <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">{getChurchName(tx.churchId || tx.church)}</td>
                                                                <td className="py-2.5 px-3 text-center">
                                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${isExpense ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40'}`}>
                                                                        {isExpense ? 'Saída' : 'Entrada'}
                                                                    </span>
                                                                </td>
                                                                <td className={`py-2.5 px-3 text-right tabular-nums font-bold ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                    {isExpense ? '-' : '+'} {formatBRL(amt)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {filteredReportData.length > BALANCETE_ITEMS_PER_PAGE && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/90 dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                            <span className="text-[11px]">
                                                Exibindo <span className="tabular-nums text-slate-900 dark:text-white">{(balanceteCurrentPage - 1) * BALANCETE_ITEMS_PER_PAGE + 1}</span> a <span className="tabular-nums text-slate-900 dark:text-white">{Math.min(filteredReportData.length, balanceteCurrentPage * BALANCETE_ITEMS_PER_PAGE)}</span> de <span className="tabular-nums text-slate-900 dark:text-white">{filteredReportData.length}</span> lançamentos
                                            </span>

                                            <div className="flex items-center gap-1.5 ml-auto">
                                                <button
                                                    onClick={() => setBalanceteCurrentPage(1)}
                                                    disabled={balanceteCurrentPage === 1}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                >
                                                    Primeira
                                                </button>
                                                <button
                                                    onClick={() => setBalanceteCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={balanceteCurrentPage === 1}
                                                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                    title="Página Anterior"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <span className="px-2 tabular-nums text-[11px] text-slate-800 dark:text-white">
                                                    {balanceteCurrentPage} / {balanceteTotalPages}
                                                </span>
                                                <button
                                                    onClick={() => setBalanceteCurrentPage(p => Math.min(balanceteTotalPages, p + 1))}
                                                    disabled={balanceteCurrentPage === balanceteTotalPages}
                                                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                    title="Próxima Página"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setBalanceteCurrentPage(balanceteTotalPages)}
                                                    disabled={balanceteCurrentPage === balanceteTotalPages}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                >
                                                    Última
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TYPE 3: BALANCETE CONTÁBIL */}
                        {balanceteType === 'contabil' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="p-3.5 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-900/40 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                            Estrutura de Plano de Contas Contábil da Igreja (Balancete Formal de Verificação)
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-900/40 px-2.5 py-1 rounded-md">
                                        Equilíbrio Contábil OK
                                    </span>
                                </div>

                                <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                                    <div className="overflow-x-auto custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200/90 dark:border-slate-800">
                                                    <th className="py-2.5 px-3">Código</th>
                                                    <th className="py-2.5 px-3">Plano de Contas</th>
                                                    <th className="py-2.5 px-3 text-center">Tipo</th>
                                                    <th className="py-2.5 px-3 text-right">Créditos / Entradas (R$)</th>
                                                    <th className="py-2.5 px-3 text-right">Débitos / Saídas (R$)</th>
                                                    <th className="py-2.5 px-3 text-right">Saldo Final (R$)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                                {/* GRUPO 1: RECEITAS */}
                                                <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 font-bold">
                                                    <td className="py-2 px-3 tabular-nums text-emerald-800 dark:text-emerald-400">1.0.00</td>
                                                    <td className="py-2 px-3 text-emerald-800 dark:text-emerald-300 uppercase">RECEITAS OPERACIONAIS (DÍZIMOS, OFERTAS & CONTRIBUIÇÕES)</td>
                                                    <td className="py-2 px-3 text-center text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">GRUPO</td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatBRL(financialTotals.income)}</td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-slate-400">R$ 0,00</td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatBRL(financialTotals.income)}</td>
                                                </tr>

                                                {incomeCategories.map((c, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                        <td className="py-2 px-3 pl-6 tabular-nums text-slate-400 text-[11px]">1.1.0{i + 1}</td>
                                                        <td className="py-2 px-3 pl-6 text-slate-700 dark:text-slate-200">  • {c.category}</td>
                                                        <td className="py-2 px-3 text-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Crédito</td>
                                                        <td className="py-2 px-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{formatBRL(c.amount)}</td>
                                                        <td className="py-2 px-3 text-right tabular-nums text-slate-400">R$ 0,00</td>
                                                        <td className="py-2 px-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{formatBRL(c.amount)}</td>
                                                    </tr>
                                                ))}

                                                {/* GRUPO 2: DESPESAS */}
                                                <tr className="bg-rose-50/60 dark:bg-rose-950/20 font-bold">
                                                    <td className="py-2 px-3 tabular-nums text-rose-800 dark:text-rose-400">2.0.00</td>
                                                    <td className="py-2 px-3 text-rose-800 dark:text-rose-300 uppercase">DESPESAS OPERACIONAIS & MANUTENÇÃO MINISTERIAL</td>
                                                    <td className="py-2 px-3 text-center text-[10px] font-semibold text-rose-700 dark:text-rose-400">GRUPO</td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-slate-400">R$ 0,00</td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-rose-700 dark:text-rose-400">{formatBRL(financialTotals.expenses)}</td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-rose-700 dark:text-rose-400">- {formatBRL(financialTotals.expenses)}</td>
                                                </tr>

                                                {expenseCategories.map((c, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                        <td className="py-2 px-3 pl-6 tabular-nums text-slate-400 text-[11px]">2.1.0{i + 1}</td>
                                                        <td className="py-2 px-3 pl-6 text-slate-700 dark:text-slate-200">  • {c.category}</td>
                                                        <td className="py-2 px-3 text-center text-[10px] font-semibold text-rose-600 dark:text-rose-400">Débito</td>
                                                        <td className="py-2 px-3 text-right tabular-nums text-slate-400">R$ 0,00</td>
                                                        <td className="py-2 px-3 text-right tabular-nums font-medium text-rose-600 dark:text-rose-400">{formatBRL(c.amount)}</td>
                                                        <td className="py-2 px-3 text-right tabular-nums font-medium text-rose-600 dark:text-rose-400">- {formatBRL(c.amount)}</td>
                                                    </tr>
                                                ))}

                                                {/* BALANÇO FINAL */}
                                                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700 font-bold text-xs">
                                                    <td className="py-3 px-3 tabular-nums">3.0.00</td>
                                                    <td className="py-3 px-3 uppercase">RESULTADO LÍQUIDO DO EXERCÍCIO (SALDO FINAL CONTÁBIL)</td>
                                                    <td className="py-3 px-3 text-center text-[10px] font-semibold text-orange-600 dark:text-orange-400">BALANÇO</td>
                                                    <td className="py-3 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatBRL(financialTotals.income)}</td>
                                                    <td className="py-3 px-3 text-right tabular-nums text-rose-700 dark:text-rose-400">{formatBRL(financialTotals.expenses)}</td>
                                                    <td className={`py-3 px-3 text-right tabular-nums text-sm ${financialTotals.balance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                                        {formatBRL(financialTotals.balance)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 4: Resumo por Igreja / Congregação */}
                {activeTab === 'churches' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs h-full flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    Demonstrativo Consolidado por Congregação
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Visão geral comparativa da arrecadação, despesas e saldo por unidade.</p>
                            </div>
                            <button
                                onClick={() => setActiveView('reports')}
                                className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <span>Ir para Fechamento de Caixa</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {churchSummaries.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs">
                                Nenhuma igreja cadastrada no sistema.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {churchSummaries.map((ch: any) => (
                                    <div 
                                        key={ch.id}
                                        className="p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-orange-300 dark:hover:border-orange-800/70 transition-colors space-y-4"
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{ch.name}</h4>
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums block">CNPJ: {ch.cnpJ}</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/40 shrink-0">
                                                {ch.txCount} movimentações
                                            </span>
                                        </div>

                                        {/* Progress bar contribution */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                <span>Participação no Total</span>
                                                <span className="tabular-nums">{ch.sharePercent}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-orange-600 rounded-full transition-all duration-500"
                                                    style={{ width: `${ch.sharePercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs">
                                            <div>
                                                <span className="text-[10px] uppercase font-semibold tracking-wide text-slate-400 block">Entradas Totais</span>
                                                <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(ch.totalIncome)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-semibold tracking-wide text-slate-400 block">Saídas Totais</span>
                                                <span className="tabular-nums font-bold text-rose-600 dark:text-rose-400">{formatBRL(ch.totalExpenses)}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pt-3 border-t border-slate-200/70 dark:border-slate-800 text-xs">
                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                Contribuintes: <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{ch.contributorCount}</strong>
                                            </span>
                                            <span className={`tabular-nums font-bold text-sm ${ch.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {formatBRL(ch.netBalance)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 5: Relatório por Categoria (Entradas, Saídas e Filtros Avançados) */}
                {activeTab === 'expenses' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs h-full flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
                        {/* Header & Overall Totals */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    Relatório Consolidado por Categoria
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Análise financeira completa por categorias, com suporte a entradas e saídas, formas de pagamento e cargos/vínculos.</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs tabular-nums font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                    Entradas: {formatBRL(categoryTotals.totalIncome)}
                                </span>
                                <span className="text-xs tabular-nums font-semibold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 text-rose-700 dark:text-rose-300">
                                    Saídas: {formatBRL(categoryTotals.totalExpenses)}
                                </span>
                                <span className={`text-xs tabular-nums font-semibold px-2.5 py-1 rounded-lg border ${
                                    (categoryTotals.totalIncome - categoryTotals.totalExpenses) >= 0
                                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/40 text-amber-700 dark:text-amber-300'
                                }`}>
                                    Saldo Filtrado: {formatBRL(categoryTotals.totalIncome - categoryTotals.totalExpenses)}
                                </span>
                            </div>
                        </div>

                        {/* Dynamic Controls & Filter Bar */}
                        <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 rounded-xl space-y-3">
                            {/* Primary Filters Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {/* Movement Type Toggle */}
                                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                                    <button
                                        onClick={() => setCategoryTypeFilter('all')}
                                        className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-colors text-center cursor-pointer ${
                                            categoryTypeFilter === 'all'
                                                ? 'bg-orange-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setCategoryTypeFilter('income')}
                                        className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-colors text-center cursor-pointer ${
                                            categoryTypeFilter === 'income'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                                        }`}
                                    >
                                        Entradas
                                    </button>
                                    <button
                                        onClick={() => setCategoryTypeFilter('expense')}
                                        className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-colors text-center cursor-pointer ${
                                            categoryTypeFilter === 'expense'
                                                ? 'bg-rose-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
                                        }`}
                                    >
                                        Saídas
                                    </button>
                                </div>

                                {/* Payment Method Dropdown */}
                                <div className="relative">
                                    <select
                                        value={categoryPaymentMethodFilter}
                                        onChange={e => setCategoryPaymentMethodFilter(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:border-orange-500"
                                    >
                                        <option value="all">Forma de Pagto: Todas</option>
                                        {availablePaymentMethods.map((pm, idx) => (
                                            <option key={idx} value={pm}>{pm}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Cargo / Vínculo Dropdown */}
                                <div className="relative">
                                    <select
                                        value={categoryRoleFilter}
                                        onChange={e => setCategoryRoleFilter(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:border-orange-500"
                                    >
                                        <option value="all">Vínculo / Cargo: Todos</option>
                                        {availableRoles.map((role, idx) => (
                                            <option key={idx} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Reset All Filters Button */}
                                {(selectedExpenseCategories.length > 0 || expenseCategorySearch || categoryTypeFilter !== 'all' || categoryPaymentMethodFilter !== 'all' || categoryRoleFilter !== 'all') && (
                                    <button
                                        onClick={() => {
                                            setSelectedExpenseCategories([]);
                                            setExpenseCategorySearch('');
                                            setCategoryTypeFilter('all');
                                            setCategoryPaymentMethodFilter('all');
                                            setCategoryRoleFilter('all');
                                        }}
                                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Resetar Todos os Filtros</span>
                                    </button>
                                )}
                            </div>

                            {/* Secondary Row: Search & Multi-Category Selection */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/60">
                                {/* Search Input */}
                                <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Buscar categoria por nome..."
                                        value={expenseCategorySearch}
                                        onChange={e => setExpenseCategorySearch(e.target.value)}
                                        className="pl-9 pr-8 py-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                                    />
                                    {expenseCategorySearch && (
                                        <button 
                                            onClick={() => setExpenseCategorySearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Multi-Select Category Dropdown */}
                                <div className="relative" ref={categoryDropdownRef}>
                                    <button
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-between ${
                                            selectedExpenseCategories.length > 0
                                                ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Filter className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                            <span>
                                                {selectedExpenseCategories.length === 0
                                                    ? 'Todas as Categorias'
                                                    : `${selectedExpenseCategories.length} Categoria${selectedExpenseCategories.length > 1 ? 's' : ''} Selecionada${selectedExpenseCategories.length > 1 ? 's' : ''}`
                                                }
                                            </span>
                                        </div>
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isCategoryDropdownOpen && (
                                        <div className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-xl shadow-elevated z-30 p-3 space-y-2 animate-in fade-in duration-150">
                                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Categorias Cadastradas</span>
                                                <button
                                                    onClick={() => setSelectedExpenseCategories([])}
                                                    className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                                                >
                                                    Limpar Seleção
                                                </button>
                                            </div>

                                            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                                                {allSystemCategoryNames.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic py-2 text-center">Nenhuma categoria encontrada.</p>
                                                ) : (
                                                    allSystemCategoryNames.map((catName, idx) => {
                                                        const isSelected = selectedExpenseCategories.includes(catName);
                                                        const catObj = categorySummaries.find(c => c.category === catName);
                                                        return (
                                                            <label
                                                                key={idx}
                                                                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => toggleExpenseCategory(catName)}
                                                                        className="rounded border-slate-300 accent-orange-600 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                                    />
                                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{catName}</span>
                                                                </div>
                                                                {catObj && (
                                                                    <span className="tabular-nums text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                                                                        {formatBRL(catObj.amount)}
                                                                    </span>
                                                                )}
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] font-semibold text-slate-500">
                                                <span className="tabular-nums">{selectedExpenseCategories.length} de {allSystemCategoryNames.length} marcadas</span>
                                                <button
                                                    onClick={() => setIsCategoryDropdownOpen(false)}
                                                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                                >
                                                    Concluído
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Category Pills / Chips */}
                            {allSystemCategoryNames.length > 0 && (
                                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-1 pb-0.5 text-xs" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
                                    <button
                                        onClick={() => setSelectedExpenseCategories([])}
                                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap cursor-pointer text-[11px] flex items-center gap-1 tabular-nums ${
                                            selectedExpenseCategories.length === 0
                                                ? 'bg-orange-600 text-white shadow-xs'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-orange-400'
                                        }`}
                                    >
                                        <span>Todas ({allSystemCategoryNames.length})</span>
                                    </button>

                                    {allSystemCategoryNames.map((catName, idx) => {
                                        const isSelected = selectedExpenseCategories.includes(catName);
                                        const catObj = categorySummaries.find(c => c.category === catName);
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => toggleExpenseCategory(catName)}
                                                className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap cursor-pointer text-[11px] flex items-center gap-1.5 border ${
                                                    isSelected
                                                        ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-800 shadow-xs'
                                                        : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-300'
                                                }`}
                                            >
                                                {isSelected && <Check className="w-3 h-3 text-orange-600 dark:text-orange-400" />}
                                                <span>{catName}</span>
                                                {catObj && (
                                                    <span className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
                                                        isSelected ? 'bg-orange-200/70 dark:bg-orange-900/60 text-orange-900 dark:text-orange-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                        {formatBRL(catObj.amount)}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Summary Metrics for Filtered Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-xl border border-orange-200/80 dark:border-orange-950 bg-orange-50/40 dark:bg-orange-950/20">
                                <span className="text-[10px] uppercase font-semibold text-orange-700 dark:text-orange-400 block tracking-wide">Volume Movimentado</span>
                                <div className="flex items-baseline gap-2 mt-0.5">
                                    <span className="text-lg tabular-nums font-bold text-orange-700 dark:text-orange-300">{formatBRL(categoryTotals.totalAmount)}</span>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                <span className="text-[10px] uppercase font-semibold text-slate-500 block tracking-wide">Categorias Exibidas</span>
                                <span className="text-lg tabular-nums font-bold text-slate-900 dark:text-white mt-0.5 block">
                                    {categoryTotals.categoriesCount} <span className="text-xs font-normal text-slate-400">de {allSystemCategoryNames.length}</span>
                                </span>
                            </div>

                            <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                <span className="text-[10px] uppercase font-semibold text-slate-500 block tracking-wide">Lançamentos Filtrados</span>
                                <span className="text-lg tabular-nums font-bold text-slate-900 dark:text-white mt-0.5 block">
                                    {categoryTotals.totalCount} <span className="text-xs font-normal text-slate-400">movimentações</span>
                                </span>
                            </div>
                        </div>

                        {/* Category Cards & Drilldown */}
                        {displayedCategoryCards.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                                <p>Nenhuma categoria encontrada para os filtros selecionados.</p>
                                {(selectedExpenseCategories.length > 0 || expenseCategorySearch || categoryTypeFilter !== 'all' || categoryPaymentMethodFilter !== 'all' || categoryRoleFilter !== 'all') && (
                                    <button
                                        onClick={() => {
                                            setSelectedExpenseCategories([]);
                                            setExpenseCategorySearch('');
                                            setCategoryTypeFilter('all');
                                            setCategoryPaymentMethodFilter('all');
                                            setCategoryRoleFilter('all');
                                        }}
                                        className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-orange-700 transition-colors"
                                    >
                                        Limpar Filtros de Categoria
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {displayedCategoryCards.map((cat, idx) => {
                                    const totalOverall = categoryTotals.totalAmount || 1;
                                    const percent = Math.round((cat.amount / totalOverall) * 100);
                                    const isExpanded = expandedCategory === cat.category;
                                    const catTransactions = isExpanded ? cat.transactions : [];

                                    return (
                                        <div 
                                            key={idx}
                                            className={`p-4 rounded-xl border transition-colors flex flex-col space-y-3 ${
                                                isExpanded
                                                    ? 'border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 shadow-xs md:col-span-2'
                                                    : 'border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                                                            <Tag className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                                            {cat.category}
                                                        </h4>
                                                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                                                            cat.typeLabel === 'misto'
                                                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800'
                                                                : cat.typeLabel === 'saida'
                                                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200/80 dark:border-rose-800'
                                                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800'
                                                        }`}>
                                                            {cat.typeLabel === 'misto' ? 'Misto' : cat.typeLabel === 'saida' ? 'Saída' : 'Entrada'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">{cat.count} lançamentos • {percent}% do volume exibido</span>
                                                    
                                                    {/* Subtotals if mixed or present */}
                                                    {(cat.incomeAmount > 0 && cat.expenseAmount > 0) && (
                                                        <div className="flex items-center gap-2 mt-1 text-[10px] tabular-nums">
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Entradas: {formatBRL(cat.incomeAmount)}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-rose-600 dark:text-rose-400 font-semibold">Saídas: {formatBRL(cat.expenseAmount)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-right">
                                                    <span className={`text-xs tabular-nums font-bold block ${
                                                        cat.typeLabel === 'saida' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                                    }`}>{formatBRL(cat.amount)}</span>
                                                    <button
                                                        onClick={() => toggleExpandCategory(cat.category)}
                                                        className="mt-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer flex items-center gap-1 ml-auto"
                                                    >
                                                        <span>{isExpanded ? 'Ocultar Lançamentos' : 'Ver Detalhes'}</span>
                                                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        cat.typeLabel === 'saida' ? 'bg-rose-500' : cat.typeLabel === 'misto' ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>

                                            {/* DRILLDOWN TABLE FOR EXPANDED CATEGORY */}
                                            {isExpanded && (
                                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-in fade-in duration-200">
                                                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                        <span className="tabular-nums">Lançamentos da Categoria ({catTransactions.length})</span>
                                                        <span className="tabular-nums text-slate-700 dark:text-slate-300">Subtotal: {formatBRL(cat.amount)}</span>
                                                    </div>

                                                    <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                                        <div className="overflow-x-auto max-h-60 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
                                                            <table className="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200/90 dark:border-slate-800">
                                                                        <th className="py-2 px-3">Data</th>
                                                                        <th className="py-2 px-3">Tipo</th>
                                                                        <th className="py-2 px-3">Histórico / Descrição</th>
                                                                        <th className="py-2 px-3">Contribuinte / Favorecido</th>
                                                                        <th className="py-2 px-3">Forma Pagto</th>
                                                                        <th className="py-2 px-3">Vínculo / Cargo</th>
                                                                        <th className="py-2 px-3">Igreja</th>
                                                                        <th className="py-2 px-3 text-right">Valor (R$)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                                                    {catTransactions.length === 0 ? (
                                                                        <tr>
                                                                            <td colSpan={8} className="py-4 text-center text-slate-400 italic">
                                                                                Nenhum lançamento detalhado encontrado.
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        catTransactions.map((tx: any, tIdx: number) => {
                                                                            const isExp = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && String(tx.category).toLowerCase().includes('saida'));
                                                                            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                                                                            const pm = getTxPaymentMethod(tx);
                                                                            const role = getTxRole(tx);
                                                                            const isManualTx = tx.isManual || tx.source === 'manual' || tx.raw?.transaction?.source === 'manual' || tx.raw?.transaction?.isManual === true || (tx.raw as any)?.isManual === true || String(tx.id).startsWith('ghost-manual-') || (tx.row_hash && tx.row_hash.includes('|bmanual|'));

                                                                            return (
                                                                                <tr key={tIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                                    <td className="py-1.5 px-3 tabular-nums text-slate-500 text-[11px] whitespace-nowrap">
                                                                                        {!isManualTx && tx.reference_date && tx.bank_date && tx.reference_date !== tx.bank_date ? (
                                                                                            <div className="flex flex-col leading-tight">
                                                                                                <span className="font-semibold text-slate-800 dark:text-white" title={`Data de Referência (Competência): ${formatDateBRL(tx.date)}`}>
                                                                                                    {formatDateBRL(tx.date)}
                                                                                                </span>
                                                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5" title={`Data no Banco: ${formatDateBRL(tx.bank_date)}`}>
                                                                                                    <span className="text-[9px] uppercase font-semibold text-slate-400 mr-0.5">Banco:</span>
                                                                                                    {formatDateBRL(tx.bank_date)}
                                                                                                </span>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span>{formatDateBRL(tx.date) || '---'}</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-1.5 px-3 whitespace-nowrap">
                                                                                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                                                                                            isExp ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                                                                        }`}>
                                                                                            {isExp ? 'Saída' : 'Entrada'}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="py-1.5 px-3 font-semibold text-slate-800 dark:text-slate-200 uppercase text-[11px]">{tx.desc || tx.description || tx.historico || 'Lançamento'}</td>
                                                                                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">{tx.payer || tx.contribuinte || tx.favorecido || tx.nome || '---'}</td>
                                                                                    <td className="py-1.5 px-3 text-slate-500 text-[11px] tabular-nums">{pm}</td>
                                                                                    <td className="py-1.5 px-3 text-slate-500 text-[11px]">{role}</td>
                                                                                    <td className="py-1.5 px-3 text-slate-400 text-[11px]">{getChurchName(tx.churchId || tx.church)}</td>
                                                                                    <td className={`py-1.5 px-3 text-right tabular-nums font-bold ${
                                                                                        isExp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                                                                    }`}>{formatBRL(amt)}</td>
                                                                                </tr>
                                                                            );
                                                                        })
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});
