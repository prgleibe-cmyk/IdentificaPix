
import { MatchResult, Language } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { NameResolver } from '../core/processors/NameResolver';

export const ExportService = {
    /**
     * Gera e dispara o download de um arquivo CSV a partir dos resultados da conciliação.
     */
    downloadCsv: (data: MatchResult[], filename: string = 'relatorio_conciliacao.csv') => {
        const headers = ["Data", "Descrição", "Tipo", "Status", "Valor", "Igreja"];
        const csvContent = [
            headers.join(";"),
            ...data.map(r => {
                const isGhost = r.status === 'PENDENTE';
                const date = formatDate(isGhost ? (r.contributor?.date || r.transaction.date) : r.transaction.date);
                
                // FIDELIDADE TOTAL: Usa o valor original entregue pelo modelo
                const rawName = r.contributor?.cleanedName || r.contributor?.name || r.transaction.cleanedDescription || r.transaction.description;
                const desc = String(rawName).replace(/;/g, ' ').toUpperCase();
                
                const type = (r.contributor?.contributionType || r.transaction.contributionType || "").replace(/;/g, ' ');
                const status = r.status === 'IDENTIFICADO' ? (r.matchMethod || 'AUTO') : r.status;
                const church = (r.church?.name || '---').replace(/;/g, ' ');
                const rawAmount = isGhost ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount;
                const amount = Number(rawAmount).toFixed(2).replace('.', ',');
                
                return [`"${date}"`, `"${desc}"`, `"${type}"`, `"${status}"`, `"${amount}"`, `"${church}"`].join(";");
            })
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Gera um HTML formatado para impressão baseado nos dados atuais da tabela.
     */
    printHtml: (data: MatchResult[], title: string, summary: any, language: Language) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const tableRows = data.map(r => {
            const isGhost = r.status === 'PENDENTE';
            const date = formatDate(isGhost ? (r.contributor?.date || r.transaction.date) : r.transaction.date);
            
            // FIDELIDADE TOTAL: Usa o valor original entregue pelo modelo
            const rawName = r.contributor?.cleanedName || r.contributor?.name || r.transaction.cleanedDescription || r.transaction.description;
            const name = String(rawName).toUpperCase();

            const amountVal = isGhost ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount;
            const isNegative = amountVal < 0;
            const amount = formatCurrency(amountVal, language);
            const type = r.contributor?.contributionType || r.transaction.contributionType || '---';
            
            // Cores baseadas no Status
            let statusLabel = r.status as string;
            let statusColor = '#64748b'; // Slate 500 (Padrão)

            if (r.status === 'IDENTIFICADO') {
                statusLabel = r.matchMethod || 'AUTO';
                statusColor = '#059669'; // Emerald 600
            } else if (r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE') {
                statusLabel = 'PENDENTE';
                statusColor = '#d97706'; // Amber 600
            }

            const churchName = r.church?.name || '-';

            return `
                <tr>
                    <td>${date}</td>
                    <td style="font-weight: 600;">${name}</td>
                    <td style="font-size: 9px; color: #475569;">${churchName}</td>
                    <td style="text-align: center; font-size: 9px; font-weight: bold;">${type}</td>
                    <td style="text-align: center; font-weight: 800; color: ${statusColor}; font-size: 9px;">${statusLabel}</td>
                    <td style="text-align: right; font-weight: 900; font-family: monospace; color: ${isNegative ? '#dc2626' : '#059669'};">${amount}</td>
                </tr>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title} - IdentificaPix</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                        
                        body { 
                            font-family: 'Inter', sans-serif; 
                            padding: 20px; 
                            color: #1e293b;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        
                        h1 { font-size: 20px; margin-bottom: 5px; text-transform: uppercase; font-weight: 900; }
                        p { margin: 0 0 20px 0; color: #64748b; font-size: 12px; font-weight: 600; }
                        
                        .summary { 
                            display: flex; 
                            gap: 20px; 
                            margin-bottom: 20px; 
                            padding: 15px; 
                            background: #f1f5f9 !important; 
                            border-radius: 12px; 
                            border: 1px solid #e2e8f0; 
                        }
                        
                        .summary-item { display: flex; flex-direction: column; }
                        .summary-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
                        .summary-value { font-size: 16px; font-weight: 900; color: #0f172a; }
                        
                        table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
                        th { 
                            text-align: left; 
                            background: #f8fafc !important; 
                            padding: 10px 8px; 
                            border-bottom: 2px solid #0f172a; 
                            text-transform: uppercase; 
                            font-size: 9px; 
                            font-weight: 900;
                            color: #475569; 
                        }
                        
                        td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; word-break: break-word; vertical-align: middle; }
                        tr:nth-child(even) { background: #f8fafc !important; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                    <div class="summary">
                        <div class="summary-item">
                            <span class="summary-label">Registros</span>
                            <span class="summary-value">${summary.count}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Montante Total</span>
                            <span class="summary-value" style="color: ${summary.total < 0 ? '#dc2626' : '#059669'};">${formatCurrency(summary.total, language)}</span>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 12%">Data</th>
                                <th style="width: 35%">Descrição do Lançamento</th>
                                <th style="width: 20%">Igreja / Unidade</th>
                                <th style="width: 10%; text-align: center;">Tipo</th>
                                <th style="width: 10%; text-align: center;">Status</th>
                                <th style="width: 13%; text-align: right;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }
};
