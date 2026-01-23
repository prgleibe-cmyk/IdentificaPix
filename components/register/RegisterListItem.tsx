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
    <li className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 p-2 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 hover:-translate-y-0.5 transition-all duration-300 group gap-2 sm:gap-0">
        <div className="flex-1 min-w-0 pr-0 sm:pr-2">{children}</div>
        <div className="flex-shrink-0 flex items-center justify-end space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 sm:transform sm:translate-x-2 sm:group-hover:translate-x-0">
            {actions}
        </div>
    </li>
));