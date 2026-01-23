import React from 'react';
import { BaseIcon } from './BaseIcon';

export const BanknotesIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
    </BaseIcon>
);

export const CreditCardIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
    </BaseIcon>
);

export const DollarSignIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </BaseIcon>
);

export const BarcodeIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 5v14M8 5v14M11 5v14M16 5v14M21 5v14M6 5v14M13 5v14M18 5v14" />
    </BaseIcon>
);

export const QrCodeIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3M14 17h1M14 20h3M17 17h1M17 20h1M20 14h1M20 17h1M20 20h1M17 14h1" />
    </BaseIcon>
);

export const TrophyIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </BaseIcon>
);

export const ChartBarIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
    </BaseIcon>
);

export const ChartPieIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </BaseIcon>
);

export const PresentationChartLineIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M4 4h16v12H4z" />
        <path d="M4 20h16M9 20v2M15 20v2M8 12l3-3 2 2 3-3" />
    </BaseIcon>
);

export const CircleStackIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </BaseIcon>
);

export const RectangleStackIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 10h18M3 14h18M3 18h18" />
        <path d="M2 5h20v14H2z" />
    </BaseIcon>
);

export const TableCellsIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
    </BaseIcon>
);

export const TagIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
    </BaseIcon>
);

export const BrainIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54Z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54Z" />
    </BaseIcon>
);

export const BuildingOfficeIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="9" y1="22" x2="9" y2="18" />
        <line x1="15" y1="22" x2="15" y2="18" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </BaseIcon>
);

export const DocumentDuplicateIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M20 7h-9a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </BaseIcon>
);

export const DocumentArrowDownIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 18 15 15" />
    </BaseIcon>
);

export const CloudArrowUpIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        <polyline points="12 12 12 16" />
        <polyline points="9 15 12 12 15 15" />
    </BaseIcon>
);

export const UploadIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </BaseIcon>
);

export const EnvelopeIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
        <polyline points="22,6 12,13 2,6" />
    </BaseIcon>
);

export const ClipboardDocumentIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3m-6 9h6m-6-3h6" />
    </BaseIcon>
);

export const ClockIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </BaseIcon>
);

export const CalendarIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </BaseIcon>
);

export const Cog6ToothIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </BaseIcon>
);

export const AdjustmentsHorizontalIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <line x1="21" y1="4" x2="14" y2="4" />
        <line x1="10" y1="4" x2="3" y2="4" />
        <line x1="21" y1="12" x2="12" y2="12" />
        <line x1="8" y1="12" x2="3" y2="12" />
        <line x1="21" y1="20" x2="16" y2="20" />
        <line x1="12" y1="20" x2="3" y2="20" />
        <line x1="14" y1="2" x2="14" y2="6" />
        <line x1="8" y1="10" x2="8" y2="14" />
        <line x1="16" y1="18" x2="16" y2="22" />
    </BaseIcon>
);

export const PaintBrushIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8a4.5 4.5 0 0 1-4.5 4.5c-.53 0-1.04-.09-1.52-.27-.37-.13-.77-.07-1.09.18-.32.25-.49.64-.46 1.04.05.51.07 1.04.07 1.55 0 1.66-1.34 3-3 3z" />
        <circle cx="7.5" cy="10.5" r="1" />
        <circle cx="10.5" cy="7.5" r="1" />
        <circle cx="13.5" cy="7.5" r="1" />
        <circle cx="16.5" cy="10.5" r="1" />
    </BaseIcon>
);
