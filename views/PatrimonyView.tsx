import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { 
    Building2, 
    Plus, 
    Search, 
    Filter, 
    FileText, 
    Upload, 
    Trash2, 
    Edit3, 
    Eye, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    ShieldCheck, 
    DollarSign, 
    Tag, 
    MapPin, 
    Calendar, 
    Download, 
    X, 
    Printer, 
    Paperclip, 
    Layers, 
    Box, 
    Truck, 
    Tv, 
    Music, 
    Armchair, 
    Zap, 
    Laptop, 
    ChefHat, 
    Info, 
    ExternalLink
} from 'lucide-react';

export interface PatrimonyDocument {
    id: string;
    title: string;
    type: 'nota_fiscal' | 'escritura' | 'apolice' | 'manual' | 'contrato' | 'foto' | 'outro';
    fileName: string;
    uploadedAt: string;
    notes?: string;
}

export interface PatrimonyItem {
    id: string;
    code: string;
    title: string;
    category: 'Imóvel' | 'Veículo' | 'Som & Imagem' | 'Instrumento Musical' | 'Mobiliário' | 'Climatização & Energia' | 'Informática' | 'Utensílios & Cozinha' | 'Outro';
    churchName: string;
    locationDetails: string;
    acquisitionValue: number;
    acquisitionDate: string;
    invoiceNumber?: string;
    supplierOrDonor?: string;
    warrantyExpiration?: string;
    insuranceExpiration?: string;
    condition: 'Excelente' | 'Bom' | 'Regular' | 'Danificado' | 'Inoperante';
    status: 'Ativo' | 'Em Manutenção' | 'Em Vistoria' | 'Baixado/Doado' | 'Empréstimo';
    notes?: string;
    documents: PatrimonyDocument[];
    updatedAt: string;
}

const STORAGE_KEY = 'iggestor_patrimonio_assets_v1';

const INITIAL_PATRIMONY_DATA: PatrimonyItem[] = [
    {
        id: 'pat-1',
        code: 'IMO-2026-001',
        title: 'Templo Sede - Terreno e Prédio Principal',
        category: 'Imóvel',
        churchName: 'Sede Principal',
        locationDetails: 'Avenida Central, nº 1000 - Salão de Cultos',
        acquisitionValue: 1250000.00,
        acquisitionDate: '2015-04-10',
        invoiceNumber: 'Matrícula 45.892 RGI',
        supplierOrDonor: 'Construtora Graça e Paz',
        insuranceExpiration: '2027-12-31',
        condition: 'Excelente',
        status: 'Ativo',
        notes: 'Escritura registrada em cartório de imóveis. Apólice de seguro contra incêndio e vendaval renovada.',
        documents: [
            { id: 'doc-1', title: 'Escritura Pública e Matrícula RGI', type: 'escritura', fileName: 'Escritura_Templo_Sede.pdf', uploadedAt: '2025-01-15' },
            { id: 'doc-2', title: 'Apólice de Seguro de Imóvel', type: 'apolice', fileName: 'Apolice_Seguro_2026.pdf', uploadedAt: '2026-01-10' }
        ],
        updatedAt: new Date().toISOString()
    },
    {
        id: 'pat-2',
        code: 'SOM-2026-004',
        title: 'Mesa de Som Digital Allen & Heath SQ-6',
        category: 'Som & Imagem',
        churchName: 'Sede Principal',
        locationDetails: 'Cabine de Som / Sonorização Principal',
        acquisitionValue: 28500.00,
        acquisitionDate: '2024-08-20',
        invoiceNumber: 'NF-e 88412',
        supplierOrDonor: 'ProAudio Equipamentos',
        warrantyExpiration: '2027-08-20',
        condition: 'Excelente',
        status: 'Ativo',
        notes: 'Acompanha case rígido e iluminação LED de cabine.',
        documents: [
            { id: 'doc-3', title: 'Nota Fiscal de Compra e Garantia', type: 'nota_fiscal', fileName: 'NF_88412_SQ6.pdf', uploadedAt: '2024-08-22' },
            { id: 'doc-4', title: 'Manual em Português', type: 'manual', fileName: 'Manual_SQ6_PT.pdf', uploadedAt: '2024-08-22' }
        ],
        updatedAt: new Date().toISOString()
    },
    {
        id: 'pat-3',
        code: 'MUS-2026-012',
        title: 'Piano de Cauda Elétrico Yamaha Clavinova CVP',
        category: 'Instrumento Musical',
        churchName: 'Sede Principal',
        locationDetails: 'Púlpito / Altar Principal',
        acquisitionValue: 19800.00,
        acquisitionDate: '2023-11-05',
        invoiceNumber: 'NF-e 44102',
        supplierOrDonor: 'Doação Família Oliveira',
        condition: 'Bom',
        status: 'Ativo',
        notes: 'Realizada afinação digital e limpeza de contatos em Maio/2026.',
        documents: [
            { id: 'doc-5', title: 'Termo de Doação e Recebimento', type: 'contrato', fileName: 'Termo_Doacao_Piano.pdf', uploadedAt: '2023-11-06' }
        ],
        updatedAt: new Date().toISOString()
    },
    {
        id: 'pat-4',
        code: 'CLI-2026-008',
        title: 'Central de Ar Condicionado Inverter 60.000 BTUs',
        category: 'Climatização & Energia',
        churchName: 'Sede Principal',
        locationDetails: 'Salão de Cultos - Lado Esquerdo',
        acquisitionValue: 11400.00,
        acquisitionDate: '2024-02-14',
        invoiceNumber: 'NF-e 10293',
        supplierOrDonor: 'ClimaFrio Refrigeração',
        warrantyExpiration: '2026-02-14',
        condition: 'Regular',
        status: 'Em Manutenção',
        notes: 'Chamado aberto para higienização e recarga de gás refrigerante.',
        documents: [
            { id: 'doc-6', title: 'Ordem de Serviço de Manutenção Preventiva', type: 'contrato', fileName: 'OS_Manutencao_Ar.pdf', uploadedAt: '2026-06-10' }
        ],
        updatedAt: new Date().toISOString()
    },
    {
        id: 'pat-5',
        code: 'VEI-2026-001',
        title: 'Micro-ônibus Mercedes Benz Sprinter 20 Lugares',
        category: 'Veículo',
        churchName: 'Sede Principal',
        locationDetails: 'Estacionamento Privativo',
        acquisitionValue: 185000.00,
        acquisitionDate: '2022-09-30',
        invoiceNumber: 'DUT 492019-2',
        supplierOrDonor: 'AutoConcessionária do Vale',
        insuranceExpiration: '2026-10-15',
        condition: 'Bom',
        status: 'Ativo',
        notes: 'Utilizado para transporte do departamento infantil e eventos missionários.',
        documents: [
            { id: 'doc-7', title: 'Documento CRLV Digital', type: 'outro', fileName: 'CRLV_Sprinter_2026.pdf', uploadedAt: '2026-02-01' },
            { id: 'doc-8', title: 'Apólice de Seguro Total', type: 'apolice', fileName: 'Apolice_Seguro_Sprinter.pdf', uploadedAt: '2025-10-10' }
        ],
        updatedAt: new Date().toISOString()
    }
];

export const PatrimonyView: React.FC = () => {
    const context = useContext(AppContext);
    const churches = context?.churches || [];

    const [assets, setAssets] = useState<PatrimonyItem[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error('Erro ao carregar patrimônio:', e);
        }
        return INITIAL_PATRIMONY_DATA;
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedChurch, setSelectedChurch] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<PatrimonyItem | null>(null);
    const [viewingAsset, setViewingAsset] = useState<PatrimonyItem | null>(null);
    const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

    // Form state
    const [formCode, setFormCode] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState<PatrimonyItem['category']>('Som & Imagem');
    const [formChurchName, setFormChurchName] = useState('');
    const [formLocationDetails, setFormLocationDetails] = useState('');
    const [formAcquisitionValue, setFormAcquisitionValue] = useState('');
    const [formAcquisitionDate, setFormAcquisitionDate] = useState('');
    const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
    const [formSupplierOrDonor, setFormSupplierOrDonor] = useState('');
    const [formWarrantyExpiration, setFormWarrantyExpiration] = useState('');
    const [formInsuranceExpiration, setFormInsuranceExpiration] = useState('');
    const [formCondition, setFormCondition] = useState<PatrimonyItem['condition']>('Excelente');
    const [formStatus, setFormStatus] = useState<PatrimonyItem['status']>('Ativo');
    const [formNotes, setFormNotes] = useState('');
    const [formDocuments, setFormDocuments] = useState<PatrimonyDocument[]>([]);

    // Document addition state
    const [newDocTitle, setNewDocTitle] = useState('');
    const [newDocType, setNewDocType] = useState<PatrimonyDocument['type']>('nota_fiscal');
    const [newDocFile, setNewDocFile] = useState<File | null>(null);

    // Save state to localStorage whenever assets changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
        } catch (e) {
            console.error('Erro ao salvar patrimônio:', e);
        }
    }, [assets]);

    const handleOpenCreateModal = () => {
        setEditingAsset(null);
        const autoCode = `PAT-${new Date().getFullYear()}-${String(assets.length + 1).padStart(3, '0')}`;
        setFormCode(autoCode);
        setFormTitle('');
        setFormCategory('Som & Imagem');
        setFormChurchName(churches[0]?.name || 'Sede Principal');
        setFormLocationDetails('');
        setFormAcquisitionValue('');
        setFormAcquisitionDate(new Date().toISOString().split('T')[0]);
        setFormInvoiceNumber('');
        setFormSupplierOrDonor('');
        setFormWarrantyExpiration('');
        setFormInsuranceExpiration('');
        setFormCondition('Excelente');
        setFormStatus('Ativo');
        setFormNotes('');
        setFormDocuments([]);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (item: PatrimonyItem) => {
        setEditingAsset(item);
        setFormCode(item.code);
        setFormTitle(item.title);
        setFormCategory(item.category);
        setFormChurchName(item.churchName);
        setFormLocationDetails(item.locationDetails);
        setFormAcquisitionValue(item.acquisitionValue.toString());
        setFormAcquisitionDate(item.acquisitionDate);
        setFormInvoiceNumber(item.invoiceNumber || '');
        setFormSupplierOrDonor(item.supplierOrDonor || '');
        setFormWarrantyExpiration(item.warrantyExpiration || '');
        setFormInsuranceExpiration(item.insuranceExpiration || '');
        setFormCondition(item.condition);
        setFormStatus(item.status);
        setFormNotes(item.notes || '');
        setFormDocuments(item.documents || []);
        setIsModalOpen(true);
    };

    const handleAddDocumentToForm = () => {
        if (!newDocTitle.trim()) return;
        const newDoc: PatrimonyDocument = {
            id: `doc-${Date.now()}`,
            title: newDocTitle.trim(),
            type: newDocType,
            fileName: newDocFile ? newDocFile.name : `Documento_${newDocType.toUpperCase()}.pdf`,
            uploadedAt: new Date().toISOString().split('T')[0]
        };
        setFormDocuments(prev => [...prev, newDoc]);
        setNewDocTitle('');
        setNewDocFile(null);
    };

    const handleRemoveDocFromForm = (docId: string) => {
        setFormDocuments(prev => prev.filter(d => d.id !== docId));
    };

    const handleSaveAsset = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim() || !formCode.trim()) return;

        const valFloat = parseFloat(formAcquisitionValue.replace(',', '.')) || 0;

        const newItem: PatrimonyItem = {
            id: editingAsset ? editingAsset.id : `pat-${Date.now()}`,
            code: formCode.trim().toUpperCase(),
            title: formTitle.trim(),
            category: formCategory,
            churchName: formChurchName || 'Sede Principal',
            locationDetails: formLocationDetails.trim(),
            acquisitionValue: valFloat,
            acquisitionDate: formAcquisitionDate || new Date().toISOString().split('T')[0],
            invoiceNumber: formInvoiceNumber.trim() || undefined,
            supplierOrDonor: formSupplierOrDonor.trim() || undefined,
            warrantyExpiration: formWarrantyExpiration || undefined,
            insuranceExpiration: formInsuranceExpiration || undefined,
            condition: formCondition,
            status: formStatus,
            notes: formNotes.trim() || undefined,
            documents: formDocuments,
            updatedAt: new Date().toISOString()
        };

        if (editingAsset) {
            setAssets(prev => prev.map(item => item.id === editingAsset.id ? newItem : item));
            if (viewingAsset && viewingAsset.id === editingAsset.id) {
                setViewingAsset(newItem);
            }
        } else {
            setAssets(prev => [newItem, ...prev]);
        }

        setIsModalOpen(false);
    };

    const handleDeleteAsset = (id: string) => {
        setAssets(prev => prev.filter(item => item.id !== id));
        if (viewingAsset?.id === id) setViewingAsset(null);
        setDeletingAssetId(null);
    };

    // Filter logic
    const filteredAssets = useMemo(() => {
        return assets.filter(item => {
            const matchesSearch = 
                item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.locationDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
            const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
            const matchesChurch = selectedChurch === 'all' || item.churchName === selectedChurch;

            return matchesSearch && matchesCategory && matchesStatus && matchesChurch;
        });
    }, [assets, searchTerm, selectedCategory, selectedStatus, selectedChurch]);

    // KPI Metrics
    const metrics = useMemo(() => {
        const totalCount = assets.length;
        const totalValue = assets.reduce((sum, item) => sum + (item.acquisitionValue || 0), 0);
        const maintenanceCount = assets.filter(item => item.status === 'Em Manutenção' || item.condition === 'Danificado' || item.condition === 'Inoperante').length;
        const totalDocs = assets.reduce((sum, item) => sum + (item.documents?.length || 0), 0);

        return {
            totalCount,
            totalValue,
            maintenanceCount,
            totalDocs
        };
    }, [assets]);

    const getCategoryIcon = (category: PatrimonyItem['category']) => {
        switch (category) {
            case 'Imóvel': return <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
            case 'Veículo': return <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
            case 'Som & Imagem': return <Tv className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
            case 'Instrumento Musical': return <Music className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
            case 'Mobiliário': return <Armchair className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
            case 'Climatização & Energia': return <Zap className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />;
            case 'Informática': return <Laptop className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
            case 'Utensílios & Cozinha': return <ChefHat className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
            default: return <Box className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
        }
    };

    const getStatusBadge = (status: PatrimonyItem['status']) => {
        switch (status) {
            case 'Ativo':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50"><CheckCircle2 className="w-3.5 h-3.5" /> Ativo</span>;
            case 'Em Manutenção':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50"><AlertTriangle className="w-3.5 h-3.5" /> Manutenção</span>;
            case 'Em Vistoria':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50"><Clock className="w-3.5 h-3.5" /> Em Vistoria</span>;
            case 'Baixado/Doado':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700"><Trash2 className="w-3.5 h-3.5" /> Baixado</span>;
            case 'Empréstimo':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50"><Tag className="w-3.5 h-3.5" /> Cedido</span>;
        }
    };

    const getConditionBadge = (condition: PatrimonyItem['condition']) => {
        switch (condition) {
            case 'Excelente':
                return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Excelente</span>;
            case 'Bom':
                return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Bom Estado</span>;
            case 'Regular':
                return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Regular</span>;
            case 'Danificado':
                return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Danificado</span>;
            case 'Inoperante':
                return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Inoperante</span>;
        }
    };

    const handlePrintFicha = () => {
        window.print();
    };

    return (
        <div className="space-y-6 pb-12 relative min-h-[600px]">
            
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                        <Building2 className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                Controle & Gestão de Patrimônio
                            </h1>
                            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-amber-200/60 dark:border-amber-800/40">
                                Oficial
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                            Controle total de bens da igreja, tombo de equipamentos, guarda de notas fiscais, apólices de seguro, contratos e acompanhamento de garantias.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-1.5 px-5 py-2 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 transition-all tracking-wider uppercase cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Cadastrar Novo Bem
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total de Bens</span>
                        <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">{metrics.totalCount} itens</span>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">Catalogados no tombamento</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Box className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Valor Patrimonial Total</span>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                            R$ {metrics.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">Soma de aquisição / estimativa</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <DollarSign className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Bens em Manutenção</span>
                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{metrics.maintenanceCount} itens</span>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">Atenção ou reparo necessário</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Pasta de Documentos</span>
                        <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 block">{metrics.totalDocs} anexos</span>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">Notas, apólices & escrituras</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    
                    {/* Search Input */}
                    <div className="relative w-full md:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por bem, tombo, local ou NF..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                            <option value="all">Todas as Categorias</option>
                            <option value="Imóvel">Imóvel</option>
                            <option value="Veículo">Veículo</option>
                            <option value="Som & Imagem">Som & Imagem</option>
                            <option value="Instrumento Musical">Instrumento Musical</option>
                            <option value="Mobiliário">Mobiliário</option>
                            <option value="Climatização & Energia">Climatização & Energia</option>
                            <option value="Informática">Informática</option>
                            <option value="Utensílios & Cozinha">Utensílios & Cozinha</option>
                            <option value="Outro">Outro</option>
                        </select>

                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                            <option value="all">Todos os Status</option>
                            <option value="Ativo">Ativo</option>
                            <option value="Em Manutenção">Em Manutenção</option>
                            <option value="Em Vistoria">Em Vistoria</option>
                            <option value="Baixado/Doado">Baixado/Doado</option>
                            <option value="Empréstimo">Cedido / Empréstimo</option>
                        </select>

                        {churches.length > 0 && (
                            <select
                                value={selectedChurch}
                                onChange={(e) => setSelectedChurch(e.target.value)}
                                className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                            >
                                <option value="all">Todas as Congregações</option>
                                {churches.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        )}

                        {/* View Switcher */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                Tabela
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                Cards
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* List / Table */}
            {filteredAssets.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 dark:bg-amber-950/40 flex items-center justify-center mx-auto">
                        <Box className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Nenhum bem patrimonial encontrado</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        Tente ajustar os termos da pesquisa ou cadastre novos bens para montar o inventário oficial.
                    </p>
                    <button
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-1.5 px-5 py-2 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 transition-all tracking-wider uppercase cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" /> Cadastrar Bem
                    </button>
                </div>
            ) : viewMode === 'table' ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                                    <th className="p-4">Tombo / Tag</th>
                                    <th className="p-4">Descrição do Bem</th>
                                    <th className="p-4">Congregação / Local</th>
                                    <th className="p-4">Aquisição & Valor</th>
                                    <th className="p-4">Conservação</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Documentos</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                                {filteredAssets.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="p-4 font-black font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                            {item.code}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                    {getCategoryIcon(item.category)}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-900 dark:text-white block text-xs">
                                                        {item.title}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block font-medium">
                                                        {item.category} {item.invoiceNumber ? `• ${item.invoiceNumber}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-0.5">
                                                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                                                    {item.churchName}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                                                    {item.locationDetails || 'Local não informado'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            <span className="font-black text-slate-900 dark:text-white block text-xs">
                                                R$ {item.acquisitionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">
                                                {new Date(item.acquisitionDate).toLocaleDateString('pt-BR')}
                                            </span>
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            {getConditionBadge(item.condition)}
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            {getStatusBadge(item.status)}
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            <button
                                                onClick={() => setViewingAsset(item)}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                                            >
                                                <Paperclip className="w-3.5 h-3.5" />
                                                {item.documents?.length || 0} anexo(s)
                                            </button>
                                        </td>
                                        <td className="p-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => setViewingAsset(item)}
                                                    title="Ver Ficha / Pasta Completa"
                                                    className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEditModal(item)}
                                                    title="Editar Dados do Bem"
                                                    className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeletingAssetId(item.id)}
                                                    title="Excluir Registros"
                                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Grid view */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAssets.map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                                        {item.code}
                                    </span>
                                    {getStatusBadge(item.status)}
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        {getCategoryIcon(item.category)}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-extrabold text-slate-900 dark:text-white text-sm line-clamp-2">
                                            {item.title}
                                        </h3>
                                        <span className="text-[11px] text-slate-400 font-medium block">
                                            {item.category}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{item.churchName} ({item.locationDetails || 'Geral'})</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-slate-400 text-[11px]">Valor de Aquisição:</span>
                                        <span className="font-black text-slate-900 dark:text-white text-xs">
                                            R$ {item.acquisitionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => setViewingAsset(item)}
                                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <Eye className="w-3.5 h-3.5" /> Pasta do Bem ({item.documents?.length || 0})
                                </button>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleOpenEditModal(item)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeletingAssetId(item.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal / Panel: Create / Edit Asset */}
            {isModalOpen && (
                <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden rounded-3xl">
                    <form onSubmit={handleSaveAsset} className="flex flex-col h-full w-full overflow-hidden">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                            {editingAsset ? 'Editar Registro de Patrimônio' : 'Cadastrar Novo Bem Patrimonial'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                            Preencha as especificações técnicas, dados da nota fiscal, apólices e anexe os documentos
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Form Body - Scrollable */}
                        <div className="p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar text-xs">
                            
                            {/* Section 1: Identificação do Bem */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    1. Identificação Básica & Categoria
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Código de Tombamento / Tag *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formCode}
                                            onChange={(e) => setFormCode(e.target.value)}
                                            placeholder="Ex: PAT-2026-001"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none font-mono text-sm font-bold uppercase"
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Nome / Descrição do Bem *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formTitle}
                                            onChange={(e) => setFormTitle(e.target.value)}
                                            placeholder="Ex: Mesa de Som Digital Allen & Heath SQ-6..."
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Categoria do Patrimônio
                                        </label>
                                        <select
                                            value={formCategory}
                                            onChange={(e) => setFormCategory(e.target.value as any)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold cursor-pointer"
                                        >
                                            <option value="Imóvel">Imóvel / Terreno</option>
                                            <option value="Veículo">Veículo</option>
                                            <option value="Som & Imagem">Som & Imagem</option>
                                            <option value="Instrumento Musical">Instrumento Musical</option>
                                            <option value="Mobiliário">Mobiliário</option>
                                            <option value="Climatização & Energia">Climatização & Energia</option>
                                            <option value="Informática">Informática</option>
                                            <option value="Utensílios & Cozinha">Utensílios & Cozinha</option>
                                            <option value="Outro">Outro</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Congregação / Unidade
                                        </label>
                                        <input
                                            type="text"
                                            value={formChurchName}
                                            onChange={(e) => setFormChurchName(e.target.value)}
                                            placeholder="Ex: Sede Principal, Congregação Vale..."
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Localização Física Interna
                                        </label>
                                        <input
                                            type="text"
                                            value={formLocationDetails}
                                            onChange={(e) => setFormLocationDetails(e.target.value)}
                                            placeholder="Ex: Cabine de Som, Púlpito, Salão Infantil..."
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Dados Financeiros & Aquisição */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    2. Aquisição, Valor & Documentação
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Valor de Aquisição (R$)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formAcquisitionValue}
                                            onChange={(e) => setFormAcquisitionValue(e.target.value)}
                                            placeholder="0.00"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-black"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Data de Aquisição
                                        </label>
                                        <input
                                            type="date"
                                            value={formAcquisitionDate}
                                            onChange={(e) => setFormAcquisitionDate(e.target.value)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Nº da Nota Fiscal / Documento
                                        </label>
                                        <input
                                            type="text"
                                            value={formInvoiceNumber}
                                            onChange={(e) => setFormInvoiceNumber(e.target.value)}
                                            placeholder="Ex: NF-e 88412"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Fornecedor ou Doador
                                        </label>
                                        <input
                                            type="text"
                                            value={formSupplierOrDonor}
                                            onChange={(e) => setFormSupplierOrDonor(e.target.value)}
                                            placeholder="Ex: ProAudio Equipamentos"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Vencimento da Garantia (Se houver)
                                        </label>
                                        <input
                                            type="date"
                                            value={formWarrantyExpiration}
                                            onChange={(e) => setFormWarrantyExpiration(e.target.value)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Vencimento do Seguro / Apólice
                                        </label>
                                        <input
                                            type="date"
                                            value={formInsuranceExpiration}
                                            onChange={(e) => setFormInsuranceExpiration(e.target.value)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Conservação & Status */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    3. Situação & Estado de Conservação
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Estado de Conservação
                                        </label>
                                        <select
                                            value={formCondition}
                                            onChange={(e) => setFormCondition(e.target.value as any)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold cursor-pointer"
                                        >
                                            <option value="Excelente">Excelente (Sem marcas ou avarias)</option>
                                            <option value="Bom">Bom Estado (Funcionamento 100%)</option>
                                            <option value="Regular">Regular (Pequeno desgaste)</option>
                                            <option value="Danificado">Danificado (Necessita Reparo)</option>
                                            <option value="Inoperante">Inoperante (Fora de Uso)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Status Operacional
                                        </label>
                                        <select
                                            value={formStatus}
                                            onChange={(e) => setFormStatus(e.target.value as any)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold cursor-pointer"
                                        >
                                            <option value="Ativo">Ativo e Alocado</option>
                                            <option value="Em Manutenção">Em Manutenção / Assistência</option>
                                            <option value="Em Vistoria">Em Vistoria / Avaliação</option>
                                            <option value="Baixado/Doado">Baixado / Alienado</option>
                                            <option value="Empréstimo">Cedido em Empréstimo</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                        Observações / Histórico de Manutenção
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={formNotes}
                                        onChange={(e) => setFormNotes(e.target.value)}
                                        placeholder="Descreva detalhes específicos, numeração de série, revisões efetuadas ou particularidades do bem..."
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-medium"
                                    />
                                </div>
                            </div>

                            {/* Section 4: Anexos e Documentos */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                                    <span>4. Anexar Documentação Digital</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Notas fiscais, escrituras, fotos, manuais</span>
                                </h3>

                                <div className="bg-slate-50/70 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="sm:col-span-2 space-y-1">
                                            <input
                                                type="text"
                                                value={newDocTitle}
                                                onChange={(e) => setNewDocTitle(e.target.value)}
                                                placeholder="Título do documento (ex: Nota Fiscal Eletrônica)..."
                                                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-xs font-bold transition-all outline-none"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <select
                                                value={newDocType}
                                                onChange={(e) => setNewDocType(e.target.value as any)}
                                                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-xs font-bold transition-all outline-none cursor-pointer"
                                            >
                                                <option value="nota_fiscal">Nota Fiscal</option>
                                                <option value="escritura">Escritura / RGI</option>
                                                <option value="apolice">Apólice de Seguro</option>
                                                <option value="manual">Manual Técnico</option>
                                                <option value="contrato">Termo / Contrato</option>
                                                <option value="foto">Foto do Bem</option>
                                                <option value="outro">Outro Anexo</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 pt-1">
                                        <input
                                            type="file"
                                            id="file-upload-input"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setNewDocFile(e.target.files[0]);
                                                    if (!newDocTitle) {
                                                        setNewDocTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                                                    }
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor="file-upload-input"
                                            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer inline-flex items-center gap-2 transition-all"
                                        >
                                            <Upload className="w-3.5 h-3.5 text-slate-400" />
                                            {newDocFile ? newDocFile.name : 'Selecionar Arquivo'}
                                        </label>

                                        <button
                                            type="button"
                                            onClick={handleAddDocumentToForm}
                                            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Plus className="w-4 h-4" /> Anexar Documento
                                        </button>
                                    </div>
                                </div>

                                {/* Attached documents list */}
                                {formDocuments.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                            Documentos Anexados ({formDocuments.length}):
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {formDocuments.map((doc) => (
                                                <div key={doc.id} className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                                                        <div className="min-w-0">
                                                            <span className="font-bold text-slate-900 dark:text-white text-xs block truncate">
                                                                {doc.title}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 block uppercase">
                                                                {doc.type} • {doc.fileName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveDocFromForm(doc.id)}
                                                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-full shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-full shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                            >
                                {editingAsset ? 'Salvar Alterações' : 'Concluir Cadastro'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: View Asset Dossier / Ficha Técnica do Bem */}
            {viewingAsset && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-6 overflow-hidden">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 relative flex flex-col h-full max-h-[90vh] overflow-hidden">
                        
                        {/* Printable Section Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-900/80">
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
                                    {viewingAsset.code}
                                </span>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                        Pasta Técnica do Bem Patrimonial
                                    </h2>
                                    <span className="text-xs text-slate-500">
                                        Dossiê oficial de documentos, dados de aquisição e situação
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrintFicha}
                                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <Printer className="w-4 h-4" /> Imprimir Ficha
                                </button>
                                <button
                                    onClick={() => setViewingAsset(null)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Dossier Body */}
                        <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 text-xs custom-scrollbar">
                            
                            {/* Top Details Card */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                                            {viewingAsset.category}
                                        </span>
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                            {viewingAsset.title}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(viewingAsset.status)}
                                        {getConditionBadge(viewingAsset.condition)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                    <div>
                                        <span className="text-slate-400 block font-medium">Congregação / Alocação:</span>
                                        <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                                            {viewingAsset.churchName}
                                        </span>
                                        <span className="text-slate-500 block text-[11px]">
                                            {viewingAsset.locationDetails || 'Sem especificação interna'}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="text-slate-400 block font-medium">Valor Registrado:</span>
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm block mt-0.5">
                                            R$ {viewingAsset.acquisitionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-slate-500 block text-[11px]">
                                            Data: {new Date(viewingAsset.acquisitionDate).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="text-slate-400 block font-medium">Documento de Origem:</span>
                                        <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                                            {viewingAsset.invoiceNumber || 'Não especificado'}
                                        </span>
                                        <span className="text-slate-500 block text-[11px]">
                                            {viewingAsset.supplierOrDonor ? `Fornecedor: ${viewingAsset.supplierOrDonor}` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Warranties & Insurance Banner */}
                            {(viewingAsset.warrantyExpiration || viewingAsset.insuranceExpiration) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {viewingAsset.warrantyExpiration && (
                                        <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/50 flex items-center gap-3">
                                            <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0" />
                                            <div>
                                                <span className="font-extrabold text-purple-900 dark:text-purple-200 block">
                                                    Garantia do Fabricante / Loja
                                                </span>
                                                <span className="text-xs text-purple-700 dark:text-purple-300 block">
                                                    Válida até {new Date(viewingAsset.warrantyExpiration).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {viewingAsset.insuranceExpiration && (
                                        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex items-center gap-3">
                                            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                                            <div>
                                                <span className="font-extrabold text-blue-900 dark:text-blue-200 block">
                                                    Apólice de Seguro Ativa
                                                </span>
                                                <span className="text-xs text-blue-700 dark:text-blue-300 block">
                                                    Renovação necessária até {new Date(viewingAsset.insuranceExpiration).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Notes / History */}
                            {viewingAsset.notes && (
                                <div className="space-y-2">
                                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                                        Observações & Histórico do Bem
                                    </h4>
                                    <p className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                                        {viewingAsset.notes}
                                    </p>
                                </div>
                            )}

                            {/* Documents list */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Paperclip className="w-4 h-4 text-amber-500" />
                                        Documentos e Anexos Guardados ({viewingAsset.documents?.length || 0})
                                    </h4>

                                    <button
                                        onClick={() => {
                                            handleOpenEditModal(viewingAsset);
                                        }}
                                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Adicionar Anexo
                                    </button>
                                </div>

                                {!viewingAsset.documents || viewingAsset.documents.length === 0 ? (
                                    <div className="p-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center text-slate-400 text-xs">
                                        Nenhum documento anexado a este patrimônio ainda.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {viewingAsset.documents.map((doc) => (
                                            <div key={doc.id} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between hover:border-amber-500/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-slate-900 dark:text-white text-xs block truncate">
                                                            {doc.title}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 block uppercase font-medium">
                                                            {doc.type} • {doc.uploadedAt}
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        alert(`Visualizando documento: ${doc.title} (${doc.fileName})`);
                                                    }}
                                                    className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer shrink-0"
                                                    title="Visualizar / Baixar"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
                            <button
                                onClick={() => handleOpenEditModal(viewingAsset)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl transition-colors text-xs inline-flex items-center gap-2 cursor-pointer"
                            >
                                <Edit3 className="w-4 h-4" /> Editar Este Bem
                            </button>

                            <button
                                onClick={() => setViewingAsset(null)}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-md transition-all text-xs cursor-pointer"
                            >
                                Fechar Pasta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deletingAssetId && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">Excluir Registro do Patrimônio?</h3>
                            <p className="text-xs text-slate-500 mt-1">Esta ação removerá este item e todos os vínculos de documentos das pesquisas.</p>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => setDeletingAssetId(null)}
                                className="flex-1 px-5 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDeleteAsset(deletingAssetId)}
                                className="flex-1 px-5 py-2.5 text-[10px] font-black text-white bg-rose-600 hover:bg-rose-700 rounded-2xl shadow-md transition-all tracking-wider uppercase cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
