import React, { memo } from 'react';

interface ListItemProps {
    children: React.ReactNode;
    actions: React.ReactNode;
}

/**
 * Reusable list item for Register view lists.
 * Preserves IdentificaPix standard styles and interactions.
 */
export const RegisterListItem: React.FC<ListItemProps> = memo(({ children, actions }) => (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl shadow-xs hover:border-orange-300/80 dark:hover:border-slate-700 transition-colors duration-200 group gap-2 sm:gap-0">
        <div className="flex-1 min-w-0 pr-0 sm:pr-2">{children}</div>
        <div className="flex-shrink-0 flex items-center justify-end gap-1.5 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity duration-200">
            {actions}
        </div>
    </li>
));