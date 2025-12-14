
import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';

export const Header: React.FC = () => {
    const { activeView } = useUI();
    const { t } = useTranslation();

    // Map view to title for breadcrumb/header title
    const viewTitles: Record<string, string> = {
        'dashboard': t('dashboard.title'),
        'upload': t('upload.title'),
        'reports': t('reports.title'),
        'savedReports': t('savedReports.title'),
        'search': t('search.title'),
        'settings': t('settings.title'),
        'cadastro': t('register.title'),
        'admin': 'Administração'
    };
    const currentTitle = viewTitles[activeView] || t('app.title');

    return (
        <header className="sticky top-0 z-40 transition-all duration-300 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5">
            <div className="px-6 h-16 lg:h-20 flex items-center justify-between">
                {/* Left: Context Title */}
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-brand-graphite dark:text-white tracking-tight leading-none">
                        {currentTitle}
                    </h2>
                </div>
            </div>
        </header>
    );
};
