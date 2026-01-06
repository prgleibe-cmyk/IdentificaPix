
import { GmailTransaction } from "./GmailService";

/**
 * Converte as transações estruturadas do Gmail em uma string CSV.
 * Isso permite injetar os dados no pipeline existente (StrategyEngine)
 * sem precisar modificar a lógica de upload ou reconciliação do AppContext.
 */
export const adaptGmailToCsv = (transactions: GmailTransaction[]): string => {
    if (transactions.length === 0) return "";

    // Cabeçalho padrão que o GenericStrategy sabe ler
    const header = "Data;Descrição;Valor;Tipo\n";
    
    const rows = transactions.map(t => {
        // Formatar data YYYY-MM-DD para DD/MM/YYYY (padrão BR esperado pelo parser genérico)
        const dateParts = t.date.split('-');
        const brDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : t.date;
        
        // Formatar valor para decimal com ponto (padrão genérico aceita)
        const amount = t.amount.toFixed(2);
        
        // Sanitizar descrição para evitar quebras de CSV
        const desc = t.description.replace(/;/g, ' ').trim();
        const type = (t.type || 'GMAIL_IMPORT').replace(/;/g, ' ');

        return `${brDate};${desc};${amount};${type}`;
    });

    return header + rows.join('\n');
};
