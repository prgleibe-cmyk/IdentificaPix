import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { ChurchFormData } from '../../types';
import { XMarkIcon } from '../Icons';
import { QrCode, Building2, User, Landmark, MapPin, Image as ImageIcon, CreditCard, Phone, Mail, FileText, MessageSquare } from 'lucide-react';
import { ChurchPortalShareModal } from '../admin/ChurchPortalShareModal';

export const EditChurchModal: React.FC = () => {
    const { editingChurch, updateChurch, closeEditChurch } = useContext(AppContext);
    const { t } = useTranslation();
    const [formData, setFormData] = useState<ChurchFormData>({
        name: '',
        address: '',
        pastor: '',
        treasurer: '',
        logoUrl: '',
        cnpj: '',
        phone: '',
        email: '',
        pixKey: '',
        cep: '',
        city: '',
        state: ''
    });
    const [showPortalShare, setShowPortalShare] = useState(false);
    const [contributors, setContributors] = useState<{ id: string; name: string }[]>([]);

    // Vínculo / Cargo States for Pastors & Treasurers
    const DEFAULT_PASTOR_ROLES = [
        'Pastor Presidente',
        'Pastor Auxiliar',
        'Pastor Vice-Presidente',
        'Pastor de Jovens',
        'Pastor de Casais',
        'Pastor de Missões',
        'Pastor de Ensino',
        'Pastor Jubilado',
        'Evangelista / Dirigente',
        'Dirigente de Congregação',
        'Bispo / Apóstolo',
        'Outro Cargo'
    ];

    const DEFAULT_TREASURER_ROLES = [
        '1º Tesoureiro',
        '2º Tesoureiro',
        '3º Tesoureiro',
        'Tesoureiro Geral',
        'Tesoureiro Auxiliar',
        'Diretor Financeiro',
        'Gerente Financeiro',
        'Contador / Fiscal',
        'Conselho Fiscal',
        'Outro Cargo'
    ];

    const [pastorRoles, setPastorRoles] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('iggestor_pastor_roles_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        return DEFAULT_PASTOR_ROLES;
    });

    const [treasurerRoles, setTreasurerRoles] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('iggestor_treasurer_roles_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        return DEFAULT_TREASURER_ROLES;
    });

    const [creatingPastorRoleIndex, setCreatingPastorRoleIndex] = useState<number | null>(null);
    const [newPastorRoleInput, setNewPastorRoleInput] = useState('');

    const [creatingTreasurerRoleIndex, setCreatingTreasurerRoleIndex] = useState<number | null>(null);
    const [newTreasurerRoleInput, setNewTreasurerRoleInput] = useState('');

    const handleAddCustomPastorRole = (index: number) => {
        const trimmed = newPastorRoleInput.trim();
        if (!trimmed) return;
        if (!pastorRoles.includes(trimmed)) {
            const updated = [...pastorRoles, trimmed];
            setPastorRoles(updated);
            try {
                localStorage.setItem('iggestor_pastor_roles_v1', JSON.stringify(updated));
            } catch (e) {}
        }
        handlePastorChange(index, 'title', trimmed);
        setNewPastorRoleInput('');
        setCreatingPastorRoleIndex(null);
    };

    const handleAddCustomTreasurerRole = (index: number) => {
        const trimmed = newTreasurerRoleInput.trim();
        if (!trimmed) return;
        if (!treasurerRoles.includes(trimmed)) {
            const updated = [...treasurerRoles, trimmed];
            setTreasurerRoles(updated);
            try {
                localStorage.setItem('iggestor_treasurer_roles_v1', JSON.stringify(updated));
            } catch (e) {}
        }
        handleTreasurerChange(index, 'title', trimmed);
        setNewTreasurerRoleInput('');
        setCreatingTreasurerRoleIndex(null);
    };

    useEffect(() => {
        // Carregar lista de cadastros de pessoas para autocomplete de Pastor e Tesoureiro
        fetch('/api/v1/contributors')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const list = data
                        .map((c: any) => ({
                            id: c.id,
                            name: c.canonical_name || c.name
                        }))
                        .filter(c => c.name);
                    setContributors(list);
                }
            })
            .catch(err => console.error('Erro ao carregar lista de membros para autocomplete:', err));
    }, []);

    useEffect(() => {
        if (editingChurch) {
            let pastorsList: any[] = [];
            if (Array.isArray(editingChurch.pastors) && editingChurch.pastors.length > 0) {
                pastorsList = editingChurch.pastors;
            } else if (editingChurch.pastor) {
                pastorsList = [{ name: editingChurch.pastor, title: 'Pastor Presidente' }];
            } else {
                pastorsList = [{ name: '', title: 'Pastor Presidente' }];
            }

            let treasurersList: any[] = [];
            if (Array.isArray(editingChurch.treasurers) && editingChurch.treasurers.length > 0) {
                treasurersList = editingChurch.treasurers;
            } else if (editingChurch.treasurer) {
                treasurersList = [{ name: editingChurch.treasurer, title: '1º Tesoureiro' }];
            } else {
                treasurersList = [{ name: '', title: '1º Tesoureiro' }];
            }

            setFormData({
                name: editingChurch.name || '',
                address: editingChurch.address || '',
                pastor: editingChurch.pastor || '',
                treasurer: editingChurch.treasurer || '',
                logoUrl: editingChurch.logoUrl || '',
                cnpj: editingChurch.cnpj || '',
                phone: editingChurch.phone || '',
                email: editingChurch.email || '',
                pixKey: editingChurch.pixKey || '',
                cep: editingChurch.cep || '',
                city: editingChurch.city || '',
                state: editingChurch.state || '',
                whatsapp_official: editingChurch.whatsapp_official || editingChurch.phone || '',
                whatsapp_responsible: editingChurch.whatsapp_responsible || 'tesouraria',
                auto_comm_enabled: editingChurch.auto_comm_enabled !== undefined ? editingChurch.auto_comm_enabled : true,
                auto_send_on_confirmation: editingChurch.auto_send_on_confirmation !== undefined ? editingChurch.auto_send_on_confirmation : true,
                pastors: pastorsList,
                treasurers: treasurersList
            });
        }
    }, [editingChurch]);

    if (!editingChurch) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPastor = () => {
        setFormData(prev => {
            const current = prev.pastors || [];
            const nextTitle = current.length === 0 ? 'Pastor Presidente' : 'Pastor Auxiliar';
            return {
                ...prev,
                pastors: [...current, { name: '', title: nextTitle }]
            };
        });
    };

    const handleRemovePastor = (index: number) => {
        setFormData(prev => {
            const current = prev.pastors || [];
            const updated = current.filter((_, i) => i !== index);
            const finalPastors = updated.length > 0 ? updated : [{ name: '', title: 'Pastor Presidente' }];
            const primaryPastor = finalPastors.find(p => p.name.trim())?.name || '';
            return {
                ...prev,
                pastors: finalPastors,
                pastor: primaryPastor
            };
        });
    };

    const handlePastorChange = (index: number, field: 'name' | 'title', value: string) => {
        setFormData(prev => {
            const current = [...(prev.pastors || [])];
            if (!current[index]) {
                current[index] = { name: '', title: '' };
            }
            current[index] = { ...current[index], [field]: value };
            const primaryPastor = current.find(p => p.name.trim())?.name || '';
            return {
                ...prev,
                pastors: current,
                pastor: primaryPastor
            };
        });
    };

    const handleAddTreasurer = () => {
        setFormData(prev => {
            const current = prev.treasurers || [];
            const nextTitle = current.length === 0 ? '1º Tesoureiro' : `${current.length + 1}º Tesoureiro`;
            return {
                ...prev,
                treasurers: [...current, { name: '', title: nextTitle }]
            };
        });
    };

    const handleRemoveTreasurer = (index: number) => {
        setFormData(prev => {
            const current = prev.treasurers || [];
            const updated = current.filter((_, i) => i !== index);
            const finalTreasurers = updated.length > 0 ? updated : [{ name: '', title: '1º Tesoureiro' }];
            const primaryTreasurer = finalTreasurers.find(t => t.name.trim())?.name || '';
            return {
                ...prev,
                treasurers: finalTreasurers,
                treasurer: primaryTreasurer
            };
        });
    };

    const handleTreasurerChange = (index: number, field: 'name' | 'title', value: string) => {
        setFormData(prev => {
            const current = [...(prev.treasurers || [])];
            if (!current[index]) {
                current[index] = { name: '', title: '' };
            }
            current[index] = { ...current[index], [field]: value };
            const primaryTreasurer = current.find(t => t.name.trim())?.name || '';
            return {
                ...prev,
                treasurers: current,
                treasurer: primaryTreasurer
            };
        });
    };

    const handleLogoUpload = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setFormData(d => ({ ...d, logoUrl: result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateChurch(editingChurch.id, formData);
    };

    return (
        <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col h-full w-full">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    {t('modal.editChurch')}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Ficha Financeira e Institucional da Congregação
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button type="button" onClick={closeEditChurch} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 flex-1 overflow-y-auto w-full">
                    <div className="space-y-6 w-full max-w-5xl mx-auto">
                        
                        {/* Section: PORTAL DO CONTRIBUINTE */}
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 dark:border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">
                                    PORTAL DO CONTRIBUINTE
                                </span>
                                <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                                    Divulgação e QR Code Oficial da Congregação
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Gere o QR Code exclusivo da congregação e compartilhe o link direto para os contribuintes.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowPortalShare(true)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex-shrink-0 cursor-pointer"
                            >
                                <QrCode className="w-4 h-4" />
                                <span>Divulgar Portal</span>
                            </button>
                        </div>

                        {/* Bloco 1: Dados Gerais e Financeiros */}
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                                <Landmark className="w-4 h-4 text-orange-500" />
                                1. Identificação e Dados Financeiros
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2 lg:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Nome da Igreja / Congregação <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                            placeholder="Ex: Igreja Evangélica Central"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        CNPJ da Igreja
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="cnpj"
                                            value={formData.cnpj}
                                            onChange={handleChange}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                            placeholder="00.000.000/0001-00"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Telefone / WhatsApp
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                            placeholder="(11) 99999-9999"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        E-mail Oficial
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                            placeholder="contato@igreja.org"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Chave Pix Principal (Ofertas/Dízimos)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="pixKey"
                                            value={formData.pixKey}
                                            onChange={handleChange}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                            placeholder="CNPJ, E-mail, Telefone ou Aleatória"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bloco 2: Liderança Responsável (Pastores & Tesouraria) */}
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3 gap-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <User className="w-4 h-4 text-amber-500" />
                                    2. Responsáveis (Pastor & Tesouraria)
                                </h4>
                                <span className="text-[10px] text-slate-400 font-semibold">
                                    Cadastre múltiplos pastores e tesoureiros com títulos/funções personalizadas
                                </span>
                            </div>

                            {/* Datalist Reutilizável para Autocomplete */}
                            <datalist id="contributors-autocomplete-list">
                                {contributors.map(c => (
                                    <option key={c.id} value={c.name} />
                                ))}
                            </datalist>

                            {/* Sub-bloco: Pastores e Dirigentes */}
                            <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <span>Pastores & Dirigentes</span>
                                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                            {(formData.pastors || []).length}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddPastor}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                                    >
                                        + Adicionar Pastor
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {(formData.pastors || []).map((pastorItem, index) => (
                                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                                <div className="sm:col-span-4 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                            Cargo / Vínculo
                                                        </label>
                                                        {creatingPastorRoleIndex !== index && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCreatingPastorRoleIndex(index);
                                                                    setNewPastorRoleInput('');
                                                                }}
                                                                className="text-[9px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                                            >
                                                                + Criar
                                                            </button>
                                                        )}
                                                    </div>

                                                    {creatingPastorRoleIndex === index ? (
                                                        <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                                                            <input 
                                                                type="text"
                                                                value={newPastorRoleInput}
                                                                onChange={(e) => setNewPastorRoleInput(e.target.value)}
                                                                placeholder="Ex: Pastor de Jovens"
                                                                className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs p-1.5 rounded-lg border border-amber-300 dark:border-amber-700 outline-none font-bold"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleAddCustomPastorRole(index);
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAddCustomPastorRole(index)}
                                                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                                            >
                                                                OK
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setCreatingPastorRoleIndex(null); setNewPastorRoleInput(''); }}
                                                                className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-[10px] font-bold cursor-pointer"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={pastorItem.title || ''}
                                                            onChange={(e) => {
                                                                if (e.target.value === '__NEW__') {
                                                                    setCreatingPastorRoleIndex(index);
                                                                    setNewPastorRoleInput('');
                                                                } else {
                                                                    handlePastorChange(index, 'title', e.target.value);
                                                                }
                                                            }}
                                                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20"
                                                        >
                                                            <option value="">Selecione o cargo...</option>
                                                            {pastorItem.title && !pastorRoles.includes(pastorItem.title) && (
                                                                <option value={pastorItem.title}>{pastorItem.title}</option>
                                                            )}
                                                            {pastorRoles.map((role) => (
                                                                <option key={role} value={role}>{role}</option>
                                                            ))}
                                                            <option value="__NEW__">+ Criar Novo Cargo...</option>
                                                        </select>
                                                    )}
                                                </div>

                                                <div className="sm:col-span-7 space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                        Nome do Pastor
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="contributors-autocomplete-list"
                                                        value={pastorItem.name || ''}
                                                        onChange={(e) => handlePastorChange(index, 'name', e.target.value)}
                                                        placeholder="Digite ou escolha na lista..."
                                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20"
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 flex items-end justify-center pt-2 sm:pt-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePastor(index)}
                                                        title="Remover Pastor"
                                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick suggestion tags */}
                                            <div className="flex flex-wrap items-center gap-1 pt-1">
                                                <span className="text-[9px] text-slate-400 font-bold mr-1">Exemplos:</span>
                                                {['Pastor Presidente', 'Pastor Auxiliar', 'Pastor de Jovens', 'Dirigente de Congregação'].map((suggestion) => (
                                                    <button
                                                        key={suggestion}
                                                        type="button"
                                                        onClick={() => handlePastorChange(index, 'title', suggestion)}
                                                        className="text-[9px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200/60 dark:border-amber-800/60 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sub-bloco: Tesoureiros e Equipe Financeira */}
                            <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <span>Tesoureiros e Equipe Financeira</span>
                                        <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                            {(formData.treasurers || []).length}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddTreasurer}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                                    >
                                        + Adicionar Tesoureiro
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {(formData.treasurers || []).map((treasurerItem, index) => (
                                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                                <div className="sm:col-span-4 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                            Cargo / Vínculo
                                                        </label>
                                                        {creatingTreasurerRoleIndex !== index && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCreatingTreasurerRoleIndex(index);
                                                                    setNewTreasurerRoleInput('');
                                                                }}
                                                                className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                                            >
                                                                + Criar
                                                            </button>
                                                        )}
                                                    </div>

                                                    {creatingTreasurerRoleIndex === index ? (
                                                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                                                            <input 
                                                                type="text"
                                                                value={newTreasurerRoleInput}
                                                                onChange={(e) => setNewTreasurerRoleInput(e.target.value)}
                                                                placeholder="Ex: 1º Tesoureiro"
                                                                className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 outline-none font-bold"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleAddCustomTreasurerRole(index);
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAddCustomTreasurerRole(index)}
                                                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                                            >
                                                                OK
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setCreatingTreasurerRoleIndex(null); setNewTreasurerRoleInput(''); }}
                                                                className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-[10px] font-bold cursor-pointer"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={treasurerItem.title || ''}
                                                            onChange={(e) => {
                                                                if (e.target.value === '__NEW__') {
                                                                    setCreatingTreasurerRoleIndex(index);
                                                                    setNewTreasurerRoleInput('');
                                                                } else {
                                                                    handleTreasurerChange(index, 'title', e.target.value);
                                                                }
                                                            }}
                                                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                        >
                                                            <option value="">Selecione o cargo...</option>
                                                            {treasurerItem.title && !treasurerRoles.includes(treasurerItem.title) && (
                                                                <option value={treasurerItem.title}>{treasurerItem.title}</option>
                                                            )}
                                                            {treasurerRoles.map((role) => (
                                                                <option key={role} value={role}>{role}</option>
                                                            ))}
                                                            <option value="__NEW__">+ Criar Novo Cargo...</option>
                                                        </select>
                                                    )}
                                                </div>

                                                <div className="sm:col-span-7 space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                        Nome do Tesoureiro
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="contributors-autocomplete-list"
                                                        value={treasurerItem.name || ''}
                                                        onChange={(e) => handleTreasurerChange(index, 'name', e.target.value)}
                                                        placeholder="Digite ou escolha na lista..."
                                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 flex items-end justify-center pt-2 sm:pt-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTreasurer(index)}
                                                        title="Remover Tesoureiro"
                                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick suggestion tags */}
                                            <div className="flex flex-wrap items-center gap-1 pt-1">
                                                <span className="text-[9px] text-slate-400 font-bold mr-1">Exemplos:</span>
                                                {['1º Tesoureiro', '2º Tesoureiro', 'Tesoureiro Geral', 'Tesoureiro Auxiliar'].map((suggestion) => (
                                                    <button
                                                        key={suggestion}
                                                        type="button"
                                                        onClick={() => handleTreasurerChange(index, 'title', suggestion)}
                                                        className="text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Bloco 3: Endereço da Igreja */}
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                3. Endereço da Sede / Congregação
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        CEP
                                    </label>
                                    <input
                                        type="text"
                                        name="cep"
                                        value={formData.cep}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="00000-000"
                                    />
                                </div>

                                <div className="space-y-2 lg:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Endereço / Logradouro
                                    </label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="Ex: Av. Principal, 123"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Cidade / UF
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleChange}
                                            className="col-span-2 block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-3 text-xs font-bold transition-all outline-none"
                                            placeholder="Cidade"
                                        />
                                        <input
                                            type="text"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            maxLength={2}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-2 text-xs font-bold uppercase transition-all outline-none text-center"
                                            placeholder="UF"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bloco 4: Logo Oficial */}
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                                <ImageIcon className="w-4 h-4 text-emerald-500" />
                                4. Identidade Visual (Logo / Brasão)
                            </h4>

                            <div className="flex items-center space-x-5 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                                <img 
                                    src={formData.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} 
                                    alt="Pré-visualização" 
                                    className="w-16 h-16 rounded-2xl object-cover bg-slate-50 shadow-sm border border-slate-100 dark:border-slate-800" 
                                />
                                <div className="space-y-1">
                                    <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl px-4 py-2 text-xs font-bold inline-block shadow-sm uppercase tracking-wide transition-colors">
                                        <span>Alterar Logo</span>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    handleLogoUpload(e.target.files[0]);
                                                }
                                            }}
                                            className="hidden"
                                        />
                                    </label>
                                    <p className="text-[10px] text-slate-400">
                                        A imagem será exibida nos relatórios financeiros e no Portal do Contribuinte.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Bloco 5: Central de Comunicação (WhatsApp Oficial & Preferências) */}
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                                <MessageSquare className="w-4 h-4 text-emerald-500" />
                                5. Central de Comunicação (WhatsApp Oficial)
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        WhatsApp Oficial da Igreja
                                    </label>
                                    <input
                                        type="text"
                                        name="whatsapp_official"
                                        value={formData.whatsapp_official || ''}
                                        onChange={handleChange}
                                        placeholder="(11) 99999-9999"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-3 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                    <p className="text-[10px] text-slate-400">Número oficial para emissão automática de notificações no WhatsApp.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Responsável pelo WhatsApp
                                    </label>
                                    <select
                                        name="whatsapp_responsible"
                                        value={formData.whatsapp_responsible || 'tesouraria'}
                                        onChange={(e) => setFormData(p => ({ ...p, whatsapp_responsible: e.target.value }))}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-3 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                                    >
                                        <option value="tesouraria">Tesouraria Principal</option>
                                        <option value="pastor">Pastor Responsável</option>
                                        <option value="secretaria">Secretaria Geral</option>
                                        <option value="outro">Outro Responsável</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <label className="flex items-center space-x-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.auto_comm_enabled !== false}
                                            onChange={(e) => setFormData(p => ({ ...p, auto_comm_enabled: e.target.checked }))}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Comunicação Automática Ativa</span>
                                            <span className="text-[10px] text-slate-400">Habilita disparos de mensagens automáticas no sistema</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center space-x-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.auto_send_on_confirmation !== false}
                                            onChange={(e) => setFormData(p => ({ ...p, auto_send_on_confirmation: e.target.checked }))}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Envio em ContributionConfirmed</span>
                                            <span className="text-[10px] text-slate-400">Disparar recibo no momento de confirmação da contribuição</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                    <button type="button" onClick={closeEditChurch} className="px-6 py-3 rounded-full text-xs font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wide cursor-pointer">{t('common.cancel')}</button>
                    <button type="submit" className="px-8 py-3 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 transition-all uppercase tracking-wide cursor-pointer">{t('common.save')}</button>
                </div>
            </form>

            {/* Portal Share Modal */}
            {showPortalShare && editingChurch && (
                <ChurchPortalShareModal
                    church={editingChurch}
                    onClose={() => setShowPortalShare(false)}
                />
            )}
        </div>
    );
};
