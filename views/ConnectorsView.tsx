
import React, { useState, useContext, useEffect, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppContext } from '../contexts/AppContext';
import { 
    LinkIcon, 
    ShieldCheckIcon, 
    CheckCircleIcon, 
    ClipboardDocumentIcon,
    BuildingOfficeIcon,
    ChevronDownIcon,
    ArrowUturnLeftIcon,
    DevicePhoneMobileIcon,
    LightBulbIcon
} from '../components/Icons';

import { resolveBankKey } from '../utils/bankHelper';

export const ConnectorsView: React.FC = memo(() => {
    const { session, user } = useAuth();
    const { showToast, setActiveView } = useUI();
    const { banks } = useContext(AppContext);
    
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [inboxKey, setInboxKey] = useState<string>('');
    const [selectedOS] = useState<'android'>('android');
    const [activeStep, setActiveStep] = useState<number>(1);

    // Inicializa com o primeiro banco se houver
    useEffect(() => {
        if (banks.length > 0 && !selectedBankId) {
            setSelectedBankId(banks[0].id);
        }
    }, [banks]);

    // Busca a chave de segurança do Inbox de forma autenticada do servidor
    useEffect(() => {
        const fetchInboxKey = async () => {
            if (!session?.access_token) return;
            try {
                const response = await fetch('/api/inbox/config', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.key) {
                        setInboxKey(data.key);
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar chave de automação:", error);
            }
        };
        fetchInboxKey();
    }, [session]);

    // URL de Webhook dinâmica baseada no Banco Selecionado com a chave do Inbox embutida
    const webhookUrl = selectedBankId 
        ? `${window.location.origin}/api/inbox/${user?.id}/${selectedBankId}${inboxKey ? `?key=${inboxKey}` : ''}`
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

    const totalSteps = selectedOS === 'android' ? 12 : 3;

    return (
        <div className="flex flex-col min-h-full animate-fade-in gap-3 pb-16 md:pb-4 min-w-0">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button 
                            onClick={() => setActiveView('upload')}
                            title="Voltar para Lançar Dados"
                            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95 shrink-0"
                        >
                            <ArrowUturnLeftIcon className="w-4 h-4" />
                        </button>
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <DevicePhoneMobileIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Automação de Notificações
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Receba doações no sistema no exato momento em que o banco avisar.
                            </p>
                        </div>
                    </div>

                    <div className="inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg w-full sm:w-auto shrink-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Conexão em Tempo Real</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start min-w-0">
                {/* CARD 1: CONFIGURAÇÃO POR BANCO */}
                <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden min-w-0">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <LinkIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight leading-tight">Vincular meu Banco</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Gere o link para colocar no seu aplicativo de automação.</p>
                        </div>
                    </div>

                    <div className="p-4 md:p-5 space-y-5 min-w-0">
                        {/* Seletor de Banco */}
                        <div className="relative group/select min-w-0">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                                1. Qual conta bancária receberá?
                            </label>
                            <div className="relative">
                                <BuildingOfficeIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within/select:text-orange-600 transition-colors" />
                                <select 
                                    value={selectedBankId}
                                    onChange={(e) => setSelectedBankId(e.target.value)}
                                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 appearance-none transition-all"
                                >
                                    <option value="" disabled>Escolha o banco...</option>
                                    {banks.filter(b => {
                                        const key = resolveBankKey(b);
                                        return key === 'SICOOB' || key === 'SICREDI';
                                    }).map(bank => (
                                        <option key={bank.id} value={bank.id}>{bank.name}</option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>

                        {/* URL Gerada */}
                        <div className="min-w-0">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                                2. Copie este link de conexão
                            </label>
                            <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg min-w-0">
                                <div className="px-2.5 py-1.5 text-xs font-mono text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">
                                    {webhookUrl}
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 shrink-0 text-xs font-semibold active:scale-95 ${
                                        copied 
                                            ? 'bg-emerald-600 text-white' 
                                            : 'bg-orange-600 text-white hover:bg-orange-700 shadow-xs'
                                    }`}
                                >
                                    {copied ? <CheckCircleIcon className="w-4 h-4 shrink-0" /> : <ClipboardDocumentIcon className="w-4 h-4 shrink-0" />}
                                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 p-3.5 rounded-lg flex items-start gap-3">
                            <LightBulbIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                                <strong>Importante:</strong> Você deve fazer este processo para cada banco que a igreja utiliza. Cada um tem o seu próprio link.
                            </p>
                        </div>
                    </div>
                </div>

                {/* CARD 2: PASSO A PASSO PRÁTICO PARA ANDROID */}
                <div className="xl:col-span-7 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden min-w-0">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                                <DevicePhoneMobileIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight leading-tight">
                                    Manual de Configuração (Android)
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    Siga os passos abaixo no aplicativo MacroDroid
                                </p>
                            </div>
                        </div>
                        <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-900/40 px-2.5 py-1 rounded-md shrink-0 tabular-nums">
                            Passo {activeStep} de {totalSteps}
                        </span>
                    </div>

                    <div className="p-4 md:p-5 flex flex-col gap-5 min-w-0">
                        {/* Stepper Responsivo sem overflow */}
                        <div className="space-y-2 min-w-0">
                            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                                {Array.from({ length: totalSteps }).map((_, idx) => {
                                    const stepNum = idx + 1;
                                    const isCompleted = activeStep > stepNum;
                                    const isActive = activeStep === stepNum;
                                    return (
                                        <button
                                            key={stepNum}
                                            onClick={() => setActiveStep(stepNum)}
                                            className={`h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all border ${
                                                isCompleted 
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300' 
                                                    : isActive 
                                                    ? 'bg-orange-600 border-orange-600 text-white shadow-xs' 
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {isCompleted ? '✓' : stepNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-orange-600 transition-all duration-300 rounded-full"
                                    style={{ width: `${(activeStep / totalSteps) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Interactive Screen Simulator + Steps Explanation Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start min-w-0">
                            
                            {/* Column 1: Step Detailed instructions (7/12 width) */}
                            <div className="md:col-span-7 space-y-4 min-w-0">
                                {selectedOS === 'android' ? (
                                    <>
                                        {activeStep === 1 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 1: Instalação e Acesso Inicial</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Instalar e Abrir o MacroDroid</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Abra a <strong>Google Play Store</strong> no seu celular, procure pelo aplicativo gratuito <strong className="text-orange-600 dark:text-orange-400">"MacroDroid"</strong> e faça a instalação. 
                                                    Ao abri-lo pela primeira vez, você verá a tela principal vazia. Dê um toque no botão redondo branco com o sinal de mais <strong className="text-orange-600 dark:text-orange-400">"+"</strong> no canto inferior direito para iniciar a criação da sua automação.
                                                </p>
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    <strong>Aviso importante:</strong> O aplicativo é totalmente grátis. Se aparecerem banners de assinatura Premium, basta clicar no "X" ou em "continuar grátis". A versão gratuita atende perfeitamente ao nosso sistema.
                                                </div>
                                            </div>
                                        )}

                                        {activeStep === 2 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 2: Nova Automação (Macro)</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Criar uma Nova Macro e Nomear</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Na tela de edição, escreva no topo o nome da sua automação para identificá-la facilmente, por exemplo: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-semibold text-orange-600 dark:text-orange-400">IgGestor - Sicredi</code>. 
                                                    Você notará três blocos vazios na tela: <strong>Gatilhos</strong> (Vermelho), <strong>Ações</strong> (Azul) e <strong>Restrições</strong> (Verde). Toque no sinal de mais <strong className="text-rose-600 dark:text-rose-400">"+"</strong> localizado no bloco <strong>Gatilhos</strong> vermelho.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 3 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 3: Selecionar Categoria</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Escolher Categoria "Eventos do Dispositivo"</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    A tela "Adicionar Gatilho" exibe diversas categorias organizadas em cores. Desça um pouco a tela e procure pela opção <strong>"Eventos do Dispositivo"</strong> (marcada por um ícone de celular com engrenagem). Dê um toque nela para expandir as opções.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 4 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 4: Selecionar Tipo de Evento</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Escolher o Gatilho de "Notificação"</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Nas subcategorias em vermelho de Eventos do Dispositivo, role a lista até o final e toque na opção <strong className="text-rose-600 dark:text-rose-400">"Notificação"</strong> (que contém um ícone de sininho/aviso de atenção amarelo).
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 5 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 5: Solicitação de Permissão</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Habilitar Acesso do Aplicativo ao Celular</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    O Android protege suas mensagens, por isso o MacroDroid mostrará o aviso <strong>"Acesso às Notificações Exigido"</strong> explicando que o sistema precisa de permissão de leitura de notificações. Toque no botão <strong className="text-orange-600 dark:text-orange-400">"OK"</strong> na caixa de diálogo para ir às configurações do aparelho celular.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 6 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 6: Permitir no Android</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Ativar Chave de Leitura de Notificações</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Na tela de configurações do Android, procure pela opção <strong>"MacroDroid"</strong> (que estará marcada como Não permitida/Inativa). Toque no interruptor ao lado para <strong className="text-emerald-600 dark:text-emerald-400">Ativá-lo</strong> e, na mensagem de segurança que surgir, clique em <strong>"Permitir"</strong> ou <strong>"Autorizar"</strong>. Depois, volte para o MacroDroid usando a seta de retorno.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 7 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 7: Detalhes do Gatilho</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Selecionar o Banco e Texto Detectado</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Ao voltar ao aplicativo, escolha a opção <strong>"Notificação Recebida"</strong> e clique em <strong>OK</strong>. Em seguida:
                                                </p>
                                                <ul className="text-xs text-slate-600 dark:text-slate-300 list-decimal pl-4 space-y-1.5 leading-relaxed">
                                                    <li>Marque <strong>"Apenas do aplicativo selecionado"</strong> e clique em OK. Selecione o aplicativo do seu banco (ex: <strong>Sicredi</strong>, <strong>Inter</strong>, <strong>Nubank</strong>, etc.).</li>
                                                    <li>Na tela do diálogo, marque <strong>"Ignorar maiúsculas/minúsculas"</strong>. Em <strong>Conteúdo do texto</strong>, marque <strong>"Contém"</strong> e digite o texto de identificação padrão do Pix recebido do seu banco (ex: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-semibold text-orange-600 dark:text-orange-400">recebeu um Pix</code> ou <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-semibold text-orange-600 dark:text-orange-400">Pix recebido</code>). Clique em <strong>OK</strong>.</li>
                                                </ul>
                                            </div>
                                        )}

                                        {activeStep === 8 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 8: Adicionar Ação</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Abrir o Menu de Categorias de Ação</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Agora com o gatilho configurado, toque no sinal de mais <strong className="text-blue-600 dark:text-blue-400">"+"</strong> no bloco azul <strong>"Ações"</strong>.
                                                    A tela <strong>Adicionar Ação</strong> abrirá com uma lista completa de categorias do sistema, como <em>Ações do dispositivo</em>, <em>Aplicativos</em>, <em>Conectividade</em>, <em>Interação Web</em>, entre outras.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 9 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 9: Buscar "Requisição HTTP"</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Pesquisar pela Ação Correta</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Toque no ícone de lupa no topo direito da tela, digite <strong className="text-orange-600 dark:text-orange-400">"req"</strong> ou <strong className="text-orange-600 dark:text-orange-400">"Requisição HTTP"</strong>.
                                                    Embaixo da categoria <strong>"Interação Web"</strong>, surgirá a opção <strong className="text-orange-600 dark:text-orange-400">"Requisição HTTP"</strong>. Dê um toque nela para abrir suas configurações.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 10 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 10: Método e URL</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Configurar Envio como POST</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Dentro da configuração da Requisição HTTP, altere o campo <strong>Método da requisição</strong> de <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">GET</code> para <strong className="text-orange-600 dark:text-orange-400">POST</strong>. 
                                                    No campo <strong>Digite a URL</strong>, cole exatamente o link exclusivo que você copiou no Card ao lado. Mantenha a opção <strong>"Seguir redirecionamentos"</strong> marcada.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 11 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 11: Parâmetros de Envio</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Configurar os Parâmetros de Query</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Para que o servidor do IgGestor autorize a sua requisição com segurança e processe o texto recebido, você <strong>precisa configurar dois parâmetros</strong> na aba <strong>"Parâmetros de query"</strong>:
                                                </p>
                                                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-white mb-1">1º Parâmetro (Texto da Notificação):</div>
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            <li>Toque no botão <strong className="text-orange-600 dark:text-orange-400">"+"</strong> no canto inferior direito para adicionar um parâmetro.</li>
                                                            <li>Nome do parâmetro: <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-rose-600 font-bold font-mono border border-slate-200 dark:border-slate-700">text</code></li>
                                                            <li>No campo <strong>Valor</strong>, clique no botão de três pontinhos <strong>"..."</strong> à direita e escolha <strong>"Texto da notificação"</strong> para inserir <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-emerald-600 font-mono border border-slate-200 dark:border-slate-700">{"{notification}"}</code>. Clique em <strong>OK</strong>.</li>
                                                        </ul>
                                                    </div>
                                                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2.5">
                                                        <div className="font-bold text-slate-900 dark:text-white mb-1">2º Parâmetro (Chave de Segurança - CRÍTICO):</div>
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            <li>Toque no botão <strong className="text-orange-600 dark:text-orange-400">"+"</strong> novamente.</li>
                                                            <li>Nome do parâmetro: <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-rose-600 font-bold font-mono border border-slate-200 dark:border-slate-700">key</code></li>
                                                            <li className="break-all">No campo <strong>Valor</strong>, digite exatamente o seu código de segurança único: <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-amber-600 font-mono font-bold select-all border border-slate-200 dark:border-slate-700">{inboxKey || 'identificapix_sms_2026'}</code>. Clique em <strong>OK</strong>.</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeStep === 12 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-md w-fit">Passo 12: Salvar e Ativar</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Salvar e Concluir a Configuração</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Na seção inferior das configurações da Requisição HTTP, certifique-se de que "Salvar código de retorno HTTP" esteja como <strong>"Não salvar saída"</strong> e marque a opção <strong>"Não salvar resposta HTTP"</strong> para otimizar o consumo de memória do celular.
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Clique no botão de <strong>✓</strong> no topo ou no ícone de disquete flutuante no canto inferior direito para salvar a Ação. Depois, clique no <strong>ícone de disquete</strong> na tela da Macro para gravar e ativar o monitoramento instantaneamente!
                                                </p>
                                                <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/70 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                                                    <strong>Excelente trabalho!</strong> Toda vez que seu aplicativo bancário enviar uma notificação de Pix, o MacroDroid enviará os detalhes e o IgGestor fará a identificação em menos de 1 segundo.
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {activeStep === 1 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 1: Obter URL</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Buscar o Serviço de Internet no iOS</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Abra o aplicativo <strong>Atalhos (Shortcuts)</strong> oficial da Apple em seu iPhone, crie uma automação de SMS recebido e busque por <strong className="text-orange-600">"URL"</strong> nas ações. Na lista que surgir, selecione <strong className="text-orange-600">"Obter Conteúdo da URL"</strong>.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 2 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 2: Mudar para POST</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Colar link e Mudar Método</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Cole o link copiado no primeiro campo azul. Depois, clique na setinha de expansão <strong className="text-orange-600">"&gt;"</strong> ao lado da ação e configure:
                                                </p>
                                                <ul className="text-xs text-slate-600 dark:text-slate-300 list-disc pl-4 space-y-1.5 leading-relaxed">
                                                    <li>Mude o <strong>Método</strong> de <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">GET</code> para <code className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-mono font-bold">POST</code>.</li>
                                                    <li>Configure o <strong>Corpo da Requisição</strong> para <strong className="text-slate-800 dark:text-slate-200">"JSON"</strong>.</li>
                                                </ul>
                                            </div>
                                        )}

                                        {activeStep === 3 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-0.5 rounded-md w-fit">Passo 3: Mapear Variável</span>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Mapear Entrada de Mensagem</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    No campo cinza ao lado de <strong className="text-rose-500">text</strong>:
                                                </p>
                                                <ul className="text-xs text-slate-600 dark:text-slate-300 list-decimal pl-4 space-y-1.5 leading-relaxed">
                                                    <li><strong>Toque na palavra "Texto"</strong> para abrir o teclado e a barra de ferramentas do iOS.</li>
                                                    <li>Na barra acima do teclado, clique em <strong className="text-orange-600 font-bold">"Entrada do Atalho"</strong> (ou <strong>"Shortcut Input"</strong>).</li>
                                                    <li>Pronto! Clique em "OK" no topo do celular para salvar. Agora, toda vez que chegar aviso do banco contendo o Pix, o iPhone processará de modo 100% automático na sua Lista Viva!</li>
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Navigation Buttons */}
                                <div className="flex items-center gap-2.5 pt-2">
                                    <button
                                        disabled={activeStep === 1}
                                        onClick={() => setActiveStep(prev => prev - 1)}
                                        className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all border border-slate-200 dark:border-slate-700 shadow-xs active:scale-95"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        disabled={activeStep === totalSteps}
                                        onClick={() => setActiveStep(prev => prev + 1)}
                                        className="flex-1 sm:flex-none px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-all shadow-xs active:scale-95"
                                    >
                                        Próximo
                                    </button>
                                </div>
                            </div>

                            {/* Column 2: Simulated Smartphone Preview (5/12 width) */}
                            <div className="md:col-span-5 flex justify-center w-full">
                                <div className="w-full max-w-[232px] h-[380px] bg-slate-950 rounded-[2.25rem] border-[5px] border-slate-900 shadow-lg overflow-hidden relative flex flex-col shrink-0">
                                    {/* Notch */}
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-slate-900 rounded-full z-30 flex items-center justify-center">
                                        <div className="w-8 h-0.5 bg-slate-800 rounded-full"></div>
                                    </div>

                                    {/* Smartphone Content Container */}
                                    <div className="flex-1 flex flex-col p-3 pt-6 text-slate-100 select-none overflow-hidden text-[9px] font-sans">
                                        {selectedOS === 'android' ? (
                                            <>
                                                {/* ANDROID SIMULATOR SCREENS */}
                                                
                                                {/* Status Bar */}
                                                <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono px-1">
                                                    <div className="flex items-center gap-1">
                                                        <span>15:26</span>
                                                        <span className="text-[6px] opacity-75">💬</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span>📶</span>
                                                        <span>5G</span>
                                                        <span>🔋 21%⚡</span>
                                                    </div>
                                                </div>

                                                {activeStep === 1 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="bg-[#1b2a4a] px-2 py-1.5 rounded-lg flex justify-between items-center text-slate-200 font-bold text-[8px] mb-1">
                                                            <span>⭐ Macros (0)</span>
                                                            <div className="flex gap-1.5 opacity-80">
                                                                <span>🔍</span>
                                                                <span>⚙️</span>
                                                                <span>⋮</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
                                                            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-xl mb-2 animate-bounce">
                                                                🤖
                                                            </div>
                                                            <div className="text-[8px] font-bold text-slate-300">Sem macros configuradas</div>
                                                            <div className="text-[6px] text-slate-500 mt-0.5">Use o botão + para criar uma nova</div>
                                                        </div>

                                                        {/* Bottom Tab Menu */}
                                                        <div className="grid grid-cols-4 gap-1 border-t border-slate-900 py-1.5 text-center text-[5px] text-slate-400 font-bold bg-[#111]">
                                                            <div>Início</div>
                                                            <div className="text-white">Macros</div>
                                                            <div>Modelos</div>
                                                            <div>Config.</div>
                                                        </div>

                                                        {/* Floating Action Button Highlight */}
                                                        <div className="absolute bottom-6 right-4 z-10 flex items-center justify-center">
                                                            <span className="absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75 animate-ping"></span>
                                                            <button 
                                                                onClick={() => setActiveStep(2)}
                                                                className="relative w-8 h-8 rounded-full bg-white text-slate-900 font-black flex items-center justify-center text-xs shadow-lg active:scale-95 hover:bg-slate-100"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 2 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="bg-[#1e293b] px-2.5 py-2 rounded-lg flex items-center justify-between text-slate-200 border-b border-slate-700">
                                                            <span className="text-[7px]">←</span>
                                                            <input 
                                                                type="text" 
                                                                value="IgGestor - Sicredi" 
                                                                disabled
                                                                className="bg-transparent text-white font-bold text-[8px] text-center border-b border-blue-400 w-28 outline-none ml-1"
                                                            />
                                                            <div className="flex gap-1.5 opacity-80 text-[7px]">
                                                                <span>💾</span>
                                                                <span>⋮</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex-1 py-2 space-y-2">
                                                            {/* Red Block Gatilhos */}
                                                            <div className="bg-rose-950/20 border border-rose-500/40 p-1.5 rounded-lg">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">🔴 Gatilhos</span>
                                                                    <div className="relative">
                                                                        <span className="absolute -left-1 -top-1 inline-flex h-4 w-4 rounded-full bg-rose-400 opacity-75 animate-ping"></span>
                                                                        <button onClick={() => setActiveStep(3)} className="w-3.5 h-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-center text-[8px]">+</button>
                                                                    </div>
                                                                </div>
                                                                <div className="text-[6px] text-rose-400/60 italic text-center py-1">Sem gatilhos configurados</div>
                                                            </div>

                                                            {/* Blue Block Ações */}
                                                            <div className="bg-blue-950/20 border border-blue-500/10 p-1.5 rounded-lg opacity-40">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">🔵 Ações</span>
                                                                    <span className="w-3.5 h-3.5 rounded-full bg-blue-600/40 text-white font-bold flex items-center justify-center text-[8px]">+</span>
                                                                </div>
                                                            </div>

                                                            {/* Green Block Restrições */}
                                                            <div className="bg-emerald-950/20 border border-emerald-500/10 p-1.5 rounded-lg opacity-40">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">🟢 Restrições</span>
                                                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-600/40 text-white font-bold flex items-center justify-center text-[8px]">+</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-[#101c2a] p-1 text-[6px] rounded flex justify-between items-center text-teal-400 border border-teal-900/30">
                                                            <span>Variáveis locais</span>
                                                            <span>➕</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 3 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="bg-rose-950 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-rose-200">
                                                            <span className="font-bold text-[8px]">Adicionar Gatilho</span>
                                                            <div className="flex gap-1.5">
                                                                <span>🔍</span>
                                                                <span>⋮</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex-1 py-1.5 space-y-1 overflow-y-auto">
                                                            <div className="p-1 px-2 bg-slate-900 text-slate-400 text-[6px] rounded">::: Aplicativos</div>
                                                            <div className="p-1 px-2 bg-slate-900 text-slate-400 text-[6px] rounded">🔋 Bateria / Energia</div>
                                                            <div className="p-1 px-2 bg-slate-900 text-slate-400 text-[6px] rounded">📞 Chamadas / SMS</div>
                                                            <div className="p-1 px-2 bg-slate-900 text-slate-400 text-[6px] rounded">📶 Conectividade</div>
                                                            <div className="p-1 px-2 bg-slate-900 text-slate-400 text-[6px] rounded">📅 Data / Hora</div>
                                                            <div className="p-1 px-2 bg-slate-900 text-slate-400 text-[6px] rounded">〰️ Específico do MacroDroid</div>
                                                            
                                                            {/* Highlight Target */}
                                                            <div className="relative">
                                                                <span className="absolute -inset-0.5 rounded-lg bg-rose-500 opacity-40 animate-pulse"></span>
                                                                <button 
                                                                    onClick={() => setActiveStep(4)} 
                                                                    className="relative w-full p-1.5 px-2 bg-rose-600 text-white text-[7px] rounded-lg font-black text-left flex justify-between items-center"
                                                                >
                                                                    <span>📱 Eventos do Dispositivo</span>
                                                                    <span className="animate-ping">👈</span>
                                                                </button>
                                                            </div>

                                                            <div className="p-1 px-2 bg-slate-900 text-slate-400 text-[6px] rounded">👥 Interação do Usuário</div>
                                                            <div className="p-1 px-2 bg-slate-900 text-slate-400 text-[6px] rounded">📍 Localização</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 4 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="bg-rose-950 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-rose-200">
                                                            <span className="font-bold text-[8px]">Eventos do Dispositivo</span>
                                                            <span>←</span>
                                                        </div>

                                                        <div className="flex-1 py-2 space-y-1 overflow-y-auto">
                                                            <div className="p-1 bg-slate-900/60 text-slate-500 text-[6px] rounded">Arquivo alterado</div>
                                                            <div className="p-1 bg-slate-900/60 text-slate-500 text-[6px] rounded">Botão de mídia pressionado</div>
                                                            <div className="p-1 bg-slate-900/60 text-slate-500 text-[6px] rounded">Câmara em uso</div>
                                                            <div className="p-1 bg-slate-900/60 text-slate-500 text-[6px] rounded">IP do dispositivo alterado</div>
                                                            
                                                            {/* Highlight Target */}
                                                            <div className="relative">
                                                                <span className="absolute -inset-0.5 rounded-lg bg-rose-500 opacity-40 animate-pulse"></span>
                                                                <button 
                                                                    onClick={() => setActiveStep(5)} 
                                                                    className="relative w-full p-2 bg-rose-700 text-white text-[7px] rounded-lg font-black text-left flex justify-between items-center"
                                                                >
                                                                    <span>🔔 Notificação</span>
                                                                    <span className="animate-ping">👈</span>
                                                                </button>
                                                            </div>

                                                            <div className="p-1 bg-slate-900/60 text-slate-500 text-[6px] rounded">Sinal de celular alterado</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 5 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between relative">
                                                        <div className="bg-rose-950 px-2.5 py-1.5 rounded-lg opacity-30 flex items-center justify-between">
                                                            <span className="font-bold text-[8px]">Eventos do Dispositivo</span>
                                                            <span>←</span>
                                                        </div>
                                                        <div className="flex-1 opacity-35 py-2 space-y-1">
                                                            <div className="p-1 bg-slate-900 text-[6px]">Arquivo alterado</div>
                                                            <div className="p-1 bg-slate-900 text-[6px]">Câmara em uso</div>
                                                        </div>

                                                        {/* Permission Required System Modal Popup (Acesso as Notificações Exigido) */}
                                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-2 z-20">
                                                            <div className="bg-[#2a2a2a] rounded-xl border border-slate-700 p-3 text-slate-100 flex flex-col gap-2 max-w-[190px] shadow-2xl animate-fade-in">
                                                                <h5 className="font-bold text-[8px] text-white">Acesso às Notificações Exigido</h5>
                                                                <p className="text-[6px] text-slate-400 leading-tight">
                                                                    Para usar esse recurso, é necessário habilitar a opção de acesso às Notificações nas configurações do dispositivo.
                                                                </p>
                                                                <div className="flex justify-end gap-2 text-[7px] font-black mt-1">
                                                                    <span className="text-slate-400 px-1 py-0.5">CANCELAR</span>
                                                                    <button 
                                                                        onClick={() => setActiveStep(6)}
                                                                        className="text-blue-400 font-bold px-1 py-0.5 bg-blue-500/10 rounded animate-pulse"
                                                                    >
                                                                        OK
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 6 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="px-2 py-2 flex items-center gap-1.5 border-b border-slate-800">
                                                            <span className="text-[10px]">←</span>
                                                            <span className="font-bold text-[8px] text-white">Acesso a Notificações</span>
                                                        </div>

                                                        <div className="flex-1 py-2 space-y-2">
                                                            <div className="text-[6px] uppercase text-slate-500 font-bold ml-1">Permitidos</div>
                                                            <div className="bg-slate-900 px-2 py-1 rounded flex justify-between items-center">
                                                                <span className="text-[7px]">Sicredi</span>
                                                                <span className="text-emerald-500 text-[7px]">ON ●</span>
                                                            </div>

                                                            <div className="text-[6px] uppercase text-slate-500 font-bold ml-1 pt-1">Não Permitidos</div>
                                                            
                                                            {/* MacroDroid Inactive Permission Switch */}
                                                            <div className="relative">
                                                                <span className="absolute -inset-1 rounded bg-blue-500/25 opacity-50 animate-pulse"></span>
                                                                <div 
                                                                    onClick={() => setActiveStep(7)}
                                                                    className="relative bg-slate-900 hover:bg-slate-800 px-2 py-1.5 rounded flex justify-between items-center cursor-pointer border border-blue-500/50"
                                                                >
                                                                    <span className="text-[7.5px] font-bold text-white">MacroDroid</span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="w-6 h-3.5 bg-slate-700 rounded-full flex items-center p-0.5">
                                                                            <span className="w-2.5 h-2.5 bg-slate-300 rounded-full"></span>
                                                                        </span>
                                                                        <span className="animate-bounce">👈</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 7 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between relative">
                                                        <div className="bg-[#1b2a4a] px-2 py-1.5 opacity-30 text-[8px]">Configure a Notificação</div>
                                                        
                                                        {/* Configuration Overlay Panel */}
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-2 z-10">
                                                            <div className="bg-[#242424] rounded-xl p-3 border border-slate-700 w-full max-w-[190px] space-y-2.5 text-slate-200">
                                                                <div className="font-bold text-[8px] text-rose-400">Opções de Notificação</div>
                                                                
                                                                <div className="space-y-1 text-[6.5px]">
                                                                    <div className="text-emerald-400">● Notificação Recebida</div>
                                                                    <div className="text-slate-400">○ Notificação Removida</div>
                                                                </div>

                                                                <div className="bg-slate-900 p-1.5 rounded text-[6px] space-y-1">
                                                                    <div>App: <strong className="text-white">Sicredi</strong></div>
                                                                    <div>Texto: <strong className="text-white">Contém: "recebeu um Pix"</strong></div>
                                                                </div>

                                                                <button 
                                                                    onClick={() => setActiveStep(8)}
                                                                    className="w-full py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[7.5px] rounded animate-pulse"
                                                                >
                                                                    Confirmar OK
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 8 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="bg-[#1e293b] px-2.5 py-2 rounded-lg flex items-center justify-between text-slate-200 border-b border-slate-700">
                                                            <span className="text-[7px]">←</span>
                                                            <span className="text-white font-bold text-[8px]">IgGestor - Sicredi</span>
                                                            <div className="flex gap-1.5 opacity-85 text-[7px]">
                                                                <span>💾</span>
                                                                <span>⋮</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex-1 py-2 space-y-2">
                                                            {/* Gatilho configured */}
                                                            <div className="bg-rose-950/25 border border-rose-500/40 p-1.5 rounded-lg text-[6.5px]">
                                                                <span className="text-rose-400 font-bold block mb-0.5">🔴 Gatilhos</span>
                                                                <div className="text-white">Notificação Recebida (Sicredi, "recebeu um Pix")</div>
                                                            </div>

                                                            {/* Highlighting Ações "+" */}
                                                            <div className="bg-blue-950/20 border border-blue-500/40 p-1.5 rounded-lg">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">🔵 Ações</span>
                                                                    <div className="relative">
                                                                        <span className="absolute -left-1 -top-1 inline-flex h-4 w-4 rounded-full bg-blue-400 opacity-75 animate-ping"></span>
                                                                        <button onClick={() => setActiveStep(9)} className="w-3.5 h-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center text-[8px]">+</button>
                                                                    </div>
                                                                </div>
                                                                <div className="text-[5.5px] text-blue-400/60 italic text-center py-1">Sem ações configuradas</div>
                                                            </div>

                                                            {/* Restrições */}
                                                            <div className="bg-emerald-950/10 border border-emerald-500/10 p-1.5 rounded-lg opacity-30 text-[6.5px]">
                                                                <span className="text-emerald-400 font-bold block">🟢 Restrições</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 9 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="bg-[#1b2a4a] px-2.5 py-1.5 rounded-lg flex items-center justify-between text-blue-200">
                                                            <span className="font-bold text-[8px]">Adicionar Ação</span>
                                                            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[6px] text-slate-300">
                                                                <span>🔍 req</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 py-1.5 space-y-2 p-1">
                                                            <div className="text-slate-500 text-[5px]">Resultados da busca</div>
                                                            <div className="relative">
                                                                <span className="absolute -inset-0.5 rounded-lg bg-blue-500 opacity-40 animate-pulse"></span>
                                                                <button 
                                                                    onClick={() => setActiveStep(10)} 
                                                                    className="relative w-full p-2 bg-blue-600 text-white text-[7px] rounded-lg font-black text-left flex justify-between items-center"
                                                                >
                                                                    <span>🌐 Requisição HTTP</span>
                                                                    <span className="animate-ping text-[6px]">👈 Toque</span>
                                                                </button>
                                                            </div>
                                                            <div className="text-[5.5px] text-slate-400 p-1 bg-slate-900/40 rounded italic leading-normal">
                                                                💡 Selecione "Requisição HTTP" para podermos enviar os parâmetros do Pix via POST.
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 10 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between relative">
                                                        <div className="bg-[#1b2a4a] px-2.5 py-1.5 opacity-30 text-[8px]">Nova Ação</div>
                                                        
                                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-1.5 z-10">
                                                            <div className="bg-[#242424] rounded-xl p-2.5 border border-slate-700 w-full max-w-[200px] space-y-1.5 text-slate-200">
                                                                <div className="font-bold text-[7.5px] text-blue-400">Requisição HTTP</div>
                                                                
                                                                <div className="space-y-1 text-[6px]">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-slate-400">Método:</span>
                                                                        <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold text-[6px] animate-pulse">POST</span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-slate-400 font-bold">Digite a URL:</span>
                                                                        <span className="bg-slate-950 p-1 rounded text-[5px] text-slate-300 truncate border border-blue-500/40">{webhookUrl}</span>
                                                                    </div>
                                                                </div>

                                                                <button 
                                                                    onClick={() => setActiveStep(11)}
                                                                    className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[7px] rounded text-center animate-pulse"
                                                                >
                                                                    Confirmar (OK)
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 11 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between relative">
                                                        <div className="bg-[#1b2a4a] px-2.5 py-1.5 opacity-30 text-[8px]">Configurar Parâmetros</div>
                                                        
                                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-1.5 z-10">
                                                            <div className="bg-[#242424] rounded-xl p-2 px-2.5 border border-slate-700 w-full max-w-[200px] space-y-1.5 text-slate-200">
                                                                <div className="font-bold text-[7px] text-blue-400 border-b border-slate-700 pb-1">Parâmetros de query</div>
                                                                
                                                                <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
                                                                    {/* Param 1 */}
                                                                    <div className="bg-slate-900 p-1 rounded text-[5px] space-y-0.5">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-slate-400">Nome:</span>
                                                                            <strong className="text-rose-400">text</strong>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-slate-400">Valor:</span>
                                                                            <strong className="text-emerald-400">{"{notification}"}</strong>
                                                                        </div>
                                                                    </div>

                                                                    {/* Param 2 */}
                                                                    <div className="bg-slate-900 p-1 rounded text-[5px] space-y-0.5">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-slate-400">Nome:</span>
                                                                            <strong className="text-rose-400 font-bold">key</strong>
                                                                        </div>
                                                                        <div className="flex justify-between items-center gap-1">
                                                                            <span className="text-slate-400">Valor:</span>
                                                                            <strong className="text-amber-400 truncate max-w-[100px]">{inboxKey || 'identificapix_sms_2026'}</strong>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <button 
                                                                    onClick={() => setActiveStep(12)}
                                                                    className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[7px] rounded text-center animate-pulse"
                                                                >
                                                                    Salvar Parâmetro (OK)
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 12 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between relative">
                                                        <div className="bg-[#1e293b] p-1.5 text-[7px] flex justify-between items-center text-slate-300 border-b border-slate-700">
                                                            <span>IgGestor - Sicredi</span>
                                                            <span className="text-emerald-500 font-bold">● Ativa</span>
                                                        </div>

                                                        <div className="flex-1 py-1.5 space-y-1.5 p-1.5">
                                                            <div className="bg-rose-950/15 border border-rose-500/30 p-1.5 rounded-lg text-[5.5px]">
                                                                <span className="text-rose-400 font-bold block mb-0.5">🔴 GATILHO</span>
                                                                <span className="text-slate-200">Notificação Recebida (Sicredi, "recebeu um Pix")</span>
                                                            </div>

                                                            <div className="bg-blue-950/15 border border-blue-500/30 p-1.5 rounded-lg text-[5.5px]">
                                                                <span className="text-blue-400 font-bold block mb-0.5">🔵 AÇÃO</span>
                                                                <span className="text-slate-200">Requisição HTTP (POST)</span>
                                                            </div>
                                                        </div>

                                                        {/* Floater Save Button with highlight/ping */}
                                                        <div className="absolute bottom-4 right-4 z-10 flex items-center justify-center">
                                                            <span className="absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                                                            <div className="relative w-8 h-8 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 flex items-center justify-center font-bold text-white text-[12px] cursor-pointer">
                                                                💾
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {/* IOS SIMULATOR SCREENS */}
                                                {activeStep === 1 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono">
                                                            <span>15:00</span>
                                                            <span>80%</span>
                                                        </div>
                                                        <div className="bg-slate-900 border border-slate-800 px-2 py-1.5 rounded-full text-[7px] text-slate-400 mb-2">
                                                            🔍 Buscar Ações...
                                                        </div>
                                                        <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-[7px] text-slate-300 space-y-1">
                                                            <div className="font-bold text-[8px] text-blue-400">🌐 Internet / Web</div>
                                                            <div className="bg-blue-500/10 text-blue-400 font-bold p-1 rounded">
                                                                ✓ Obter Conteúdo da URL
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => setActiveStep(2)}
                                                            className="w-full py-2 bg-blue-600 text-white font-bold text-[9px] rounded-full text-center mt-auto shadow-lg"
                                                        >
                                                            Avançar
                                                        </button>
                                                    </div>
                                                )}

                                                {activeStep === 2 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono">
                                                            <span>15:02</span>
                                                            <span>80%</span>
                                                        </div>
                                                        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-2 flex-1">
                                                            <div className="font-bold text-[8px] text-blue-400">Obter Conteúdo da URL</div>
                                                            <div className="bg-slate-950 p-1.5 rounded text-[6px] text-slate-400 truncate">
                                                                {webhookUrl}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-1 text-[7px] text-slate-400 pt-1.5">
                                                                <div>Método: <strong className="text-white">POST</strong></div>
                                                                <div>Corpo: <strong className="text-white">JSON</strong></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 3 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono">
                                                            <span>15:05</span>
                                                            <span>80%</span>
                                                        </div>
                                                        <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-[7px] text-slate-300 space-y-1">
                                                            <div className="font-bold text-[8px] text-blue-400">Adicionar Novo Campo</div>
                                                            <div className="flex items-center gap-1.5 pt-1">
                                                                <span className="text-rose-400 font-mono">text</span>
                                                                <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold font-sans">Entrada do Atalho</span>
                                                            </div>
                                                        </div>
                                                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[7px] rounded-lg mt-auto text-center font-bold">
                                                            ✓ Configurado com Sucesso!
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                </div>
            </div>

            {/* SEÇÃO DE SEGURANÇA PADRONIZADA */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <ShieldCheckIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Privacidade Garantida</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                        Esses links são exclusivos da sua igreja. O sistema lê apenas os dados de valor e nome contidos na mensagem do banco. Qualquer dúvida chame o Suporte.
                    </p>
                </div>
            </div>
        </div>
    );
});
