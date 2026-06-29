
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
    const { session, user } = useAuth();
    const { showToast, setActiveView } = useUI();
    const { banks } = useContext(AppContext);
    
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [inboxKey, setInboxKey] = useState<string>('');
    const [selectedOS, setSelectedOS] = useState<'android' | 'ios'>('android');
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
                    {/* CARD 2: PASSO A PASSO PRÁTICO PARA ANDROID / IPHONE */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-1">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <DevicePhoneMobileIcon className="w-4 h-4 text-brand-blue" />
                            Manual de Configuração Celular
                        </h3>
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
                            <button
                                onClick={() => { setSelectedOS('android'); setActiveStep(1); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                    selectedOS === 'android'
                                        ? 'bg-brand-blue text-white shadow-md'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                Android (MacroDroid)
                            </button>
                            <button
                                onClick={() => { setSelectedOS('ios'); setActiveStep(1); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                    selectedOS === 'ios'
                                        ? 'bg-brand-blue text-white shadow-md'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                iPhone (iOS Shortcuts)
                            </button>
                        </div>
                    </div>

                    {/* INTERACTIVE WIZARD STEPPERS */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col gap-6">
                        
                        {/* Stepper Dots & Labels */}
                        <div className="relative flex items-center justify-between w-full max-w-md mx-auto mb-2">
                            {/* Line behind */}
                            <div className="absolute left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-700 -translate-y-1/2 top-1/2 z-0"></div>
                            <div 
                                className="absolute left-0 h-0.5 bg-brand-blue -translate-y-1/2 top-1/2 z-0 transition-all duration-300"
                                style={{ width: `${((activeStep - 1) / ((selectedOS === 'android' ? 5 : 3) - 1)) * 100}%` }}
                            ></div>

                            {/* Step Indicators */}
                            {Array.from({ length: selectedOS === 'android' ? 5 : 3 }).map((_, idx) => {
                                const stepNum = idx + 1;
                                const isCompleted = activeStep > stepNum;
                                const isActive = activeStep === stepNum;
                                return (
                                    <button
                                        key={stepNum}
                                        onClick={() => setActiveStep(stepNum)}
                                        className={`relative z-10 w-8 h-8 rounded-full font-black text-xs flex items-center justify-center transition-all ${
                                            isCompleted 
                                                ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/15' 
                                                : isActive 
                                                ? 'bg-brand-blue text-white ring-4 ring-blue-500/25 scale-110' 
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                    >
                                        {isCompleted ? '✓' : stepNum}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Interactive Screen Simulator + Steps Explanation Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                            
                            {/* Column 1: Step Detailed instructions (7/12 width) */}
                            <div className="md:col-span-7 space-y-4">
                                {selectedOS === 'android' ? (
                                    <>
                                        {activeStep === 1 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 1: Instalar o App</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Instalar o MacroDroid no Celular</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Abra a <strong>Google Play Store</strong> no seu celular Android, procure pelo aplicativo gratuito <strong className="text-brand-blue">"MacroDroid"</strong> e instale-o. Ele monitorará as notificações de Pix do banco e enviará ao sistema.
                                                </p>
                                                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                                                    💡 <strong>Dica de ouro:</strong> O MacroDroid é extremamente seguro, super leve e possui mais de 10 milhões de downloads no mundo todo.
                                                </div>
                                            </div>
                                        )}

                                        {activeStep === 2 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 2: Nova Automação</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Adicionar uma Nova Macro</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Ao abrir o MacroDroid, toque no botão quadrado vermelho escrito <strong className="text-rose-500">"Adicionar Macro"</strong>. É aqui que vamos ensinar o celular a identificar os recebimentos.
                                                </p>
                                                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100/30 text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
                                                    ⚠️ Se o aplicativo mostrar anúncios ou oferecer planos, basta fechar ou clicar em "continuar grátis". A versão gratuita atende 100% o nosso sistema.
                                                </div>
                                            </div>
                                        )}

                                        {activeStep === 3 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 3: Criar o Gatilho</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Configurar o Gatilho de Notificação</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    O Gatilho (Trigger) define quando agir. Toque no botão <strong className="text-rose-500">"+"</strong> no topo da área vermelha <strong>"Gatilhos"</strong> e siga este caminho:
                                                </p>
                                                <ul className="text-xs text-slate-500 dark:text-slate-400 list-decimal pl-4 space-y-1.5 leading-relaxed">
                                                    <li>Vá em <strong>Eventos do Dispositivo</strong> ➔ <strong>Notificação</strong> ➔ <strong>Notificação Recebida</strong>.</li>
                                                    <li>Selecione <strong>"Apenas do aplicativo selecionado"</strong>, clique em OK e escolha o aplicativo do seu banco (ex: <strong>Sicredi</strong>, <strong>Inter</strong>, etc.).</li>
                                                    <li>Em <strong>Conteúdo do texto</strong>, mude para <strong>"Contém"</strong> e digite exatamente: <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono font-bold text-brand-blue">recebeu um Pix</code> ou <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono font-bold text-brand-blue">Pix recebido</code>.</li>
                                                </ul>
                                            </div>
                                        )}

                                        {activeStep === 4 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 4: Configurar o Envio</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Configurar a Ação de Envio (POST HTTP)</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    A Ação envia a notificação para nós. Toque no botão <strong className="text-brand-blue font-bold">"+"</strong> na área azul <strong>"Ações"</strong> e faça o seguinte:
                                                </p>
                                                <ul className="text-xs text-slate-500 dark:text-slate-400 list-decimal pl-4 space-y-1.5 leading-relaxed">
                                                    <li>Vá em <strong>Aplicativo</strong> ➔ toque em <strong>"Abrir Site / Comando HTTP"</strong> (ou <strong>"HTTP GET/POST"</strong>).</li>
                                                    <li>Mude o Método de GET para <strong className="text-brand-blue">POST</strong>.</li>
                                                    <li>Cole no campo <strong>URL</strong> o link exclusivo que você copiou no Card ao lado.</li>
                                                    <li>Adicione o parâmetro de corpo com Chave: <code className="bg-slate-150 px-1 py-0.5 rounded font-mono font-bold text-rose-500">text</code> e no Valor clique nos três pontinhos <strong className="text-brand-blue font-bold">"..."</strong> para escolher a variável dinâmica de sistema <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-emerald-500">[notification_text]</code>.</li>
                                                </ul>
                                            </div>
                                        )}

                                        {activeStep === 5 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full w-fit">Passo 5: Salvar e Ativar</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Dar Nome e Ativar a Automação</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    No topo da tela de edição do MacroDroid, dê um nome para sua automação (ex: <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 dark:text-slate-200">IdentificaPix Automação</code>) e clique no ícone de check/disquete flutuante no canto inferior direito para salvar.
                                                </p>
                                                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100/30 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                                                    🎉 <strong>Tudo Pronto!</strong> O Android solicitará algumas permissões de acesso às notificações e economia de energia. Certifique-se de autorizar todas para que as notificações rodem em segundo plano com o celular bloqueado!
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {activeStep === 1 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 1: Obter URL</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Buscar o Serviço de Internet no iOS</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Abra o aplicativo <strong>Atalhos (Shortcuts)</strong> oficial da Apple em seu iPhone, crie uma automação de SMS recebido e busque por <strong className="text-brand-blue">"URL"</strong> nas ações. Na lista que surgir, selecione <strong className="text-brand-blue">"Obter Conteúdo da URL"</strong>.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 2 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 2: Mudar para POST</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Colar link e Mudar Método</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Cole o link copiado no primeiro campo azul. Depois, clique na setinha de expansão <strong className="text-brand-blue">"&gt;"</strong> ao lado da ação e configure:
                                                </p>
                                                <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc pl-4 space-y-1.5 leading-relaxed">
                                                    <li>Mude o <strong>Método</strong> de <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono">GET</code> para <code className="bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded font-mono font-bold">POST</code>.</li>
                                                    <li>Configure o <strong>Corpo da Requisição</strong> para <strong className="text-slate-700 dark:text-slate-300">"JSON"</strong>.</li>
                                                </ul>
                                            </div>
                                        )}

                                        {activeStep === 3 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 3: Mapear Variável</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Mapear Entrada de Mensagem</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    No campo cinza ao lado de <strong className="text-rose-500">text</strong>:
                                                </p>
                                                <ul className="text-xs text-slate-500 dark:text-slate-400 list-decimal pl-4 space-y-1.5 leading-relaxed">
                                                    <li><strong>Toque na palavra "Texto"</strong> para abrir o teclado e a barra de ferramentas do iOS.</li>
                                                    <li>Na barra acima do teclado, clique em <strong className="text-brand-blue font-bold">"Entrada do Atalho"</strong> (ou <strong>"Shortcut Input"</strong>).</li>
                                                    <li>Pronto! Clique em "OK" no topo do celular para salvar. Agora, toda vez que chegar aviso do banco contendo o Pix, o iPhone processará de modo 100% automático na sua Lista Viva!</li>
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Navigation Buttons */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        disabled={activeStep === 1}
                                        onClick={() => setActiveStep(prev => prev - 1)}
                                        className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 disabled:opacity-40 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-800"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        disabled={activeStep === (selectedOS === 'android' ? 5 : 3)}
                                        onClick={() => setActiveStep(prev => prev + 1)}
                                        className="px-4 py-2 bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                    >
                                        Próximo
                                    </button>
                                </div>
                            </div>

                            {/* Column 2: Simulated Smartphone Preview (5/12 width) */}
                            <div className="md:col-span-5 flex justify-center">
                                <div className="w-[240px] h-[380px] bg-slate-950 rounded-[2.5rem] border-[5px] border-slate-900 shadow-2xl overflow-hidden relative flex flex-col shrink-0">
                                    {/* Notch */}
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-slate-900 rounded-full z-30 flex items-center justify-center">
                                        <div className="w-8 h-0.5 bg-slate-800 rounded-full"></div>
                                    </div>

                                    {/* Smartphone Content Container */}
                                    <div className="flex-1 flex flex-col p-3 pt-6 text-slate-100 select-none overflow-hidden text-[9px] font-sans">
                                        {selectedOS === 'android' ? (
                                            <>
                                                {/* ANDROID SIMULATOR SCREENS */}
                                                {activeStep === 1 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono">
                                                            <span>15:00</span>
                                                            <div className="flex items-center gap-1">
                                                                <span>5G</span>
                                                                <span>24%</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-850 px-2 py-1.5 rounded-full text-[8px] text-slate-400 mb-2">
                                                            <span>🔍</span>
                                                            <span className="flex-1 font-bold text-slate-300">macrodroid</span>
                                                        </div>
                                                        <div className="flex gap-2 items-center mt-1">
                                                            <div className="w-10 h-10 bg-indigo-900/60 border border-indigo-500/30 rounded-xl flex items-center justify-center text-lg shrink-0">
                                                                🤖
                                                            </div>
                                                            <div>
                                                                <h4 className="text-[9px] font-bold leading-tight">MacroDroid</h4>
                                                                <span className="text-[7px] text-emerald-400 font-bold block mt-0.5">✓ Instalado</span>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-1 border-y border-slate-900 py-1.5 my-2 text-center text-slate-400 text-[7px]">
                                                            <div>
                                                                <span className="font-bold text-slate-200 block text-[8px]">4,1 ★</span>
                                                                <span>89 mil aval.</span>
                                                            </div>
                                                            <div className="border-x border-slate-900">
                                                                <span className="font-bold text-slate-200 block text-[8px]">Livre</span>
                                                                <span>Classificação</span>
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-slate-200 block text-[8px]">+10 mi</span>
                                                                <span>Downloads</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => setActiveStep(2)}
                                                            className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[9px] rounded-full text-center shadow-lg transition-transform active:scale-95 mt-auto"
                                                        >
                                                            Abrir (Toque Aqui)
                                                        </button>
                                                    </div>
                                                )}

                                                {activeStep === 2 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono">
                                                            <span>15:02</span>
                                                            <span>24%</span>
                                                        </div>
                                                        <div className="text-[8px] font-black tracking-wider uppercase text-slate-400 mb-2 text-center">MACRODROID</div>
                                                        
                                                        <div className="grid grid-cols-2 gap-1.5 flex-1 items-center">
                                                            <button 
                                                                onClick={() => setActiveStep(3)}
                                                                className="p-3 bg-rose-950/30 hover:bg-rose-900/30 border-2 border-rose-500/80 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-all group animate-pulse"
                                                            >
                                                                <span className="text-base">➕</span>
                                                                <span className="text-[8px] font-black uppercase text-rose-300 leading-tight">Adicionar Macro</span>
                                                                <span className="text-[6px] text-rose-400/80">Toque aqui</span>
                                                            </button>
                                                            <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl flex flex-col items-center justify-center text-slate-600 text-[7px] uppercase font-bold">
                                                                <span>Modelos</span>
                                                            </div>
                                                            <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl flex flex-col items-center justify-center text-slate-600 text-[7px] uppercase font-bold">
                                                                <span>Configurações</span>
                                                            </div>
                                                            <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl flex flex-col items-center justify-center text-slate-600 text-[7px] uppercase font-bold">
                                                                <span>Fórum</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 3 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono">
                                                            <span>15:05</span>
                                                            <span>24%</span>
                                                        </div>
                                                        <div className="bg-rose-950/30 border border-rose-500/30 p-2.5 rounded-xl mb-2">
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-rose-400">🔴 Gatilhos</span>
                                                                <button onClick={() => setActiveStep(4)} className="w-4.5 h-4.5 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-[10px] animate-pulse">+</button>
                                                            </div>
                                                            <div className="bg-slate-900 border border-slate-850 p-2 rounded-lg text-[7px] text-slate-300 space-y-1">
                                                                <div className="font-bold text-[8px] text-rose-300">✓ Notificação Recebida</div>
                                                                <div>App: <strong className="text-white">Seu Banco</strong></div>
                                                                <div>Contém: <strong className="text-white">"recebeu um Pix"</strong></div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-blue-950/10 border border-blue-900/10 p-2 rounded-lg opacity-30 text-[7px] mb-1">
                                                            🔵 Ações
                                                        </div>
                                                        <div className="bg-slate-900/20 border border-slate-850/10 p-2 rounded-lg opacity-30 text-[7px]">
                                                            🟢 Restrições
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 4 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between">
                                                        <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono">
                                                            <span>15:08</span>
                                                            <span>24%</span>
                                                        </div>
                                                        <div className="bg-rose-950/10 border border-rose-900/10 p-1.5 rounded-lg opacity-30 text-[7px] mb-2">
                                                            🔴 Gatilhos (Notificação Recebida)
                                                        </div>
                                                        <div className="bg-blue-950/30 border border-blue-500/30 p-2.5 rounded-xl mb-2 flex-1">
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">🔵 Ações</span>
                                                                <button onClick={() => setActiveStep(5)} className="w-4.5 h-4.5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] animate-pulse">+</button>
                                                            </div>
                                                            <div className="bg-slate-900 border border-slate-850 p-2 rounded-lg text-[7px] text-slate-300 space-y-1.5">
                                                                <div className="font-bold text-[8px] text-blue-300">✓ HTTP POST</div>
                                                                <div className="truncate text-slate-500 text-[6px]">{webhookUrl}</div>
                                                                <div>Corpo: <strong className="text-white">text = [notification_text]</strong></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeStep === 5 && (
                                                    <div className="flex flex-col h-full animate-fade-in justify-between relative">
                                                        <div className="flex justify-between items-center text-[7px] text-slate-400 mb-2 font-mono">
                                                            <span>15:10</span>
                                                            <span>24%</span>
                                                        </div>
                                                        
                                                        <div className="text-[8px] text-slate-400 mb-1">Nome da macro:</div>
                                                        <div className="bg-slate-900 border border-slate-850 px-2 py-1 rounded-lg text-[9px] font-bold text-white mb-2">
                                                            IdentificaPix Automação
                                                        </div>
                                                        
                                                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-850 text-[7px] space-y-1 mb-2 flex-1">
                                                            <div className="text-rose-400 font-bold">🔴 Gatilho: Notificação do Banco</div>
                                                            <div className="text-blue-400 font-bold">🔵 Ação: HTTP POST para o sistema</div>
                                                        </div>
                                                        
                                                        <div className="absolute bottom-2 right-2">
                                                            <div className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/40 flex items-center justify-center font-bold text-white text-[12px] animate-bounce">
                                                                ✓
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
                                                        <div className="bg-slate-900 border border-slate-850 px-2 py-1.5 rounded-full text-[7px] text-slate-400 mb-2">
                                                            🔍 Buscar Ações...
                                                        </div>
                                                        <div className="bg-slate-900 border border-slate-850 p-2 rounded-lg text-[7px] text-slate-300 space-y-1">
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
                                                        <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl space-y-2 flex-1">
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
                                                        <div className="bg-slate-900 border border-slate-850 p-2 rounded-xl text-[7px] text-slate-300 space-y-1">
                                                            <div className="font-bold text-[8px] text-blue-400">Adicionar Novo Campo</div>
                                                            <div className="flex items-center gap-1.5 pt-1">
                                                                <span className="text-rose-400 font-mono">text</span>
                                                                <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">Entrada do Atalho</span>
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
