import { useState, useEffect, useCallback } from 'react';
import { ChurchPixKeyPublic } from '../types/portal';

export function usePortalPix(churchId?: string, bankId?: string) {
    const [pixKeys, setPixKeys] = useState<ChurchPixKeyPublic[]>([]);
    const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPixKeys = useCallback(async () => {
        if (!churchId && !bankId) {
            setPixKeys([]);
            setSelectedKeyId(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const queryParam = bankId ? `bank_id=${encodeURIComponent(bankId)}` : `church_id=${encodeURIComponent(churchId!)}`;
            const response = await fetch(`/api/v1/church-pix-keys/public?${queryParam}`, {
                cache: 'no-store'
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.message || `Falha ao carregar informações de Pix (${response.status})`);
            }

            const data: ChurchPixKeyPublic[] = await response.json();
            setPixKeys(data);

            if (data.length > 0) {
                // Default to first key if none or current selection invalid
                if (!selectedKeyId || !data.some(k => k.id === selectedKeyId)) {
                    setSelectedKeyId(data[0].id);
                }
            } else {
                setSelectedKeyId(null);
            }
        } catch (err: any) {
            console.error('[usePortalPix] Erro ao buscar chaves Pix:', err);
            setError(err.message || 'Erro ao carregar dados Pix.');
            setPixKeys([]);
            setSelectedKeyId(null);
        } finally {
            setLoading(false);
        }
    }, [churchId, bankId, selectedKeyId]);

    useEffect(() => {
        fetchPixKeys();
    }, [churchId, bankId]);

    const selectedKey = pixKeys.find(k => k.id === selectedKeyId) || (pixKeys.length > 0 ? pixKeys[0] : null);

    return {
        pixKeys,
        selectedKey,
        selectedKeyId,
        setSelectedKeyId,
        loading,
        error,
        refetch: fetchPixKeys
    };
}
