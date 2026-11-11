
import React from 'react';

export const DashboardSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 xl:gap-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 h-36 border border-slate-200/90 dark:border-slate-800"></div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xl:gap-4 h-[420px]">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800"></div>
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800"></div>
        </div>
    </div>
);
