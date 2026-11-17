import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, QrCodeIcon } from '../Icons';
import { ChurchFormData } from '../../types';
import { BANK_CATALOG } from '../../constants/bankCatalog';
import { Building2, Landmark, User, MapPin, Image as ImageIcon } from 'lucide-react';
import { InlineRoleSelector } from './InlineRoleSelector';
import { getAuthToken } from '../../services/auth/authAdapter';

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
                    const token = await getAuthToken();
                    const postRes = await fetch('/api/v1/church-pix-keys', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
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

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                onCancel();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isSubmitting, onCancel]);

    return (
        <div
            data-register-overlay="true"
            className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            id="bank-modal-container"
            onClick={(e) => { e.stopPropagation(); if (!isSubmitting) onCancel(); }}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-5rem)] md:max-h-[min(86vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
                id="bank-modal-form"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate" id="bank-modal-title">
                                Cadastro de Conta Bancária
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                Preencha os dados da instituição e chaves de recebimento.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                        id="btn-close-bank-modal"
                        aria-label="Fechar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full space-y-4">
                    {errorMessage && (
                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-fade-in">
                            {errorMessage}
                        </div>
                    )}

                    {/* Seção: Instituição & Identificação da Conta */}
                    <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200/70 dark:border-slate-800">
                            <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Instituição Financeira e Identificação
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                                <label htmlFor="bank-key" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5" id="lbl-bank-key">
                                    Instituição Financeira / Banco
                                </label>
                                <select
                                    id="bank-key"
                                    value={selectedBankKey}
                                    onChange={(e) => setSelectedBankKey(e.target.value)}
                                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 transition-all outline-none text-xs font-semibold cursor-pointer"
                                    disabled={isSubmitting}
                                    required
                                >
                                    <option value="">Selecione a instituição bancária...</option>
                                    {BANK_CATALOG.filter(b => b.active).map(b => (
                                        <option key={b.key} value={b.key}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="account-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5" id="lbl-account-name">
                                    Nome / Identificação da Conta
                                </label>
                                <input
                                    type="text"
                                    id="account-name"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    className={`block w-full rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 py-2 px-3 outline-none transition-all text-xs font-medium ${isDuplicate ? 'border border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' : 'border border-slate-300 dark:border-slate-700 focus:ring-orange-500/20 focus:border-orange-500'}`}
                                    placeholder="Ex: Conta Principal, Dízimos, Ofertas..."
                                    required
                                    disabled={isSubmitting}
                                />
                                {isDuplicate && (
                                    <p className="text-rose-500 text-xs font-medium mt-1 ml-0.5 animate-fade-in" id="dup-warning">
                                        Já existe uma conta cadastrada com esse nome neste banco.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Seção: Recebimento via Pix */}
                    <div className="bg-slate-50/70 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    <QrCodeIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                                        Recebimento via Pix (Portal do Contribuinte)
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Ative e configure a chave Pix associada a esta conta para exibição no Portal.
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={enablePix}
                                    onChange={e => setEnablePix(e.target.checked)}
                                    className="sr-only peer"
                                    disabled={isSubmitting}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>

                        {enablePix && (
                            <div className="space-y-3.5 pt-3.5 border-t border-slate-200/70 dark:border-slate-800 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Tipo da Chave
                                        </label>
                                        <select
                                            value={pixType}
                                            onChange={e => setPixType(e.target.value as any)}
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-semibold outline-none cursor-pointer"
                                            disabled={isSubmitting}
                                        >
                                            <option value="cpf">CPF</option>
                                            <option value="cnpj">CNPJ</option>
                                            <option value="phone">Telefone</option>
                                            <option value="email">E-mail</option>
                                            <option value="random">Chave Aleatória (EVP)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
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
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium outline-none"
                                            required={enablePix}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Titular da Chave
                                        </label>
                                        <input
                                            type="text"
                                            value={holderName}
                                            onChange={e => setHolderName(e.target.value)}
                                            placeholder="Nome do Titular ou Razão Social"
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium outline-none"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Descrição (Opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Ex: Conta principal para dízimos e ofertas"
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium outline-none"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0" id="bank-modal-actions">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        id="btn-cancel-bank"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !selectedBankKey || !accountName.trim() || isDuplicate}
                        className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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
    const {
        addChurch,
        pastorRoles = ['Pastor Presidente', 'Pastor Auxiliar'],
        treasurerRoles = ['1º Tesoureiro', '2º Tesoureiro'],
        addTenantOption,
        renameTenantOption,
        deleteTenantOption
    } = useContext(AppContext);
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
            setData(prev => ({
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
            setData(prev => ({
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
            setData(prev => ({
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
            setData(prev => ({
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
        // Carregar lista de cadastros de pessoas para autocomplete
        let mounted = true;
        getAuthToken()
            .then(token => fetch('/api/v1/contributors', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            }))
            .then(res => (res.ok ? res.json() : []))
            .then(resData => {
                if (mounted && Array.isArray(resData)) {
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
        return () => { mounted = false; };
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

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                onCancel();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isSubmitting, onCancel]);

    return (
        <div
            data-register-overlay="true"
            className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={(e) => { e.stopPropagation(); if (!isSubmitting) onCancel(); }}
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
                                Novo Cadastro de Congregação
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                Ficha financeira e institucional da congregação.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                        aria-label="Fechar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full">
                    <div className="space-y-4 w-full max-w-full">

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
                                        value={data.name}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="Ex: Igreja Evangélica Central"
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        CNPJ da Igreja
                                    </label>
                                    <input
                                        type="text"
                                        name="cnpj"
                                        value={data.cnpj || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="00.000.000/0001-00"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Telefone / WhatsApp
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={data.phone || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="(11) 99999-9999"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-1 lg:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        E-mail Oficial
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={data.email || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="contato@igreja.org"
                                        disabled={isSubmitting}
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
                            <datalist id="new-church-contributors-autocomplete-list">
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
                                            {(data.pastors || []).length}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddPastor}
                                        disabled={isSubmitting}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        + Adicionar Pastor
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {(data.pastors || []).map((pastorItem, index) => (
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
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="sm:col-span-6 space-y-1">
                                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                        Nome do Pastor
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="new-church-contributors-autocomplete-list"
                                                        value={pastorItem.name || ''}
                                                        onChange={(e) => handlePastorChange(index, 'name', e.target.value)}
                                                        placeholder="Digite ou escolha na lista..."
                                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 flex items-center justify-center sm:pt-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePastor(index)}
                                                        disabled={isSubmitting}
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
                                            {(data.treasurers || []).length}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddTreasurer}
                                        disabled={isSubmitting}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        + Adicionar Tesoureiro
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {(data.treasurers || []).map((treasurerItem, index) => (
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
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="sm:col-span-6 space-y-1">
                                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                        Nome do Tesoureiro
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="new-church-contributors-autocomplete-list"
                                                        value={treasurerItem.name || ''}
                                                        onChange={(e) => handleTreasurerChange(index, 'name', e.target.value)}
                                                        placeholder="Digite ou escolha na lista..."
                                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 flex items-center justify-center sm:pt-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTreasurer(index)}
                                                        disabled={isSubmitting}
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
                                        value={data.cep || ''}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="00000-000"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-1 lg:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Endereço / Logradouro
                                    </label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={data.address}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                        placeholder="Ex: Av. Principal, 123"
                                        disabled={isSubmitting}
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
                                            value={data.city || ''}
                                            onChange={handleChange}
                                            className="col-span-2 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-medium transition-all outline-none"
                                            placeholder="Cidade"
                                            disabled={isSubmitting}
                                        />
                                        <input
                                            type="text"
                                            name="state"
                                            value={data.state || ''}
                                            onChange={handleChange}
                                            maxLength={2}
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-2 text-xs font-semibold uppercase transition-all outline-none text-center"
                                            placeholder="UF"
                                            disabled={isSubmitting}
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
                                    src={data.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'}
                                    alt="Preview"
                                    className="w-14 h-14 rounded-xl object-cover bg-slate-50 shadow-xs border border-slate-200/70 dark:border-slate-800 shrink-0"
                                />
                                <div className="space-y-1">
                                    <label className={`cursor-pointer bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold inline-block shadow-xs transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <span>Escolher Arquivo</span>
                                        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                                    </label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        A imagem será exibida nos relatórios financeiros e no Portal do Contribuinte.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !data.name.trim()}
                        className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                        {isSubmitting ? 'Salvando...' : t('common.save')}
                    </button>
                </div>
            </form>
        </div>
    );
};