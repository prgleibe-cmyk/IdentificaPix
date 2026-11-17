import React, { useState, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { ChurchFormData } from '../../types';
import { XMarkIcon } from '../Icons';
import { QrCode, Building2, User, Landmark, MapPin, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { ChurchPortalShareModal } from '../admin/ChurchPortalShareModal';
import { InlineRoleSelector } from '../register/InlineRoleSelector';
import { getAuthToken } from '../../services/auth/authAdapter';

export const EditChurchModal: React.FC = () => {
    const {
        editingChurch,
        updateChurch,
        closeEditChurch,
        pastorRoles = ['Pastor Presidente', 'Pastor Auxiliar'],
        treasurerRoles = ['1º Tesoureiro', '2º Tesoureiro'],
        addTenantOption,
        renameTenantOption,
        deleteTenantOption
    } = useContext(AppContext);
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
    const [isSaving, setIsSaving] = useState(false);

    const [creatingPastorRoleIndex, setCreatingPastorRoleIndex] = useState<number | null>(null);
    const [newPastorRoleInput, setNewPastorRoleInput] = useState('');

    const [creatingTreasurerRoleIndex, setCreatingTreasurerRoleIndex] = useState<number | null>(null);
    const [newTreasurerRoleInput, setNewTreasurerRoleInput] = useState('');

    const [managingPastorRoles, setManagingPastorRoles] = useState(false);
    const [managingTreasurerRoles, setManagingTreasurerRoles] = useState(false);

    const handleAddPastorRole = async (role: string) => {
        const trimmed = role.trim();
        if (!trimmed) return;
        if (addTenantOption) {
            await addTenantOption('pastor_role', trimmed);
        }
    };

    const handleRenamePastorRole = async (oldRole: string, newRole: string) => {
        const trimmed = newRole.trim();
        if (!trimmed || trimmed === oldRole) return;
        const ok = renameTenantOption ? await renameTenantOption('pastor_role', oldRole, trimmed) : true;
        if (ok) {
            setFormData(prev => ({
                ...prev,
                pastors: (prev.pastors || []).map(p => p.title === oldRole ? { ...p, title: trimmed } : p)
            }));
        }
    };

    const handleDeletePastorRole = async (roleToDelete: string) => {
        const ok = deleteTenantOption ? await deleteTenantOption('pastor_role', roleToDelete) : true;
        if (ok) {
            const remaining = pastorRoles.filter((r: string) => r !== roleToDelete);
            const fallback = remaining[0] || '';
            setFormData(prev => ({
                ...prev,
                pastors: (prev.pastors || []).map(p => p.title === roleToDelete ? { ...p, title: fallback } : p)
            }));
        }
    };

    const handleAddTreasurerRole = async (role: string) => {
        const trimmed = role.trim();
        if (!trimmed) return;
        if (addTenantOption) {
            await addTenantOption('treasurer_role', trimmed);
        }
    };

    const handleRenameTreasurerRole = async (oldRole: string, newRole: string) => {
        const trimmed = newRole.trim();
        if (!trimmed || trimmed === oldRole) return;
        const ok = renameTenantOption ? await renameTenantOption('treasurer_role', oldRole, trimmed) : true;
        if (ok) {
            setFormData(prev => ({
                ...prev,
                treasurers: (prev.treasurers || []).map(t => t.title === oldRole ? { ...t, title: trimmed } : t)
            }));
        }
    };

    const handleDeleteTreasurerRole = async (roleToDelete: string) => {
        const ok = deleteTenantOption ? await deleteTenantOption('treasurer_role', roleToDelete) : true;
        if (ok) {
            const remaining = treasurerRoles.filter((r: string) => r !== roleToDelete);
            const fallback = remaining[0] || '';
            setFormData(prev => ({
                ...prev,
                treasurers: (prev.treasurers || []).map(t => t.title === roleToDelete ? { ...t, title: fallback } : t)
            }));
        }
    };

    const handleAddCustomPastorRole = (index: number) => {
        const trimmed = newPastorRoleInput.trim();
        if (!trimmed) return;
        handleAddPastorRole(trimmed);
        handlePastorChange(index, 'title', trimmed);
        setNewPastorRoleInput('');
        setCreatingPastorRoleIndex(null);
    };

    const handleAddCustomTreasurerRole = (index: number) => {
        const trimmed = newTreasurerRoleInput.trim();
        if (!trimmed) return;
        handleAddTreasurerRole(trimmed);
        handleTreasurerChange(index, 'title', trimmed);
        setNewTreasurerRoleInput('');
        setCreatingTreasurerRoleIndex(null);
    };

    useEffect(() => {
        // Carregar lista de cadastros de pessoas para autocomplete de Pastor e Tesoureiro
        let mounted = true;
        getAuthToken()
            .then(token => fetch('/api/v1/contributors', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            }))
            .then(res => (res.ok ? res.json() : []))
            .then(data => {
                if (mounted && Array.isArray(data)) {
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
        return () => { mounted = false; };
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

    useEffect(() => {
        if (!editingChurch || showPortalShare) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeEditChurch();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [editingChurch, showPortalShare, closeEditChurch]);

    if (!editingChurch || typeof document === 'undefined') return null;

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        try {
            await updateChurch(editingChurch.id, formData);
        } catch (_) {
            // Erro já notificado via toast pelo updateChurch; mantém modal aberto
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div
            data-register-overlay="true"
            className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={(e) => {
                e.stopPropagation();
                if (!showPortalShare) closeEditChurch();
            }}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                {t('modal.editChurch')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                Ficha financeira e institucional da congregação.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeEditChurch}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                        aria-label="Fechar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full">
                    <div className="space-y-4 w-full max-w-full">

                        {/* Section: PORTAL DO CONTRIBUINTE */}
                        <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                                    Portal do Contribuinte
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                    Divulgação e QR Code oficial da congregação
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Gere o QR Code exclusivo da congregação e compartilhe o link direto para os contribuintes.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowPortalShare(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-all flex-shrink-0 cursor-pointer"
                            >
                                <QrCode className="w-4 h-4" />
                                <span>Divulgar Portal</span>
                            </button>
                        </div>

                        {/* Bloco 1: Dados Gerais e Financeiros */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3.5">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-2.5">
                                <Landmark className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                1. Identificação e Dados Financeiros
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                <div className="space-y-1 lg:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Nome da Igreja / Congregação <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="Ex: Igreja Evangélica Central"
                                        required
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        CNPJ da Igreja
                                    </label>
                                    <input
                                        type="text"
                                        name="cnpj"
                                        value={formData.cnpj}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="00.000.000/0001-00"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Telefone / WhatsApp
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>

                                <div className="space-y-1 lg:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        E-mail Oficial
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="contato@igreja.org"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bloco 2: Liderança Responsável (Pastores & Tesouraria) */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2.5 gap-1">
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <User className="w-4 h-4 text-amber-500" />
                                    2. Responsáveis (Pastor e Tesouraria)
                                </h4>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Cadastre múltiplos pastores e tesoureiros com funções personalizadas
                                </span>
                            </div>

                            {/* Datalist Reutilizável para Autocomplete */}
                            <datalist id="contributors-autocomplete-list">
                                {contributors.map(c => (
                                    <option key={c.id} value={c.name} />
                                ))}
                            </datalist>

                            {/* Sub-bloco: Pastores e Dirigentes */}
                            <div className="space-y-3 bg-white dark:bg-slate-900/70 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                        <span>Pastores e Dirigentes</span>
                                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-semibold">
                                            {(formData.pastors || []).length}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddPastor}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                                    >
                                        + Adicionar Pastor
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {(formData.pastors || []).map((pastorItem, index) => (
                                        <div key={index} className="p-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                                                <div className="sm:col-span-5 space-y-1">
                                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                        Cargo / Vínculo
                                                    </label>
                                                    <InlineRoleSelector
                                                        value={pastorItem.title || ''}
                                                        onChange={(newVal) => handlePastorChange(index, 'title', newVal)}
                                                        roles={pastorRoles}
                                                        onAddRole={handleAddPastorRole}
                                                        onRenameRole={handleRenamePastorRole}
                                                        onDeleteRole={handleDeletePastorRole}
                                                        themeColor="amber"
                                                    />
                                                </div>

                                                <div className="sm:col-span-6 space-y-1">
                                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                        Nome do Pastor
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="contributors-autocomplete-list"
                                                        value={pastorItem.name || ''}
                                                        onChange={(e) => handlePastorChange(index, 'name', e.target.value)}
                                                        placeholder="Digite ou escolha na lista..."
                                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 flex items-center justify-center sm:pt-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePastor(index)}
                                                        title="Remover Pastor"
                                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sub-bloco: Tesoureiros e Equipe Financeira */}
                            <div className="space-y-3 bg-white dark:bg-slate-900/70 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                        <span>Tesoureiros e Equipe Financeira</span>
                                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-semibold">
                                            {(formData.treasurers || []).length}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddTreasurer}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                                    >
                                        + Adicionar Tesoureiro
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {(formData.treasurers || []).map((treasurerItem, index) => (
                                        <div key={index} className="p-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                                                <div className="sm:col-span-5 space-y-1">
                                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                        Cargo / Vínculo
                                                    </label>
                                                    <InlineRoleSelector
                                                        value={treasurerItem.title || ''}
                                                        onChange={(newVal) => handleTreasurerChange(index, 'title', newVal)}
                                                        roles={treasurerRoles}
                                                        onAddRole={handleAddTreasurerRole}
                                                        onRenameRole={handleRenameTreasurerRole}
                                                        onDeleteRole={handleDeleteTreasurerRole}
                                                        themeColor="emerald"
                                                    />
                                                </div>

                                                <div className="sm:col-span-6 space-y-1">
                                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                        Nome do Tesoureiro
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="contributors-autocomplete-list"
                                                        value={treasurerItem.name || ''}
                                                        onChange={(e) => handleTreasurerChange(index, 'name', e.target.value)}
                                                        placeholder="Digite ou escolha na lista..."
                                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 flex items-center justify-center sm:pt-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTreasurer(index)}
                                                        title="Remover Tesoureiro"
                                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Bloco 3: Endereço da Igreja */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3.5">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-2.5">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                3. Endereço da Sede / Congregação
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        CEP
                                    </label>
                                    <input
                                        type="text"
                                        name="cep"
                                        value={formData.cep}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="00000-000"
                                    />
                                </div>

                                <div className="space-y-1 lg:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Endereço / Logradouro
                                    </label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="Ex: Av. Principal, 123"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Cidade / UF
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleChange}
                                            className="col-span-2 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                            placeholder="Cidade"
                                        />
                                        <input
                                            type="text"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            maxLength={2}
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-2 text-xs font-semibold uppercase transition-all outline-none text-center"
                                            placeholder="UF"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bloco 4: Logo Oficial */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-2.5">
                                <ImageIcon className="w-4 h-4 text-emerald-500" />
                                4. Identidade Visual (Logo / Brasão)
                            </h4>

                            <div className="flex items-center gap-4 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700">
                                <img
                                    src={formData.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'}
                                    alt="Pré-visualização"
                                    className="w-14 h-14 rounded-xl object-cover bg-slate-50 shadow-xs border border-slate-200/70 dark:border-slate-800 shrink-0"
                                />
                                <div className="space-y-1">
                                    <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold inline-block shadow-xs transition-colors">
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
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        A imagem será exibida nos relatórios financeiros e no Portal do Contribuinte.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Bloco 5: Central de Comunicação (WhatsApp Oficial & Preferências) */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3.5">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-2.5">
                                <MessageSquare className="w-4 h-4 text-emerald-500" />
                                5. Central de Comunicação (WhatsApp Oficial)
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        WhatsApp Oficial da Igreja
                                    </label>
                                    <input
                                        type="text"
                                        name="whatsapp_official"
                                        value={formData.whatsapp_official || ''}
                                        onChange={handleChange}
                                        placeholder="(11) 99999-9999"
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium outline-none"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Número oficial para emissão automática de notificações no WhatsApp.</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Responsável pelo WhatsApp
                                    </label>
                                    <select
                                        name="whatsapp_responsible"
                                        value={formData.whatsapp_responsible || 'tesouraria'}
                                        onChange={(e) => setFormData(p => ({ ...p, whatsapp_responsible: e.target.value }))}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium outline-none cursor-pointer"
                                    >
                                        <option value="tesouraria">Tesouraria Principal</option>
                                        <option value="pastor">Pastor Responsável</option>
                                        <option value="secretaria">Secretaria Geral</option>
                                        <option value="outro">Outro Responsável</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <label className="flex items-center space-x-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.auto_comm_enabled !== false}
                                            onChange={(e) => setFormData(p => ({ ...p, auto_comm_enabled: e.target.checked }))}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <div>
                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Comunicação Automática Ativa</span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">Habilita disparos de mensagens automáticas no sistema</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center space-x-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.auto_send_on_confirmation !== false}
                                            onChange={(e) => setFormData(p => ({ ...p, auto_send_on_confirmation: e.target.checked }))}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <div>
                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Envio em ContributionConfirmed</span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">Disparar recibo no momento de confirmação da contribuição</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <button
                        type="button"
                        onClick={closeEditChurch}
                        disabled={isSaving}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={!formData.name.trim() || isSaving}
                        className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                        {isSaving ? 'Salvando...' : t('common.save')}
                    </button>
                </div>
            </form>

            {/* Portal Share Modal */}
            {showPortalShare && editingChurch && (
                <ChurchPortalShareModal
                    church={editingChurch}
                    onClose={() => setShowPortalShare(false)}
                />
            )}
        </div>,
        document.body
    );
};
