import React, { useState } from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { PortalRequestStatusCard } from '../components/PortalRequestStatusCard';
import { formatCurrencyBrl } from '../utils/portalFormatters';
import { usePortalPix } from '../hooks/usePortalPix';

interface PortalPaymentStepProps {
    churchId?: string;
    requestId?: string;
    totalAmount: number;
    referenceNumber: string;
    onBack: () => void;
    onFinish: () => void;
}

export const PortalPaymentStep: React.FC<PortalPaymentStepProps> = ({
    churchId,
    requestId,
    totalAmount,
    referenceNumber,
    onBack,
    onFinish
}) => {
    const { pixKeys, selectedKey, selectedKeyId, setSelectedKeyId, loading, error, refetch } = usePortalPix(churchId);
    const [copied, setCopied] = useState(false);

    const handleCopyPix = (keyToCopy: string) => {
        if (!keyToCopy) return;
        navigator.clipboard.writeText(keyToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
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

    return (
        <PortalCard
            title="Forma de Pagamento via Pix"
            subtitle="Utilize as informações oficiais da igreja para realizar sua contribuição no aplicativo do seu banco."
        >
            <div className="space-y-6">
                {/* Total & Reference Header */}
                <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue dark:text-blue-400 block">
                        Valor da Intenção de Contribuição
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

                {/* Active Pix Keys Selection & Details */}
                {!loading && !error && pixKeys.length > 0 && selectedKey && (
                    <div className="space-y-5">
                        {/* Multiple Keys Selection Selector (if > 1 key) */}
                        {pixKeys.length > 1 && (
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Escolha a chave Pix para transferência:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {pixKeys.map((k) => (
                                        <button
                                            key={k.id}
                                            type="button"
                                            onClick={() => setSelectedKeyId(k.id)}
                                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                                                k.id === selectedKey.id
                                                    ? 'border-brand-blue bg-blue-500/5 dark:bg-blue-500/10 ring-2 ring-brand-blue/30'
                                                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-800 dark:text-white">
                                                    {k.bank_name || 'Banco da Igreja'}
                                                </span>
                                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    {formatPixTypeLabel(k.pix_type)}
                                                </span>
                                            </div>
                                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate mt-1">
                                                {k.pix_key}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Selected Key Display Card */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                            {/* Bank and Holder Info Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block">
                                        Instituição / Banco
                                    </span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-white">
                                        {selectedKey.bank_name || 'Banco da Igreja'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block">
                                        Tipo de Chave
                                    </span>
                                    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-brand-blue/10 text-brand-blue dark:text-blue-400 mt-0.5">
                                        {formatPixTypeLabel(selectedKey.pix_type)}
                                    </span>
                                </div>
                            </div>

                            {/* Titular */}
                            {selectedKey.holder_name && (
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block">
                                        Favorecido / Titular
                                    </span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {selectedKey.holder_name}
                                    </span>
                                </div>
                            )}

                            {/* Static QR Code Representation */}
                            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-w-xs mx-auto text-center shadow-sm">
                                <div className="w-40 h-40 bg-slate-900 dark:bg-slate-950 p-2.5 rounded-xl flex items-center justify-center relative shadow-inner">
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
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2 block">
                                    Aponte a câmera no app do seu banco
                                </span>
                            </div>

                            {/* Pix Copy Box */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Chave Pix da Igreja
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedKey.pix_key}
                                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none font-bold"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopyPix(selectedKey.pix_key)}
                                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                                            copied
                                                ? 'bg-emerald-600 text-white shadow-md'
                                                : 'bg-brand-blue hover:bg-blue-600 text-white shadow'
                                        }`}
                                    >
                                        {copied ? '✓ Copiado!' : 'Copiar Chave'}
                                    </button>
                                </div>
                            </div>

                            {selectedKey.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                    Obs: {selectedKey.description}
                                </p>
                            )}
                        </div>
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
                        <li>Insira o valor exato da sua contribuição (<strong>{formatCurrencyBrl(totalAmount)}</strong>).</li>
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
