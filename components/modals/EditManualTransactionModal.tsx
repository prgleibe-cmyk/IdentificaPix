import React, { useState, useContext, useEffect, useMemo } from 'react';
import { 
    X, 
    Pencil, 
    CheckCircle2, 
    Building2, 
    Calendar, 
    DollarSign, 
    FileText, 
    Tag, 
    CreditCard, 
    Building, 
    User, 
    ArrowUpRight, 
    ArrowDownRight,
    AlertCircle
} from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useAuth } from '../../contexts/AuthContext';
import { MatchResult, Church } from '../../types';
import { getCachedContributors } from '../../services/contributorsCache';
import { resolveContributionType, resolvePaymentMethod } from '../../utils/formatters';

interface EditManualTransactionModalProps {
    isOpen: boolean;
    row: MatchResult | null;
    onClose: () => void;
    onSave: (updatedRow: MatchResult) => void;
}

export const EditManualTransactionModal: React.FC<EditManualTransactionModalProps> = ({
    isOpen,
    row,
    onClose,
    onSave
}) => {
    const { 
        churches, 
        banks, 
        contributionKeywords, 
        paymentMethods: sysPaymentMethods, 
        showToast 
    } = useContext(AppContext);
    const { language } = useTranslation();
    const { subscription, user, isSecondaryUser } = useAuth();

    // Initial values from row
    const isInitialExpense = useMemo(() => {
        if (!row) return false;
        const amt = row.transaction?.amount ?? (row.contributor as any)?.amount ?? 0;
        return amt < 0 || 
               row.transaction?.type?.toLowerCase() === 'expense' || 
               row.transaction?.type?.toLowerCase() === 'saida';
    }, [row]);

    const initialAmount = useMemo(() => {
        if (!row) return '';
        const amt = Math.abs(row.transaction?.amount ?? (row.contributor as any)?.amount ?? 0);
        if (amt === 0) return '';
        return amt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, [row]);

    const initialDescription = useMemo(() => {
        if (!row) return '';
        return row.contributor?.name || 
               row.transaction?.description || 
               row.transaction?.rawDescription || 
               '';
    }, [row]);

    const initialDate = useMemo(() => {
        if (!row) return new Date().toISOString().split('T')[0];
        const d = row.contributor?.reference_date || 
                  row.contributor?.date || 
                  row.transaction?.reference_date || 
                  row.transaction?.date;
        if (!d) return new Date().toISOString().split('T')[0];
        return d.includes('T') ? d.split('T')[0] : d;
    }, [row]);

    const initialChurchId = useMemo(() => {
        if (!row?.church?.id || row.church.id === 'unidentified') {
            return churches[0]?.id || '';
        }
        return row.church.id;
    }, [row, churches]);

    const initialBankId = useMemo(() => {
        if (!row) return '';
        return (row.transaction as any)?.bank_id || (row as any).bankId || '';
    }, [row]);

    const initialContributionType = useMemo(() => {
        if (!row) return 'Dízimo';
        return row.contributionType || 
               (row.contributor as any)?.contributionType || 
               (isInitialExpense ? 'Saída Geral' : 'Dízimo');
    }, [row, isInitialExpense]);

    const initialPaymentMethod = useMemo(() => {
        if (!row) return 'DINHEIRO';
        return row.paymentMethod || 
               (row.contributor as any)?.paymentMethod || 
               row.transaction?.paymentMethod || 
               'DINHEIRO';
    }, [row]);

    // Local form state
    const [type, setType] = useState<'entrada' | 'saida'>(isInitialExpense ? 'saida' : 'entrada');
    const [amountStr, setAmountStr] = useState<string>(initialAmount);
    const [description, setDescription] = useState<string>(initialDescription);
    const [date, setDate] = useState<string>(initialDate);
    const [churchId, setChurchId] = useState<string>(initialChurchId);
    const [bankId, setBankId] = useState<string>(initialBankId);
    const [contributionType, setContributionType] = useState<string>(initialContributionType);
    const [paymentMethod, setPaymentMethod] = useState<string>(initialPaymentMethod);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Contributor suggestions
    const [dbContributors, setDbContributors] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setType(isInitialExpense ? 'saida' : 'entrada');
            setAmountStr(initialAmount);
            setDescription(initialDescription);
            setDate(initialDate);
            setChurchId(initialChurchId);
            setBankId(initialBankId);
            setContributionType(initialContributionType);
            setPaymentMethod(initialPaymentMethod);
            setErrorMessage(null);
            setIsSaving(false);
        }
    }, [isOpen, isInitialExpense, initialAmount, initialDescription, initialDate, initialChurchId, initialBankId, initialContributionType, initialPaymentMethod]);

    useEffect(() => {
        let isMounted = true;
        getCachedContributors().then(list => {
            if (isMounted && Array.isArray(list)) {
                setDbContributors(list);
            }
        }).catch(err => {
            console.error('[EditManualTransactionModal] Erro ao carregar contribuintes:', err);
        });
        return () => { isMounted = false; };
    }, []);

    // Filter suggestions based on typed description
    const filteredContributors = useMemo(() => {
        if (!description || description.trim().length < 2) return [];
        const lower = description.toLowerCase().trim();
        return dbContributors.filter((c: any) => {
            const name = (c.name || '').toLowerCase();
            const cpf = (c.cpf || '').replace(/\D/g, '');
            return name.includes(lower) || cpf.includes(lower);
        }).slice(0, 5);
    }, [description, dbContributors]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawDigits = e.target.value.replace(/\D/g, '');
        if (!rawDigits || parseInt(rawDigits, 10) === 0) {
            setAmountStr('');
            return;
        }
        const truncated = rawDigits.slice(0, 11);
        const numericValue = parseInt(truncated, 10) / 100;
        const formatted = numericValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        setAmountStr(formatted);
        if (errorMessage) setErrorMessage(null);
    };

    const handleSelectContributor = (contrib: any) => {
        setDescription(contrib.name || '');
        if (contrib.church_id && churches.some(c => c.id === contrib.church_id)) {
            setChurchId(contrib.church_id);
        }
        setShowSuggestions(false);
    };

    if (!isOpen || !row) return null;

    const handleSave = async () => {
        try {
            setErrorMessage(null);

            // Validations
            const cleanDesc = description.trim();
            if (!cleanDesc) {
                setErrorMessage('A descrição ou nome do contribuinte é obrigatória.');
                return;
            }

            const cleanAmountStr = amountStr.replace(/\./g, '').replace(',', '.').trim();
            const parsedAmount = parseFloat(cleanAmountStr);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                setErrorMessage('Informe um valor válido maior que zero.');
                return;
            }

            const selectedChurch = churches.find(c => c.id === churchId) || row.church || churches[0];
            if (!selectedChurch) {
                setErrorMessage('Selecione uma igreja/congregação.');
                return;
            }

            setIsSaving(true);

            const finalAmount = type === 'saida' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
            const finalType = type === 'saida' ? 'expense' : 'income';
            const nowIso = new Date().toISOString();

            const updatedRow: MatchResult = {
                ...row,
                transaction: {
                    ...row.transaction,
                    amount: finalAmount,
                    description: cleanDesc,
                    rawDescription: cleanDesc,
                    date: date,
                    reference_date: date,
                    type: finalType,
                    bank_id: bankId || undefined,
                    paymentMethod: paymentMethod,
                    contributionType: contributionType,
                    source: 'manual',
                    isManual: true
                },
                contributor: row.contributor ? {
                    ...row.contributor,
                    name: cleanDesc,
                    amount: finalAmount,
                    date: date,
                    reference_date: date,
                    contributionType: contributionType,
                    paymentMethod: paymentMethod,
                    _churchId: selectedChurch.id
                } : {
                    id: row.transaction.id,
                    name: cleanDesc,
                    amount: finalAmount,
                    date: date,
                    reference_date: date,
                    _churchId: selectedChurch.id,
                    contributionType: contributionType,
                    paymentMethod: paymentMethod
                },
                church: selectedChurch,
                _churchId: selectedChurch.id,
                contributionType: contributionType,
                paymentMethod: paymentMethod,
                updatedAt: nowIso
            };

            // Call in-memory updater
            onSave(updatedRow);

            // Persist to backend database via PUT
            const txId = row.transaction.id;
            if (txId && !txId.startsWith('temp-') && !txId.startsWith('ghost-')) {
                try {
                    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    await fetch(`/api/v1/consolidated_transactions/${txId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({
                            amount: finalAmount,
                            description: cleanDesc,
                            type: finalType,
                            transaction_date: date,
                            church_id: selectedChurch.id && selectedChurch.id !== 'unidentified' ? selectedChurch.id : null,
                            bank_id: bankId || null,
                            contribution_type: contributionType,
                            payment_method: paymentMethod,
                            source: 'manual'
                        })
                    });
                } catch (apiErr) {
                    console.error('[EditManualTransactionModal] Erro ao persistir na API:', apiErr);
                }
            }

            if (showToast) {
                showToast('Lançamento manual atualizado com sucesso!', 'success');
            }

            onClose();
        } catch (err: any) {
            console.error('[EditManualTransactionModal] Erro ao salvar:', err);
            setErrorMessage('Ocorreu um erro ao salvar as alterações.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabeçalho */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Pencil className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                Editar Lançamento Manual
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Ajuste os valores, data, destino e classificação deste registro.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Corpo do Formulário */}
                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
                    {/* Alerta de erro */}
                    {errorMessage && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Alternador Tipo: Entrada / Saída */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                            Tipo de Movimentação
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => { setType('entrada'); if (contributionType === 'Saída Geral') setContributionType('Dízimo'); }}
                                className={`py-2 px-3 rounded-xl font-bold uppercase text-[11px] flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                                    type === 'entrada'
                                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                                }`}
                            >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                <span>Entrada (Receita)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setType('saida'); if (contributionType === 'Dízimo') setContributionType('Saída Geral'); }}
                                className={`py-2 px-3 rounded-xl font-bold uppercase text-[11px] flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                                    type === 'saida'
                                        ? 'bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                                }`}
                            >
                                <ArrowDownRight className="w-3.5 h-3.5" />
                                <span>Saída (Despesa)</span>
                            </button>
                        </div>
                    </div>

                    {/* Descrição / Contribuinte com sugestão */}
                    <div className="relative">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                {type === 'entrada' ? 'Nome do Contribuinte / Descrição' : 'Descrição da Saída / Fornecedor'}
                            </span>
                            <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200/60 dark:border-amber-800/40">
                                * Obrigatório
                            </span>
                        </label>
                        <input 
                            type="text"
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                setShowSuggestions(true);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            placeholder={type === 'entrada' ? 'Ex: João da Silva, Maria Santos, etc.' : 'Ex: Pagamento Energia, Material Limpeza, etc.'}
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                        />

                        {/* Dropdown de sugestões */}
                        {showSuggestions && filteredContributors.length > 0 && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                                <div className="p-1.5 bg-slate-50 dark:bg-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                                    Contribuintes Cadastrados Sugeridos
                                </div>
                                {filteredContributors.map((c: any) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleSelectContributor(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-50 dark:border-slate-800/40 last:border-0 flex items-center justify-between"
                                    >
                                        <span className="truncate">{c.name}</span>
                                        {c.cpf && <span className="text-[10px] text-slate-400 font-mono">{c.cpf}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Grid: Valor e Data */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Valor */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <DollarSign className="w-3 h-3 text-slate-400" />
                                Valor (R$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                                <input 
                                    type="text"
                                    inputMode="numeric"
                                    value={amountStr}
                                    onChange={handleAmountChange}
                                    placeholder="0,00"
                                    className="w-full pl-9 pr-3 py-2 text-xs font-black font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Data */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                Data de Competência
                            </label>
                            <input 
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Grid: Igreja e Banco */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Igreja */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                Igreja / Congregação
                            </label>
                            <select
                                value={churchId}
                                onChange={(e) => setChurchId(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                            >
                                {churches.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Banco / Caixa */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Building className="w-3 h-3 text-slate-400" />
                                Conta / Banco (Opcional)
                            </label>
                            <select
                                value={bankId}
                                onChange={(e) => setBankId(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                            >
                                <option value="">Sem vínculo de banco (Caixa Físico)</option>
                                {banks.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Grid: Descrição / Finalidade e Forma de Pagamento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Tipo de Contribuição / Finalidade */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <Tag className="w-3 h-3 text-slate-400" />
                                Classificação / Finalidade
                            </label>
                            <input 
                                type="text"
                                list="contrib-types-list"
                                value={contributionType}
                                onChange={(e) => setContributionType(e.target.value)}
                                placeholder="Ex: Dízimo, Oferta, Missões, etc."
                                className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                            />
                            <datalist id="contrib-types-list">
                                {contributionKeywords.map((k, i) => (
                                    <option key={i} value={k} />
                                ))}
                                <option value="Dízimo" />
                                <option value="Oferta" />
                                <option value="Oferta Especial" />
                                <option value="Missões" />
                                <option value="Construção" />
                                <option value="Saída Geral" />
                            </datalist>
                        </div>

                        {/* Forma de Pagamento */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                <CreditCard className="w-3 h-3 text-slate-400" />
                                Forma de Pagamento
                            </label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                            >
                                <option value="DINHEIRO">DINHEIRO</option>
                                <option value="PIX">PIX</option>
                                <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
                                <option value="CARTÃO DE DÉBITO">CARTÃO DE DÉBITO</option>
                                <option value="CARTÃO DE CRÉDITO">CARTÃO DE CRÉDITO</option>
                                <option value="BOLETO">BOLETO</option>
                                <option value="CHEQUE">CHEQUE</option>
                                <option value="OUTRO">OUTRO</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Rodapé / Ações */}
                <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !amountStr || !description.trim()}
                        className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-brand-blue hover:bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
