import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Megaphone, 
  AlertTriangle, 
  Wrench, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink, 
  X, 
  Info,
  Clock
} from 'lucide-react';

export const GlobalAnnouncementBanner: React.FC = () => {
  const { systemSettings } = useAuth();
  const announcement = systemSettings?.announcement;
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Key to identify unique message version
  const messageVersionKey = announcement 
    ? `dismissed_announcement_${announcement.updatedAt || ''}_${announcement.type || ''}_${(announcement.message || '').slice(0, 30)}`
    : '';

  useEffect(() => {
    if (!messageVersionKey) {
      setDismissed(false);
      return;
    }
    const isDismissed = sessionStorage.getItem(messageVersionKey) === 'true';
    setDismissed(isDismissed);
  }, [messageVersionKey]);

  if (!announcement || !announcement.enabled || !announcement.message?.trim() || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    if (messageVersionKey) {
      sessionStorage.setItem(messageVersionKey, 'true');
    }
    setDismissed(true);
  };

  // Styling based on banner type
  const getTypeStyles = () => {
    switch (announcement.type) {
      case 'maintenance':
        return {
          containerBg: 'bg-slate-900 dark:bg-slate-950 text-slate-100 border-b border-slate-800',
          iconWrap: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
          badgeBg: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
          btnBg: 'bg-orange-600 text-white hover:bg-orange-700',
          closeBtn: 'text-slate-400 hover:text-white hover:bg-slate-800',
          icon: <Wrench className="w-4 h-4 flex-shrink-0" />,
          defaultTitle: 'Manutenção do Sistema'
        };
      case 'warning':
        return {
          containerBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100 border-b border-amber-200/90 dark:border-amber-900/60',
          iconWrap: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50',
          badgeBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
          btnBg: 'bg-amber-600 text-white hover:bg-amber-700',
          closeBtn: 'text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60',
          icon: <AlertTriangle className="w-4 h-4 flex-shrink-0" />,
          defaultTitle: 'Aviso Importante'
        };
      case 'success':
        return {
          containerBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 border-b border-emerald-200/90 dark:border-emerald-900/60',
          iconWrap: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50',
          badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800',
          btnBg: 'bg-emerald-600 text-white hover:bg-emerald-700',
          closeBtn: 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
          icon: <CheckCircle2 className="w-4 h-4 flex-shrink-0" />,
          defaultTitle: 'Novidade & Atualização'
        };
      case 'info':
      default:
        return {
          containerBg: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200/90 dark:border-slate-800 shadow-xs',
          iconWrap: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/70 dark:border-orange-900/40',
          badgeBg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/70 dark:border-orange-900/40',
          btnBg: 'bg-orange-600 text-white hover:bg-orange-700',
          closeBtn: 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
          icon: <Megaphone className="w-4 h-4 flex-shrink-0" />,
          defaultTitle: 'Comunicado Global'
        };
    }
  };

  const style = getTypeStyles();
  const displayTitle = announcement.title?.trim() || style.defaultTitle;

  return (
    <div 
      className={`w-full py-2.5 px-4 z-40 transition-colors relative ${style.containerBg}`}
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Left: Icon, Badge & Message */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${style.iconWrap}`}>
            {style.icon}
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] whitespace-nowrap ${style.badgeBg}`}>
              {displayTitle}
            </span>
            <p className="font-medium leading-relaxed break-words opacity-90">
              {announcement.message}
            </p>
          </div>
        </div>

        {/* Right: Action link & dismiss button */}
        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
          {announcement.linkUrl && (
            <a
              href={announcement.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 whitespace-nowrap ${style.btnBg}`}
            >
              <span>{announcement.linkLabel || 'Saiba Mais'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {announcement.dismissible !== false && (
            <button
              onClick={handleDismiss}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${style.closeBtn}`}
              title="Fechar aviso"
              aria-label="Fechar comunicado"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
