
import React, { useState, useEffect } from 'react';
import { modelService } from '../../services/modelService';
import { useUI } from '../../contexts/UIContext';
import { FileModel } from '../../types';
import { 
    BrainIcon, 
    TrashIcon, 
    EyeIcon, 
    DocumentArrowDownIcon, 
    MagnifyingGlassIcon, 
    TableCellsIcon,
    XMarkIcon,
    ArrowPathIcon
} from '../Icons';

export const AdminModelsTab: React.FC = () => {
    const { showToast } = useUI();
    const [models, setModels] = useState<(FileModel & { user_email?: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModel, setSelectedModel] = useState<FileModel | null>(null);

    useEffect(() => {
        loadModels();
    }, []);

    const loadModels = async () => {
        setIsLoading(true);
        const data = await modelService.getAllModelsAdmin();
        setModels(data);
        setIsLoading(false);
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Tem certeza que deseja esquecer o modelo "${name}"? O sistema pedirá para treinar novamente no próximo upload.`)) {
            const success = await modelService.deleteModel(id);
            if (success) {
                showToast("Modelo excluído com sucesso.", "success");
                loadModels();
                if (selectedModel?.id === id) setSelectedModel(null);
            } else {
                showToast("Erro ao excluir modelo.", "error");
            }
        }
    };

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
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Modelos Aprendidos</h3>
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
                                    filteredModels.map(model => (
                                        <tr 
                                            key={model.id} 
                                            onClick={() => setSelectedModel(model)}
                                            className={`cursor-pointer transition-colors group ${selectedModel?.id === model.id ? 'bg-purple-50 dark:bg-purple-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{model.name}</div>
                                                <div className="text-[9px] text-slate-400 font-mono mt-0.5">v{model.version} • {model.fingerprint?.columnCount || '?'} cols</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {model.name.toLowerCase().includes('lista') || model.name.toLowerCase().includes('contributor') ? (
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded text-[9px] font-bold uppercase border border-indigo-100 dark:border-indigo-800">Lista</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded text-[9px] font-bold uppercase border border-blue-100 dark:border-blue-800">Extrato</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-slate-600 dark:text-slate-300 truncate max-w-[150px]">{model.user_email}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {new Date(model.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => handleDelete(model.id, model.name)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    title="Excluir Modelo"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Painel de Visualização (Preview/Snippet) */}
                {selectedModel && (
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
        </div>
    );
};
