import React from 'react';

interface PortalContainerProps {
    children: React.ReactNode;
    className?: string;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const PortalContainer: React.FC<PortalContainerProps> = ({
    children,
    className = '',
    maxWidth = 'lg'
}) => {
    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        full: 'max-w-full'
    };

    return (
        <div className={`w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 ${maxWidthClasses[maxWidth]} ${className}`}>
            {children}
        </div>
    );
};
