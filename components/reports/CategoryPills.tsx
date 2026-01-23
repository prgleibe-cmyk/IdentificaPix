
import React from 'react';
import { RectangleStackIcon, BuildingOfficeIcon, ExclamationTriangleIcon, BanknotesIcon } from '../Icons';
import { ReportCategory } from '../../hooks/useReportsController';

interface CategoryPillsProps {
    activeCategory: ReportCategory;
    onCategoryChange: (cat: ReportCategory) => void;
    counts: { general: number; churches: number; pending: number; expenses: number };
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({ activeCategory, onCategoryChange, counts }) => {
    const categories = [
        { id: 'general', label: 'Geral', count: counts.general, icon: RectangleStackIcon, theme: 'slate' },
        { id: 'churches', label: 'Igrejas', count: counts.churches, icon: BuildingOfficeIcon, theme: 'blue' },
        { id: 'unidentified', label: 'Pendentes', count: counts.pending, icon: ExclamationTriangleIcon, theme: 'amber' },
        { id: 'expenses', label: 'Saídas', count: counts.expenses, icon: BanknotesIcon, theme: 'rose' }
    ];

    return (
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-full border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
            {categories.map(cat => {
                const isActive = activeCategory === cat.id;
                let activeClass = isActive ? (cat.id === 'general' ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white' : cat.id === 'churches' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : cat.id === 'unidentified' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'bg-gradient-to-r from-rose-500 to-red-600 text-white') : 'bg-white dark:bg-slate-800 text-slate-500';
                return (
                    <button
                        key={cat.id}
                        onClick={() => onCategoryChange(cat.id as ReportCategory)}
                        className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-wide border border-transparent shadow-sm ${activeClass} ${isActive ? 'transform scale-105 z-10 shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <cat.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{cat.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}>
                            {cat.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
