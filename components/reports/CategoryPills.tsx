
import React from 'react';
import { RectangleStackIcon, BuildingOfficeIcon, ExclamationTriangleIcon, BanknotesIcon } from '../Icons';
import { ReportCategory } from '../../hooks/useReportsController';

interface CategoryPillsProps {
    activeCategory: ReportCategory;
    onCategoryChange: (cat: ReportCategory) => void;
    counts: { general: number; churches: number; pending: number; expenses: number; contributors?: number };
    role?: string;
    isSecondaryUser?: boolean;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({ activeCategory, onCategoryChange, counts, role, isSecondaryUser }) => {
    let categories: Array<{ id: ReportCategory; label: string; count?: number; icon: any; theme: string }> = [
        { id: 'general', label: 'Geral', count: counts.general, icon: RectangleStackIcon, theme: 'slate' },
        { id: 'churches', label: 'Igrejas', count: counts.churches, icon: BuildingOfficeIcon, theme: 'blue' },
        { id: 'unidentified', label: 'Pendentes', count: counts.pending, icon: ExclamationTriangleIcon, theme: 'amber' },
        { id: 'expenses', label: 'Saídas', count: counts.expenses, icon: BanknotesIcon, theme: 'rose' }
    ];

    if (isSecondaryUser || role === 'member') {
        categories = categories.filter(cat => cat.id === 'churches');
    }

    return (
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
            {categories.map(cat => {
                const isActive = activeCategory === cat.id;
                let activeClass = isActive 
                    ? (cat.id === 'general' ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-xs' 
                        : cat.id === 'churches' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs' 
                        : cat.id === 'unidentified' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs' 
                        : cat.id === 'contributors' ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs'
                        : 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-xs') 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200/60 dark:border-slate-700/60';
                return (
                    <button
                        key={cat.id}
                        onClick={() => onCategoryChange(cat.id)}
                        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 text-[11px] font-black uppercase tracking-wider border border-transparent cursor-pointer ${activeClass} ${isActive ? 'z-10' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <cat.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{cat.label}</span>
                        {cat.count !== undefined && (
                            <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}>
                                {cat.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};
