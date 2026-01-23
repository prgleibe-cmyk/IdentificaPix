import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useUI } from '../../contexts/UIContext';

export const useAdminUsers = () => {
    const { showToast } = useUI();
    const [usersList, setUsersList] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Edit State
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [formData, setFormData] = useState({
        subscription_status: 'trial',
        limit_ai: 100,
        usage_ai: 0,
        max_churches: 2,
        custom_price: '',
        is_blocked: false,
        trial_ends_at: '',
        subscription_ends_at: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const fetchUsers = useCallback(async () => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setUsersList(data || []);
        } catch (error: any) {
            console.error("Erro ao buscar usuários:", error);
            showToast("Erro ao carregar usuários: " + error.message, "error");
        } finally {
            setIsLoadingData(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleEditClick = useCallback((user: any) => {
        setEditingUser(user);
        const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

        setFormData({
            subscription_status: user.subscription_status || 'trial',
            limit_ai: user.limit_ai || 100,
            usage_ai: user.usage_ai || 0,
            max_churches: user.max_churches || 1,
            custom_price: user.custom_price || '',
            is_blocked: user.is_blocked || false,
            trial_ends_at: formatDate(user.trial_ends_at),
            subscription_ends_at: formatDate(user.subscription_ends_at)
        });
    }, []);

    // Fix: Added React to imports and typed event as React.FormEvent
    const handleSaveUser = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsSaving(true);

        try {
            const updates: any = {
                subscription_status: formData.subscription_status,
                limit_ai: parseInt(String(formData.limit_ai)),
                usage_ai: parseInt(String(formData.usage_ai)),
                max_churches: parseInt(String(formData.max_churches)),
                max_banks: parseInt(String(formData.max_churches)),
                custom_price: formData.custom_price ? parseFloat(String(formData.custom_price)) : null,
                is_blocked: formData.is_blocked,
                is_lifetime: formData.subscription_status === 'lifetime'
            };

            if (formData.trial_ends_at) updates.trial_ends_at = new Date(formData.trial_ends_at).toISOString();
            if (formData.subscription_ends_at) updates.subscription_ends_at = new Date(formData.subscription_ends_at).toISOString();

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', editingUser.id);

            if (error) throw error;

            showToast("Usuário atualizado com sucesso!", "success");
            setEditingUser(null);
            fetchUsers(); 
        } catch (error: any) {
            console.error("Erro ao atualizar:", error);
            showToast("Erro ao salvar: " + error.message, "error");
        } finally {
            setIsSaving(false);
        }
    }, [editingUser, formData, fetchUsers, showToast]);

    const filteredUsers = useMemo(() => {
        return usersList.filter(u => 
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (u.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [usersList, searchTerm]);

    return {
        usersList: filteredUsers,
        isLoadingData,
        searchTerm,
        setSearchTerm,
        editingUser,
        setEditingUser,
        formData,
        setFormData,
        isSaving,
        handleEditClick,
        handleSaveUser,
        fetchUsers
    };
};