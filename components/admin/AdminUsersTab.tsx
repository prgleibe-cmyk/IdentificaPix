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
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 overflow-hidden animate-fade-in relative h-full flex flex-col">
            <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('admin.users.title')} (<span className="tabular-nums">{usersList.length}</span>)
                </h3>
                <div className="relative">
                    <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder={t('admin.users.searchPlaceholder')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none w-full md:w-64 font-medium transition-all"
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
                    potentialOwners={usersList.filter(u => u.role === 'owner' || !u.role)}
                />
            )}

            {userToDelete && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-elevated w-full max-w-md border border-slate-200/90 dark:border-slate-800 overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Confirmar Exclusão</h3>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                                Tem certeza que deseja excluir o usuário <span className="font-semibold text-rose-600 dark:text-rose-400">{userToDelete.email}</span>? 
                                Esta ação não pode ser desfeita e removerá permanentemente o perfil do usuário.
                            </p>
                            <div className="flex justify-end gap-2.5">
                                <button 
                                    onClick={() => setUserToDelete(null)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmDeleteUser}
                                    disabled={isDeleting === userToDelete.id}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60"
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
