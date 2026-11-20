import React, { useState, useEffect, useContext, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useUI } from '../../contexts/UIContext';
import { ExportService } from '../../services/ExportService';
import { getCachedContributors, subscribeToContributorUpdates } from '../../services/contributorsCache';
import { ExportPrintActions } from './ExportPrintActions';
import { 
    Users, Building2, Loader2, RefreshCw, Search,
    CheckCircle2, AlertTriangle, Camera, Phone, Mail, MapPin, 
    ChevronDown, X, Eye, Check, ExternalLink, ShieldAlert,
    Sparkles, User, Tag, ChevronLeft, ChevronRight, FileText, Filter
} from 'lucide-react';

const formatDocument = (doc?: string) => {
    if (!doc) return '---';
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) {
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (clean.length === 14) {
        return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return doc;
};

// Types for data missing filters
export type MissingDataType = 'ALL' | 'COMPLETE_ONLY' | 'INCOMPLETE_ONLY' | 'NO_PHOTO' | 'NO_PHONE' | 'NO_EMAIL' | 'NO_ADDRESS' | 'NO_DOC' | 'NO_ROLE';

export interface ContributorsReportHandle {
    downloadFormat: (format: 'pdf' | 'excel' | 'csv' | 'ofx') => void;
    print: () => void;
    refresh: () => void;
}

interface ContributorsReportSectionProps {
    hideExportPrint?: boolean;
}

export const ContributorsReportSection = forwardRef<ContributorsReportHandle, ContributorsReportSectionProps>(({ hideExportPrint = false }, ref) => {
    const { churches, contributorFiles } = useContext(AppContext);
    const { showToast } = useUI();

    const [contributors, setContributors] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    
    // Multi-select church filter
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
    const [isChurchDropdownOpen, setIsChurchDropdownOpen] = useState<boolean>(false);
    
    // Advanced data quality missing filters
    const [missingFilter, setMissingFilter] = useState<MissingDataType>('ALL');
    const [selectedPersonType, setSelectedPersonType] = useState<'ALL' | 'PF' | 'PJ'>('ALL');
    const [selectedRole, setSelectedRole] = useState<string>('ALL');
    
    // Modal state
    const [selectedContributor, setSelectedContributor] = useState<any | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const ITEMS_PER_PAGE = 50;

    const churchDropdownRef = useRef<HTMLDivElement>(null);

    // Debounce search input to maintain 60 FPS typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 150);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Close popovers on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (churchDropdownRef.current && !churchDropdownRef.current.contains(event.target as Node)) {
                setIsChurchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load contributor data from API and merge local files if needed
    const loadContributorsData = async (forceRefresh = false) => {
        setIsLoading(true);
        try {
            const apiDataRaw = await getCachedContributors(forceRefresh);
            let apiData: any[] = Array.isArray(apiDataRaw) ? [...apiDataRaw] : [];

            // Fallback: merge with local contributorFiles
            if (contributorFiles && contributorFiles.length > 0) {
                const existingMap = new Map(apiData.map(c => [(c.name || c.fullName || '').toLowerCase().trim(), c]));
                
                contributorFiles.forEach((cf: any) => {
                    const fileContributors = cf.contributors || [];
                    fileContributors.forEach((fc: any) => {
                        const key = (fc.name || fc.fullName || '').toLowerCase().trim();
                        if (key && !existingMap.has(key)) {
                            apiData.push({
                                id: fc.id || `file-${Math.random()}`,
                                name: fc.name || fc.fullName || 'NÃO INFORMADO',
                                personType: fc.personType || (fc.cpfCnpj?.length === 18 ? 'PJ' : 'PF'),
                                cpfCnpj: fc.cpfCnpj || fc.document || fc.cpf || '',
                                churchId: fc.churchId || cf.churchId || 'church-1',
                                role: fc.role || fc.churchRole || 'Membro',
                                phone: fc.phone || fc.mobile || '',
                                email: fc.email || '',
                                city: fc.city || '',
                                state: fc.state || '',
                                photo: fc.photo || fc.photo_url || fc.photoUrl || fc.avatarUrl || ''
                            });
                        }
                    });
                });
            }

            setContributors(apiData);
        } catch (e) {
            console.error('[ContributorsReport] Erro ao carregar cadastros:', e);
            showToast('Erro ao carregar lista de cadastros.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadContributorsData(true);
        const unsubscribe = subscribeToContributorUpdates(() => {
            loadContributorsData(true);
        });
        return () => {
            unsubscribe();
        };
    }, [contributorFiles]);

    // Unique roles
    const availableRoles = useMemo(() => {
        const rolesSet = new Set<string>();
        contributors.forEach(c => {
            const r = c.role || c.churchRole;
            if (r) rolesSet.add(r);
        });
        return Array.from(rolesSet);
    }, [contributors]);

    // Check helper for missing attributes
    const getContributorMissingData = (c: any) => {
        const hasPhoto = !!(c.photo || c.photo_url || c.photoUrl || c.avatarUrl);
        const hasPhone = !!(c.phone || c.mobile || c.telefone || c.celular);
        const hasEmail = !!(c.email);
        const hasAddress = !!(c.address || c.city || c.cidade || c.state || c.uf || c.street);
        const hasDoc = !!(c.cpfCnpj || c.cpf || c.document || c.cnpj);
        const hasRole = !!(c.role || c.churchRole);

        const missingList: string[] = [];
        if (!hasPhoto) missingList.push('Foto');
        if (!hasPhone) missingList.push('Telefone');
        if (!hasEmail) missingList.push('E-mail');
        if (!hasAddress) missingList.push('Endereço');
        if (!hasDoc) missingList.push('CPF/CNPJ');
        if (!hasRole) missingList.push('Cargo/Vínculo');

        const isComplete = missingList.length === 0;

        return {
            hasPhoto,
            hasPhone,
            hasEmail,
            hasAddress,
            hasDoc,
            hasRole,
            missingList,
            isComplete
        };
    };

    // Toggle multi-select church selection
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

    // Filter contributors
    const filteredContributors = useMemo(() => {
        const query = debouncedSearchQuery.toLowerCase().trim();
        const cleanQueryDoc = query.replace(/\D/g, '');
        const normalizedQuery = query ? query.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';

        return contributors.filter(c => {
            // Search Query
            if (query) {
                const nameStr = (c.name || c.fullName || c.canonical_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const nameMatch = nameStr.includes(normalizedQuery);
                const docRaw = c.cpfCnpj || c.cpf || c.document || '';
                const docMatch = cleanQueryDoc ? docRaw.replace(/\D/g, '').includes(cleanQueryDoc) : docRaw.toLowerCase().includes(query);
                const phoneMatch = cleanQueryDoc ? (c.phone || c.mobile || '').replace(/\D/g, '').includes(cleanQueryDoc) : false;
                const emailMatch = (c.email || '').toLowerCase().includes(query);
                const cityMatch = (c.city || c.cidade || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQuery);
                if (!nameMatch && !docMatch && !phoneMatch && !emailMatch && !cityMatch) return false;
            }

            // Multi-Church Filter
            if (selectedChurchIds.length > 0) {
                const cChurch = c.churchId || c.church_id;
                if (!selectedChurchIds.includes(cChurch)) return false;
            }

            // Person Type
            if (selectedPersonType !== 'ALL') {
                const type = c.personType || c.person_type || (c.cpfCnpj?.length === 18 ? 'PJ' : 'PF');
                if (type !== selectedPersonType) return false;
            }

            // Role
            if (selectedRole !== 'ALL') {
                const r = c.role || c.churchRole || c.role_position || 'Membro';
                if (r !== selectedRole) return false;
            }

            // Data Quality / Missing Data Filters
            const quality = getContributorMissingData(c);
            if (missingFilter === 'COMPLETE_ONLY' && !quality.isComplete) return false;
            if (missingFilter === 'INCOMPLETE_ONLY' && quality.isComplete) return false;
            if (missingFilter === 'NO_PHOTO' && quality.hasPhoto) return false;
            if (missingFilter === 'NO_PHONE' && quality.hasPhone) return false;
            if (missingFilter === 'NO_EMAIL' && quality.hasEmail) return false;
            if (missingFilter === 'NO_ADDRESS' && quality.hasAddress) return false;
            if (missingFilter === 'NO_DOC' && quality.hasDoc) return false;
            if (missingFilter === 'NO_ROLE' && quality.hasRole) return false;

            return true;
        });
    }, [contributors, debouncedSearchQuery, selectedChurchIds, selectedPersonType, selectedRole, missingFilter]);

    const totalPages = Math.ceil(filteredContributors.length / ITEMS_PER_PAGE) || 1;

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, selectedChurchIds, selectedPersonType, selectedRole, missingFilter]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredContributors.length, totalPages, currentPage]);

    const paginatedContributors = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredContributors.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredContributors, currentPage]);

    // Statistics & Data Quality Overview
    const stats = useMemo(() => {
        const total = filteredContributors.length;
        const pf = filteredContributors.filter(c => (c.personType || 'PF') === 'PF').length;
        const pj = filteredContributors.filter(c => c.personType === 'PJ').length;
        
        let completeCount = 0;
        let noPhotoCount = 0;
        let noPhoneCount = 0;
        let noEmailCount = 0;
        let noDocCount = 0;
        let noAddressCount = 0;

        filteredContributors.forEach(c => {
            const q = getContributorMissingData(c);
            if (q.isComplete) completeCount++;
            if (!q.hasPhoto) noPhotoCount++;
            if (!q.hasPhone) noPhoneCount++;
            if (!q.hasEmail) noEmailCount++;
            if (!q.hasDoc) noDocCount++;
            if (!q.hasAddress) noAddressCount++;
        });

        const integrityScore = total > 0 ? Math.round((completeCount / total) * 100) : 100;
        const incompleteCount = total - completeCount;

        return { 
            total, 
            pf, 
            pj, 
            completeCount,
            incompleteCount,
            integrityScore,
            noPhotoCount,
            noPhoneCount,
            noEmailCount,
            noDocCount,
            noAddressCount
        };
    }, [filteredContributors]);

    const getChurchName = (cId?: string, item?: any) => {
        const churchId = cId || item?.church_id || item?.churchId;
        const matched = churches.find(c => c.id === churchId || (item?.congregation && c.name && c.name.trim().toLowerCase() === item.congregation.trim().toLowerCase()));
        return matched?.name || item?.congregation || churches[0]?.name || 'Igreja Sede';
    };

    // Download format runner
    const handleDownloadFormat = (format: 'pdf' | 'excel' | 'csv' | 'ofx') => {
        const dateStr = new Date().toISOString().slice(0, 10);

        let churchLabel = 'Todas as Igrejas';
        if (selectedChurchIds.length === 1) {
            const ch = churches.find(c => c.id === selectedChurchIds[0]);
            if (ch) churchLabel = ch.name;
        } else if (selectedChurchIds.length > 1) {
            churchLabel = `${selectedChurchIds.length} Igrejas Selecionadas`;
        }

        const titleSuffix = ` - ${churchLabel}`;

        if (format === 'pdf') {
            ExportService.downloadContributorsPdf(filteredContributors, churches, `Relatório de Cadastros e Contribuintes${titleSuffix}`, `relatorio_cadastros_${dateStr}.pdf`, selectedChurchIds[0]);
        } else if (format === 'excel') {
            ExportService.downloadContributorsExcel(filteredContributors, churches, `cadastros_contribuintes_${dateStr}.xlsx`);
        } else if (format === 'csv') {
            ExportService.downloadContributorsCsv(filteredContributors, churches, `cadastros_contribuintes_${dateStr}.csv`);
        } else if (format === 'ofx') {
            ExportService.downloadContributorsOfx(filteredContributors, churches, `cadastros_contribuintes_${dateStr}.ofx`);
        }
        showToast(`Relatório gerado no formato ${format.toUpperCase()} com sucesso!`, 'success');
    };

    const handlePrint = () => {
        let churchLabel = 'Todas as Igrejas';
        if (selectedChurchIds.length === 1) {
            const ch = churches.find(c => c.id === selectedChurchIds[0]);
            if (ch) churchLabel = ch.name;
        } else if (selectedChurchIds.length > 1) {
            churchLabel = `${selectedChurchIds.length} Igrejas Selecionadas`;
        }
        const titleSuffix = ` - ${churchLabel}`;

        ExportService.printContributorsHtml(
            filteredContributors,
            churches,
            `Relatório de Cadastros e Contribuintes${titleSuffix}`,
            selectedChurchIds[0]
        );
    };

    useImperativeHandle(ref, () => ({
        downloadFormat: handleDownloadFormat,
        print: handlePrint,
        refresh: () => loadContributorsData(true)
    }));

    // Clean all filters
    const resetFilters = () => {
        setSearchQuery('');
        setSelectedChurchIds([]);
        setSelectedPersonType('ALL');
        setSelectedRole('ALL');
        setMissingFilter('ALL');
    };

    const hasActiveFilters = searchQuery || selectedChurchIds.length > 0 || selectedPersonType !== 'ALL' || selectedRole !== 'ALL' || missingFilter !== 'ALL';

    return (
        <div className="space-y-4 flex flex-col h-full animate-fade-in pb-2">
            {/* Top Quality Overview & Stat Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total no Relatório</p>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">{stats.total}</h4>
                        <span className="text-[11px] text-slate-400 tabular-nums">{stats.pf} PF · {stats.pj} PJ</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40">
                        <Users className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Integridade Cadastral</p>
                        <h4 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">{stats.integrityScore}%</h4>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">{stats.completeCount} cadastros 100% completos</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                <div 
                    onClick={() => setMissingFilter(missingFilter === 'INCOMPLETE_ONLY' ? 'ALL' : 'INCOMPLETE_ONLY')}
                    className={`bg-white dark:bg-slate-900 p-3.5 rounded-xl border ${missingFilter === 'INCOMPLETE_ONLY' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-200/90 dark:border-slate-800'} shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-400 transition-all`}
                >
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Com Dados Faltando</p>
                        <h4 className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5 tabular-nums">{stats.incompleteCount}</h4>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Clique para filtrar pendentes</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Igrejas no Filtro</p>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {selectedChurchIds.length === 0 ? 'Todas as Igrejas' : `${selectedChurchIds.length} selecionada(s)`}
                        </span>
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Filter Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Search Field */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por Nome, CPF/CNPJ, E-mail, Cidade..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500 transition-colors"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                                ×
                            </button>
                        )}
                    </div>

                    {/* Role Filter */}
                    {availableRoles.length > 0 && (
                        <select
                            value={selectedRole}
                            onChange={e => setSelectedRole(e.target.value)}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                        >
                            <option value="ALL">Todos os Cargos/Vínculos</option>
                            {availableRoles.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Refresh (+ Export/Print discreto quando standalone) */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => loadContributorsData(true)}
                        title="Recarregar Cadastros"
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700 shadow-2xs transition-colors flex items-center justify-center cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-orange-600' : ''}`} />
                    </button>

                    {!hideExportPrint && (
                        <ExportPrintActions
                            onDownloadCsv={() => handleDownloadFormat('csv')}
                            onDownloadExcel={() => handleDownloadFormat('excel')}
                            onDownloadPdf={() => handleDownloadFormat('pdf')}
                            onDownloadOfx={() => handleDownloadFormat('ofx')}
                            onPrint={handlePrint}
                            downloadTitle="Exportar Cadastros"
                            printTitle="Imprimir Relatório de Cadastros"
                            menuTitle="Formatos de Cadastros"
                        />
                    )}
                </div>
            </div>

            {/* Main Table View */}
            <div className="flex-1 min-h-[400px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col">
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                        <p className="text-xs font-semibold">Carregando relatório de cadastros...</p>
                    </div>
                ) : filteredContributors.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
                        <Users className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhum cadastro encontrado</h4>
                        <p className="text-xs text-slate-400">Ajuste os filtros de busca ou integridade para visualizar os registros.</p>
                        {hasActiveFilters && (
                            <button onClick={resetFilters} className="mt-2 text-xs font-semibold text-orange-600 hover:underline">
                                Limpar todos os filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-auto custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
                            <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">
                                    <th className="py-3 px-4">Nome / Razão Social</th>
                                    <th className="py-3 px-4">Tipo</th>
                                    <th className="py-3 px-4">CPF / CNPJ</th>
                                    <th className="py-3 px-4">Igreja / Congregação</th>
                                    <th className="py-3 px-4">Cargo / Vínculo</th>
                                    <th className="py-3 px-4">Contato / Localidade</th>
                                    <th className="py-3 px-4">Status de Dados</th>
                                    <th className="py-3 px-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-200 font-medium">
                                {paginatedContributors.map((item, idx) => {
                                    const isPj = item.personType === 'PJ';
                                    const name = item.name || item.fullName || 'NÃO INFORMADO';
                                    const initial = name.charAt(0).toUpperCase();
                                    const quality = getContributorMissingData(item);
                                    const photoUrl = item.photo || item.photo_url || item.photoUrl || item.avatarUrl;

                                    return (
                                        <tr 
                                            key={item.id || idx} 
                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                                            onClick={() => setSelectedContributor(item)}
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    {photoUrl ? (
                                                        <img 
                                                            src={photoUrl} 
                                                            alt={name} 
                                                            className="w-8 h-8 rounded-lg object-cover border border-slate-200/90 dark:border-slate-700 shadow-2xs" 
                                                        />
                                                    ) : (
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-2xs ${isPj ? 'bg-slate-700' : 'bg-orange-600'}`}>
                                                            {initial}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="font-semibold text-slate-900 dark:text-white block">{name}</span>
                                                        {item.email ? (
                                                            <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">{item.email}</span>
                                                        ) : (
                                                            <span className="text-[11px] text-amber-500 block italic font-medium">Sem E-mail</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${isPj ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200/70 dark:border-orange-900/40'}`}>
                                                    {isPj ? 'PJ (Empresa)' : 'PF (Pessoa)'}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                                                {formatDocument(item.cpfCnpj || item.cpf || item.document)}
                                            </td>

                                            <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                                                {getChurchName(item.churchId || item.church_id, item)}
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 text-[10px] font-semibold">
                                                    {item.role || item.churchRole || 'Membro'}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                                <div className="flex flex-col">
                                                    <span className="tabular-nums">{item.phone || item.mobile || '---'}</span>
                                                    {(item.city || item.cidade) && (
                                                        <span className="text-[10px] text-slate-400">{item.city || item.cidade} - {item.state || item.uf || 'UF'}</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                {quality.isComplete ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/40 inline-flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Completo
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/40 inline-flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                            Falta {quality.missingList[0]}
                                                        </span>
                                                        {quality.missingList.length > 1 && (
                                                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 tabular-nums">
                                                                +{quality.missingList.length - 1}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedContributor(item);
                                                    }}
                                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-orange-600 transition-colors"
                                                    title="Ver Ficha Completa"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredContributors.length > ITEMS_PER_PAGE && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                            <span className="text-[11px]">
                                Exibindo <span className="font-mono text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-mono text-slate-900 dark:text-white">{Math.min(filteredContributors.length, currentPage * ITEMS_PER_PAGE)}</span> de <span className="font-mono text-slate-900 dark:text-white">{filteredContributors.length}</span> contribuintes
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
                </>
                )}
            </div>

            {/* Contributor Profile Inspection Modal */}
            {selectedContributor && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-elevated space-y-4 relative">
                        <button
                            onClick={() => setSelectedContributor(null)}
                            className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-lg">
                                {(selectedContributor.name || selectedContributor.fullName || 'C')[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">{selectedContributor.name || selectedContributor.fullName}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {selectedContributor.role || selectedContributor.churchRole || 'Membro'} · {getChurchName(selectedContributor.churchId || selectedContributor.church_id, selectedContributor)}
                                </p>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase block">Tipo de Pessoa</span>
                                <span className="font-semibold text-slate-800 dark:text-white">{selectedContributor.personType === 'PJ' ? 'Pessoa Jurídica (PJ)' : 'Pessoa Física (PF)'}</span>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase block">CPF / CNPJ</span>
                                <span className="tabular-nums font-bold text-slate-800 dark:text-white">{formatDocument(selectedContributor.cpfCnpj || selectedContributor.cpf || selectedContributor.document)}</span>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase block">Telefone / WhatsApp</span>
                                <span className="font-semibold text-slate-800 dark:text-white tabular-nums">{selectedContributor.phone || selectedContributor.mobile || 'Não informado'}</span>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase block">E-mail</span>
                                <span className="font-semibold text-slate-800 dark:text-white truncate block">{selectedContributor.email || 'Não informado'}</span>
                            </div>
                        </div>

                        {/* Check list missing items */}
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-2">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Diagnóstico do Cadastro</span>
                            <div className="flex flex-wrap gap-2 text-xs">
                                {getContributorMissingData(selectedContributor).missingList.length === 0 ? (
                                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4" /> Cadastro 100% Completo
                                    </span>
                                ) : (
                                    getContributorMissingData(selectedContributor).missingList.map((m, i) => (
                                        <span key={i} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/40 font-semibold text-[10px] flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Falta {m}
                                        </span>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            {selectedContributor.phone && (
                                <a
                                    href={`https://wa.me/55${selectedContributor.phone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                                >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>Enviar WhatsApp</span>
                                </a>
                            )}
                            <button
                                onClick={() => setSelectedContributor(null)}
                                className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
