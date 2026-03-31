import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { processFileContent } from '../services/processingService';
import { LaunchService } from '../services/LaunchService';

interface UseSmartBankCardProps {
    bank: any;
}

export const useSmartBankCard = ({ bank }: UseSmartBankCardProps) => {
    const { 
        activeBankFiles,
        handleStatementUpload, 
        fileModels,
        effectiveIgnoreKeywords,
        persistTransactions,
        hydrate,
        setModelRequiredData 
    } = useContext(AppContext);
    
    const { user } = useAuth();
    const { showToast } = useUI();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    const dragStartRef = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    const uploaderRef = useRef<any>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const uploadModeRef = useRef<'replace' | 'append'>('replace');

    const bankFiles = activeBankFiles.filter((f: any) => f.bankId === bank.id);
    const totalTransactions = bankFiles.reduce((acc: number, f: any) => acc + (f.processedTransactions?.length || 0), 0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (menuRef.current) {
            setIsDragging(true);
            const rect = menuRef.current.getBoundingClientRect();
            dragStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setMenuPos({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
            }
        };
        const handleMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleAppend = async (content: string, fileName: string, rawFile: File, base64?: string) => {
        if (!user) return;
        setIsUploading(true);
        try {
            const result = await processFileContent(content, fileName, fileModels, effectiveIgnoreKeywords, base64);
            
            if (result.status === 'MODEL_REQUIRED') {
                if (setModelRequiredData) {
                    setModelRequiredData({ ...result, fileName, bankId: bank.id });
                }
                setIsUploading(false);
                return;
            }

            const newTransactions = result.transactions;

            if (!newTransactions || newTransactions.length === 0) {
                showToast("Nenhuma transação encontrada no arquivo.", "error");
                setIsUploading(false);
                return;
            }

            // 🛡️ FUNIL CENTRAL: Delega para o persistTransactions do hook de sincronização
            const launchResult = await persistTransactions(bank.id, newTransactions);

            if (launchResult.added > 0) {
                showToast(`${launchResult.added} transações adicionadas!`, "success");
            } else {
                showToast("Registros já existentes ignorados.", "success");
            }
        } catch (e: any) {
            showToast("Erro ao adicionar: " + e.message, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUploadWrapper = async (content: string, fileName: string, rawFile: File, base64?: string) => {
        setIsUploading(true);
        try {
            if (uploadModeRef.current === 'replace') {
                await handleStatementUpload(content, fileName, bank.id, rawFile, base64);
            } else {
                await handleAppend(content, fileName, rawFile, base64);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsUploading(false);
            setIsMenuOpen(false);
        }
    };

    const triggerUpload = (mode: 'replace' | 'append') => {
        uploadModeRef.current = mode;
        uploaderRef.current?.open();
        setIsMenuOpen(false);
    };

    const removeSpecificFile = async (fileToRemove: any) => {
        if (!user) return;
        setIsUploading(true);
        setIsMenuOpen(false);
        
        try {
            // No modo blindado, qualquer remoção física exige re-sincronia do banco
            // 1. Identifica os arquivos que permanecerão
            const remainingFiles = bankFiles.filter((f: any) => f !== fileToRemove);
            
            // 2. Limpa todos os pendentes deste banco
            await LaunchService.clearBankLaunch(user.id, bank.id);
            
            // 3. Re-insere apenas os que sobraram (o launchToBank fará o dedupe novamente)
            if (remainingFiles.length > 0) {
                const allTxs = remainingFiles.flatMap((f: any) => f.processedTransactions || []);
                if (allTxs.length > 0) {
                    await LaunchService.launchToBank(user.id, bank.id, allTxs);
                }
            }

            // 4. Reidrata a UI a partir da única fonte de verdade
            await hydrate(false);
            
            showToast("Arquivo removido.", "success");
        } catch (e: any) {
            showToast("Erro ao remover arquivo.", "error");
        } finally {
            setIsUploading(false);
        }
    };

    return {
        isMenuOpen, setIsMenuOpen,
        isUploading, setIsUploading,
        menuPos, setMenuPos,
        isDragging,
        uploaderRef,
        menuRef,
        bankFiles,
        totalTransactions,
        handleMouseDown,
        handleFileUploadWrapper,
        triggerUpload,
        removeSpecificFile
    };
};