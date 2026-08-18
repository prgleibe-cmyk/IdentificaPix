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
          containerBg: 'bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white border-b border-purple-500/40 shadow-lg shadow-purple-900/20',
          badgeBg: 'bg-purple-900/60 text-purple-200 border border-purple-400/40',
          btnBg: 'bg-white text-purple-900 hover:bg-purple-50',
          icon: <Wrench className="w-4 h-4 text-purple-200 flex-shrink-0 animate-pulse" />,
          defaultTitle: 'Manutenção do Sistema'
        };
      case 'warning':
        return {
          containerBg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white border-b border-amber-400/40 shadow-lg shadow-orange-900/20',
          badgeBg: 'bg-amber-900/60 text-amber-100 border border-amber-300/40',
          btnBg: 'bg-white text-amber-900 hover:bg-amber-50',
          icon: <AlertTriangle className="w-4 h-4 text-amber-200 flex-shrink-0" />,
          defaultTitle: 'Aviso Importante'
        };
      case 'success':
        return {
          containerBg: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-b border-emerald-400/40 shadow-lg shadow-emerald-900/20',
          badgeBg: 'bg-emerald-900/60 text-emerald-100 border border-emerald-300/40',
          btnBg: 'bg-white text-emerald-900 hover:bg-emerald-50',
          icon: <Sparkles className="w-4 h-4 text-emerald-200 flex-shrink-0" />,
          defaultTitle: 'Novidade & Atualização'
        };
      case 'info':
      default:
        return {
          containerBg: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border-b border-blue-400/40 shadow-lg shadow-blue-900/20',
          badgeBg: 'bg-blue-900/60 text-blue-100 border border-blue-300/40',
          btnBg: 'bg-white text-blue-900 hover:bg-blue-50',
          icon: <Megaphone className="w-4 h-4 text-blue-200 flex-shrink-0" />,
          defaultTitle: 'Comunicado Global'
        };
    }
  };

  const style = getTypeStyles();
  const displayTitle = announcement.title?.trim() || style.defaultTitle;

  return (
    <div 
      className={`w-full py-2.5 px-4 z-40 transition-all duration-300 animate-fade-in relative ${style.containerBg}`}
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Left: Icon, Badge & Message */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
            {style.icon}
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wider ${style.badgeBg}`}>
              {displayTitle}
            </span>
            <p className="font-semibold text-white/95 leading-relaxed break-words">
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
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 ${style.btnBg}`}
            >
              <span>{announcement.linkLabel || 'Saiba Mais'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {announcement.dismissible !== false && (
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
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
