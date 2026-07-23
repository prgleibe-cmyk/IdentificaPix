import React, { useState } from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { PortalRequestStatusCard } from '../components/PortalRequestStatusCard';
import { formatCurrencyBrl } from '../utils/portalFormatters';
import { usePortalPix } from '../hooks/usePortalPix';
import { ContributionItemMock, ChurchPixKeyPublic } from '../types/portal';

interface PortalPaymentStepProps {
    churchId?: string;
    requestId?: string;
    totalAmount: number;
    referenceNumber: string;
    items?: ContributionItemMock[];
    onBack: () => void;
    onFinish: () => void;
}

interface PaymentGroup {
    key: ChurchPixKeyPublic;
    items: ContributionItemMock[];
    total: number;
}

export const PortalPaymentStep: React.FC<PortalPaymentStepProps> = ({
    churchId,
    requestId,
    totalAmount,
    referenceNumber,
    items,
    onBack,
    onFinish
}) => {
    const { pixKeys, selectedKey, selectedKeyId, setSelectedKeyId, loading, error, refetch } = usePortalPix(churchId);
    const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

    const handleCopyPix = (keyId: string, keyToCopy: string) => {
        if (!keyToCopy) return;
        navigator.clipboard.writeText(keyToCopy);
        setCopiedKeyId(keyId);
        setTimeout(() => setCopiedKeyId(null), 2500);
    };

    const formatPixTypeLabel = (type: string) => {
        const lower = type.toLowerCase();
        switch (lower) {
            case 'cnpj': return 'CNPJ';
            case 'cpf': return 'CPF';
            case 'phone': return 'Telefone';
            case 'email': return 'E-mail';
            case 'random': return 'Chave Aleatória';
            default: return type.toUpperCase();
        }
    };

    // Group selected items by bank Pix key
    const selectedItems = items ? items.filter(i => i.selected && i.amount > 0) : [];
    const paymentGroups: PaymentGroup[] = [];

    if (pixKeys.length > 0) {
        if (selectedItems.length > 0) {
            const keyGroupMap = new Map<string, PaymentGroup>();

            selectedItems.forEach(item => {
                // Find a key that directly matches the contribution type's target bank_id
                let matchingKey: ChurchPixKeyPublic | undefined;
                if (item.bank_id) {
                    matchingKey = pixKeys.find(k => k.bank_id === item.bank_id);
                }

                if (!matchingKey) {
                    matchingKey = selectedKey || pixKeys[0];
                }

                if (matchingKey) {
                    if (!keyGroupMap.has(matchingKey.id)) {
                        keyGroupMap.set(matchingKey.id, { key: matchingKey, items: [], total: 0 });
                    }
                    const grp = keyGroupMap.get(matchingKey.id)!;
                    grp.items.push(item);
                    grp.total += item.amount;
                }
            });

            paymentGroups.push(...Array.from(keyGroupMap.values()));
        } else if (selectedKey) {
            paymentGroups.push({ key: selectedKey, items: [], total: totalAmount });
        }
    }

    return (
        <PortalCard
            title="Forma de Pagamento via Pix"
            subtitle="Utilize as informações oficiais da igreja para realizar sua contribuição no aplicativo do seu banco."
        >
            <div className="space-y-6">
                {/* Total & Reference Header */}
                <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue dark:text-blue-400 block">
                        Valor Total da Intenção de Contribuição
                    </span>
                    <span className="text-3xl font-black text-slate-800 dark:text-white block mt-1">
                        {formatCurrencyBrl(totalAmount)}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-1 block">
                        Protocolo: {referenceNumber}
                    </span>
                </div>

                {/* Real-time Identification Status Banner (Polling) */}
                {requestId && (
                    <PortalRequestStatusCard
                        requestId={requestId}
                        churchId={churchId}
                        referenceNumber={referenceNumber}
                        initialAmount={totalAmount}
                        initialStatus="pending"
                    />
                )}

                {/* Loading State */}
                {loading && (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="w-8 h-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Carregando formas de contribuição Pix da igreja...
                        </p>
                    </div>
                )}

                {/* Error State */}
                {!loading && error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-between">
                        <span>⚠️ {error}</span>
                        <button 
                            onClick={refetch}
                            className="underline text-xs font-bold ml-2 hover:opacity-80"
                        >
                            Tentar novamente
                        </button>
                    </div>
                )}

                {/* Empty State: No Pix Keys */}
                {!loading && !error && pixKeys.length === 0 && (
                    <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
                        <span className="text-2xl block">🏛️</span>
                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                            Nenhuma Chave Pix Cadastrada
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-400 max-w-sm mx-auto">
                            Esta igreja ainda não possui uma chave Pix cadastrada no sistema. Entre em contato com a administração da igreja para concluir sua contribuição.
                        </p>
                    </div>
                )}

                {/* Split Banner if multiple accounts are required */}
                {!loading && !error && paymentGroups.length > 1 && (
                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs space-y-1">
                        <span className="font-black uppercase tracking-wider block text-[11px] text-indigo-600 dark:text-indigo-400">
                            ⚡ Contribuição Direcionada por Conta Bancária
                        </span>
                        <p className="text-xs">
                            Sua seleção abrange categorias vinculadas a contas bancárias distintas. Por favor, realize as transferências abaixo para cada conta correspondente:
                        </p>
                    </div>
                )}

                {/* Render Payment Groups */}
                {!loading && !error && paymentGroups.length > 0 && (
                    <div className="space-y-6">
                        {paymentGroups.map((group, index) => {
                            const isCopied = copiedKeyId === group.key.id;
                            return (
                                <div 
                                    key={group.key.id}
                                    className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm"
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                                        <div>
                                            {paymentGroups.length > 1 && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue dark:text-blue-400 block mb-0.5">
                                                    Pagamento {index + 1} de {paymentGroups.length}
                                                </span>
                                            )}
                                            <span className="text-sm font-black text-slate-800 dark:text-white">
                                                {group.key.bank_name || 'Conta Bancária'}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-mono font-black text-brand-blue dark:text-blue-400 bg-brand-blue/10 px-2.5 py-1 rounded-lg">
                                                {formatCurrencyBrl(group.total)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Categories Included in this Bank Account */}
                                    {group.items.length > 0 && (
                                        <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block">
                                                Categorias Incluídas neste Pagamento:
                                            </span>
                                            <div className="space-y-1">
                                                {group.items.map(item => (
                                                    <div key={item.id} className="flex justify-between items-center text-xs">
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                            {item.label}
                                                        </span>
                                                        <span className="font-bold text-slate-800 dark:text-white">
                                                            {formatCurrencyBrl(item.amount)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Holder Info */}
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        {group.key.holder_name && (
                                            <div>
                                                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block">
                                                    Favorecido / Titular
                                                </span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {group.key.holder_name}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block">
                                                Tipo de Chave
                                            </span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                                {formatPixTypeLabel(group.key.pix_type)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Static QR Code Representation */}
                                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-w-xs mx-auto text-center shadow-sm">
                                        <div className="w-36 h-36 bg-slate-900 dark:bg-slate-950 p-2.5 rounded-xl flex items-center justify-center relative shadow-inner">
                                            <svg className="w-full h-full text-white" viewBox="0 0 100 100" fill="currentColor">
                                                <rect x="5" y="5" width="25" height="25" />
                                                <rect x="9" y="9" width="17" height="17" fill="black" />
                                                <rect x="13" y="13" width="9" height="9" fill="white" />
                                                
                                                <rect x="70" y="5" width="25" height="25" />
                                                <rect x="74" y="9" width="17" height="17" fill="black" />
                                                <rect x="78" y="13" width="9" height="9" fill="white" />

                                                <rect x="5" y="70" width="25" height="25" />
                                                <rect x="9" y="74" width="17" height="17" fill="black" />
                                                <rect x="13" y="78" width="9" height="9" fill="white" />

                                                <rect x="35" y="10" width="10" height="10" />
                                                <rect x="50" y="15" width="15" height="8" />
                                                <rect x="35" y="35" width="30" height="10" />
                                                <rect x="70" y="40" width="20" height="20" />
                                                <rect x="40" y="55" width="15" height="15" />
                                                <rect x="60" y="70" width="30" height="10" />
                                                <rect x="35" y="80" width="20" height="10" />
                                                <rect x="75" y="85" width="15" height="10" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className="bg-brand-blue text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow">
                                                    PIX
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 block">
                                            Aponte a câmera no app do seu banco
                                        </span>
                                    </div>

                                    {/* Pix Copy Box */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Chave Pix
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={group.key.pix_key}
                                                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none font-bold"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleCopyPix(group.key.id, group.key.pix_key)}
                                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                                                    isCopied
                                                        ? 'bg-emerald-600 text-white shadow-md'
                                                        : 'bg-brand-blue hover:bg-blue-600 text-white shadow'
                                                }`}
                                            >
                                                {isCopied ? '✓ Copiado!' : 'Copiar Chave'}
                                            </button>
                                        </div>
                                    </div>

                                    {group.key.description && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                            Obs: {group.key.description}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Instructions */}
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 text-slate-600 dark:text-slate-300 text-xs space-y-1.5">
                    <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        💡 Instruções de Pagamento:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-600 dark:text-slate-400">
                        <li>Abra o aplicativo do seu banco de preferência.</li>
                        <li>Acesse a opção <strong>Pix</strong> e escolha pagar via QR Code ou Chave Pix.</li>
                        <li>Realize a transferência para cada conta bancária indicada acima nos valores especificados.</li>
                        <li>Conclua a transferência bancária com segurança.</li>
                    </ol>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <PortalButton
                        variant="outline"
                        size="md"
                        onClick={onBack}
                    >
                        &larr; Voltar
                    </PortalButton>
                    <PortalButton
                        variant="primary"
                        size="md"
                        className="flex-1"
                        onClick={onFinish}
                    >
                        Concluir e Ver Comprovante de Intenção &rarr;
                    </PortalButton>
                </div>
            </div>
        </PortalCard>
    );
};
