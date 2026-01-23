
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
                className="relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-[#FF5252] via-[#EA4335] to-[#D93025] hover:from-[#FF6E6E] hover:to-[#E63946] transition-all shadow-lg shadow-red-500/30 hover:-translate-y-0.5 active:scale-95 group border border-white/20"
            >
                <EnvelopeIcon className="w-3.5 h-3.5 stroke-[2]" />
                <span className="hidden sm:inline">Importar do Gmail</span>
                <span className="sm:hidden">Gmail</span>
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
