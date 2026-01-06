
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
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#EA4335] hover:bg-[#D93025] text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-[10px] font-bold uppercase tracking-wide group"
            >
                <EnvelopeIcon className="w-3.5 h-3.5 text-white" />
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
