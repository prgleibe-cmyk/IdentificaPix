import React from 'react';
import { BaseIcon } from './BaseIcon';

export const MagnifyingGlassIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </BaseIcon>
);

export const MinusIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <line x1="5" y1="12" x2="19" y2="12" />
    </BaseIcon>
);

export const PlusIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </BaseIcon>
);

export const PlusCircleIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </BaseIcon>
);

export const XMarkIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </BaseIcon>
);

export const XCircleIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </BaseIcon>
);

export const CheckCircleIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </BaseIcon>
);

export const CheckBadgeIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
        <path d="m9 12 2 2 4-4" />
    </BaseIcon>
);

export const TrashIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </BaseIcon>
);

export const PencilIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
    </BaseIcon>
);

export const FloppyDiskIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </BaseIcon>
);

export const PrinterIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
    </BaseIcon>
);

export const ArrowPathIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M3 21v-5h5" />
    </BaseIcon>
);

export const PlayCircleIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
    </BaseIcon>
);

export const WrenchScrewdriverIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="m14.7 12.7 5 5a2 2 0 0 1 0 2.8l-1.5 1.5a2 2 0 0 1-2.8 0l-5-5" />
        <path d="M8.8 13.1l-4.2 4.2a2 2 0 0 0 0 2.8l1.5 1.5a2 2 0 0 0 2.8 0l4.2-4.2" />
        <circle cx="12" cy="12" r="3" />
        <path d="m20 4-8.4 8.4" />
        <path d="m4 20 8.4-8.4" />
    </BaseIcon>
);

export const ShieldIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </BaseIcon>
);

export const ShieldCheckIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
    </BaseIcon>
);

export const BoltIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </BaseIcon>
);

export const SparklesIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" />
        <path d="M5 3v4" /><path d="M3 5h4" /><path d="M21 17v4" /><path d="M19 19h4" />
    </BaseIcon>
);

export const InformationCircleIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </BaseIcon>
);

export const ExclamationTriangleIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </BaseIcon>
);

export const EyeIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </BaseIcon>
);

export const EyeSlashIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />
    </BaseIcon>
);

export const LockClosedIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </BaseIcon>
);

export const LockOpenIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </BaseIcon>
);

export const EllipsisVerticalIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
    </BaseIcon>
);

export const PhotoIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
    </BaseIcon>
);

export const ArrowsPointingOutIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="m15 3 6 6" />
        <path d="m9 21-6-6" />
        <path d="M21 3v6h-6" />
        <path d="M3 21v-6h6" />
        <path d="M21 3 14.5 9.5" />
        <path d="M3 21 9.5 14.5" />
    </BaseIcon>
);

export const ArrowsPointingInIcon: React.FC<any> = (props) => (
    <BaseIcon {...props}>
        <path d="m2 2 6 6" />
        <path d="m22 22-6-6" />
        <path d="M8 2v6H2" />
        <path d="M16 22v-6h6" />
        <path d="m12 12 10-10" />
        <path d="m12 12-10 10" />
    </BaseIcon>
);