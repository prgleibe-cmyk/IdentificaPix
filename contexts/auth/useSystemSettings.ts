
import { useEffect, useRef, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { AdminConfigService } from '../../services/AdminConfigService';
import { SystemSettings, DEFAULT_SETTINGS } from './AuthContracts';

export const useSystemSettings = () => {
    const [systemSettings, setSystemSettings] = usePersistentState<SystemSettings>(
        'identificapix-settings-v6', 
        DEFAULT_SETTINGS
    );
    const settingsRef = useRef(systemSettings);

    useEffect(() => {
        settingsRef.current = systemSettings;
    }, [systemSettings]);

    useEffect(() => {
        const syncRemoteSettings = async () => {
            try {
                const remoteSettings = await AdminConfigService.get<SystemSettings>('system_settings');
                if (remoteSettings) {
                    setSystemSettings(prev => ({
                        ...DEFAULT_SETTINGS,
                        ...remoteSettings
                    }));
                } else {
                    setSystemSettings(prev => ({
                        ...DEFAULT_SETTINGS,
                        ...prev
                    }));
                }
            } catch (e) {
                console.error("Failed to sync system settings", e);
            }
        };
        syncRemoteSettings();
    }, [setSystemSettings]);

    const updateSystemSettings = useCallback(async (newSettings: Partial<SystemSettings>) => {
        const currentSettings = settingsRef.current;
        const updated = { ...currentSettings, ...newSettings };
        setSystemSettings(updated);
        try {
            await AdminConfigService.set('system_settings', updated);
        } catch (err) {
            console.error("Falha Crítica: Configuração não persistida no DB", err);
        }
    }, [setSystemSettings]);

    return { systemSettings, updateSystemSettings, settingsRef };
};
