
import React, { useState, useEffect, useContext, useRef } from 'react';
import { modelService } from '../../services/modelService';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { FileModel, Transaction } from '../../types';
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
    ShieldCheckIcon,
    PlayCircleIcon,
    PlusCircleIcon
} from '../Icons';
import { FilePreprocessorModal } from '../modals/FilePreprocessorModal';

export const AdminModelsTab: React.FC = () => {
    const { showToast } = useUI();
    const { fetchModels } = useContext(AppContext);
    const [models, setModels] = useState<(FileModel & { user_email?: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModel, setSelectedModel] = useState<FileModel | null>(null);
    const [modelToRefine, setModelToRefine] = useState<FileModel | null>(null);
    
    // Estados para o Teste de Modelo
    const [modelToTest, setModelToTest] = useState<FileModel | null>(null);
    const [testFile, setTestFile] = useState<{ content: string, fileName: string, rawFile: File } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estado para criação de modelo novo
    const [isCreatingModel, setIsCreatingModel] = useState(false);

    // Estados de Ação Inline
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    useEffect(() => {
        loadModels();
    }, []);

    const loadModels = async (silent = false) => {
        if (!silent) setIsLoading(true);
        // Carrega APENAS modelos dinâmicos (Banco de Dados + LocalStorage)
        // Removemos qualquer injeção de estratégias nativas hardcoded aqui.
        const dbModels = await modelService.getAllModelsAdmin();
        setModels(dbModels);
        if (!silent) setIsLoading(false);
    };

    const stopPropagation = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        stopPropagation(e);
        if (deleteConfirmId === id) {
            const success = await modelService.deleteModel(id);
            if (success) {
                showToast("Modelo excluído com sucesso.", "success");
                
                // Atualização Otimista: Remove da lista visualmente
                setModels(prev => prev.filter(m => m.id !== id));
                
                if (fetchModels) await fetchModels();
                if (selectedModel?.id === id) setSelectedModel(null);
            } else {
                showToast("Erro ao excluir modelo.", "error");
            }
            setDeleteConfirmId(null);
        } else {
            setDeleteConfirmId(id);
            setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 4000);
        }
    };

    const handleStartRename = (e: React.MouseEvent, model: FileModel) => {
        stopPropagation(e);
        setDeleteConfirmId(null);
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
            
            // Atualização Otimista
            setModels(prev => prev.map(m => m.id === id ? { ...m, name: editName.trim() } : m));
            
            if (fetchModels) fetchModels();
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

    // Callback unificado para sucesso na criação/edição
    const handleRefinementSuccess = async (savedModel: FileModel, _data: Transaction[]) => {
        setModelToRefine(null);
        setIsCreatingModel(false);
        showToast("Modelo salvo com sucesso!", "success");
        
        if (savedModel) {
            // Atualização Otimista: Insere ou Substitui na lista
            setModels(prev => {
                // Remove versão anterior se for da mesma linhagem (para não duplicar visualmente)
                const cleaned = prev.filter(m => m.lineage_id !== savedModel.lineage_id);
                // Adiciona o novo no topo
                return [{ ...savedModel, user_email: 'Você (Agora)' }, ...cleaned];
            });
        }

        // Sincroniza em background
        loadModels(true);
        if (fetchModels) await fetchModels();
    };

    const initiateTest = (e: React.MouseEvent, model: FileModel) => {
        stopPropagation(e);
        setModelToTest(model);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fileInputRef.current?.click();
    };

    const handleFileSelectedForTest = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !modelToTest) return;

        let content = '';
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.ofx')) {
            content = await file.text();
        } else {
            content = ''; 
        }

        setTestFile({
            content,
            fileName: file.name,
            rawFile: file
        });
    };

    const closeTestModal = () => {
        setModelToTest(null);
        setTestFile(null);
    };

    const filteredModels = models.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (m.user_email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full gap-4">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileSelectedForTest}
                accept=".csv,.txt,.xlsx,.xls,.pdf"
            />

            <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 p-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800">
                        <BrainIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Laboratório de Arquivos</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Gestão de inteligência e aprendizado de layouts ({models.length})</p>
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
                        onClick={() => setIsCreatingModel(true)} 
                        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase shadow-md hover:shadow-lg transition-all active:scale-95"
                    >
                        <PlusCircleIcon className="w-3.5 h-3.5" />
                        <span>Novo Modelo</span>
                    </button>

                    <button 
                        onClick={() => loadModels()} 
                        className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-purple-600 hover:border-purple-200 transition-colors"
                        title="Atualizar Lista"
                    >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-xs text-left">
                            <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 font-bold border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Modelo</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Autor</th>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                {isLoading ? (
                                    <tr><td colSpan={6} className="text-center py-8"><div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div></td></tr>
                                ) : filteredModels.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400">
                                            <p className="text-sm font-bold mb-2">Nenhum modelo encontrado.</p>
                                            <p className="text-xs mb-4">Crie um novo modelo para ensinar o sistema a ler seus arquivos.</p>
                                            <button 
                                                onClick={() => setIsCreatingModel(true)} 
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full text-xs font-bold uppercase transition-colors"
                                            >
                                                Criar Primeiro Modelo
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredModels.map((model: FileModel & { user_email?: string }) => {
                                        const isEditing = editingId === model.id;
                                        const isConfirmingDelete = deleteConfirmId === model.id;
                                        const isSelected = selectedModel?.id === model.id;
                                        const status = model.status || 'draft';

                                        return (
                                            <tr 
                                                key={model.id} 
                                                onClick={() => !isEditing && setSelectedModel(model)}
                                                className={`transition-colors group cursor-pointer ${isSelected ? 'bg-purple-50 dark:bg-purple-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
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
                                                            <div>
                                                                <div className="font-bold truncate max-w-[200px] text-slate-700 dark:text-slate-200">{model.name}</div>
                                                                <div className="text-[9px] text-slate-400 font-mono mt-0.5">v{model.version} • {model.fingerprint?.columnCount || '?'} cols</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {status === 'approved' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 uppercase tracking-wide border border-emerald-200 dark:border-emerald-800">
                                                            <ShieldCheckIcon className="w-3 h-3" /> Aprovado
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wide border border-slate-200 dark:border-slate-700">
                                                            Rascunho
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {model.name.toLowerCase().includes('lista') || model.name.toLowerCase().includes('contributor') ? (
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded text-[9px] font-bold uppercase border border-indigo-100 dark:border-indigo-800">Lista</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded text-[9px] font-bold uppercase border border-blue-100 dark:border-blue-800">Extrato</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="truncate max-w-[150px] text-slate-600 dark:text-slate-300">
                                                        {model.user_email}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                    {new Date(model.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-center gap-1" onClick={stopPropagation}>
                                                            <button onClick={(e) => handleSaveRename(e, model.id)} className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"><CheckCircleIcon className="w-3.5 h-3.5" /></button>
                                                            <button onClick={handleCancelRename} className="p-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"><XCircleIcon className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={stopPropagation}>
                                                            <button onClick={(e) => handleStartRename(e, model)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Renomear"><PencilIcon className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => handleRefine(e, model)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="Reaprender (Refinar)"><WrenchScrewdriverIcon className="w-3.5 h-3.5" /></button>
                                                            <button onClick={(e) => handleDelete(e, model.id)} className={`p-1.5 rounded-lg transition-all duration-200 ${isConfirmingDelete ? 'bg-red-500 text-white hover:bg-red-600 shadow-md scale-110' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`} title={isConfirmingDelete ? "Confirmar?" : "Excluir"}>{isConfirmingDelete ? <ExclamationTriangleIcon className="w-3.5 h-3.5 animate-pulse" /> : <TrashIcon className="w-3.5 h-3.5" />}</button>
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

                {selectedModel && !editingId && (
                    <div className="w-1/3 min-w-[300px] bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-scale-in">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                            <h4 className="font-bold text-xs text-slate-700 dark:text-white uppercase tracking-wider flex items-center gap-2"><TableCellsIcon className="w-4 h-4 text-slate-400" /> Preview (Snippet)</h4>
                            <button onClick={() => setSelectedModel(null)} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            {selectedModel.status === 'approved' && (
                                <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 flex items-start gap-2">
                                    <ShieldCheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Modelo Certificado</p>
                                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400/80 leading-snug">Aprovado em: {new Date(selectedModel.approvedAt || '').toLocaleDateString()}</p>
                                    </div>
                                </div>
                            )}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-inner">
                                {selectedModel.snippet ? <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 whitespace-pre overflow-x-auto">{selectedModel.snippet}</pre> : <div className="text-center py-8 text-slate-400 text-xs italic">Snippet não disponível.</div>}
                            </div>
                            <div className="mt-4 space-y-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
                                    <h5 className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Mapeamento</h5>
                                    <ul className="text-[10px] text-slate-600 dark:text-slate-300 space-y-1">
                                        <li>Data: Coluna {selectedModel.mapping.dateColumnIndex + 1}</li>
                                        <li>Descrição: Coluna {selectedModel.mapping.descriptionColumnIndex + 1}</li>
                                        <li>Valor: Coluna {selectedModel.mapping.amountColumnIndex + 1}</li>
                                        {selectedModel.mapping.typeColumnIndex !== undefined && <li>Tipo: Coluna {selectedModel.mapping.typeColumnIndex + 1}</li>}
                                        <li>Pular Linhas: {selectedModel.mapping.skipRowsStart}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-center"><p className="text-[9px] text-slate-400">ID: {selectedModel.id}</p></div>
                    </div>
                )}
            </div>

            {modelToRefine && (
                <FilePreprocessorModal 
                    onClose={() => setModelToRefine(null)}
                    initialFile={{
                        content: modelToRefine.snippet || '',
                        fileName: modelToRefine.name,
                        type: modelToRefine.name.toLowerCase().includes('lista') ? 'contributor' : 'statement',
                        id: 'refine-mode',
                        rawFile: undefined
                    }}
                    initialModel={modelToRefine}
                    onSuccess={handleRefinementSuccess}
                    mode="refine"
                />
            )}

            {testFile && modelToTest && (
                <FilePreprocessorModal 
                    onClose={closeTestModal}
                    initialFile={{ ...testFile, type: 'statement', id: 'test-mode' }}
                    initialModel={modelToTest}
                    mode="test"
                />
            )}

            {isCreatingModel && (
                <FilePreprocessorModal 
                    onClose={() => setIsCreatingModel(false)}
                    initialFile={undefined} 
                    onSuccess={handleRefinementSuccess}
                    mode="create"
                />
            )}
        </div>
    );
};
