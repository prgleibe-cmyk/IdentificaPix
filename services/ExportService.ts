
import { MatchResult, Language } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

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
                const desc = (r.contributor?.cleanedName || r.transaction.description).replace(/;/g, ' ');
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
            const name = r.contributor?.cleanedName || r.contributor?.name || r.transaction.cleanedDescription || r.transaction.description;
            const amountVal = isGhost ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount;
            const isNegative = amountVal < 0;
            const amount = formatCurrency(amountVal, language);
            const type = r.contributor?.contributionType || r.transaction.contributionType || '---';
            const status = r.status === 'IDENTIFICADO' ? (r.matchMethod || 'AUTO') : r.status;
            const churchName = r.church?.name || '-';

            return `
                <tr>
                    <td>${date}</td>
                    <td>${name}</td>
                    <td style="font-size: 9px;">${churchName}</td>
                    <td style="text-align: center;">${type}</td>
                    <td style="text-align: center;">${status}</td>
                    <td style="text-align: right; font-weight: bold; font-family: monospace; ${isNegative ? 'color: #dc2626;' : ''}">${amount}</td>
                </tr>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title} - IdentificaPix</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; }
                        h1 { font-size: 20px; margin-bottom: 5px; text-transform: uppercase; }
                        p { margin: 0 0 20px 0; color: #64748b; font-size: 12px; }
                        .summary { display: flex; gap: 20px; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
                        .summary-item { display: flex; flex-direction: column; }
                        .summary-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; }
                        .summary-value { font-size: 14px; font-weight: bold; color: #0f172a; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th { text-align: left; background: #f1f5f9; padding: 8px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 10px; color: #475569; }
                        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
                        tr:nth-child(even) { background: #f8fafc; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <p>Gerado em: ${new Date().toLocaleString()}</p>
                    <div class="summary">
                        <div class="summary-item">
                            <span class="summary-label">Quantidade</span>
                            <span class="summary-value">${summary.count}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total</span>
                            <span class="summary-value" style="${summary.total < 0 ? 'color: #dc2626;' : ''}">${formatCurrency(summary.total, language)}</span>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 12%">Data</th>
                                <th style="width: 35%">Nome / Descrição</th>
                                <th style="width: 20%">Igreja</th>
                                <th style="width: 10%; text-align: center;">Tipo</th>
                                <th style="width: 10%; text-align: center;">Status</th>
                                <th style="width: 13%; text-align: right;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <script>window.onload = function() { window.print(); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }
};
