import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useUI } from '../../contexts/UIContext';
import { ExportService } from '../../services/ExportService';
import { 
    Users, Building2, UserCheck, Search, Download, 
    FileSpreadsheet, FileText, Filter, Loader2, RefreshCw, FileCode, Printer,
    CheckCircle2, AlertTriangle, Camera, Phone, Mail, MapPin, 
    ChevronDown, X, Eye, Check, ExternalLink, ShieldAlert,
    Sparkles, User, Tag
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

export const ContributorsReportSection: React.FC = () => {
    const { churches, contributorFiles } = useContext(AppContext);
    const { showToast } = useUI();

    const [contributors, setContributors] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Multi-select church filter
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
    const [isChurchDropdownOpen, setIsChurchDropdownOpen] = useState<boolean>(false);
    
    // Advanced data quality missing filters
    const [missingFilter, setMissingFilter] = useState<MissingDataType>('ALL');
    const [selectedPersonType, setSelectedPersonType] = useState<'ALL' | 'PF' | 'PJ'>('ALL');
    const [selectedRole, setSelectedRole] = useState<string>('ALL');
    
    // Export and Modal state
    const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
    const [selectedContributor, setSelectedContributor] = useState<any | null>(null);

    const churchDropdownRef = useRef<HTMLDivElement>(null);
    const downloadMenuRef = useRef<HTMLDivElement>(null);

    // Close popovers on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (churchDropdownRef.current && !churchDropdownRef.current.contains(event.target as Node)) {
                setIsChurchDropdownOpen(false);
            }
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setShowDownloadMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load contributor data from API and merge local files if needed
    const loadContributorsData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/v1/contributors');
            let apiData: any[] = [];
            if (res.ok) {
                const json = await res.json();
                apiData = Array.isArray(json) ? json : (json.contributors || []);
            }

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
                                photo: fc.photo || fc.photoUrl || fc.avatarUrl || ''
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
        loadContributorsData();
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
        const hasPhoto = !!(c.photo || c.photoUrl || c.avatarUrl);
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
        return contributors.filter(c => {
            // Search Query
            if (searchQuery) {
                const query = searchQuery.toLowerCase().trim();
                const nameMatch = (c.name || c.fullName || '').toLowerCase().includes(query);
                const docMatch = (c.cpfCnpj || c.cpf || c.document || '').includes(query);
                const phoneMatch = (c.phone || c.mobile || '').includes(query);
                const emailMatch = (c.email || '').toLowerCase().includes(query);
                const cityMatch = (c.city || c.cidade || '').toLowerCase().includes(query);
                if (!nameMatch && !docMatch && !phoneMatch && !emailMatch && !cityMatch) return false;
            }

            // Multi-Church Filter
            if (selectedChurchIds.length > 0) {
                if (!selectedChurchIds.includes(c.churchId)) return false;
            }

            // Person Type
            if (selectedPersonType !== 'ALL') {
                const type = c.personType || (c.cpfCnpj?.length === 18 ? 'PJ' : 'PF');
                if (type !== selectedPersonType) return false;
            }

            // Role
            if (selectedRole !== 'ALL') {
                const r = c.role || c.churchRole || 'Membro';
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
    }, [contributors, searchQuery, selectedChurchIds, selectedPersonType, selectedRole, missingFilter]);

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

    const getChurchName = (cId: string) => {
        return churches.find(c => c.id === cId)?.name || 'Igreja Sede';
    };

    // Download format runner
    const handleDownloadFormat = (format: 'pdf' | 'excel' | 'csv' | 'ofx') => {
        setShowDownloadMenu(false);
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
        setShowDownloadMenu(false);
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
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total no Relatório</p>
                        <h4 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{stats.total}</h4>
                        <span className="text-[10px] text-slate-400">{stats.pf} PF · {stats.pj} PJ</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-500">
                        <Users className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Integridade Cadastral</p>
                        <h4 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.integrityScore}%</h4>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{stats.completeCount} cadastros 100% completos</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>

                <div 
                    onClick={() => setMissingFilter(missingFilter === 'INCOMPLETE_ONLY' ? 'ALL' : 'INCOMPLETE_ONLY')}
                    className={`bg-white dark:bg-slate-900 p-3.5 rounded-2xl border ${missingFilter === 'INCOMPLETE_ONLY' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-100 dark:border-white/5'} shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-400 transition-all`}
                >
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Com Dados Faltando</p>
                        <h4 className="text-lg font-black text-amber-700 dark:text-amber-300 mt-0.5">{stats.incompleteCount}</h4>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Clique para filtrar pendentes</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Igrejas no Filtro</p>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-black text-slate-800 dark:text-white truncate">
                            {selectedChurchIds.length === 0 ? 'Todas as Igrejas' : `${selectedChurchIds.length} selecionada(s)`}
                        </span>
                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Filter Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Search Field */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por Nome, CPF/CNPJ, E-mail, Cidade..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500 transition-colors"
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
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                        >
                            <option value="ALL">Todos os Cargos/Vínculos</option>
                            {availableRoles.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Export Button & Refresh */}
                <div className="relative flex items-center gap-2" ref={downloadMenuRef}>
                    <button
                        onClick={loadContributorsData}
                        title="Recarregar Cadastros"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        onClick={handlePrint}
                        title="Imprimir Relatório de Cadastros"
                        className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer border border-slate-200/60 dark:border-white/5"
                    >
                        <Printer className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        <span>Imprimir</span>
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <Download className="w-4 h-4" />
                            <span>Exportar Cadastros</span>
                        </button>

                        {showDownloadMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 py-2 z-50 text-xs text-slate-700 dark:text-slate-200 animate-scale-in">
                                <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Formatos e Impressão</div>
                                <button
                                    onClick={handlePrint}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-white/5"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Imprimir Relatório</span>
                                </button>
                                <button
                                    onClick={() => handleDownloadFormat('pdf')}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                >
                                    <FileText className="w-4 h-4 text-red-500" />
                                    <span>Baixar como PDF</span>
                                </button>
                                <button
                                    onClick={() => handleDownloadFormat('excel')}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                    <span>Baixar como Excel (.xlsx)</span>
                                </button>
                                <button
                                    onClick={() => handleDownloadFormat('csv')}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                                    <span>Baixar como CSV</span>
                                </button>
                                <button
                                    onClick={() => handleDownloadFormat('ofx')}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                >
                                    <FileCode className="w-4 h-4 text-purple-500" />
                                    <span>Baixar como OFX (ERP/Contábil)</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table View */}
            <div className="flex-1 min-h-[400px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        <p className="text-xs font-semibold">Carregando relatório de cadastros...</p>
                    </div>
                ) : filteredContributors.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
                        <Users className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhum cadastro encontrado</h4>
                        <p className="text-xs text-slate-400">Ajuste os filtros de busca ou integridade para visualizar os registros.</p>
                        {hasActiveFilters && (
                            <button onClick={resetFilters} className="mt-2 text-xs font-bold text-orange-600 hover:underline">
                                Limpar todos os filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-black uppercase text-slate-400 tracking-wider">
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
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs text-slate-700 dark:text-slate-200 font-medium">
                                {filteredContributors.map((item, idx) => {
                                    const isPj = item.personType === 'PJ';
                                    const name = item.name || item.fullName || 'NÃO INFORMADO';
                                    const initial = name.charAt(0).toUpperCase();
                                    const quality = getContributorMissingData(item);
                                    const photoUrl = item.photo || item.photoUrl || item.avatarUrl;

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
                                                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs" 
                                                        />
                                                    ) : (
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs ${isPj ? 'bg-purple-500' : 'bg-orange-500'}`}>
                                                            {initial}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-white block">{name}</span>
                                                        {item.email ? (
                                                            <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">{item.email}</span>
                                                        ) : (
                                                            <span className="text-[10px] text-amber-500 block italic font-semibold">Sem E-mail</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isPj ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'}`}>
                                                    {isPj ? 'PJ (Empresa)' : 'PF (Pessoa)'}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                                {formatDocument(item.cpfCnpj || item.cpf || item.document)}
                                            </td>

                                            <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                                                {getChurchName(item.churchId)}
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                                                    {item.role || item.churchRole || 'Membro'}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                                <div className="flex flex-col">
                                                    <span>{item.phone || item.mobile || '---'}</span>
                                                    {(item.city || item.cidade) && (
                                                        <span className="text-[10px] text-slate-400">{item.city || item.cidade} - {item.state || item.uf || 'UF'}</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                {quality.isComplete ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 inline-flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Completo
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 inline-flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                            Falta {quality.missingList[0]}
                                                        </span>
                                                        {quality.missingList.length > 1 && (
                                                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
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
                )}
            </div>

            {/* Contributor Profile Inspection Modal */}
            {selectedContributor && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
                        <button
                            onClick={() => setSelectedContributor(null)}
                            className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold text-lg">
                                {(selectedContributor.name || selectedContributor.fullName || 'C')[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 dark:text-white text-base">{selectedContributor.name || selectedContributor.fullName}</h3>
                                <p className="text-xs text-slate-400">
                                    {selectedContributor.role || selectedContributor.churchRole || 'Membro'} · {getChurchName(selectedContributor.churchId)}
                                </p>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Tipo de Pessoa</span>
                                <span className="font-semibold text-slate-800 dark:text-white">{selectedContributor.personType === 'PJ' ? 'Pessoa Jurídica (PJ)' : 'Pessoa Física (PF)'}</span>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">CPF / CNPJ</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-white">{formatDocument(selectedContributor.cpfCnpj || selectedContributor.cpf || selectedContributor.document)}</span>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Telefone / WhatsApp</span>
                                <span className="font-semibold text-slate-800 dark:text-white">{selectedContributor.phone || selectedContributor.mobile || 'Não informado'}</span>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">E-mail</span>
                                <span className="font-semibold text-slate-800 dark:text-white truncate block">{selectedContributor.email || 'Não informado'}</span>
                            </div>
                        </div>

                        {/* Check list missing items */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Diagnóstico do Cadastro</span>
                            <div className="flex flex-wrap gap-2 text-xs">
                                {getContributorMissingData(selectedContributor).missingList.length === 0 ? (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4" /> Cadastro 100% Completo
                                    </span>
                                ) : (
                                    getContributorMissingData(selectedContributor).missingList.map((m, i) => (
                                        <span key={i} className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1">
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
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>Enviar WhatsApp</span>
                                </a>
                            )}
                            <button
                                onClick={() => setSelectedContributor(null)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
