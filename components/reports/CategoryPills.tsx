import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RectangleStackIcon, BuildingOfficeIcon, ExclamationTriangleIcon, BanknotesIcon } from '../Icons';
import { ReportCategory } from '../../hooks/useReportsController';
import { ChevronDown, Check } from 'lucide-react';

interface CategoryPillsProps {
    activeCategory: ReportCategory;
    onCategoryChange: (cat: ReportCategory) => void;
    counts: { general: number; churches: number; pending: number; expenses: number; contributors?: number };
    role?: string;
    isSecondaryUser?: boolean;
    churchList?: { id: string; name: string; count: number }[];
    selectedReportId?: string | null;
    onSelectChurch?: (id: string) => void;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({ 
    activeCategory, 
    onCategoryChange, 
    counts, 
    role, 
    isSecondaryUser,
    churchList,
    selectedReportId,
    onSelectChurch
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
    const churchButtonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    let categories: Array<{ id: ReportCategory; label: string; count?: number; icon: any; theme: string }> = [
        { id: 'general', label: 'Geral', count: counts.general, icon: RectangleStackIcon, theme: 'slate' },
        { id: 'churches', label: 'Igrejas', count: counts.churches, icon: BuildingOfficeIcon, theme: 'blue' },
        { id: 'unidentified', label: 'Pendentes', count: counts.pending, icon: ExclamationTriangleIcon, theme: 'amber' },
        { id: 'expenses', label: 'Saídas', count: counts.expenses, icon: BanknotesIcon, theme: 'rose' }
    ];

    if (isSecondaryUser || role === 'member') {
        categories = categories.filter(cat => cat.id === 'churches');
    }

    const selectedChurch = churchList?.find(c => c.id === selectedReportId) || (churchList && churchList.length > 0 ? churchList[0] : null);

    const handleChurchButtonClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeCategory !== 'churches') {
            onCategoryChange('churches');
        }
        if (churchButtonRef.current) {
            const rect = churchButtonRef.current.getBoundingClientRect();
            const menuWidth = 280;
            let left = rect.left;
            if (left + menuWidth > window.innerWidth - 12) {
                left = Math.max(12, window.innerWidth - menuWidth - 12);
            }
            setDropdownPos({
                top: rect.bottom + 6,
                left: left
            });
        }
        setIsDropdownOpen(prev => !prev);
    };

    const handleCategoryClick = (catId: ReportCategory, e: React.MouseEvent) => {
        if (catId === 'churches') {
            handleChurchButtonClick(e);
        } else {
            setIsDropdownOpen(false);
            onCategoryChange(catId);
        }
    };

    useEffect(() => {
        if (!isDropdownOpen) return;

        const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(target) &&
                churchButtonRef.current && 
                !churchButtonRef.current.contains(target)
            ) {
                setIsDropdownOpen(false);
            }
        };

        const handleResize = () => {
            setIsDropdownOpen(false);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        window.addEventListener('resize', handleResize);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
            window.removeEventListener('resize', handleResize);
        };
    }, [isDropdownOpen]);

    return (
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-900/70 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-x-auto no-scrollbar">
            {categories.map(cat => {
                const isActive = activeCategory === cat.id;
                const isChurch = cat.id === 'churches';
                
                let activeClass = isActive 
                    ? (cat.id === 'general' ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-xs' 
                        : cat.id === 'churches' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs' 
                        : cat.id === 'unidentified' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs' 
                        : cat.id === 'contributors' ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs'
                        : 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-xs') 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200/60 dark:border-slate-700/60';

                const displayLabel = isChurch && isActive && selectedChurch
                    ? `Igreja: ${selectedChurch.name}`
                    : cat.label;

                return (
                    <button
                        key={cat.id}
                        ref={isChurch ? churchButtonRef : undefined}
                        onClick={(e) => handleCategoryClick(cat.id, e)}
                        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 text-[11px] font-black uppercase tracking-wider border border-transparent cursor-pointer ${activeClass} ${isActive ? 'z-10' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        title={isChurch ? 'Clique para selecionar uma congregação' : undefined}
                    >
                        <cat.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className={isChurch ? 'max-w-[160px] sm:max-w-[220px] truncate' : ''}>{displayLabel}</span>
                        {isChurch && (
                            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isActive ? 'text-white/80' : 'text-slate-400'} ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        )}
                        {cat.count !== undefined && (
                            <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-extrabold shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}>
                                {cat.count}
                            </span>
                        )}
                    </button>
                );
            })}

            {isDropdownOpen && dropdownPos && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: `${dropdownPos.top}px`,
                        left: `${dropdownPos.left}px`,
                        zIndex: 99999,
                        minWidth: '260px',
                        maxWidth: '340px'
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl py-1.5 backdrop-blur-md animate-scale-in"
                >
                    <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between mb-1">
                        <span>Selecionar Igreja</span>
                        <span className="text-[9px] font-mono lowercase opacity-70">({churchList?.length || 0})</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {churchList && churchList.length > 0 ? (
                            churchList.map(church => {
                                const isSelected = activeCategory === 'churches' && (selectedReportId === church.id || (!selectedReportId && churchList[0]?.id === church.id));
                                return (
                                    <button
                                        key={church.id}
                                        type="button"
                                        onClick={() => {
                                            onSelectChurch?.(church.id);
                                            onCategoryChange('churches');
                                            setIsDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-left text-xs font-bold transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-black'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/80'
                                        }`}
                                    >
                                        <span className="truncate flex-1">{church.name}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {church.count !== undefined && church.count > 0 && (
                                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                    {church.count}
                                                </span>
                                            )}
                                            {isSelected && (
                                                <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 stroke-[2.5]" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                                Nenhuma congregação encontrada
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
