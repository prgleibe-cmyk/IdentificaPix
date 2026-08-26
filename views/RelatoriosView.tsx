import React, { useState, useContext, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { ContributorsReportSection } from '../components/reports/ContributorsReportSection';
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
    Download, 
    Printer, 
    ArrowRight, 
    ArrowLeft,
    SlidersHorizontal,
    PieChart, 
    AlertCircle, 
    CheckCircle2, 
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
    Table2,
    Layers,
    ChevronDown,
    ChevronUp,
    Check,
    RotateCcw,
    RefreshCw,
    Tag,
    X,
    FileSpreadsheet,
    FileCode,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<'all' | 'month' | 'last-month' | 'quarter' | 'year' | 'custom'>('month');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [balanceteCurrentPage, setBalanceteCurrentPage] = useState<number>(1);
    const BALANCETE_ITEMS_PER_PAGE = 50;
    
    // Multi-select church filter
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
    const [isChurchDropdownOpen, setIsChurchDropdownOpen] = useState<boolean>(false);

    // Expenses / Categories tab multi-category filter & drilldown state
    const [categoryTypeFilter, setCategoryTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
    const [categoryPaymentMethodFilter, setCategoryPaymentMethodFilter] = useState<string>('all');
    const [categoryRoleFilter, setCategoryRoleFilter] = useState<string>('all');
    const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);
    const [expenseCategorySearch, setExpenseCategorySearch] = useState<string>('');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);

    // Export dropdown state
    const [showExportLivroCaixa, setShowExportLivroCaixa] = useState<boolean>(false);
    const [showExportBalancete, setShowExportBalancete] = useState<boolean>(false);
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
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const exportLivroCaixaRef = useRef<HTMLDivElement>(null);
    const exportBalanceteRef = useRef<HTMLDivElement>(null);
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

    const reportData = context?.reportData || [];
    const contributorFiles = context?.contributorFiles || [];

    // Click outside listener for dropdown popovers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (churchDropdownRef.current && !churchDropdownRef.current.contains(event.target as Node)) {
                setIsChurchDropdownOpen(false);
            }
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
            if (exportLivroCaixaRef.current && !exportLivroCaixaRef.current.contains(event.target as Node)) {
                setShowExportLivroCaixa(false);
            }
            if (exportBalanceteRef.current && !exportBalanceteRef.current.contains(event.target as Node)) {
                setShowExportBalancete(false);
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

    // Toggle multi-select church filter
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

    // Filter reportData by search, multi-church, and period filters
    const filteredReportData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let lastMonthYear = currentYear;
        let lastMonthIndex = currentMonth - 1;
        if (lastMonthIndex < 0) {
            lastMonthIndex = 11;
            lastMonthYear = currentYear - 1;
        }

        const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const lastMonthPrefix = `${lastMonthYear}-${String(lastMonthIndex + 1).padStart(2, '0')}`;
        const currentYearPrefix = String(currentYear);
        const currentQuarter = Math.floor(currentMonth / 3);
        const customStartIso = customStartDate ? customStartDate.split('T')[0] : null;
        const customEndIso = customEndDate ? customEndDate.split('T')[0] : null;
        const lowerSearch = searchTerm.trim().toLowerCase();

        return reportData.filter((item: any) => {
            // Secondary user church restriction
            if (isSecondaryUser && allowedChurchIds && allowedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                const matchesAllowed = allowedChurchIds.some(cId => {
                    if (itemChurchId === cId) return true;
                    const chName = churchNameMap.get(cId);
                    return chName && (item.church === chName || item.churchId === cId);
                });
                if (!matchesAllowed) return false;
            }

            // Multi-church filter
            if (selectedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                const matchesAny = selectedChurchIds.some(cId => {
                    if (itemChurchId === cId) return true;
                    const chName = churchNameMap.get(cId);
                    return chName && (item.church === chName || item.churchId === cId);
                });
                if (!matchesAny) return false;
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
            if (item.date) {
                const itemIso = String(item.date).split(/[T ]/)[0];
                if (dateRange === 'month') {
                    if (!itemIso.startsWith(currentMonthPrefix)) return false;
                } else if (dateRange === 'last-month') {
                    if (!itemIso.startsWith(lastMonthPrefix)) return false;
                } else if (dateRange === 'quarter') {
                    if (!itemIso.startsWith(currentYearPrefix)) return false;
                    const monthNum = Number(itemIso.slice(5, 7));
                    if (Math.floor((monthNum - 1) / 3) !== currentQuarter) return false;
                } else if (dateRange === 'year') {
                    if (!itemIso.startsWith(currentYearPrefix)) return false;
                } else if (dateRange === 'custom') {
                    if (customStartIso && itemIso < customStartIso) return false;
                    if (customEndIso && itemIso > customEndIso) return false;
                }
            }

            return true;
        });
    }, [reportData, selectedChurchIds, searchTerm, dateRange, customStartDate, customEndDate, churchNameMap, isSecondaryUser, allowedChurchIds]);

    const balanceteTotalPages = Math.ceil(filteredReportData.length / BALANCETE_ITEMS_PER_PAGE) || 1;

    useEffect(() => {
        setBalanceteCurrentPage(1);
    }, [dateRange, customStartDate, customEndDate, selectedChurchIds, searchTerm, balanceteType]);

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
            const amount = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const isPending = tx.status === 'pending' || tx.unidentified || tx.isPending;

            if (isPending) {
                pending += amount;
                pendingCount++;
            }

            if (isExpense) {
                expenses += amount;
            } else {
                income += amount;
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
            const cId = tx.churchId || tx.church;
            if (!cId) return;
            let entry = churchDataMap.get(cId);
            if (!entry) {
                entry = { txCount: 0, totalIncome: 0, totalExpenses: 0 };
                churchDataMap.set(cId, entry);
            }
            entry.txCount++;
            const amt = Number(tx.amount) || Number(tx.val) || 0;
            const isExpense = tx.type === 'expense' || amt < 0;
            if (isExpense) {
                entry.totalExpenses += Math.abs(amt);
            } else {
                entry.totalIncome += amt;
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
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            if (isExpense) {
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
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            if (!isExpense) {
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

    // Export Handler for Livro Caixa
    const handleExportLivroCaixa = (format: 'pdf' | 'excel' | 'csv' | 'ofx') => {
        setShowExportLivroCaixa(false);
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
        setShowExportBalancete(false);
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

    // If report has not been generated yet, show the full Configuration Panel
    if (!hasGenerated) {
        return (
            <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full min-h-full flex flex-col animate-fade-in pb-8 md:pb-4">
                {/* Title Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 md:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl text-white shadow-lg shadow-orange-500/20">
                            <FileText className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                Central de Relatórios IgGestor
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                Configure os filtros e selecione o relatório desejado antes de gerar a visualização completa.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Step 1: Tipo de Relatório */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 md:p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
                        <Sparkles className="w-4 h-4 text-orange-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                            1. Tipo de Relatório Desejado
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Button 1: Dizimistas & Contribuintes */}
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('contributors');
                                setIsBalanceteMenuOpen(false);
                                setIsCategoryMenuOpen(false);
                            }}
                            className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                activeTab === 'contributors'
                                    ? 'bg-orange-50/90 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-200 ring-2 ring-orange-500/20 shadow-xs font-bold'
                                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:border-orange-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-2.5 rounded-xl shrink-0 ${activeTab === 'contributors' ? 'bg-orange-500 text-white' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'}`}>
                                    <Users className="w-5 h-5" />
                                </div>
                                <div className="truncate">
                                    <h4 className="font-extrabold text-xs truncate">Dizimistas & Contribuintes</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Dízimos e membros</p>
                                </div>
                            </div>
                            {activeTab === 'contributors' && <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />}
                        </button>

                        {/* Button 2: Balancete Financeiro */}
                        <div className="relative" ref={balanceteMenuRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTab !== 'balancete') {
                                        setActiveTab('balancete');
                                    }
                                    setIsBalanceteMenuOpen(!isBalanceteMenuOpen);
                                    setIsCategoryMenuOpen(false);
                                }}
                                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                    activeTab === 'balancete'
                                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs font-bold'
                                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${activeTab === 'balancete' ? 'bg-blue-600 text-white' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                                        <PieChart className="w-5 h-5" />
                                    </div>
                                    <div className="truncate">
                                        <h4 className="font-extrabold text-xs truncate">
                                            {activeTab === 'balancete'
                                                ? `Balancete (${balanceteType === 'sintetico' ? 'Sintético' : balanceteType === 'analitico' ? 'Analítico' : 'Contábil'})`
                                                : 'Balancete Financeiro'}
                                        </h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Visões financeiras</p>
                                    </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isBalanceteMenuOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
                            </button>

                            {/* Dropdown Options for Balancete */}
                            {isBalanceteMenuOpen && (
                                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 text-xs animate-scale-in">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('balancete');
                                            setBalanceteType('sintetico');
                                            setIsBalanceteMenuOpen(false);
                                        }}
                                        className={`w-full p-2.5 rounded-xl text-left font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'balancete' && balanceteType === 'sintetico'
                                                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Sintético (Resumo)</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Visão acumulada por grupo</div>
                                        </div>
                                        {activeTab === 'balancete' && balanceteType === 'sintetico' && <Check className="w-4 h-4 text-blue-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('balancete');
                                            setBalanceteType('analitico');
                                            setIsBalanceteMenuOpen(false);
                                        }}
                                        className={`w-full p-2.5 rounded-xl text-left font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'balancete' && balanceteType === 'analitico'
                                                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Analítico (Extrato)</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Extrato completo de lançamentos</div>
                                        </div>
                                        {activeTab === 'balancete' && balanceteType === 'analitico' && <Check className="w-4 h-4 text-blue-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('balancete');
                                            setBalanceteType('contabil');
                                            setIsBalanceteMenuOpen(false);
                                        }}
                                        className={`w-full p-2.5 rounded-xl text-left font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'balancete' && balanceteType === 'contabil'
                                                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Contábil (Razão)</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Formato contábil estruturado</div>
                                        </div>
                                        {activeTab === 'balancete' && balanceteType === 'contabil' && <Check className="w-4 h-4 text-blue-600" />}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Button 3: Resumo por Igreja */}
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('churches');
                                setIsBalanceteMenuOpen(false);
                                setIsCategoryMenuOpen(false);
                            }}
                            className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                activeTab === 'churches'
                                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs font-bold'
                                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-2.5 rounded-xl shrink-0 ${activeTab === 'churches' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div className="truncate">
                                    <h4 className="font-extrabold text-xs truncate">Resumo por Igreja</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Comparativo de congregações</p>
                                </div>
                            </div>
                            {activeTab === 'churches' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                        </button>

                        {/* Button 4: Relatório por Categoria */}
                        <div className="relative" ref={categoryMenuRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTab !== 'expenses') {
                                        setActiveTab('expenses');
                                    }
                                    setIsCategoryMenuOpen(!isCategoryMenuOpen);
                                    setIsBalanceteMenuOpen(false);
                                }}
                                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                    activeTab === 'expenses'
                                        ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20 shadow-xs font-bold'
                                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:border-purple-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${activeTab === 'expenses' ? 'bg-purple-600 text-white' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'}`}>
                                        <Tag className="w-5 h-5" />
                                    </div>
                                    <div className="truncate">
                                        <h4 className="font-extrabold text-xs truncate">
                                            {activeTab === 'expenses'
                                                ? `Categoria (${categoryTypeFilter === 'all' ? 'Todas' : categoryTypeFilter === 'income' ? 'Receitas' : 'Despesas'})`
                                                : 'Relatório por Categoria'}
                                        </h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Receitas e despesas</p>
                                    </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isCategoryMenuOpen ? 'rotate-180 text-purple-600' : 'text-slate-400'}`} />
                            </button>

                            {/* Dropdown Options for Categories */}
                            {isCategoryMenuOpen && (
                                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 text-xs animate-scale-in">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('expenses');
                                            setCategoryTypeFilter('all');
                                            setIsCategoryMenuOpen(false);
                                        }}
                                        className={`w-full p-2.5 rounded-xl text-left font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'expenses' && categoryTypeFilter === 'all'
                                                ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Todas as Categorias</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Receitas e despesas combinadas</div>
                                        </div>
                                        {activeTab === 'expenses' && categoryTypeFilter === 'all' && <Check className="w-4 h-4 text-purple-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('expenses');
                                            setCategoryTypeFilter('income');
                                            setIsCategoryMenuOpen(false);
                                        }}
                                        className={`w-full p-2.5 rounded-xl text-left font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'expenses' && categoryTypeFilter === 'income'
                                                ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Apenas Receitas</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Entradas, dízimos e ofertas</div>
                                        </div>
                                        {activeTab === 'expenses' && categoryTypeFilter === 'income' && <Check className="w-4 h-4 text-purple-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('expenses');
                                            setCategoryTypeFilter('expense');
                                            setIsCategoryMenuOpen(false);
                                        }}
                                        className={`w-full p-2.5 rounded-xl text-left font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                            activeTab === 'expenses' && categoryTypeFilter === 'expense'
                                                ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div>
                                            <div>Apenas Despesas</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Saídas e contas pagas</div>
                                        </div>
                                        {activeTab === 'expenses' && categoryTypeFilter === 'expense' && <Check className="w-4 h-4 text-purple-600" />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Step 2: Período do Relatório */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 md:p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                            2. Período do Relatório
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setDateRange('month')}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                                dateRange === 'month'
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <Calendar className="w-4 h-4" />
                            <span>Mês Atual</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setDateRange('custom')}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                                dateRange === 'custom'
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <span>Selecionar Período Desejado...</span>
                        </button>

                        {dateRange === 'custom' && (
                            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs animate-fade-in">
                                <div className="flex flex-col gap-0.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Data Inicial</label>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={e => setCustomStartDate(e.target.value)}
                                        className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer text-xs"
                                    />
                                </div>
                                <span className="text-slate-400 font-bold text-xs pt-3">até</span>
                                <div className="flex flex-col gap-0.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Data Final</label>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={e => setCustomEndDate(e.target.value)}
                                        className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer text-xs"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 3: Selecionar Igreja / Congregação */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 md:p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-orange-500" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                                3. Filtro de Igreja / Congregação
                            </h3>
                        </div>
                    </div>

                    <div className="relative max-w-md" ref={churchDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsChurchDropdownOpen(!isChurchDropdownOpen)}
                            className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                                selectedChurchIds.length > 0
                                    ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Building2 className="w-4 h-4 text-orange-500 shrink-0" />
                                <span className="font-bold text-xs truncate">
                                    {selectedChurchIds.length === 0
                                        ? 'Todas as Igrejas'
                                        : selectedChurchIds.length === 1
                                        ? (churches.find((c: any) => c.id === selectedChurchIds[0])?.name || '1 Igreja')
                                        : `${selectedChurchIds.length} igrejas selecionadas`}
                                </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isChurchDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isChurchDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50 space-y-2 animate-scale-in">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 border-b border-slate-100 dark:border-slate-700 pb-2">
                                    <span>Selecionar Igrejas</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedChurchIds(churches.map((c: any) => c.id))}
                                            className="text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                                        >
                                            Todas
                                        </button>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedChurchIds([])}
                                            className="text-slate-400 hover:underline cursor-pointer"
                                        >
                                            Limpar
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-56 overflow-y-auto space-y-1 py-1">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedChurchIds([])}
                                        className={`w-full p-2 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer flex items-center justify-between ${
                                            selectedChurchIds.length === 0
                                                ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-transparent text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedChurchIds.length === 0 ? 'bg-white text-orange-500 border-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                                {selectedChurchIds.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                                            </div>
                                            <span>Todas as Igrejas</span>
                                        </div>
                                    </button>

                                    {churches.map((c: any) => {
                                        const isSelected = selectedChurchIds.includes(c.id);
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => toggleChurchSelection(c.id)}
                                                className={`w-full p-2 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer flex items-center justify-between ${
                                                    isSelected
                                                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-transparent text-slate-700 dark:text-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${isSelected ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                    </div>
                                                    <span className="truncate">{c.name}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 4: Busca por Palavra-Chave (Opcional) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 md:p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
                        <Search className="w-4 h-4 text-orange-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                            4. Busca por Palavra-Chave (Opcional)
                        </h3>
                    </div>

                    <div className="relative max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute top-1/2 left-3.5 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar por nome de contribuinte, histórico ou categoria..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 font-medium"
                        />
                    </div>
                </div>

                {/* Big Action CTA Button */}
                <div className="flex items-center justify-end pt-2">
                    <button
                        type="button"
                        onClick={() => setHasGenerated(true)}
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-3 cursor-pointer"
                    >
                        <FileText className="w-5 h-5" />
                        <span>GERAR RELATÓRIO</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Generated Report View
    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full min-h-full flex flex-col animate-fade-in pb-8 md:pb-4">
            {/* Top Bar on Generated Report Screen */}
            <div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
                {/* Left: Active Report Title & Parameter Summary Badges */}
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => setHasGenerated(false)}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 text-slate-700 dark:text-slate-200 rounded-2xl transition-all flex items-center justify-center cursor-pointer shrink-0"
                        title="Voltar e alterar parâmetros do relatório"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight truncate">
                                {activeTab === 'contributors' && 'Relatório de Dizimistas & Contribuintes'}
                                {activeTab === 'balancete' && `Balancete Financeiro (${balanceteType === 'sintetico' ? 'Sintético' : balanceteType === 'analitico' ? 'Analítico' : 'Contábil'})`}
                                {activeTab === 'churches' && 'Resumo Comparativo por Igreja'}
                                {activeTab === 'expenses' && `Relatório por Categoria (${categoryTypeFilter === 'all' ? 'Todas' : categoryTypeFilter === 'income' ? 'Receitas' : 'Despesas'})`}
                            </h1>

                            <span className="px-2.5 py-0.5 bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 rounded-full text-[10px] font-extrabold uppercase">
                                Relatório Gerado
                            </span>
                        </div>

                        <p className="text-xs text-slate-400 font-medium flex items-center gap-2 flex-wrap mt-0.5">
                            <span>Período: {dateRange === 'month' ? 'Mês Atual' : customStartDate && customEndDate ? `${customStartDate} até ${customEndDate}` : 'Período Personalizado'}</span>
                            <span>•</span>
                            <span>
                                Igreja: {selectedChurchIds.length === 0 ? 'Todas as Igrejas' : selectedChurchIds.length === 1 ? (churches.find((c: any) => c.id === selectedChurchIds[0])?.name || '1 Selecionada') : `${selectedChurchIds.length} Selecionadas`}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Right: Actions (Change Parameters, Search, Refresh) */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                    {/* Search Bar */}
                    <div className="relative max-w-xs min-w-[150px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar no relatório..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 font-medium"
                        />
                    </div>

                    <button
                        onClick={() => setHasGenerated(false)}
                        className="px-3.5 py-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 border border-orange-200 dark:border-orange-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Alterar Parâmetros</span>
                    </button>

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing || isHydratingFromCloud}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Recarregar banco de dados"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isHydratingFromCloud ? 'animate-spin text-orange-500' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Section Content */}
            <div className="flex-1 min-h-0">
                {/* TAB 1: Contribuintes & Dízimos */}
                {activeTab === 'contributors' && (
                    <ContributorsReportSection />
                )}

                {/* TAB 2: Balancete (Sintético, Analítico e Contábil) */}
                {activeTab === 'balancete' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-sm h-full flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
                        {/* Header & Controls */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <PieChart className="w-4 h-4 text-blue-500" />
                                    Balancete Financeiro IgGestor
                                </h3>
                                <p className="text-xs text-slate-400">Apurativo do exercício financeiro em três visões: Sintética, Analítica e Contábil.</p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                                {/* Recarregar Button */}
                                <button
                                    onClick={handleRefresh}
                                    disabled={isRefreshing || isHydratingFromCloud}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs font-semibold"
                                    title="Recarregar dados do Balancete"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isHydratingFromCloud ? 'animate-spin text-blue-500' : ''}`} />
                                    <span>Recarregar</span>
                                </button>

                                {/* Export Menu */}
                                <div className="relative" ref={exportBalanceteRef}>
                                    <button
                                        onClick={() => setShowExportBalancete(!showExportBalancete)}
                                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Exportar Balancete</span>
                                        <ChevronDown className="w-3 h-3 ml-0.5" />
                                    </button>

                                    {showExportBalancete && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 py-2 z-50 text-xs text-slate-700 dark:text-slate-200 animate-scale-in">
                                            <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Formatos Balancete</div>
                                            <button
                                                onClick={() => handleExportBalancete('pdf')}
                                                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                            >
                                                <FileText className="w-4 h-4 text-red-500" />
                                                <span>Baixar como PDF</span>
                                            </button>
                                            <button
                                                onClick={() => handleExportBalancete('excel')}
                                                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                            >
                                                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                                <span>Baixar como Excel (.xlsx)</span>
                                            </button>
                                            <button
                                                onClick={() => handleExportBalancete('csv')}
                                                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                            >
                                                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                                                <span>Baixar como CSV</span>
                                            </button>
                                            <button
                                                onClick={() => handleExportBalancete('ofx')}
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
                                    title="Imprimir Balancete"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Imprimir</span>
                                </button>
                            </div>
                        </div>

                        {/* Balancete Type Selector Pills */}
                        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/60 dark:border-white/5 w-full sm:w-auto self-start">
                            <button
                                onClick={() => setBalanceteType('sintetico')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                                    balanceteType === 'sintetico'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <PieChart className="w-4 h-4" />
                                <span>Balancete Sintético</span>
                            </button>

                            <button
                                onClick={() => setBalanceteType('analitico')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                                    balanceteType === 'analitico'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <Table2 className="w-4 h-4" />
                                <span>Balancete Analítico</span>
                            </button>

                            <button
                                onClick={() => setBalanceteType('contabil')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                                    balanceteType === 'contabil'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <FileText className="w-4 h-4" />
                                <span>Balancete Contábil</span>
                            </button>
                        </div>

                        {/* Top Key Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-950 bg-emerald-50/40 dark:bg-emerald-950/20">
                                <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 block">Receitas Brutas</span>
                                <span className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">{formatBRL(financialTotals.income)}</span>
                            </div>

                            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-950 bg-rose-50/40 dark:bg-rose-950/20">
                                <span className="text-[10px] uppercase font-black text-rose-600 dark:text-rose-400 block">Despesas & Custos</span>
                                <span className="text-lg font-mono font-black text-rose-700 dark:text-rose-300 mt-0.5 block">{formatBRL(financialTotals.expenses)}</span>
                            </div>

                            <div className={`p-3.5 rounded-xl border ${financialTotals.balance >= 0 ? 'border-blue-200 dark:border-blue-950 bg-blue-50/40 dark:bg-blue-950/20' : 'border-amber-200 dark:border-amber-950 bg-amber-50/40 dark:bg-amber-950/20'}`}>
                                <span className="text-[10px] uppercase font-black text-slate-600 dark:text-slate-400 block">Resultado Operacional</span>
                                <span className={`text-lg font-mono font-black ${financialTotals.balance >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'} mt-0.5 block`}>{formatBRL(financialTotals.balance)}</span>
                            </div>

                            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-950 bg-amber-50/40 dark:bg-amber-950/20">
                                <span className="text-[10px] uppercase font-black text-amber-600 dark:text-amber-400 block">Pendentes Conciliação</span>
                                <span className="text-lg font-mono font-black text-amber-700 dark:text-amber-300 mt-0.5 block">{formatBRL(financialTotals.pending)}</span>
                            </div>
                        </div>

                        {/* TYPE 1: BALANCETE SINTÉTICO */}
                        {balanceteType === 'sintetico' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                                {/* Entradas Demonstrative */}
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20 space-y-3">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                        <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                                            <ArrowUpRight className="w-4 h-4" />
                                            Demonstrativo Sintético de Entradas
                                        </h4>
                                        <span className="text-xs font-mono font-bold text-emerald-600">{formatBRL(financialTotals.income)}</span>
                                    </div>

                                    {incomeCategories.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma entrada registrada no período.</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {incomeCategories.map((cat, idx) => {
                                                const perc = financialTotals.income > 0 ? Math.round((cat.amount / financialTotals.income) * 100) : 0;
                                                return (
                                                    <div key={idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1.5">
                                                        <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                                                            <span>{cat.category}</span>
                                                            <span className="font-mono text-emerald-600">{formatBRL(cat.amount)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                                                            <span>{cat.count} lançamentos</span>
                                                            <span>{perc}% das entradas</span>
                                                        </div>
                                                        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${perc}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Saídas Demonstrative */}
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20 space-y-3">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                        <h4 className="text-xs font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider flex items-center gap-1.5">
                                            <ArrowDownRight className="w-4 h-4" />
                                            Demonstrativo Sintético de Saídas por Categoria
                                        </h4>
                                        <span className="text-xs font-mono font-bold text-rose-600">{formatBRL(financialTotals.expenses)}</span>
                                    </div>

                                    {expenseCategories.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma saída registrada no período.</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {expenseCategories.map((cat, idx) => {
                                                const perc = financialTotals.expenses > 0 ? Math.round((cat.amount / financialTotals.expenses) * 100) : 0;
                                                return (
                                                    <div key={idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1.5">
                                                        <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                                                            <span>{cat.category}</span>
                                                            <span className="font-mono text-rose-600">{formatBRL(cat.amount)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                                                            <span>{cat.count} lançamentos</span>
                                                            <span>{perc}% das saídas</span>
                                                        </div>
                                                        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
                                <div className="p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Detalhamento Item a Item do Balancete Analítico
                                    </span>
                                    <span className="font-mono font-bold text-slate-500">
                                        {filteredReportData.length} lançamentos encontrados
                                    </span>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                                    <th className="py-2.5 px-3">Data</th>
                                                    <th className="py-2.5 px-3">Histórico / Descrição</th>
                                                    <th className="py-2.5 px-3">Contribuinte / Favorecido</th>
                                                    <th className="py-2.5 px-3">Categoria</th>
                                                    <th className="py-2.5 px-3">Igreja</th>
                                                    <th className="py-2.5 px-3 text-center">Descrição</th>
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

                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                                                <td className="py-2 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">{tx.date || '---'}</td>
                                                                <td className="py-2 px-3 font-bold text-slate-800 dark:text-white uppercase">{tx.desc || tx.description || tx.historico || 'Lançamento'}</td>
                                                                <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{tx.payer || tx.contribuinte || tx.nome || '---'}</td>
                                                                <td className="py-2 px-3 text-slate-500">{tx.category || tx.categoria || 'Geral'}</td>
                                                                <td className="py-2 px-3 text-slate-400 text-[11px]">{getChurchName(tx.churchId || tx.church)}</td>
                                                                <td className="py-2 px-3 text-center">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isExpense ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                                                                        {isExpense ? 'Saída' : 'Entrada'}
                                                                    </span>
                                                                </td>
                                                                <td className={`py-2 px-3 text-right font-mono font-bold ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
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
                                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                                            <span className="text-[11px]">
                                                Exibindo <span className="font-mono text-slate-900 dark:text-white">{(balanceteCurrentPage - 1) * BALANCETE_ITEMS_PER_PAGE + 1}</span> a <span className="font-mono text-slate-900 dark:text-white">{Math.min(filteredReportData.length, balanceteCurrentPage * BALANCETE_ITEMS_PER_PAGE)}</span> de <span className="font-mono text-slate-900 dark:text-white">{filteredReportData.length}</span> lançamentos
                                            </span>

                                            <div className="flex items-center gap-1.5 ml-auto">
                                                <button
                                                    onClick={() => setBalanceteCurrentPage(1)}
                                                    disabled={balanceteCurrentPage === 1}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                                                >
                                                    Primeira
                                                </button>
                                                <button
                                                    onClick={() => setBalanceteCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={balanceteCurrentPage === 1}
                                                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                                                    title="Página Anterior"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <span className="px-2 font-mono text-[11px] text-slate-800 dark:text-white">
                                                    {balanceteCurrentPage} / {balanceteTotalPages}
                                                </span>
                                                <button
                                                    onClick={() => setBalanceteCurrentPage(p => Math.min(balanceteTotalPages, p + 1))}
                                                    disabled={balanceteCurrentPage === balanceteTotalPages}
                                                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                                                    title="Próxima Página"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setBalanceteCurrentPage(balanceteTotalPages)}
                                                    disabled={balanceteCurrentPage === balanceteTotalPages}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
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
                                <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                            Estrutura de Plano de Contas Contábil da Igreja (Balancete Formal de Verificação)
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-lg">
                                        Equilíbrio Contábil OK
                                    </span>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
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
                                            <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 font-black">
                                                <td className="py-2 px-3 font-mono text-emerald-800 dark:text-emerald-400">1.0.00</td>
                                                <td className="py-2 px-3 text-emerald-800 dark:text-emerald-300 uppercase">RECEITAS OPERACIONAIS (DÍZIMOS, OFERTAS & CONTRIBUIÇÕES)</td>
                                                <td className="py-2 px-3 text-center text-[10px] text-emerald-700">GRUPO</td>
                                                <td className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">{formatBRL(financialTotals.income)}</td>
                                                <td className="py-2 px-3 text-right font-mono text-slate-400">R$ 0,00</td>
                                                <td className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">{formatBRL(financialTotals.income)}</td>
                                            </tr>

                                            {incomeCategories.map((c, i) => (
                                                <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                    <td className="py-1.5 px-3 pl-6 font-mono text-slate-400 text-[11px]">1.1.0{i + 1}</td>
                                                    <td className="py-1.5 px-3 pl-6 text-slate-700 dark:text-slate-200">  • {c.category}</td>
                                                    <td className="py-1.5 px-3 text-center text-[10px] font-bold text-emerald-600">Crédito</td>
                                                    <td className="py-1.5 px-3 text-right font-mono text-emerald-600">{formatBRL(c.amount)}</td>
                                                    <td className="py-1.5 px-3 text-right font-mono text-slate-400">R$ 0,00</td>
                                                    <td className="py-1.5 px-3 text-right font-mono text-emerald-600">{formatBRL(c.amount)}</td>
                                                </tr>
                                            ))}

                                            {/* GRUPO 2: DESPESAS */}
                                            <tr className="bg-rose-50/60 dark:bg-rose-950/20 font-black">
                                                <td className="py-2 px-3 font-mono text-rose-800 dark:text-rose-400">2.0.00</td>
                                                <td className="py-2 px-3 text-rose-800 dark:text-rose-300 uppercase">DESPESAS OPERACIONAIS & MANUTENÇÃO MINISTERIAL</td>
                                                <td className="py-2 px-3 text-center text-[10px] text-rose-700">GRUPO</td>
                                                <td className="py-2 px-3 text-right font-mono text-slate-400">R$ 0,00</td>
                                                <td className="py-2 px-3 text-right font-mono text-rose-700 dark:text-rose-400">{formatBRL(financialTotals.expenses)}</td>
                                                <td className="py-2 px-3 text-right font-mono text-rose-700 dark:text-rose-400">- {formatBRL(financialTotals.expenses)}</td>
                                            </tr>

                                            {expenseCategories.map((c, i) => (
                                                <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                    <td className="py-1.5 px-3 pl-6 font-mono text-slate-400 text-[11px]">2.1.0{i + 1}</td>
                                                    <td className="py-1.5 px-3 pl-6 text-slate-700 dark:text-slate-200">  • {c.category}</td>
                                                    <td className="py-1.5 px-3 text-center text-[10px] font-bold text-rose-600">Débito</td>
                                                    <td className="py-1.5 px-3 text-right font-mono text-slate-400">R$ 0,00</td>
                                                    <td className="py-1.5 px-3 text-right font-mono text-rose-600">{formatBRL(c.amount)}</td>
                                                    <td className="py-1.5 px-3 text-right font-mono text-rose-600">- {formatBRL(c.amount)}</td>
                                                </tr>
                                            ))}

                                            {/* BALANÇO FINAL */}
                                            <tr className="bg-slate-900 text-white font-black text-xs">
                                                <td className="py-3 px-3 font-mono">3.0.00</td>
                                                <td className="py-3 px-3 uppercase">RESULTADO LÍQUIDO DO EXERCÍCIO (SALDO FINAL CONTÁBIL)</td>
                                                <td className="py-3 px-3 text-center text-[10px] text-amber-400">BALANÇO</td>
                                                <td className="py-3 px-3 text-right font-mono text-emerald-400">{formatBRL(financialTotals.income)}</td>
                                                <td className="py-3 px-3 text-right font-mono text-rose-400">{formatBRL(financialTotals.expenses)}</td>
                                                <td className={`py-3 px-3 text-right font-mono text-sm ${financialTotals.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formatBRL(financialTotals.balance)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 4: Resumo por Igreja / Congregação */}
                {activeTab === 'churches' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-sm h-full flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-orange-500" />
                                    Demonstrativo Consolidado por Congregação
                                </h3>
                                <p className="text-xs text-slate-400">Visão geral comparativa da arrecadação, despesas e saldo por unidade.</p>
                            </div>
                            <button
                                onClick={() => setActiveView('reports')}
                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
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
                                        className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20 hover:border-orange-500/30 transition-all space-y-4"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-black text-sm text-slate-800 dark:text-white">{ch.name}</h4>
                                                <span className="text-[10px] text-slate-400 block">CNPJ: {ch.cnpJ}</span>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400">
                                                {ch.txCount} movimentações
                                            </span>
                                        </div>

                                        {/* Progress bar contribution */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                                <span>Participação no Total</span>
                                                <span>{ch.sharePercent}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${ch.sharePercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800 text-xs">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Entradas Totais</span>
                                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(ch.totalIncome)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Saídas Totais</span>
                                                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatBRL(ch.totalExpenses)}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pt-3 border-t border-slate-200/50 dark:border-slate-800 text-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                Contribuintes: <strong className="text-slate-700 dark:text-slate-300">{ch.contributorCount}</strong>
                                            </span>
                                            <span className={`font-mono font-black text-sm ${ch.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-sm h-full flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
                        {/* Header & Overall Totals */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-orange-500" />
                                    Relatório Consolidado por Categoria
                                </h3>
                                <p className="text-xs text-slate-400">Análise financeira completa por categorias, com suporte a entradas e saídas, formas de pagamento e cargos/vínculos.</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                    Entradas: {formatBRL(categoryTotals.totalIncome)}
                                </span>
                                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300">
                                    Saídas: {formatBRL(categoryTotals.totalExpenses)}
                                </span>
                                <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
                                    (categoryTotals.totalIncome - categoryTotals.totalExpenses) >= 0
                                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300'
                                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300'
                                }`}>
                                    Saldo Filtrado: {formatBRL(categoryTotals.totalIncome - categoryTotals.totalExpenses)}
                                </span>
                            </div>
                        </div>

                        {/* Dynamic Controls & Filter Bar */}
                        <div className="p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                            {/* Primary Filters Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {/* Movement Type Toggle */}
                                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                                    <button
                                        onClick={() => setCategoryTypeFilter('all')}
                                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                                            categoryTypeFilter === 'all'
                                                ? 'bg-orange-500 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setCategoryTypeFilter('income')}
                                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                                            categoryTypeFilter === 'income'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                                        }`}
                                    >
                                        Entradas
                                    </button>
                                    <button
                                        onClick={() => setCategoryTypeFilter('expense')}
                                        className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all text-center ${
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
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:border-orange-500"
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
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:border-orange-500"
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
                                        className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Resetar Todos os Filtros</span>
                                    </button>
                                )}
                            </div>

                            {/* Secondary Row: Search & Multi-Category Selection */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                                {/* Search Input */}
                                <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Buscar categoria por nome..."
                                        value={expenseCategorySearch}
                                        onChange={e => setExpenseCategorySearch(e.target.value)}
                                        className="pl-9 pr-8 py-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                                    />
                                    {expenseCategorySearch && (
                                        <button 
                                            onClick={() => setExpenseCategorySearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Multi-Select Category Dropdown */}
                                <div className="relative" ref={categoryDropdownRef}>
                                    <button
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-between ${
                                            selectedExpenseCategories.length > 0
                                                ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Filter className="w-3.5 h-3.5 text-orange-500" />
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
                                        <div className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-3 space-y-2 animate-in fade-in duration-150">
                                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-[11px] font-black uppercase text-slate-500">Categorias Cadastradas</span>
                                                <button
                                                    onClick={() => setSelectedExpenseCategories([])}
                                                    className="text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                                                >
                                                    Limpar Seleção
                                                </button>
                                            </div>

                                            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                                                {allSystemCategoryNames.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic py-2 text-center">Nenhuma categoria encontrada.</p>
                                                ) : (
                                                    allSystemCategoryNames.map((catName, idx) => {
                                                        const isSelected = selectedExpenseCategories.includes(catName);
                                                        const catObj = categorySummaries.find(c => c.category === catName);
                                                        return (
                                                            <label
                                                                key={idx}
                                                                className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => toggleExpenseCategory(catName)}
                                                                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                                    />
                                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{catName}</span>
                                                                </div>
                                                                {catObj && (
                                                                    <span className="font-mono text-[10px] font-bold text-orange-600">
                                                                        {formatBRL(catObj.amount)}
                                                                    </span>
                                                                )}
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-400">
                                                <span>{selectedExpenseCategories.length} de {allSystemCategoryNames.length} marcadas</span>
                                                <button
                                                    onClick={() => setIsCategoryDropdownOpen(false)}
                                                    className="px-2.5 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold cursor-pointer"
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
                                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-1 pb-0.5 text-xs">
                                    <button
                                        onClick={() => setSelectedExpenseCategories([])}
                                        className={`px-3 py-1 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer text-[11px] flex items-center gap-1 ${
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
                                                className={`px-3 py-1 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer text-[11px] flex items-center gap-1.5 border ${
                                                    isSelected
                                                        ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-800 shadow-xs'
                                                        : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-300'
                                                }`}
                                            >
                                                {isSelected && <Check className="w-3 h-3 text-orange-600 dark:text-orange-400" />}
                                                <span>{catName}</span>
                                                {catObj && (
                                                    <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md ${
                                                        isSelected ? 'bg-orange-200 dark:bg-orange-900/60 text-orange-900 dark:text-orange-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
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
                            <div className="p-3 rounded-xl border border-orange-200/80 dark:border-orange-950 bg-orange-50/40 dark:bg-orange-950/20">
                                <span className="text-[10px] uppercase font-black text-orange-700 dark:text-orange-400 block tracking-wider">Volume Movimentado</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-lg font-mono font-black text-orange-700 dark:text-orange-300">{formatBRL(categoryTotals.totalAmount)}</span>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
                                <span className="text-[10px] uppercase font-black text-slate-500 block tracking-wider">Categorias Exibidas</span>
                                <span className="text-lg font-mono font-black text-slate-800 dark:text-white">
                                    {categoryTotals.categoriesCount} <span className="text-xs font-normal text-slate-400">de {allSystemCategoryNames.length}</span>
                                </span>
                            </div>

                            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
                                <span className="text-[10px] uppercase font-black text-slate-500 block tracking-wider">Lançamentos Filtrados</span>
                                <span className="text-lg font-mono font-black text-slate-800 dark:text-white">
                                    {categoryTotals.totalCount} <span className="text-xs font-normal text-slate-400">movimentações</span>
                                </span>
                            </div>
                        </div>

                        {/* Category Cards & Drilldown */}
                        {displayedCategoryCards.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs italic bg-slate-50/50 dark:bg-black/10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
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
                                        className="px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-orange-700 transition-colors"
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
                                            className={`p-4 rounded-xl border transition-all flex flex-col space-y-3 ${
                                                isExpanded
                                                    ? 'border-orange-400 dark:border-orange-800 bg-white dark:bg-slate-900 shadow-md md:col-span-2'
                                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                                            <Tag className="w-3.5 h-3.5 text-orange-500" />
                                                            {cat.category}
                                                        </h4>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            cat.typeLabel === 'misto'
                                                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                                                                : cat.typeLabel === 'saida'
                                                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                                                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                                                        }`}>
                                                            {cat.typeLabel === 'misto' ? 'Misto' : cat.typeLabel === 'saida' ? 'Saída' : 'Entrada'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-semibold">{cat.count} lançamentos • {percent}% do volume exibido</span>
                                                    
                                                    {/* Subtotals if mixed or present */}
                                                    {(cat.incomeAmount > 0 && cat.expenseAmount > 0) && (
                                                        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono">
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Entradas: {formatBRL(cat.incomeAmount)}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-rose-600 dark:text-rose-400 font-bold">Saídas: {formatBRL(cat.expenseAmount)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-right">
                                                    <span className={`text-xs font-mono font-black block ${
                                                        cat.typeLabel === 'saida' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                                    }`}>{formatBRL(cat.amount)}</span>
                                                    <button
                                                        onClick={() => toggleExpandCategory(cat.category)}
                                                        className="mt-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 ml-auto"
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
                                                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                                                        <span>Lançamentos da Categoria ({catTransactions.length})</span>
                                                        <span className="font-mono text-slate-700 dark:text-slate-300">Subtotal: {formatBRL(cat.amount)}</span>
                                                    </div>

                                                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                                        <div className="overflow-x-auto max-h-60 custom-scrollbar">
                                                            <table className="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                                        <th className="py-2 px-3">Data</th>
                                                                        <th className="py-2 px-3">Descrição</th>
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

                                                                            return (
                                                                                <tr key={tIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                                    <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">{formatDateBRL(tx.date) || '---'}</td>
                                                                                    <td className="py-1.5 px-3 whitespace-nowrap">
                                                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                                            isExp ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                                                                        }`}>
                                                                                            {isExp ? 'Saída' : 'Entrada'}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="py-1.5 px-3 font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">{tx.desc || tx.description || tx.historico || 'Lançamento'}</td>
                                                                                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">{tx.payer || tx.contribuinte || tx.favorecido || tx.nome || '---'}</td>
                                                                                    <td className="py-1.5 px-3 text-slate-500 text-[10px] font-mono">{pm}</td>
                                                                                    <td className="py-1.5 px-3 text-slate-500 text-[10px]">{role}</td>
                                                                                    <td className="py-1.5 px-3 text-slate-400 text-[10px]">{getChurchName(tx.churchId || tx.church)}</td>
                                                                                    <td className={`py-1.5 px-3 text-right font-mono font-bold ${
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
