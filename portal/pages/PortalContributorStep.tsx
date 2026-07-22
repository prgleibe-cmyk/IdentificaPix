import React, { useState } from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { ContributorMockProfile } from '../types/portal';
import { formatCpf, formatPhone, validateEmailVisual } from '../utils/portalFormatters';

interface PortalContributorStepProps {
    contributor: ContributorMockProfile;
    mockSearchFound: boolean;
    isSaving?: boolean;
    apiError?: string | null;
    onUpdateContributor: (updates: Partial<ContributorMockProfile>) => void;
    onSaveContributor?: () => Promise<boolean>;
    onBack: () => void;
    onContinue: () => void;
}

export const PortalContributorStep: React.FC<PortalContributorStepProps> = ({
    contributor,
    mockSearchFound,
    isSaving = false,
    apiError,
    onUpdateContributor,
    onSaveContributor,
    onBack,
    onContinue
}) => {
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!mockSearchFound) {
            const errors: Record<string, string> = {};
            if (!contributor.name.trim()) errors.name = 'Nome é obrigatório.';
            if (!contributor.cpf.trim()) errors.cpf = 'CPF é obrigatório.';
            if (!contributor.phone.trim()) errors.phone = 'Telefone é obrigatório.';
            if (!contributor.email.trim() || !validateEmailVisual(contributor.email)) {
                errors.email = 'E-mail válido é obrigatório.';
            }

            if (Object.keys(errors).length > 0) {
                setFormErrors(errors);
                return;
            }

            if (onSaveContributor) {
                const success = await onSaveContributor();
                if (!success) return;
            }
        }

        setFormErrors({});
        onContinue();
    };

    return (
        <PortalCard
            title={mockSearchFound ? "Contribuinte Identificado" : "Cadastro de Contribuinte"}
            subtitle={
                mockSearchFound 
                    ? "Confirmamos sua identificação no sistema." 
                    : "Preencha seus dados para vincular suas ofertas com segurança."
            }
        >
            {mockSearchFound ? (
                /* Scenario 3A: Existing Contributor Found */
                <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                        <div className="w-20 h-20 rounded-full bg-brand-blue text-white flex items-center justify-center font-black text-2xl shadow-lg ring-4 ring-white dark:ring-slate-800">
                            {contributor.name ? contributor.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div className="flex-1 space-y-1">
                            <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                ✓ Contribuinte Cadastrado
                            </span>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">
                                {contributor.name}
                            </h3>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Congregação: <span className="text-slate-700 dark:text-slate-200">{contributor.congregation}</span>
                            </p>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                                <span>🪪 {contributor.cpf}</span>
                                <span>📱 {contributor.phone}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            👋 Bem-vindo novamente! Suas contribuições serão automaticamente associadas ao seu histórico.
                        </p>
                    </div>

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
                            onClick={onContinue}
                        >
                            Continuar para Contribuições &rarr;
                        </PortalButton>
                    </div>
                </div>
            ) : (
                /* Scenario 3B: New Contributor Registration Form */
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Nome Completo *
                        </label>
                        <input
                            type="text"
                            value={contributor.name}
                            onChange={(e) => onUpdateContributor({ name: e.target.value })}
                            placeholder="Nome Completo do Contribuinte"
                            className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 ${
                                formErrors.name ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                            }`}
                        />
                        {formErrors.name && <p className="text-xs text-rose-500 mt-1">{formErrors.name}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                CPF *
                            </label>
                            <input
                                type="text"
                                value={contributor.cpf}
                                onChange={(e) => onUpdateContributor({ cpf: formatCpf(e.target.value) })}
                                placeholder="000.000.000-00"
                                className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 ${
                                    formErrors.cpf ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                }`}
                            />
                            {formErrors.cpf && <p className="text-xs text-rose-500 mt-1">{formErrors.cpf}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Telefone / WhatsApp *
                            </label>
                            <input
                                type="text"
                                value={contributor.phone}
                                onChange={(e) => onUpdateContributor({ phone: formatPhone(e.target.value) })}
                                placeholder="(11) 98765-4321"
                                className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 ${
                                    formErrors.phone ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                                }`}
                            />
                            {formErrors.phone && <p className="text-xs text-rose-500 mt-1">{formErrors.phone}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            E-mail *
                        </label>
                        <input
                            type="email"
                            value={contributor.email}
                            onChange={(e) => onUpdateContributor({ email: e.target.value })}
                            placeholder="seu.email@exemplo.com"
                            className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 ${
                                formErrors.email ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20'
                            }`}
                        />
                        {formErrors.email && <p className="text-xs text-rose-500 mt-1">{formErrors.email}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Cidade
                            </label>
                            <input
                                type="text"
                                value={contributor.city}
                                onChange={(e) => onUpdateContributor({ city: e.target.value })}
                                placeholder="Cidade"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Estado
                            </label>
                            <select
                                value={contributor.state}
                                onChange={(e) => onUpdateContributor({ state: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO', 'DF'].map((st) => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Congregação *
                        </label>
                        <select
                            value={contributor.congregation}
                            onChange={(e) => onUpdateContributor({ congregation: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                        >
                            <option value="Sede Central">Sede Central</option>
                            <option value="Congregação Norte">Congregação Norte</option>
                            <option value="Congregação Sul">Congregação Sul</option>
                            <option value="Congregação Leste">Congregação Leste</option>
                        </select>
                    </div>

                    {apiError && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 font-bold">
                            ⚠️ {apiError}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <PortalButton
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={onBack}
                        >
                            &larr; Voltar
                        </PortalButton>
                        <PortalButton
                            type="submit"
                            variant="primary"
                            size="md"
                            className="flex-1"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Salvando Cadastro...' : 'Cadastrar e Continuar →'}
                        </PortalButton>
                    </div>
                </form>
            )}
        </PortalCard>
    );
};
