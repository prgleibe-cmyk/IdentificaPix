import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { MagnifyingGlassIcon } from '../Icons';
import { useAdminUsers } from './useAdminUsers';
import { UserTable } from './UserTable';
import { EditUserModal } from './EditUserModal';

export const AdminUsersTab: React.FC = () => {
    const { t } = useTranslation();
    const {
        usersList,
        isLoadingData,
        searchTerm,
        setSearchTerm,
        editingUser,
        setEditingUser,
        formData,
        setFormData,
        isSaving,
        handleEditClick,
        handleSaveUser
    } = useAdminUsers();

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in relative h-full flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                    {t('admin.users.title')} ({usersList.length})
                </h3>
                <div className="relative">
                    <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder={t('admin.users.searchPlaceholder')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-blue outline-none w-full md:w-64 font-medium"
                    />
                </div>
            </div>
            
            <UserTable 
                users={usersList} 
                isLoading={isLoadingData} 
                onEdit={handleEditClick} 
            />

            {editingUser && (
                <EditUserModal 
                    user={editingUser}
                    formData={formData}
                    setFormData={setFormData}
                    isSaving={isSaving}
                    onClose={() => setEditingUser(null)}
                    onSubmit={handleSaveUser}
                />
            )}
        </div>
    );
};