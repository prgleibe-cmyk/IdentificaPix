
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
                    {/* CARD 2: PASSO A PASSO PRÁTICO PARA ANDROID */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-1">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <DevicePhoneMobileIcon className="w-4 h-4 text-brand-blue" />
                            Manual de Configuração Celular (Android)
                        </h3>
                    </div>

                     {/* INTERACTIVE WIZARD STEPPERS */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col gap-6">
                        
                        {/* Stepper Dots & Labels */}
                        <div className="relative flex items-center justify-between w-full max-w-xl mx-auto mb-2">
                            {/* Line behind */}
                            <div className="absolute left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-700 -translate-y-1/2 top-1/2 z-0"></div>
                            <div 
                                className="absolute left-0 h-0.5 bg-brand-blue -translate-y-1/2 top-1/2 z-0 transition-all duration-300"
                                style={{ width: `${((activeStep - 1) / ((selectedOS === 'android' ? 12 : 3) - 1)) * 100}%` }}
                            ></div>

                            {/* Step Indicators */}
                            {Array.from({ length: selectedOS === 'android' ? 12 : 3 }).map((_, idx) => {
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
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 1: Instalação e Acesso Inicial</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Instalar e Abrir o MacroDroid</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Abra a <strong>Google Play Store</strong> no seu celular, procure pelo aplicativo gratuito <strong className="text-brand-blue">"MacroDroid"</strong> e faça a instalação. 
                                                    Ao abri-lo pela primeira vez, você verá a tela principal vazia. Dê um toque no botão redondo branco com o sinal de mais <strong className="text-brand-blue font-bold">"+"</strong> no canto inferior direito para iniciar a criação da sua automação.
                                                </p>
                                                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                                                    💡 <strong>Aviso Importante:</strong> O aplicativo é totalmente grátis. Se aparecerem banners de assinatura Premium, basta clicar no "X" ou em "continuar grátis". A versão gratuita atende perfeitamente ao nosso sistema.
                                                </div>
                                            </div>
                                        )}

                                        {activeStep === 2 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 2: Nova Automação (Macro)</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Criar uma Nova Macro e Nomear</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Na tela de edição, escreva no topo o nome da sua automação para identificá-la facilmente, por exemplo: <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono font-bold text-brand-blue">IdentificaPix - Sicredi</code>. 
                                                    Você notará três blocos vazios na tela: **Gatilhos** (Vermelho), **Ações** (Azul) e **Restrições** (Verde). Toque no sinal de mais <strong className="text-rose-500 font-bold">"+"</strong> localizado no bloco **Gatilhos** vermelho.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 3 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 3: Selecionar Categoria</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Escolher Categoria "Eventos do Dispositivo"</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    A tela "Adicionar Gatilho" exibe diversas categorias organizadas em cores. Desça um pouco a tela e procure pela opção **"Eventos do Dispositivo"** (marcada por um ícone de celular com engrenagem). Dê um toque nela para expandir as opções.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 4 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 4: Selecionar Tipo de Evento</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Escolher o Gatilho de "Notificação"</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Nas subcategorias em vermelho de Eventos do Dispositivo, role a lista até o final e toque na opção <strong className="text-rose-500">"Notificação"</strong> (que contém um ícone de sininho/aviso de atenção amarelo).
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 5 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 5: Solicitação de Permissão</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Habilitar Acesso do Aplicativo ao Celular</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    O Android protege suas mensagens, por isso o MacroDroid mostrará o aviso **"Acesso às Notificações Exigido"** explicando que o sistema precisa de permissão de leitura de notificações. Toque no botão <strong className="text-brand-blue font-bold">"OK"</strong> na caixa de diálogo para ir às configurações do aparelho celular.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 6 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 6: Permitir no Android</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Ativar Chave de Leitura de Notificações</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Na tela de configurações do Android, procure pela opção **"MacroDroid"** (que estará marcada como Não permitida/Inativa). Toque no interruptor ao lado para <strong className="text-emerald-500 font-bold">Ativá-lo</strong> e, na mensagem de segurança que surgir, clique em **"Permitir"** ou **"Autorizar"**. Depois, volte para o MacroDroid usando a seta de retorno.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 7 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 7: Detalhes do Gatilho</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Selecionar o Banco e Texto Detectado</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Ao voltar ao aplicativo, escolha a opção **"Notificação Recebida"** e clique em **OK**. Em seguida:
                                                </p>
                                                <ul className="text-xs text-slate-500 dark:text-slate-400 list-decimal pl-4 space-y-1.5 leading-relaxed">
                                                    <li>Marque **"Apenas do aplicativo selecionado"** e clique em OK. Selecione o aplicativo do seu banco (ex: **Sicredi**, **Inter**, **Nubank**, etc.).</li>
                                                    <li>Na tela do diálogo, marque **"Ignorar maiúsculas/minúsculas"**. Em **Conteúdo do texto**, marque **"Contém"** e digite o texto de identificação padrão do Pix recebido do seu banco (ex: <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono font-bold text-brand-blue">recebeu um Pix</code> ou <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono font-bold text-brand-blue">Pix recebido</code>). Clique em **OK**.</li>
                                                </ul>
                                            </div>
                                        )}

                                        {activeStep === 8 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 8: Adicionar Ação</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Abrir o Menu de Categorias de Ação</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Agora com o gatilho configurado, toque no sinal de mais <strong className="text-brand-blue font-black">"+"</strong> no bloco azul **"Ações"**.
                                                    A tela **Adicionar Ação** abrirá com uma lista completa de categorias do sistema, como *Ações do dispositivo*, *Aplicativos*, *Conectividade*, *Interação Web*, entre outras.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 9 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 9: Buscar "Requisição HTTP"</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Pesquisar pela Ação Correta</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Toque no ícone de lupa <strong>"🔍"</strong> no topo direito da tela, digite <strong className="text-brand-blue font-bold">"req"</strong> ou <strong className="text-brand-blue font-bold">"Requisição HTTP"</strong>.
                                                    Embaixo da categoria **"Interação Web"**, surgirá a opção <strong className="text-brand-blue">"Requisição HTTP"</strong>. Dê um toque nela para abrir suas configurações.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 10 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 10: Método e URL</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Configurar Envio como POST</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Dentro da configuração da Requisição HTTP, altere o campo **Método da requisição** de `GET` para <strong className="text-brand-blue">POST</strong>. 
                                                    No campo **Digite a URL**, cole exatamente o link exclusivo que você copiou no Card acima. Mantenha a opção **"Seguir redirecionamentos"** marcada.
                                                </p>
                                            </div>
                                        )}

                                        {activeStep === 11 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest block bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full w-fit">Passo 11: Parâmetros de Envio</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Configurar os Dados do Pix</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Para enviar o conteúdo da notificação recebida, você pode usar uma de duas formas suportadas:
                                                </p>
                                                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                                    <p>
                                                        <strong>Opção A (Parâmetros de Query - Recomendado):</strong> Acesse a aba **"Parâmetros de query"**, clique no botão <strong className="text-blue-500 font-bold">"+"</strong>, configure o Nome do parâmetro como <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-rose-500 font-bold font-mono">text</code> (ou `texto`), e no campo **Valor** clique no botão de três pontinhos <strong className="text-brand-blue font-bold">"..."</strong> à direita e escolha <strong className="text-brand-blue">"Texto da notificação"</strong> para inserir <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-emerald-500 font-mono">{"{notification}"}</code>.
                                                    </p>
                                                    <p>
                                                        <strong>Opção B (Corpo JSON):</strong> Acesse a aba **"Corpo da requisição"**, configure o Tipo do conteúdo como **"Indefinido"**, marque **"Texto"** e cole o seguinte código na caixa de texto:
                                                    </p>
                                                    <pre className="p-2 bg-slate-950 text-[10px] text-teal-400 font-mono rounded-lg">
{`{
  "text": "{notification}"
}`}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}

                                        {activeStep === 12 && (
                                            <div className="space-y-3 animate-fade-in">
                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full w-fit">Passo 12: Salvar e Ativar</span>
                                                <h4 className="font-bold text-base text-slate-800 dark:text-white leading-tight">Salvar e Concluir a Configuração</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Na seção inferior das configurações da Requisição HTTP, certifique-se de que "Salvar código de retorno HTTP" esteja como **"Não salvar saída"** e marque a opção **"Não salvar resposta HTTP"** para otimizar o consumo de memória do celular.
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Clique no botão de **✓** no topo ou no ícone de disquete flutuante no canto inferior direito para salvar a Ação. Depois, clique no **ícone de disquete** na tela da Macro para gravar e ativar o monitoramento instantaneamente!
                                                </p>
                                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100/30 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                                                    🎉 <strong>Excelente Trabalho!</strong> Toda vez que seu aplicativo bancário enviar uma notificação de Pix, o MacroDroid enviará os detalhes e o IdentificaPix fará a identificação em menos de 1 segundo!
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
                                        disabled={activeStep === (selectedOS === 'android' ? 12 : 3)}
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
                                                                value="IdentificaPix - Sicredi" 
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
                                                        <div className="px-2 py-2 flex items-center gap-1.5 border-b border-slate-850">
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
                                                                    className="relative bg-slate-900 hover:bg-slate-850 px-2 py-1.5 rounded flex justify-between items-center cursor-pointer border border-blue-500/50"
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
                                                            <span className="text-white font-bold text-[8px]">IdentificaPix - Sicredi</span>
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
                                                            <div className="bg-[#242424] rounded-xl p-2.5 border border-slate-700 w-full max-w-[200px] space-y-2 text-slate-200">
                                                                <div className="font-bold text-[7px] text-blue-400 border-b border-slate-700 pb-1">Parâmetros de query</div>
                                                                
                                                                <div className="bg-slate-900 p-1.5 rounded text-[5.5px] space-y-1">
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-400">Nome:</span>
                                                                        <strong className="text-rose-400">text</strong>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-400">Valor:</span>
                                                                        <strong className="text-emerald-400">{`{notification}`}</strong>
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
                                                            <span>IdentificaPix - Sicredi</span>
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
