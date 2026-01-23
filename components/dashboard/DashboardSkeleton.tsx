
import React from 'react';

export const DashboardSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 h-48 border border-slate-100 dark:border-slate-700"></div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700"></div>
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700"></div>
        </div>
    </div>
);
