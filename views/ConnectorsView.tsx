
import React, { useState, useContext, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppContext } from '../contexts/AppContext';
import { 
    LinkIcon, 
    ShieldCheckIcon, 
    BoltIcon, 
    CheckCircleIcon, 
    ClipboardDocumentIcon,
    InformationCircleIcon,
    BuildingOfficeIcon,
    ChevronDownIcon,
    ArrowUturnLeftIcon,
    DevicePhoneMobileIcon,
    LightBulbIcon
} from '../components/Icons';

export const ConnectorsView: React.FC = () => {
    const { user } = useAuth();
    const { showToast, setActiveView } = useUI();
    const { banks } = useContext(AppContext);
    
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [copied, setCopied] = useState(false);

    // Inicializa com o primeiro banco se houver
    useEffect(() => {
        if (banks.length > 0 && !selectedBankId) {
            setSelectedBankId(banks[0].id);
        }
    }, [banks]);

    // URL de Webhook dinâmica baseada no Banco Selecionado
    const webhookUrl = selectedBankId 
        ? `${window.location.origin}/api/inbox/${user?.id}/${selectedBankId}`
        : 'Selecione um banco abaixo...';

    const handleCopy = () => {
        if (!selectedBankId) {
            showToast("Selecione um banco primeiro!", "error");
            return;
        }
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        showToast("URL do banco copiada!", "success");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col min-h-full animate-fade-in gap-6 pb-12 px-4 md:px-8 overflow-x-auto custom-scrollbar">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 min-w-max md:min-w-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setActiveView('upload')}
                        className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-blue transition-colors"
                    >
                        <ArrowUturnLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight leading-none">Automação de Notificações</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Receba doações no sistema no exato momento que o banco te avisar.</p>
                    </div>
                </div>
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-full flex items-center gap-2 w-fit">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full v-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Conexão em Tempo Real</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-w-max lg:min-w-0">
                {/* CARD 1: CONFIGURAÇÃO POR BANCO */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/5 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32"></div>
                    
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-brand-blue border border-blue-100 dark:border-blue-800">
                            <LinkIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 dark:text-white text-lg uppercase tracking-tight">Vincular meu Banco</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Gere o link para colocar no seu aplicativo de automação.</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Seletor de Banco */}
                        <div className="relative group/select">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">1. Qual conta bancária receberá?</label>
                            <div className="relative">
                                <BuildingOfficeIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within/select:text-brand-blue transition-colors" />
                                <select 
                                    value={selectedBankId}
                                    onChange={(e) => setSelectedBankId(e.target.value)}
                                    className="w-full pl-12 pr-10 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-brand-blue/10 appearance-none transition-all"
                                >
                                    <option value="" disabled>Escolha o banco...</option>
                                    {banks.map(bank => (
                                        <option key={bank.id} value={bank.id}>{bank.name}</option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>

                        {/* URL Gerada */}
                        <div className="relative group/input">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">2. Copie este link de conexão</label>
                            <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl">
                                <div className="px-4 py-2 text-xs font-mono text-slate-600 dark:text-slate-300 truncate flex-1">
                                    {webhookUrl}
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className={`p-3 rounded-xl transition-all flex items-center gap-2 ${copied ? 'bg-emerald-500 text-white' : 'bg-brand-blue text-white hover:bg-blue-600 shadow-lg shadow-blue-500/30'}`}
                                >
                                    {copied ? <CheckCircleIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                                    <span className="text-[10px] font-bold uppercase">{copied ? 'Copiado!' : 'Copiar'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-4 rounded-2xl flex gap-4">
                            <LightBulbIcon className="w-6 h-6 text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                                <strong>Importante:</strong> Você deve fazer este processo para cada banco que a igreja utiliza. Cada um tem o seu próprio link.
                            </p>
                        </div>
                    </div>
                </div>

                {/* CARD 2: PASSO A PASSO PRÁTICO */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <DevicePhoneMobileIcon className="w-4 h-4 text-brand-blue" />
                        Passo a Passo no Celular
                    </h3>
                    
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-black text-brand-blue shrink-0">1</div>
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-tight">Instale o Aplicativo</h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                No Android, baixe o app <strong>"SMS Forwarder"</strong> (ícone azul com seta). No iPhone, usaremos o app <strong>"Atalhos"</strong> que já vem no sistema.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-black text-brand-blue shrink-0">2</div>
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-tight">Crie uma Regra de Envio</h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Configure para que: "Toda vez que chegar um SMS do Banco X, enviar para um link da internet".
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-black text-brand-blue shrink-0">3</div>
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-tight">Cole o Link e Salve</h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                No campo de "URL" ou "Destino" do app, cole o <strong>Link</strong> que você copiou no card ao lado. Salve e pronto!
                            </p>
                        </div>
                    </div>

                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl flex items-center gap-4">
                        <CheckCircleIcon className="w-8 h-8 text-emerald-500 shrink-0" />
                        <p className="text-xs text-emerald-800 dark:text-emerald-400 font-bold leading-tight">
                            Agora as doações cairão sozinhas na sua "Lista Viva" dentro da tela de Lançar Dados.
                        </p>
                    </div>
                </div>
            </div>

            {/* SEÇÃO DE SEGURANÇA OTIMIZADA */}
            <div className="mt-4 bg-slate-900 rounded-3xl p-5 text-white relative overflow-hidden border border-white/5 min-w-max md:min-w-0">
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-blue/10 rounded-full blur-3xl pointer-events-none -mr-24 -mt-24"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="p-2.5 bg-white/5 rounded-xl backdrop-blur-md border border-white/10 shrink-0">
                        <ShieldCheckIcon className="w-5 h-5 text-brand-teal" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-[10px] font-black tracking-tight uppercase mb-1">Privacidade Garantida</h3>
                        <p className="text-slate-400 text-xs font-medium leading-relaxed max-w-2xl">
                            Esses links são exclusivos da sua igreja. O sistema lê apenas os dados de valor e nome contidos na mensagem do banco. Qualquer dúvida chame o Suporte.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
