import React, { useState } from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { IdentificationType } from '../types/portal';
import { 
    formatCpf, 
    formatPhone, 
    validateCpfVisual, 
    validatePhoneVisual, 
    validateEmailVisual 
} from '../utils/portalFormatters';

interface PortalIdentifyStepProps {
    identificationType: IdentificationType;
    identificationValue: string;
    mockSearchFound: boolean;
    isSearching?: boolean;
    apiError?: string | null;
    onTypeChange: (type: IdentificationType) => void;
    onValueChange: (value: string) => void;
    onPerformSearch?: () => Promise<boolean>;
    onMockSearchToggle: (found: boolean) => void;
    onContinue: () => void;
}

export const PortalIdentifyStep: React.FC<PortalIdentifyStepProps> = ({
    identificationType,
    identificationValue,
    mockSearchFound,
    isSearching = false,
    apiError,
    onTypeChange,
    onValueChange,
    onPerformSearch,
    onMockSearchToggle,
    onContinue
}) => {
    const [inputError, setInputError] = useState<string | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        let formatted = raw;

        if (identificationType === 'cpf') {
            formatted = formatCpf(raw);
        } else if (identificationType === 'phone') {
            formatted = formatPhone(raw);
        }

        onValueChange(formatted);
        if (inputError) setInputError(null);
    };

    const handleNext = async () => {
        if (!identificationValue.trim()) {
            setInputError('Por favor, informe seu dado de identificação.');
            return;
        }

        if (identificationType === 'cpf' && !validateCpfVisual(identificationValue)) {
            setInputError('CPF inválido. Digite os 11 dígitos.');
            return;
        }

        if (identificationType === 'phone' && !validatePhoneVisual(identificationValue)) {
            setInputError('Telefone inválido. Digite um DDD e número com 10 ou 11 dígitos.');
            return;
        }

        if (identificationType === 'email' && !validateEmailVisual(identificationValue)) {
            setInputError('E-mail em formato inválido.');
            return;
        }

        setInputError(null);

        if (onPerformSearch) {
            await onPerformSearch();
        }

        onContinue();
    };

    return (
        <PortalCard
            title="Identificação do Contribuinte"
            subtitle="Informe seus dados para localizar ou vincular sua contribuição com segurança."
        >
            <div className="space-y-6">
                {/* Method selector buttons */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Como deseja se identificar?
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => { onTypeChange('cpf'); setInputError(null); }}
                            className={`py-3 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                                identificationType === 'cpf'
                                    ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            🪪 CPF
                        </button>
                        <button
                            type="button"
                            onClick={() => { onTypeChange('phone'); setInputError(null); }}
                            className={`py-3 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                                identificationType === 'phone'
                                    ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            📱 Telefone
                        </button>
                        <button
                            type="button"
                            onClick={() => { onTypeChange('email'); setInputError(null); }}
                            className={`py-3 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                                identificationType === 'email'
                                    ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            ✉️ E-mail
                        </button>
                    </div>
                </div>

                {/* Input field with visual validation */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {identificationType === 'cpf' && 'Número do CPF'}
                        {identificationType === 'phone' && 'Número do Celular / WhatsApp'}
                        {identificationType === 'email' && 'Endereço de E-mail'}
                    </label>
                    <input
                        type={identificationType === 'email' ? 'email' : 'text'}
                        value={identificationValue}
                        onChange={handleInputChange}
                        placeholder={
                            identificationType === 'cpf' ? '000.000.000-00' :
                            identificationType === 'phone' ? '(11) 98765-4321' :
                            'seu.email@exemplo.com'
                        }
                        className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${
                            inputError 
                                ? 'border-rose-500 focus:ring-rose-500/20' 
                                : 'border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-blue-500/20'
                        }`}
                    />
                    {inputError && (
                        <p className="text-xs font-semibold text-rose-500 mt-1.5 flex items-center gap-1">
                            ⚠️ {inputError}
                        </p>
                    )}
                    {apiError && (
                        <p className="text-xs font-semibold text-rose-500 mt-1.5 flex items-center gap-1">
                            ❌ {apiError}
                        </p>
                    )}
                </div>

                {/* Database Connection Notice */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">
                        ⚡
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Conexão em Tempo Real
                        </span>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Consulta diretamente a base oficial de contribuintes do IgGestor.
                        </p>
                    </div>
                </div>

                <div className="pt-2">
                    <PortalButton
                        variant="primary"
                        size="lg"
                        className="w-full"
                        onClick={handleNext}
                        disabled={isSearching}
                    >
                        {isSearching ? 'Buscando no Sistema...' : 'Continuar →'}
                    </PortalButton>
                </div>
            </div>
        </PortalCard>
    );
};
