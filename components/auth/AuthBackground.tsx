import React from 'react';
import { TableCellsIcon, PresentationChartLineIcon, BanknotesIcon, DocumentDuplicateIcon, QrCodeIcon, ChartBarIcon } from '../Icons';

export const AuthBackground: React.FC = () => {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {/* Noise Layer */}
            <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
            </div>

            {/* Globs */}
            <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[120px]"></div>

            {/* Icons */}
            <TableCellsIcon className="absolute top-[10%] left-[5%] w-24 h-24 text-white opacity-[0.03] transform -rotate-12" />
            <PresentationChartLineIcon className="absolute top-[15%] right-[8%] w-32 h-32 text-blue-300 opacity-[0.04] transform rotate-6" />
            <BanknotesIcon className="absolute top-[45%] left-[-2%] w-40 h-40 text-white opacity-[0.03] transform rotate-45" />
            <DocumentDuplicateIcon className="absolute bottom-[20%] right-[5%] w-28 h-28 text-cyan-300 opacity-[0.04] transform -rotate-12" />
            <QrCodeIcon className="absolute bottom-[5%] left-[15%] w-20 h-20 text-white opacity-[0.03] transform rotate-12" />
            <ChartBarIcon className="absolute top-[40%] right-[20%] w-16 h-16 text-white opacity-[0.03] transform -rotate-6" />
        </div>
    );
};