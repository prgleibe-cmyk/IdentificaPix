
import React from 'react';
import { PlayCircleIcon } from '../../Icons';

interface MappingControlsProps {
    mapping: any;
    setMapping: (mapping: any) => void;
    columnCount: number;
    onSimulate: () => void;
}

export const MappingControls: React.FC<MappingControlsProps> = ({
    mapping,
    setMapping,
    columnCount,
    onSimulate
}) => {
    if (!mapping) return null;

    const columnOptions = Array.from({ length: columnCount }, (_, i) => (
        <option key={i} value={i}>
            Coluna {String.fromCharCode(65 + i)}
        </option>
    ));

    const updateField = (field: string, value: string) => {
        setMapping({ ...mapping, [field]: parseInt(value) });
    };

    const ControlItem = ({ label, field, value, color }: { label: string, field: string, value: number, color: string }) => (
        <div className={`flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-full px-3 py-1 border border-slate-200 dark:border-slate-700 shadow-sm`}>
            <label className={`text-[9px] font-bold uppercase ${color}`}>{label}</label>
            <select 
                value={value} 
                onChange={(e) => updateField(field, e.target.value)}
                className="bg-transparent text-[11px] font-bold outline-none w-20 cursor-pointer text-slate-700 dark:text-slate-200"
            >
                <option value="-1">Nenhum</option>
                {columnOptions}
            </select>
        </div>
    );

    return (
        <div className="flex flex-wrap gap-2 items-center flex-1">
            <ControlItem 
                label="Data" 
                field="dateColumnIndex" 
                value={mapping.dateColumnIndex} 
                color="text-blue-600" 
            />
            <ControlItem 
                label="Descrição" 
                field="descriptionColumnIndex" 
                value={mapping.descriptionColumnIndex} 
                color="text-purple-600" 
            />
            <ControlItem 
                label="Valor" 
                field="amountColumnIndex" 
                value={mapping.amountColumnIndex} 
                color="text-emerald-600" 
            />
            
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

            <button 
                onClick={onSimulate}
                className="flex items-center gap-2 px-6 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[10px] font-bold uppercase shadow-md transition-all active:scale-95"
            >
                <PlayCircleIcon className="w-4 h-4" />
                <span>Simular</span>
            </button>
        </div>
    );
};
