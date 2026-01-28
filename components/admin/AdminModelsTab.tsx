import React, { useState, useEffect, useContext } from 'react';
import { modelService } from '../../services/modelService';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { FileModel } from '../../types';
import { 
    BrainIcon, 
    TrashIcon, 
    MagnifyingGlassIcon, 
    ArrowPathIcon, 
    PencilIcon, 
    WrenchScrewdriverIcon,
    PlusCircleIcon,
    FloppyDiskIcon,
    XMarkIcon
} from '../Icons';
import { FilePreprocessorModal } from '../modals/FilePreprocessorModal';

export const AdminModelsTab: React.FC = () => {
    const { showToast } = useUI();
    const { fetchModels } = useContext(AppContext);
    const [models, setModels] = useState<FileModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isCreatingModel, setIsCreatingModel] = useState(false);
    const [modelToRefine, setModelToRefine] = useState<FileModel | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const loadModels = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const dbModels = await modelService.getAllModelsAdmin();
            setModels(dbModels);
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        loadModels();
    }, []);

    const handleSaveName = async (id: string) => {
        if (!editName.trim()) return;
        const success = await modelService.updateModelName(id, editName);
        if (success) {
            showToast("Nome atualizado.", "success");
            setModels(prev => prev.map(m => m.id === id ? { ...m, name: editName } : m));
            setEditingId(null);
            if (fetchModels) fetchModels();
        }
    };

    const handleDelete = async (id: string) => {
        if (deleteConfirmId === id) {
            const success = await modelService.deleteModel(id);
            if (success) {
                showToast("Modelo removido.", "success");
                setModels(prev => prev.filter(m => m.id !== id));
                if (fetchModels) fetchModels();
            }
            setDeleteConfirmId(null);
        } else {
            setDeleteConfirmId(id);
        }
    };

    const filteredModels = models.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full gap-4 pt-4">
            <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 p-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 border border-purple-100">
                        <BrainIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Laboratório de Estruturas</h3>
                        <p className="text-[10px] text-slate-500 font-medium">Modelos Ativos: {models.length}</p>
                    </div>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Buscar modelo..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-none w-full font-medium"
                        />
                    </div>
                    <button 
                        onClick={() => setIsCreatingModel(true)} 
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:scale-95 border border-white/10"
                    >
                        <PlusCircleIcon className="w-4 h-4" />
                        <span>Novo Modelo</span>
                    </button>
                    <button onClick={() => loadModels()} className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100">
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 font-bold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Nome do Modelo</th>
                                <th className="px-6 py-4">Versão</th>
                                <th className="px-6 py-4">ID de Linhagem</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr><td colSpan={4} className="text-center py-12"><div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div></td></tr>
                            ) : filteredModels.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-20 text-slate-400 italic font-medium">Nenhum modelo treinado disponível.</td></tr>
                            ) : (
                                filteredModels.map((model) => (
                                    <tr key={model.id} className="hover:bg-slate-50 group transition-colors">
                                        <td className="px-6 py-4">
                                            {editingId === model.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={editName} 
                                                        onChange={e => setEditName(e.target.value)}
                                                        className="border border-indigo-300 rounded px-2 py-1 text-xs outline-none focus:ring-2 ring-indigo-100"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSaveName(model.id)} className="p-1 text-emerald-600"><FloppyDiskIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => setEditingId(null)} className="p-1 text-slate-400"><XMarkIcon className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700">{model.name}</span>
                                                    <span className="text-[9px] text-slate-400 uppercase tracking-tighter">Status: {model.status === 'approved' ? 'Certificado' : 'Rascunho'}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-slate-100 rounded-full font-mono font-bold text-slate-600">v{model.version}</span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-400 text-[10px]">
                                            {model.lineage_id}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={(() => { setEditingId(model.id); setEditName(model.name); })}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Renomear"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setModelToRefine(model)}
                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="Reaprender (Refinar Estrutura)"
                                                >
                                                    <WrenchScrewdriverIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(model.id)}
                                                    className={`p-2 rounded-lg transition-colors ${deleteConfirmId === model.id ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                    title={deleteConfirmId === model.id ? "Clique para Confirmar" : "Excluir"}
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {(isCreatingModel || !!modelToRefine) && (
                <FilePreprocessorModal 
                    onClose={() => { setIsCreatingModel(false); setModelToRefine(null); }}
                    initialModel={modelToRefine || undefined}
                    onSuccess={() => { setIsCreatingModel(false); setModelToRefine(null); loadModels(true); }}
                    mode={modelToRefine ? 'refine' : 'create'}
                />
            )}
        </div>
    );
};
