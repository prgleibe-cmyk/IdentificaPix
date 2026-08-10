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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-blue/10 rounded-2xl text-brand-blue">
                            <DocumentTextIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                                Termos de Licença e Uso da Plataforma
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                IdentificaPix — Contrato de Licenciamento de Software
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
                            title="Imprimir ou Salvar em PDF"
                        >
                            <PrinterIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-slate-600 dark:text-slate-300 text-xs leading-relaxed custom-scrollbar print:text-black">
                    
                    {/* Owner Card */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2">
                        <div className="flex items-center gap-2 text-brand-blue font-bold text-xs uppercase tracking-wider">
                            <ShieldCheckIcon className="w-4 h-4" />
                            <span>Identificação do Licenciante e Proprietário</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
                            <div>
                                <span className="block text-slate-400 text-[10px] uppercase font-semibold">Proprietário (Pessoa Física):</span>
                                <strong className="text-slate-800 dark:text-white font-bold">{ownerName}</strong>
                            </div>
                            <div>
                                <span className="block text-slate-400 text-[10px] uppercase font-semibold">CPF:</span>
                                <strong className="text-slate-800 dark:text-white font-bold">{ownerCpf}</strong>
                            </div>
                            <div>
                                <span className="block text-slate-400 text-[10px] uppercase font-semibold">E-mail de Suporte:</span>
                                <strong className="text-slate-800 dark:text-white font-bold">{ownerEmail}</strong>
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
                <div className="p-4 px-6 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">
                        IdentificaPix © Todos os direitos reservados.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl bg-brand-blue text-white font-bold text-xs hover:bg-blue-600 transition-colors shadow-md shadow-blue-500/20"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};
