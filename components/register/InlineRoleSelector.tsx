import React, { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, ChevronDown } from 'lucide-react';

interface InlineRoleSelectorProps {
    value: string;
    onChange: (newValue: string) => void;
    roles: string[];
    onAddRole: (role: string) => void;
    onRenameRole: (oldRole: string, newRole: string) => void;
    onDeleteRole: (roleToDelete: string) => void;
    themeColor?: 'amber' | 'emerald';
    disabled?: boolean;
    itemLabel?: string;
    placeholder?: string;
}

export const InlineRoleSelector: React.FC<InlineRoleSelectorProps> = ({
    value,
    onChange,
    roles,
    onAddRole,
    onRenameRole,
    onDeleteRole,
    themeColor = 'amber',
    disabled = false,
    itemLabel = 'Cargo',
    placeholder,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newRoleInput, setNewRoleInput] = useState('');

    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [editRoleInput, setEditRoleInput] = useState('');

    const containerRef = useRef<HTMLDivElement>(null);

    const isAmber = themeColor === 'amber';
    const selectPlaceholder = placeholder || `Selecione o(a) ${itemLabel.toLowerCase()}...`;

    const colorClasses = isAmber ? {
        borderFocus: 'border-amber-500 ring-2 ring-amber-500/20',
        activeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold',
        badgeBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        addBtn: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40',
        submitAddBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
        editInput: 'border-amber-300 dark:border-amber-700 focus:ring-amber-500/20',
        accentText: 'text-amber-600 dark:text-amber-400'
    } : {
        borderFocus: 'border-emerald-500 ring-2 ring-emerald-500/20',
        activeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        addBtn: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
        submitAddBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        editInput: 'border-emerald-300 dark:border-emerald-700 focus:ring-emerald-500/20',
        accentText: 'text-emerald-600 dark:text-emerald-400'
    };

    // Handle Click Outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsCreating(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleConfirmAdd = () => {
        const trimmed = newRoleInput.trim();
        if (!trimmed) return;
        onAddRole(trimmed);
        onChange(trimmed);
        setNewRoleInput('');
        setIsCreating(false);
        setIsOpen(false);
    };

    const handleStartEdit = (e: React.MouseEvent, role: string) => {
        e.stopPropagation();
        setEditingRole(role);
        setEditRoleInput(role);
    };

    const handleConfirmEdit = (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault();
        if (!editingRole) return;
        const trimmed = editRoleInput.trim();
        if (trimmed && trimmed !== editingRole) {
            onRenameRole(editingRole, trimmed);
            if (value === editingRole) {
                onChange(trimmed);
            }
        }
        setEditingRole(null);
        setEditRoleInput('');
    };

    const handleDelete = (e: React.MouseEvent, role: string) => {
        e.stopPropagation();
        if (confirm(`Tem certeza que deseja excluir "${role}" da lista?`)) {
            onDeleteRole(role);
            if (value === role) {
                onChange('');
            }
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Inline Editing State for Selected Item */}
            {editingRole && editingRole === value ? (
                <div className={`p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-400 dark:border-amber-600 flex items-center gap-1.5 shadow-sm`}>
                    <input
                        type="text"
                        value={editRoleInput}
                        onChange={(e) => setEditRoleInput(e.target.value)}
                        className="flex-1 bg-transparent text-slate-900 dark:text-white text-xs font-bold px-2 py-1 outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmEdit(e);
                            if (e.key === 'Escape') setEditingRole(null);
                        }}
                    />
                    <button
                        type="button"
                        onClick={(e) => handleConfirmEdit(e)}
                        className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                        title="Salvar"
                    >
                        <Check className="w-3 h-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setEditingRole(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Cancelar"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            ) : (
                /* Main Selector Button */
                <div
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2 px-3 text-xs font-bold transition-all cursor-pointer select-none ${
                        isOpen ? colorClasses.borderFocus : 'hover:border-slate-300 dark:hover:border-slate-600'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 pr-2">
                        {value ? (
                            <span className="truncate text-slate-900 dark:text-white font-extrabold text-xs">
                                {value}
                            </span>
                        ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-normal truncate">
                                {selectPlaceholder}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {/* Action Icons right next to selected value */}
                        {value && (
                            <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-700 pr-1.5 mr-0.5">
                                <button
                                    type="button"
                                    onClick={(e) => handleStartEdit(e, value)}
                                    className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title={`Renomear ${itemLabel}`}
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleDelete(e, value)}
                                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title={`Excluir ${itemLabel} da Lista`}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            )}

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn max-h-60 flex flex-col">
                    {/* List Options */}
                    <div className="overflow-y-auto py-1 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-48">
                        {roles.length === 0 && !isCreating && (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center italic">
                                Nenhum(a) {itemLabel.toLowerCase()} cadastrado(a).
                            </div>
                        )}

                        {roles.map((role) => {
                            const isSelected = value === role;
                            const isBeingEdited = editingRole === role;

                            if (isBeingEdited) {
                                return (
                                    <div key={role} className="p-1.5 bg-slate-50 dark:bg-slate-800/80 flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            value={editRoleInput}
                                            onChange={(e) => setEditRoleInput(e.target.value)}
                                            className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 outline-none"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleConfirmEdit(e);
                                                if (e.key === 'Escape') setEditingRole(null);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={(e) => handleConfirmEdit(e)}
                                            className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors cursor-pointer"
                                            title="Salvar"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingRole(null)}
                                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                            title="Cancelar"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={role}
                                    onClick={() => {
                                        onChange(role);
                                        setIsOpen(false);
                                    }}
                                    className={`group flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors cursor-pointer select-none ${
                                        isSelected ? colorClasses.activeBg : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    <span className="truncate flex-1 pr-2">{role}</span>

                                    {/* Action buttons inside dropdown */}
                                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                        {isSelected && (
                                            <Check className={`w-3.5 h-3.5 mr-1 ${colorClasses.accentText}`} />
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => handleStartEdit(e, role)}
                                            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                                            title={`Renomear ${itemLabel}`}
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleDelete(e, role)}
                                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                                            title={`Excluir ${itemLabel}`}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer: Add New Item */}
                    <div className="border-t border-slate-100 dark:border-slate-800 p-1.5 bg-slate-50/50 dark:bg-slate-900/80 shrink-0">
                        {isCreating ? (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    value={newRoleInput}
                                    onChange={(e) => setNewRoleInput(e.target.value)}
                                    placeholder={`Nome do(a) novo(a) ${itemLabel.toLowerCase()}...`}
                                    className={`flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs px-2 py-1.5 rounded-lg border outline-none font-bold ${colorClasses.editInput}`}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleConfirmAdd();
                                        } else if (e.key === 'Escape') {
                                            setIsCreating(false);
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleConfirmAdd}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${colorClasses.submitAddBtn}`}
                                >
                                    <Check className="w-3 h-3" />
                                    Salvar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsCreating(false); setNewRoleInput(''); }}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => { setIsCreating(true); setNewRoleInput(''); }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${colorClasses.addBtn}`}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Criar Novo(a) {itemLabel}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
