import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { XMarkIcon, ShieldCheckIcon, DocumentTextIcon, PrinterIcon } from '../Icons';

interface ContractTermsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ContractTermsModal: React.FC<ContractTermsModalProps> = ({ isOpen, onClose }) => {
    const { systemSettings } = useAuth();

    if (!isOpen) return null;

    const ownerName = systemSettings?.ownerName || 'Gleibe Oliveira da Silva';
    const ownerCpf = systemSettings?.ownerCpf || '907.169.901-30';
    const ownerEmail = systemSettings?.ownerEmail || 'identificapix@gmail.com';

    const handlePrint = () => {
        window.print();
    };

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-elevated border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] animate-scale-in"
            >
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <DocumentTextIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                                Termos de Licença e Uso da Plataforma
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                IdentificaPix — Contrato de Licenciamento de Software
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handlePrint}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Imprimir ou Salvar em PDF"
                        >
                            <PrinterIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div
                    className="p-6 overflow-y-auto space-y-5 text-slate-600 dark:text-slate-300 text-xs leading-relaxed custom-scrollbar print:text-black"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                    
                    {/* Owner Card */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-xs">
                        <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold text-xs uppercase tracking-wider">
                            <ShieldCheckIcon className="w-4 h-4" />
                            <span>Identificação do Licenciante e Proprietário</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
                            <div>
                                <span className="block text-slate-400 text-[10px] uppercase font-semibold">Proprietário (Pessoa Física):</span>
                                <strong className="text-slate-800 dark:text-white font-semibold">{ownerName}</strong>
                            </div>
                            <div>
                                <span className="block text-slate-400 text-[10px] uppercase font-semibold">CPF:</span>
                                <strong className="text-slate-800 dark:text-white font-semibold tabular-nums">{ownerCpf}</strong>
                            </div>
                            <div>
                                <span className="block text-slate-400 text-[10px] uppercase font-semibold">E-mail de Suporte:</span>
                                <strong className="text-slate-800 dark:text-white font-semibold">{ownerEmail}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Clauses */}
                    <div className="space-y-4">
                        <section className="space-y-1.5">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">1. Objeto do Licenciamento</h3>
                            <p>
                                O presente Termo rege a concessão de licença de uso temporária, não exclusiva e intransferível do software <strong>IdentificaPix</strong>, de propriedade do titular pessoa física acima qualificado, para gestão, conciliação e identificação de contribuições bancárias e transações via extrato/PIX.
                            </p>
                        </section>

                        <section className="space-y-1.5">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">2. Propriedade Intelectual e Direitos Autorais</h3>
                            <p>
                                O software IdentificaPix, seus códigos-fonte, algoritmos de inteligência artificial, marcas, logos e interfaces visuais são de propriedade exclusiva do Licenciante (<strong>{ownerName}</strong>, CPF <strong>{ownerCpf}</strong>). A contratante ou usuário obtém apenas o direito de uso conforme o plano contratado.
                            </p>
                        </section>

                        <section className="space-y-1.5">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">3. Proteção de Dados e LGPD</h3>
                            <p>
                                O IdentificaPix respeita integralmente a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Os dados de extrato e cadastros inseridos no sistema são processados de forma segura e confidencial para fins estritos de conciliação financeira da entidade cadastrada, não sendo comercializados nem compartilhados com terceiros não autorizados.
                            </p>
                        </section>

                        <section className="space-y-1.5">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">4. Responsabilidades do Usuário</h3>
                            <p>
                                O Usuário é responsável pelo sigilo de suas credenciais de acesso e pela veracidade das informações financeiras importadas no sistema. O Licenciante não se responsabiliza por mau uso das ferramentas ou inconsistências oriundas de dados bancários incorretos fornecidos pelo próprio Usuário.
                            </p>
                        </section>

                        <section className="space-y-1.5">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">5. Suporte Técnico e Atualizações</h3>
                            <p>
                                O suporte ao sistema é prestado via canal oficial de e-mail (<strong>{ownerEmail}</strong>) e WhatsApp cadastrado na plataforma, garantindo correções de bugs, manutenções evolutivas e estabilidade do serviço.
                            </p>
                        </section>

                        <section className="space-y-1.5">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">6. Foro e Legislação Aplicável</h3>
                            <p>
                                Este contrato é regido pelas leis da República Federativa do Brasil, elegendo-se o foro do domicílio do Licenciante para dirimir quaisquer dúvidas decorrentes deste instrumento.
                            </p>
                        </section>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        IdentificaPix © Todos os direitos reservados.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};
