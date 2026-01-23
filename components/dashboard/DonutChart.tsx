
import React from 'react';

interface DonutChartProps {
    data: { name: string; value: number; color: string }[];
}

export const DonutChart: React.FC<DonutChartProps> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return <div className="text-center text-slate-400 py-12 font-medium text-xs">Aguardando dados...</div>;

    const radius = 60; 
    const strokeWidth = 10;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    return (
        <div className="flex flex-col items-center h-full justify-between py-2">
            <div className="relative w-32 h-32 flex-shrink-0 group mt-2">
                <div className="absolute inset-0 bg-brand-blue/5 rounded-full blur-2xl transform scale-90"></div>
                
                <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 160 160">
                     <circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-slate-100 dark:text-slate-700/30"
                    />
                    {data.map((item, index) => {
                        const percentage = item.value / total;
                        const dashArray = percentage * circumference;
                        const offset = accumulatedOffset;
                        accumulatedOffset += dashArray; 
                        
                        return (
                            <circle
                                key={`seg-${index}`}
                                cx="80"
                                cy="80"
                                r={radius}
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${dashArray} ${circumference - dashArray}`} 
                                strokeDashoffset={-offset}
                                strokeLinecap="round"
                                className="transition-all duration-500 hover:stroke-[12] hover:opacity-90 cursor-pointer drop-shadow-sm origin-center hover:scale-[1.02]"
                            />
                        );
                    })}
                </svg>
                 <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none z-20">
                    <span className="text-2xl font-black text-brand-graphite dark:text-white tracking-tighter tabular-nums transition-transform duration-500 group-hover:scale-110">{total}</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Registros</span>
                </div>
            </div>
            
            <div className="w-full px-4 mb-2 overflow-y-auto custom-scrollbar max-h-[140px]">
                <div className="grid grid-cols-1 gap-1.5">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all group/item">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate tracking-wide group-hover/item:text-slate-800 dark:group-hover/item:text-slate-200 transition-colors">
                                    {item.name}
                                </span>
                            </div>
                            <span className="text-[10px] font-black text-slate-700 dark:text-white tabular-nums bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                                {((item.value / total) * 100).toFixed(1)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
