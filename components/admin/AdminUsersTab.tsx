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
        isDeleting,
        userToDelete,
        setUserToDelete,
        handleEditClick,
        handleSaveUser,
        handleDeleteUser,
        confirmDeleteUser
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
                onDelete={handleDeleteUser}
                isDeleting={isDeleting}
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

            {userToDelete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-8">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Confirmar Exclusão</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                Tem certeza que deseja excluir o usuário <span className="font-bold text-red-500">{userToDelete.email}</span>? 
                                Esta ação não pode ser desfeita e removerá permanentemente o perfil do usuário.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => setUserToDelete(null)}
                                    className="px-5 py-2 text-xs font-bold rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors uppercase"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmDeleteUser}
                                    disabled={isDeleting === userToDelete.id}
                                    className="px-6 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-full shadow-lg shadow-red-500/30 transition-all uppercase flex items-center gap-2"
                                >
                                    {isDeleting === userToDelete.id ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Excluindo...
                                        </>
                                    ) : 'Excluir'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
