import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, QrCodeIcon } from '../Icons';
import { ChurchFormData } from '../../types';
import { BANK_CATALOG } from '../../constants/bankCatalog';
import { Building2, Landmark, User, MapPin, Image as ImageIcon } from 'lucide-react';
import { InlineRoleSelector } from './InlineRoleSelector';

export const BankModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addBank, banks } = useContext(AppContext);
    const { t } = useTranslation();
    const [accountName, setAccountName] = useState('');
    const [selectedBankKey, setSelectedBankKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pix Key Section States
    const [enablePix, setEnablePix] = useState(false);
    const [pixType, setPixType] = useState<'cpf' | 'cnpj' | 'phone' | 'email' | 'random'>('cpf');
    const [pixKey, setPixKey] = useState('');
    const [holderName, setHolderName] = useState('');
    const [description, setDescription] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isDuplicate = !!(selectedBankKey && accountName.trim() && banks && banks.some((b: any) => {
        const bKey = b.bank_key || null;
        const bAccName = (b.account_name || b.name || '').trim().toLowerCase();
        return bKey === selectedBankKey && bAccName === accountName.trim().toLowerCase();
    }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        
        if (!selectedBankKey || !accountName.trim() || isDuplicate) return;

        if (enablePix && !pixKey.trim()) {
            setErrorMessage('Por favor, preencha a Chave Pix.');
            return;
        }
        
        setIsSubmitting(true);
        try {
            const newBank = await addBank({
                bank_key: selectedBankKey,
                name: accountName.trim(), // compatibilidade visual
                account_name: accountName.trim()
            });

            if (newBank) {
                const createdBankId = typeof newBank === 'object' && newBank ? newBank.id : null;
                if (enablePix && createdBankId) {
                    const postRes = await fetch('/api/v1/church-pix-keys', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            bank_id: createdBankId,
                            church_id: null,
                            pix_type: pixType,
                            pix_key: pixKey.trim(),
                            holder_name: holderName.trim() || null,
                            description: description.trim() || null
                        })
                    });
                    if (!postRes.ok) {
                        const errJson = await postRes.json().catch(() => ({}));
                        throw new Error(errJson.message || 'Banco criado, mas ocorreu um erro ao salvar a Chave Pix.');
                    }
                }
                setAccountName('');
                setSelectedBankKey('');
                onCancel();
            }
        } catch (error: any) {
            console.error("Erro ao adicionar banco:", error);
            setErrorMessage(error.message || "Erro ao adicionar banco.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden" id="bank-modal-container">
            <form onSubmit={handleSubmit} className="flex flex-col h-full w-full" id="bank-modal-form">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
                    <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-brand-blue text-white shadow-lg shadow-blue-500/20 flex items-center justify-center">
                                <Landmark className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase" id="bank-modal-title">
                                    Cadastro de Conta Bancária
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Preencha os dados da instituição e chaves de recebimento
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer" id="btn-close-bank-modal">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 flex-1 overflow-y-auto w-full space-y-6">
                    {errorMessage && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold animate-fade-in">
                            {errorMessage}
                        </div>
                    )}

                    {/* Seção: Instituição & Identificação da Conta */}
                    <div className="p-6 bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-brand-blue" />
                            <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                                Instituição Financeira & Identificação da Conta
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label htmlFor="bank-key" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1" id="lbl-bank-key">
                                    Instituição Financeira / Banco
                                </label>
                                <select 
                                    id="bank-key" 
                                    value={selectedBankKey} 
                                    onChange={(e) => setSelectedBankKey(e.target.value)} 
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-brand-blue/10 py-3.5 px-4 transition-all outline-none text-xs font-bold cursor-pointer"
                                    disabled={isSubmitting}
                                    required
                                >
                                    <option value="">Selecione a instituição bancária...</option>
                                    {BANK_CATALOG.filter(b => b.active).map(b => (
                                        <option key={b.key} value={b.key}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="account-name" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1" id="lbl-account-name">
                                    Nome / Identificação da Conta
                                </label>
                                <input 
                                    type="text" 
                                    id="account-name" 
                                    value={accountName} 
                                    onChange={(e) => setAccountName(e.target.value)} 
                                    className={`block w-full rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 py-3.5 px-4 outline-none transition-all text-xs font-bold ${isDuplicate ? 'border border-rose-500 focus:ring-rose-500/10' : 'border border-slate-200 dark:border-slate-700 focus:ring-brand-blue/10'}`} 
                                    placeholder="Ex: Conta Principal, Dízimos, Ofertas..." 
                                    required 
                                    disabled={isSubmitting}
                                />
                                {isDuplicate && (
                                    <p className="text-rose-500 text-xs font-semibold mt-1 ml-1 animate-fade-in" id="dup-warning">
                                        Já existe uma conta cadastrada com esse nome neste banco.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Seção: Recebimento via Pix */}
                    <div className="bg-slate-50/70 dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <QrCodeIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                        Recebimento via Pix (Portal do Contribuinte)
                                    </h4>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        Ative e configure a chave Pix associada a esta conta para exibição no Portal.
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={enablePix}
                                    onChange={e => setEnablePix(e.target.checked)}
                                    className="sr-only peer"
                                    disabled={isSubmitting}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        {enablePix && (
                            <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-slate-800 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1.5 ml-1">
                                            Tipo da Chave
                                        </label>
                                        <select
                                            value={pixType}
                                            onChange={e => setPixType(e.target.value as any)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-brand-blue/10 py-3 px-4 text-xs font-bold outline-none cursor-pointer"
                                            disabled={isSubmitting}
                                        >
                                            <option value="cpf">CPF</option>
                                            <option value="cnpj">CNPJ</option>
                                            <option value="phone">Telefone</option>
                                            <option value="email">E-mail</option>
                                            <option value="random">Chave Aleatória (EVP)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1.5 ml-1">
                                            Chave Pix
                                        </label>
                                        <input
                                            type="text"
                                            value={pixKey}
                                            onChange={e => setPixKey(e.target.value)}
                                            placeholder={
                                                pixType === 'cpf' ? '000.000.000-00' :
                                                pixType === 'cnpj' ? '00.000.000/0001-00' :
                                                pixType === 'phone' ? '+55 11 99999-9999' :
                                                pixType === 'email' ? 'financeiro@igreja.org' : 'Chave aleatória UUID'
                                            }
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-brand-blue/10 py-3 px-4 text-xs font-bold outline-none"
                                            required={enablePix}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1.5 ml-1">
                                            Titular da Chave
                                        </label>
                                        <input
                                            type="text"
                                            value={holderName}
                                            onChange={e => setHolderName(e.target.value)}
                                            placeholder="Nome do Titular ou Razão Social"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-brand-blue/10 py-3 px-4 text-xs font-bold outline-none"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1.5 ml-1">
                                            Descrição (Opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Ex: Conta principal para dízimos e ofertas"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-brand-blue/10 py-3 px-4 text-xs font-bold outline-none"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto" id="bank-modal-actions">
                    <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50" id="btn-cancel-bank">{t('common.cancel')}</button>
                    <button 
                        type="submit" 
                        disabled={isSubmitting || !selectedBankKey || !accountName.trim() || isDuplicate} 
                        className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        id="btn-save-bank"
                    >
                        {isSubmitting ? 'Salvando...' : 'Salvar Conta Bancária'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export const ChurchModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addChurch } = useContext(AppContext);
    const { t } = useTranslation();
    const [data, setData] = useState<ChurchFormData>({
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
        state: '',
        pastors: [{ name: '', title: 'Pastor Presidente' }],
        treasurers: [{ name: '', title: '1º Tesoureiro' }]
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [contributors, setContributors] = useState<{ id: string; name: string }[]>([]);

    // Vínculo / Cargo States for Pastors & Treasurers
    const DEFAULT_PASTOR_ROLES = [
        'Pastor Presidente',
        'Pastor Auxiliar'
    ];

    const DEFAULT_TREASURER_ROLES = [
        '1º Tesoureiro',
        '2º Tesoureiro'
    ];

    const [pastorRoles, setPastorRoles] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('iggestor_pastor_roles_v2');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        return DEFAULT_PASTOR_ROLES;
    });

    const [treasurerRoles, setTreasurerRoles] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('iggestor_treasurer_roles_v2');
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

    const [managingPastorRoles, setManagingPastorRoles] = useState(false);
    const [managingTreasurerRoles, setManagingTreasurerRoles] = useState(false);

    const savePastorRoles = (updated: string[]) => {
        setPastorRoles(updated);
        try {
            localStorage.setItem('iggestor_pastor_roles_v2', JSON.stringify(updated));
        } catch (e) {}
    };

    const saveTreasurerRoles = (updated: string[]) => {
        setTreasurerRoles(updated);
        try {
            localStorage.setItem('iggestor_treasurer_roles_v2', JSON.stringify(updated));
        } catch (e) {}
    };

    const handleAddPastorRole = (role: string) => {
        const trimmed = role.trim();
        if (!trimmed) return;
        if (!pastorRoles.includes(trimmed)) {
            savePastorRoles([...pastorRoles, trimmed]);
        }
    };

    const handleRenamePastorRole = (oldRole: string, newRole: string) => {
        const trimmed = newRole.trim();
        if (!trimmed || trimmed === oldRole) return;
        const updated = pastorRoles.map(r => r === oldRole ? trimmed : r);
        savePastorRoles(updated);
        setData(prev => ({
            ...prev,
            pastors: (prev.pastors || []).map(p => p.title === oldRole ? { ...p, title: trimmed } : p)
        }));
    };

    const handleDeletePastorRole = (roleToDelete: string) => {
        const updated = pastorRoles.filter(r => r !== roleToDelete);
        savePastorRoles(updated);
        const fallback = updated[0] || '';
        setData(prev => ({
            ...prev,
            pastors: (prev.pastors || []).map(p => p.title === roleToDelete ? { ...p, title: fallback } : p)
        }));
    };

    const handleAddTreasurerRole = (role: string) => {
        const trimmed = role.trim();
        if (!trimmed) return;
        if (!treasurerRoles.includes(trimmed)) {
            saveTreasurerRoles([...treasurerRoles, trimmed]);
        }
    };

    const handleRenameTreasurerRole = (oldRole: string, newRole: string) => {
        const trimmed = newRole.trim();
        if (!trimmed || trimmed === oldRole) return;
        const updated = treasurerRoles.map(r => r === oldRole ? trimmed : r);
        saveTreasurerRoles(updated);
        setData(prev => ({
            ...prev,
            treasurers: (prev.treasurers || []).map(t => t.title === oldRole ? { ...t, title: trimmed } : t)
        }));
    };

    const handleDeleteTreasurerRole = (roleToDelete: string) => {
        const updated = treasurerRoles.filter(r => r !== roleToDelete);
        saveTreasurerRoles(updated);
        const fallback = updated[0] || '';
        setData(prev => ({
            ...prev,
            treasurers: (prev.treasurers || []).map(t => t.title === roleToDelete ? { ...t, title: fallback } : t)
        }));
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
        // Carregar lista de cadastros de pessoas para autocomplete
        fetch('/api/v1/contributors')
            .then(res => res.json())
            .then(resData => {
                if (Array.isArray(resData)) {
                    const list = resData
                        .map((c: any) => ({
                            id: c.id,
                            name: c.canonical_name || c.name
                        }))
                        .filter(c => c.name);
                    setContributors(list);
                }
            })
            .catch(err => console.error('Erro ao carregar lista de pessoas para autocomplete:', err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPastor = () => {
        setData(prev => {
            const current = prev.pastors || [];
            const nextTitle = current.length === 0 ? 'Pastor Presidente' : 'Pastor Auxiliar';
            return {
                ...prev,
                pastors: [...current, { name: '', title: nextTitle }]
            };
        });
    };

    const handleRemovePastor = (index: number) => {
        setData(prev => {
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
        setData(prev => {
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
        setData(prev => {
            const current = prev.treasurers || [];
            const nextTitle = current.length === 0 ? '1º Tesoureiro' : `${current.length + 1}º Tesoureiro`;
            return {
                ...prev,
                treasurers: [...current, { name: '', title: nextTitle }]
            };
        });
    };

    const handleRemoveTreasurer = (index: number) => {
        setData(prev => {
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
        setData(prev => {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data.name.trim()) return;
        setIsSubmitting(true);
        const success = await addChurch(data);
        setIsSubmitting(false);
        if (success) {
            setData({
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
                state: '',
                pastors: [{ name: '', title: 'Pastor Presidente' }],
                treasurers: [{ name: '', title: '1º Tesoureiro' }]
            });
            onCancel();
        }
    };

    const handleLogoUpload = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setData(d => ({ ...d, logoUrl: e.target?.result as string }));
            reader.readAsDataURL(file);
        }
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
                                    Novo Cadastro de Congregação
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Ficha Financeira e Institucional da Congregação
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 flex-1 overflow-y-auto w-full">
                    <div className="space-y-6 w-full max-w-full">

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
                                    <input
                                        type="text"
                                        name="name"
                                        value={data.name}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="Ex: Igreja Evangélica Central"
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        CNPJ da Igreja
                                    </label>
                                    <input
                                        type="text"
                                        name="cnpj"
                                        value={data.cnpj || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="00.000.000/0001-00"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Telefone / WhatsApp
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={data.phone || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="(11) 99999-9999"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        E-mail Oficial
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={data.email || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="contato@igreja.org"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Chave Pix Principal (Ofertas/Dízimos)
                                    </label>
                                    <input
                                        type="text"
                                        name="pixKey"
                                        value={data.pixKey || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="CNPJ, E-mail, Telefone ou Aleatória"
                                        disabled={isSubmitting}
                                    />
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
                            <datalist id="new-church-contributors-autocomplete-list">
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
                                            {(data.pastors || []).length}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddPastor}
                                        disabled={isSubmitting}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        + Adicionar Pastor
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {(data.pastors || []).map((pastorItem, index) => (
                                        <div key={index} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                                                <div className="sm:col-span-5 space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">
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
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="sm:col-span-6 space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                        Nome do Pastor
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="new-church-contributors-autocomplete-list"
                                                        value={pastorItem.name || ''}
                                                        onChange={(e) => handlePastorChange(index, 'name', e.target.value)}
                                                        placeholder="Digite ou escolha na lista..."
                                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20"
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 flex items-center justify-center pt-5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePastor(index)}
                                                        disabled={isSubmitting}
                                                        title="Remover Pastor"
                                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
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
                            <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <span>Tesoureiros e Equipe Financeira</span>
                                        <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                            {(data.treasurers || []).length}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddTreasurer}
                                        disabled={isSubmitting}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        + Adicionar Tesoureiro
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {(data.treasurers || []).map((treasurerItem, index) => (
                                        <div key={index} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                                                <div className="sm:col-span-5 space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">
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
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="sm:col-span-6 space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                        Nome do Tesoureiro
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="new-church-contributors-autocomplete-list"
                                                        value={treasurerItem.name || ''}
                                                        onChange={(e) => handleTreasurerChange(index, 'name', e.target.value)}
                                                        placeholder="Digite ou escolha na lista..."
                                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 flex items-center justify-center pt-5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTreasurer(index)}
                                                        disabled={isSubmitting}
                                                        title="Remover Tesoureiro"
                                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
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
                                        value={data.cep || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="00000-000"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-2 lg:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        Endereço / Logradouro
                                    </label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={data.address}
                                        onChange={handleChange}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-4 text-xs font-bold transition-all outline-none"
                                        placeholder="Ex: Av. Principal, 123"
                                        disabled={isSubmitting}
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
                                            value={data.city || ''}
                                            onChange={handleChange}
                                            className="col-span-2 block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-3 text-xs font-bold transition-all outline-none"
                                            placeholder="Cidade"
                                            disabled={isSubmitting}
                                        />
                                        <input
                                            type="text"
                                            name="state"
                                            value={data.state || ''}
                                            onChange={handleChange}
                                            maxLength={2}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-3.5 px-2 text-xs font-bold uppercase transition-all outline-none text-center"
                                            placeholder="UF"
                                            disabled={isSubmitting}
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
                                    src={data.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} 
                                    alt="Preview" 
                                    className="w-16 h-16 rounded-2xl object-cover bg-slate-50 shadow-sm border border-slate-100 dark:border-slate-800" 
                                />
                                <div className="space-y-1">
                                    <label className={`cursor-pointer bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl px-4 py-2 text-xs font-bold inline-block shadow-sm uppercase tracking-wide transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <span>Escolher Arquivo</span>
                                        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                                    </label>
                                    <p className="text-[10px] text-slate-400">
                                        A imagem será exibida nos relatórios financeiros e no Portal do Contribuinte.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                    <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50">{t('common.cancel')}</button>
                    <button type="submit" disabled={isSubmitting || !data.name.trim()} className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                        {isSubmitting ? 'Salvando...' : t('common.save')}
                    </button>
                </div>
            </form>
        </div>
    );
};