
// ... existing imports ...
import React from 'react';

// --- Base Icon Props ---
interface IconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
    strokeWidth?: number;
    title?: string;
}

// Helper para padronizar o estilo "Outline" (Lucide/Heroicons style)
const BaseIcon: React.FC<IconProps & { children: React.ReactNode, viewBox?: string }> = ({ 
    className = "w-6 h-6", 
    strokeWidth = 1.5, 
    children,
    viewBox = "0 0 24 24",
    ...props
}) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox={viewBox} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={strokeWidth} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
        {...props}
    >
        {props.title && <title>{props.title}</title>}
        {children}
    </svg>
);

export const CreditCardIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
    </BaseIcon>
);

export const BarcodeIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 5v14" />
        <path d="M8 5v14" />
        <path d="M12 5v14" />
        <path d="M17 5v14" />
        <path d="M21 5v14" />
    </BaseIcon>
);

export const MagnifyingGlassIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </BaseIcon>
);

export const BanknotesIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </BaseIcon>
);

export const PlayCircleIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
    </BaseIcon>
);

export const CodeBracketSquareIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="m9 10-2 2 2 2" />
        <path d="m15 10 2 2-2 2" />
    </BaseIcon>
);

// ... rest of the file ...
// (Re-exporting all previous icons to ensure no breaking changes)
export const LogoIcon: React.FC<IconProps> = ({ className = "w-10 h-10", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 11L11 13L15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <defs>
            <linearGradient id="logo_grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="currentColor" stopOpacity="0.8"/>
                <stop offset="1" stopColor="currentColor"/>
            </linearGradient>
        </defs>
    </svg>
);

export const GoogleIcon: React.FC<IconProps> = ({ className = "w-5 h-5", ...props }) => (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.02,35.625,44,30.036,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
);

export const WhatsAppIcon: React.FC<IconProps> = ({ className, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
);

export const HomeIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </BaseIcon>
);

export const UploadIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </BaseIcon>
);

export const PlusCircleIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </BaseIcon>
);

export const ChartBarIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
    </BaseIcon>
);

export const SearchIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </BaseIcon>
);

export const Cog6ToothIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </BaseIcon>
);

export const CheckCircleIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </BaseIcon>
);

export const XCircleIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </BaseIcon>
);

export const ChartPieIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </BaseIcon>
);

export const ShieldCheckIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
    </BaseIcon>
);

export const UserIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </BaseIcon>
);

export const UserCircleIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" />
        <circle cx="12" cy="10" r="3" />
        <circle cx="12" cy="12" r="10" />
    </BaseIcon>
);

export const BuildingOfficeIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="9" y1="22" x2="9" y2="22.01" />
        <line x1="15" y1="22" x2="15" y2="22.01" />
        <line x1="9" y1="18" x2="9" y2="18.01" />
        <line x1="15" y1="18" x2="15" y2="18.01" />
        <line x1="9" y1="14" x2="9" y2="14.01" />
        <line x1="15" y1="14" x2="15" y2="14.01" />
        <line x1="9" y1="10" x2="9" y2="10.01" />
        <line x1="15" y1="10" x2="15" y2="10.01" />
        <line x1="9" y1="6" x2="9" y2="6.01" />
        <line x1="15" y1="6" x2="15" y2="6.01" />
    </BaseIcon>
);

export const CircleStackIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </BaseIcon>
);

export const BoltIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </BaseIcon>
);

export const DollarSignIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </BaseIcon>
);

export const SparklesIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </BaseIcon>
);

export const ArrowsRightLeftIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </BaseIcon>
);

export const DocumentDuplicateIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </BaseIcon>
);

export const FloppyDiskIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </BaseIcon>
);

export const PencilIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </BaseIcon>
);

export const TrashIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </BaseIcon>
);

export const PrinterIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
    </BaseIcon>
);

export const DocumentArrowDownIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.342a2 2 0 0 0-.602-1.43l-4.44-4.342A2 2 0 0 0 13.56 2H6a2 2 0 0 0-2 2z" />
        <path d="M12 10v8" />
        <path d="M8 14l4 4 4-4" />
    </BaseIcon>
);

export const XMarkIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </BaseIcon>
);

export const ChevronLeftIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <polyline points="15 18 9 12 15 6" />
    </BaseIcon>
);

export const ChevronRightIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <polyline points="9 18 15 12 9 6" />
    </BaseIcon>
);

export const ChevronUpIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <polyline points="18 15 12 9 6 15" />
    </BaseIcon>
);

export const ChevronDownIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <polyline points="6 9 12 15 18 9" />
    </BaseIcon>
);

export const SunIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </BaseIcon>
);

export const MoonIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </BaseIcon>
);

export const GlobeAltIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </BaseIcon>
);

export const ArrowLeftOnRectangleIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </BaseIcon>
);

export const ExclamationTriangleIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </BaseIcon>
);

export const PaintBrushIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 2.69l5.74 9.2a.909.909 0 0 0 1.27.32l2.99-1.99a.909.909 0 0 0 .32-1.27l-9.2-5.74Z" />
        <path d="M11 10.65 14.35 14" />
        <path d="m14 17 3 3" />
        <path d="M8.29 17a6.29 6.29 0 0 0-3.32-2.18l-.5-.11a6.3 6.3 0 0 0-3.83.69l-.19.1 7.84 7.84.1-.19a6.3 6.3 0 0 0 .69-3.83l-.11-.5A6.29 6.29 0 0 0 8.29 17Z" />
    </BaseIcon>
);

export const AdjustmentsHorizontalIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
    </BaseIcon>
);

export const InformationCircleIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </BaseIcon>
);

export const EnvelopeIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </BaseIcon>
);

export const LockClosedIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </BaseIcon>
);

export const EyeIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </BaseIcon>
);

export const EyeSlashIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </BaseIcon>
);

export const CalendarIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </BaseIcon>
);

export const QrCodeIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <path d="M3 14h7v7H3z" />
    </BaseIcon>
);

export const ClipboardDocumentIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </BaseIcon>
);

export const CheckBadgeIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.74z" />
        <polyline points="9 12 11 14 15 10" />
    </BaseIcon>
);

export const PhotoIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
    </BaseIcon>
);

export const ClockIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </BaseIcon>
);

export const WrenchScrewdriverIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </BaseIcon>
);

export const BrainIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 16v5" />
        <path d="M16 14v6" />
        <path d="M8 14v6" />
        <path d="M12 3a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
    </BaseIcon>
);

export const UserPlusIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
    </BaseIcon>
);

export const ArrowPathIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </BaseIcon>
);

export const PresentationChartLineIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 3v18h18" />
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
    </BaseIcon>
);

export const TrophyIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10" />
        <path d="M17 4v3a5 5 0 0 1-10 0V4" />
        <path d="M3 6h4" />
        <path d="M17 6h4" />
        <path d="M3 6v1c0 2.21 1.79 4 4 4h0" />
        <path d="M21 6v1c0 2.21-1.79 4-4 4h0" />
    </BaseIcon>
);

export const RectangleStackIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M2 10h20" />
        <path d="M2 14h20" />
        <path d="M2 18h20" />
        <rect x="2" y="6" width="20" height="16" rx="2" />
    </BaseIcon>
);

export const TableCellsIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z" />
    </BaseIcon>
);

export const CursorArrowRaysIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M13 13l6 6" />
    </BaseIcon>
);
