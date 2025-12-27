
import React, { useState, useEffect, useContext } from 'react';
import { modelService } from '../../services/modelService';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { FileModel } from '../../types';
import { StrategyEngine, DatabaseModelStrategy } from '../../core/strategies';
import { 
    BrainIcon, 
    TrashIcon, 
    MagnifyingGlassIcon, 
    TableCellsIcon,
    XMarkIcon,
    ArrowPathIcon,
    PencilIcon,
    WrenchScrewdriverIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    LockClosedIcon,
    ShieldCheckIcon
} from '../Icons';
import { FilePreprocessorModal } from '../modals/FilePreprocessorModal';

export const AdminModelsTab: React.FC = () => {
    const { showToast } = useUI();
    const { fetchModels } = useContext(AppContext); // Contexto para atualizar estado global
    const [models, setModels] = useState<(FileModel & { user_email?: string, isSystem?: boolean })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModel, setSelectedModel] = useState<FileModel | null>(null);
    const [modelToRefine, setModelToRefine] = useState<FileModel | null>(null);

    // Estados de Ação Inline
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    useEffect(() => {
        loadModels();
    }, []);

    const loadModels = async () => {
        setIsLoading(true);
        
        // 1. Carregar Modelos do Banco de Dados
        const dbModels = await modelService.getAllModelsAdmin();

        // 2. Carregar Estratégias Nativas (Hardcoded no Core)
        // Filtramos a DatabaseModelStrategy pois ela é apenas o "motor" que lê os dbModels
        const systemStrategies = StrategyEngine.strategies
            .filter(s => s !== DatabaseModelStrategy)
            .map((s, index) => ({
                id: `sys-strat-${index}`,
                name: s.name,
                user_id: 'system',
                user_email: 'Sistema (Nativo)',
                version: 1,
                lineage_id: `sys-${s.name}`,
                is_active: true,
                fingerprint: { columnCount: 0, delimiter: 'Auto', headerHash: 'N/A', dataTopology: 'Dynamic' },
                mapping: { dateColumnIndex: 0, descriptionColumnIndex: 0, amountColumnIndex: 0, skipRowsStart: 0, skipRowsEnd: 0, decimalSeparator: ',', thousandsSeparator: '.' },
                parsingRules: { ignoredKeywords: [], rowFilters: [] },
                createdAt: new Date().toISOString(),
                isSystem: true // Flag para identificar visualmente
            } as any));

        // Combina Nativos + Banco
        setModels([...systemStrategies, ...dbModels]);
        setIsLoading(false);
    };

    // --- HANDLERS DE AÇÃO ---

    const stopPropagation = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        stopPropagation(e);
        
        if (deleteConfirmId === id) {
            // Segundo clique: Confirma a exclusão
            const success = await modelService.deleteModel(id);
            if (success) {
                showToast("Modelo excluído com sucesso.", "success");
                
                // Atualiza a tabela local
                loadModels();
                
                // CRÍTICO: Atualiza o estado global da aplicação para "esquecer" o modelo imediatamente
                await fetchModels();

                if (selectedModel?.id === id) setSelectedModel(null);
            } else {
                showToast("Erro ao excluir modelo.", "error");
            }
            setDeleteConfirmId(null);
        } else {
            // Primeiro clique: Ativa modo de confirmação
            setDeleteConfirmId(id);
            // Auto-cancelar após 4 segundos se não confirmar
            setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 4000);
        }
    };

    const handleStartRename = (e: React.MouseEvent, model: FileModel) => {
        stopPropagation(e);
        setDeleteConfirmId(null); // Reseta exclusão se estiver ativa
        setEditingId(model.id);
        setEditName(model.name);
    };

    const handleCancelRename = (e?: React.MouseEvent) => {
        if (e) stopPropagation(e);
        setEditingId(null);
        setEditName('');
    };

    const handleSaveRename = async (e: React.MouseEvent, id: string) => {
        stopPropagation(e);
        
        if (!editName.trim()) {
            showToast("O nome não pode estar vazio.", "error");
            return;
        }

        const success = await modelService.updateModelName(id, editName.trim());
        if (success) {
            showToast("Modelo renomeado.", "success");
            loadModels();
            fetchModels(); // Atualiza globalmente também
            setEditingId(null);
        } else {
            showToast("Erro ao renomear.", "error");
        }
    };

    const handleRefine = (e: React.MouseEvent, model: FileModel) => {
        stopPropagation(e);
        if (!model.snippet) {
            showToast("Este modelo antigo não possui snippet salvo para edição.", "error");
            return;
        }
        setModelToRefine(model);
    };

    const handleRefinementSuccess = async () => {
        setModelToRefine(null);
        showToast("Modelo refinado e atualizado!", "success");
        loadModels();
        await fetchModels(); // Garante que o refinamento se propague
    };

    // --- FILTROS & RENDER ---

    const filteredModels = models.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (m.user_email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header & Filter */}
            <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 p-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800">
                        <BrainIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Modelos & Estratégias</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Gestão de inteligência de layouts ({models.length})</p>
                    </div>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Buscar modelo ou usuário..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-purple-500 outline-none w-full font-medium"
                        />
                    </div>
                    <button 
                        onClick={loadModels} 
                        className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-purple-600 hover:border-purple-200 transition-colors"
                        title="Atualizar Lista"
                    >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
                {/* Lista de Modelos */}
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-xs text-left">
                            <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 font-bold border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Modelo</th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Autor</th>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="text-center py-8"><div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div></td></tr>
                                ) : filteredModels.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">Nenhum modelo encontrado.</td></tr>
                                ) : (
                                    filteredModels.map(model => {
                                        const isEditing = editingId === model.id;
                                        const isConfirmingDelete = deleteConfirmId === model.id;
                                        const isSelected = selectedModel?.id === model.id;
                                        const isSystem = !!model.isSystem;

                                        return (
                                            <tr 
                                                key={model.id} 
                                                onClick={() => !isEditing && !isSystem && setSelectedModel(model)}
                                                className={`transition-colors group ${isSelected ? 'bg-purple-50 dark:bg-purple-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'} ${isSystem ? 'bg-slate-50/50 dark:bg-slate-900/20' : 'cursor-pointer'}`}
                                            >
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2" onClick={stopPropagation}>
                                                            <input 
                                                                type="text" 
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                className="w-full bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
                                                                autoFocus
                                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(e as any, model.id)}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            {isSystem && <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500" />}
                                                            <div>
                                                                <div className={`font-bold truncate max-w-[200px] ${isSystem ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>{model.name}</div>
                                                                {!isSystem && <div className="text-[9px] text-slate-400 font-mono mt-0.5">v{model.version} • {model.fingerprint?.columnCount || '?'} cols</div>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isSystem ? (
                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300 rounded text-[9px] font-bold uppercase border border-emerald-100 dark:border-emerald-800">Hardcoded</span>
                                                    ) : model.name.toLowerCase().includes('lista') || model.name.toLowerCase().includes('contributor') ? (
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded text-[9px] font-bold uppercase border border-indigo-100 dark:border-indigo-800">Lista</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded text-[9px] font-bold uppercase border border-blue-100 dark:border-blue-800">Extrato</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className={`truncate max-w-[150px] ${isSystem ? 'text-slate-400 italic' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        {model.user_email}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                    {isSystem ? '-' : new Date(model.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {isSystem ? (
                                                        <div className="flex justify-center text-slate-300 dark:text-slate-600">
                                                            <LockClosedIcon className="w-3.5 h-3.5" title="Protegido pelo Sistema" />
                                                        </div>
                                                    ) : isEditing ? (
                                                        <div className="flex items-center justify-center gap-1" onClick={stopPropagation}>
                                                            <button 
                                                                onClick={(e) => handleSaveRename(e, model.id)}
                                                                className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                                                title="Salvar"
                                                            >
                                                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={handleCancelRename}
                                                                className="p-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                                                                title="Cancelar"
                                                            >
                                                                <XCircleIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={stopPropagation}>
                                                            
                                                            {/* Botão Refinar */}
                                                            <button 
                                                                onClick={(e) => handleRefine(e, model)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                                title="Refinar Modelo (Editar)"
                                                            >
                                                                <WrenchScrewdriverIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            
                                                            {/* Botão Renomear */}
                                                            <button 
                                                                onClick={(e) => handleStartRename(e, model)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                                title="Renomear"
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            
                                                            {/* Botão Excluir (2 Etapas) */}
                                                            <button 
                                                                onClick={(e) => handleDelete(e, model.id)}
                                                                className={`p-1.5 rounded-lg transition-all duration-200 ${
                                                                    isConfirmingDelete 
                                                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-md scale-110' 
                                                                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                                }`}
                                                                title={isConfirmingDelete ? "Confirmar Exclusão?" : "Excluir Modelo"}
                                                            >
                                                                {isConfirmingDelete ? (
                                                                    <ExclamationTriangleIcon className="w-3.5 h-3.5 animate-pulse" />
                                                                ) : (
                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Painel de Visualização (Preview/Snippet) - Apenas para DB Models */}
                {selectedModel && !editingId && !selectedModel.isSystem && (
                    <div className="w-1/3 min-w-[300px] bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-scale-in">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                            <h4 className="font-bold text-xs text-slate-700 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <TableCellsIcon className="w-4 h-4 text-slate-400" />
                                Preview (Snippet)
                            </h4>
                            <button onClick={() => setSelectedModel(null)} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-4 h-4" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-inner">
                                {selectedModel.snippet ? (
                                    <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 whitespace-pre overflow-x-auto">
                                        {selectedModel.snippet}
                                    </pre>
                                ) : (
                                    <div className="text-center py-8 text-slate-400 text-xs italic">
                                        Snippet não disponível para este modelo antigo.
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 space-y-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
                                    <h5 className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Mapeamento</h5>
                                    <ul className="text-[10px] text-slate-600 dark:text-slate-300 space-y-1">
                                        <li>Data: Coluna {selectedModel.mapping.dateColumnIndex + 1}</li>
                                        <li>Descrição: Coluna {selectedModel.mapping.descriptionColumnIndex + 1}</li>
                                        <li>Valor: Coluna {selectedModel.mapping.amountColumnIndex + 1}</li>
                                        {selectedModel.mapping.typeColumnIndex !== undefined && (
                                            <li>Tipo: Coluna {selectedModel.mapping.typeColumnIndex + 1}</li>
                                        )}
                                        <li>Pular Linhas (Início): {selectedModel.mapping.skipRowsStart}</li>
                                    </ul>
                                </div>
                                
                                {selectedModel.parsingRules?.ignoredKeywords?.length > 0 && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800">
                                        <h5 className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Ignorados</h5>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedModel.parsingRules.ignoredKeywords.map((k, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded text-[9px] text-slate-600 dark:text-slate-300">{k}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-center">
                            <p className="text-[9px] text-slate-400">
                                ID: {selectedModel.id}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Refinamento */}
            {modelToRefine && (
                <FilePreprocessorModal 
                    onClose={() => setModelToRefine(null)}
                    initialFile={{
                        content: modelToRefine.snippet || '',
                        fileName: modelToRefine.name,
                        type: modelToRefine.name.toLowerCase().includes('lista') ? 'contributor' : 'statement',
                        id: 'refine-mode',
                        rawFile: undefined // Snippet não tem rawFile binário, mas o Lab lida com isso
                    }}
                    initialModel={modelToRefine}
                    onSuccess={handleRefinementSuccess}
                />
            )}
        </div>
    );
};
