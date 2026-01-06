
import React, { useState, useEffect, useContext } from 'react';
import { EnvelopeIcon } from '../../components/Icons';
import { GmailModal } from './GmailModal';
import { AppContext } from '../../contexts/AppContext';

export const GmailButton: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { handleStatementUpload } = useContext(AppContext);

    // EFEITO DE RECUPERAÇÃO DE SESSÃO
    // Verifica se voltamos de um redirecionamento OAuth do Gmail
    useEffect(() => {
        const isPending = localStorage.getItem('identificapix_gmail_pending');
        if (isPending === 'true') {
            setIsOpen(true);
        }
    }, []);

    const handleSuccess = (csvContent: string) => {
        // INJEÇÃO SEGURA: O CSV já vem formatado do backend.
        // Criamos um File object virtual para simular um upload de arquivo local.
        const virtualFile = new File([csvContent], "gmail_import.csv", { type: "text/csv" });
        
        handleStatementUpload(
            csvContent, 
            `Gmail Import - ${new Date().toLocaleDateString()}`, 
            'gmail-virtual-bank', 
            virtualFile
        );
        
        // Limpa a flag de pendência após sucesso
        localStorage.removeItem('identificapix_gmail_pending');
    };

    const handleClose = () => {
        setIsOpen(false);
        // Garante que a flag seja limpa se o usuário fechar o modal manualmente
        localStorage.removeItem('identificapix_gmail_pending');
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 transition-colors border border-red-100 dark:border-red-800/50 text-[10px] font-bold uppercase tracking-wide shadow-sm"
            >
                <EnvelopeIcon className="w-3 h-3" />
                <span>Importar do Gmail</span>
            </button>

            {isOpen && (
                <GmailModal 
                    onClose={handleClose} 
                    onSuccess={handleSuccess} 
                />
            )}
        </>
    );
};
