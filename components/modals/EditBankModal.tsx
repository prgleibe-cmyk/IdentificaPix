import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, QrCodeIcon } from '../Icons';
import { Building2, Landmark } from 'lucide-react';
import { BANK_CATALOG } from '../../constants/bankCatalog';

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

        fetch(`/api/v1/church-pix-keys?bank_id=${encodeURIComponent(editingBank.id)}`)
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

    if (!editingBank) return null;

    const catalogBank = BANK_CATALOG.find(b => b.key.toLowerCase() === (editingBank.bank_key || '').toLowerCase());
    const institutionDisplayName = catalogBank ? catalogBank.name : (editingBank.bank_key ? editingBank.bank_key.toUpperCase() : editingBank.name);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setErrorMessage(null);

        try {
            await updateBank(editingBank.id, name);

            if (enablePix) {
                if (!pixKey.trim()) {
                    setErrorMessage('Por favor, informe a Chave Pix.');
                    setIsSaving(false);
                    return;
                }

                if (existingPixKeyId) {
                    const patchRes = await fetch(`/api/v1/church-pix-keys/${existingPixKeyId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
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
                        headers: { 'Content-Type': 'application/json' },
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
                await fetch(`/api/v1/church-pix-keys/${existingPixKeyId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        is_active: false
                    })
                });
            }

            closeEditBank();
        } catch (err: any) {
            console.error('Erro ao salvar conta e chave Pix:', err);
            setErrorMessage(err.message || 'Erro ao salvar alterações.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col h-full w-full">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-brand-blue text-white shadow-lg shadow-blue-500/20 flex items-center justify-center">
                                <Landmark className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    Editar Conta Bancária
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Atualize a identificação e chaves de recebimento da conta
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button type="button" onClick={closeEditBank} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer">
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
                                Identificação da Conta Bancária
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                    Instituição Bancária
                                </label>
                                <div className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 py-3.5 px-4 text-xs font-bold">
                                    {institutionDisplayName}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="edit-bank-name" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                    Nome / Identificação da Conta
                                </label>
                                <input
                                    type="text"
                                    id="edit-bank-name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Conta Principal, Dízimos, Ofertas..."
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-brand-blue/10 py-3.5 px-4 transition-all outline-none text-xs font-bold"
                                    required
                                    autoFocus
                                />
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
                                    onChange={e => {
                                        const checked = e.target.checked;
                                        setEnablePix(checked);
                                        setIsActive(checked);
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        {isLoadingPix && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                                Carregando configurações Pix...
                            </div>
                        )}

                        {enablePix && !isLoadingPix && (
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
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1.5 ml-1">
                                            Status da Chave
                                        </label>
                                        <select
                                            value={isActive ? 'active' : 'inactive'}
                                            onChange={e => setIsActive(e.target.value === 'active')}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-brand-blue/10 py-3 px-4 text-xs font-bold outline-none cursor-pointer"
                                        >
                                            <option value="active">Ativa</option>
                                            <option value="inactive">Inativa</option>
                                        </select>
                                    </div>
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
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                    <button type="button" onClick={closeEditBank} disabled={isSaving} className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50">{t('common.cancel')}</button>
                    <button type="submit" disabled={isSaving} className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </form>
        </div>
    );
};
