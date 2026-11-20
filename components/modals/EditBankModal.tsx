import React, { useState, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, QrCodeIcon } from '../Icons';
import { Building2, Landmark } from 'lucide-react';
import { BANK_CATALOG } from '../../constants/bankCatalog';
import { getAuthToken } from '../../services/auth/authAdapter';

export const EditBankModal: React.FC = () => {
    const { editingBank, updateBank, closeEditBank } = useContext(AppContext);
    const { t } = useTranslation();
    const [name, setName] = useState('');

    // Pix Key Section States
    const [enablePix, setEnablePix] = useState<boolean>(false);
    const [pixType, setPixType] = useState<'cpf' | 'cnpj' | 'phone' | 'email' | 'random'>('cpf');
    const [pixKey, setPixKey] = useState<string>('');
    const [holderName, setHolderName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [isActive, setIsActive] = useState<boolean>(true);
    const [existingPixKeyId, setExistingPixKeyId] = useState<string | null>(null);
    const [isLoadingPix, setIsLoadingPix] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (editingBank) {
            setName(editingBank.account_name ?? editingBank.name);
        }
    }, [editingBank]);

    // Load existing Pix key for this bank
    useEffect(() => {
        if (!editingBank) return;

        let isMounted = true;
        setIsLoadingPix(true);
        setErrorMessage(null);

        getAuthToken()
            .then(token => fetch(`/api/v1/church-pix-keys?bank_id=${encodeURIComponent(editingBank.id)}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            }))
            .then(res => res.ok ? res.json() : [])
            .then((keys: any[]) => {
                if (!isMounted) return;
                const matchingKey = keys.find((k: any) => k.bank_id === editingBank.id) || (keys.length > 0 ? keys[0] : null);
                if (matchingKey) {
                    const activeState = matchingKey.is_active ?? true;
                    setEnablePix(activeState);
                    setPixType(matchingKey.pix_type || 'cpf');
                    setPixKey(matchingKey.pix_key || '');
                    setHolderName(matchingKey.holder_name || '');
                    setDescription(matchingKey.description || '');
                    setIsActive(activeState);
                    setExistingPixKeyId(matchingKey.id);
                } else {
                    setEnablePix(false);
                    setPixType('cpf');
                    setPixKey('');
                    setHolderName('');
                    setDescription('');
                    setIsActive(true);
                    setExistingPixKeyId(null);
                }
            })
            .catch(err => {
                console.error('Erro ao buscar chaves Pix:', err);
            })
            .finally(() => {
                if (isMounted) setIsLoadingPix(false);
            });

        return () => {
            isMounted = false;
        };
    }, [editingBank]);

    useEffect(() => {
        if (!editingBank) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSaving) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeEditBank();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [editingBank, isSaving, closeEditBank]);

    if (!editingBank) return null;

    const catalogBank = BANK_CATALOG.find(b => b.key.toLowerCase() === (editingBank.bank_key || '').toLowerCase());
    const institutionDisplayName = catalogBank ? catalogBank.name : (editingBank.bank_key ? editingBank.bank_key.toUpperCase() : editingBank.name);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (enablePix && !pixKey.trim()) {
            setErrorMessage('Por favor, informe a Chave Pix.');
            return;
        }

        setIsSaving(true);

        try {
            await updateBank(editingBank.id, name, editingBank.accepted_contribution_types ?? null);
            const token = await getAuthToken();
            const authHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            };

            if (enablePix) {
                if (existingPixKeyId) {
                    const patchRes = await fetch(`/api/v1/church-pix-keys/${existingPixKeyId}`, {
                        method: 'PATCH',
                        headers: authHeaders,
                        body: JSON.stringify({
                            bank_id: editingBank.id,
                            church_id: null,
                            pix_type: pixType,
                            pix_key: pixKey.trim(),
                            holder_name: holderName.trim() || null,
                            description: description.trim() || null,
                            is_active: isActive
                        })
                    });
                    if (!patchRes.ok) {
                        const errData = await patchRes.json().catch(() => ({}));
                        throw new Error(errData.message || 'Erro ao atualizar chave Pix.');
                    }
                } else {
                    const postRes = await fetch('/api/v1/church-pix-keys', {
                        method: 'POST',
                        headers: authHeaders,
                        body: JSON.stringify({
                            bank_id: editingBank.id,
                            church_id: null,
                            pix_type: pixType,
                            pix_key: pixKey.trim(),
                            holder_name: holderName.trim() || null,
                            description: description.trim() || null
                        })
                    });
                    if (!postRes.ok) {
                        const errData = await postRes.json().catch(() => ({}));
                        throw new Error(errData.message || 'Erro ao salvar chave Pix.');
                    }
                }
            } else if (existingPixKeyId) {
                const deactivateRes = await fetch(`/api/v1/church-pix-keys/${existingPixKeyId}`, {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({
                        is_active: false
                    })
                });
                if (!deactivateRes.ok) {
                    const errData = await deactivateRes.json().catch(() => ({}));
                    throw new Error(errData.message || 'Erro ao desativar chave Pix.');
                }
            }

            closeEditBank();
        } catch (err: any) {
            console.error('Erro ao salvar conta e chave Pix:', err);
            setErrorMessage(err.message || 'Erro ao salvar alterações.');
        } finally {
            setIsSaving(false);
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            data-register-overlay="true"
            className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={(e) => {
                e.stopPropagation();
                if (!isSaving) closeEditBank();
            }}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-elevated w-full max-w-3xl max-h-[calc(100dvh-5rem)] md:max-h-[min(86vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                Editar Conta Bancária
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                Atualize a identificação e chaves de recebimento da conta.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeEditBank}
                        disabled={isSaving}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                        aria-label="Fechar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div
                    className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full space-y-4"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
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
                                Identificação da Conta Bancária
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                    Instituição Bancária
                                </label>
                                <div className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 py-2 px-3 text-xs font-semibold">
                                    {institutionDisplayName}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="edit-bank-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                    Nome / Identificação da Conta
                                </label>
                                <input
                                    type="text"
                                    id="edit-bank-name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Conta Principal, Dízimos, Ofertas..."
                                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 transition-all outline-none text-xs font-medium"
                                    required
                                    autoFocus
                                    disabled={isSaving}
                                />
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
                                    onChange={e => {
                                        const checked = e.target.checked;
                                        setEnablePix(checked);
                                        setIsActive(checked);
                                    }}
                                    className="sr-only peer"
                                    disabled={isSaving}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>

                        {isLoadingPix && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                                Carregando configurações Pix...
                            </div>
                        )}

                        {enablePix && !isLoadingPix && (
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
                                            disabled={isSaving}
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
                                            disabled={isSaving}
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
                                            disabled={isSaving}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Status da Chave
                                        </label>
                                        <select
                                            value={isActive ? 'active' : 'inactive'}
                                            onChange={e => setIsActive(e.target.value === 'active')}
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 text-xs font-semibold outline-none cursor-pointer"
                                            disabled={isSaving}
                                        >
                                            <option value="active">Ativa</option>
                                            <option value="inactive">Inativa</option>
                                        </select>
                                    </div>
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
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <button
                        type="button"
                        onClick={closeEditBank}
                        disabled={isSaving}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
};
