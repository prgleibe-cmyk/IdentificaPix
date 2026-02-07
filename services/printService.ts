
import { SpreadsheetData } from "../types";
import { formatCurrency } from "../utils/formatters";

/**
 * Serviço de impressão centralizado.
 * Gera uma janela de impressão limpa e formatada para a planilha com cores preservadas.
 */
export const printService = {
    printSpreadsheet: (data: SpreadsheetData) => {
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
            alert("O bloqueador de popups impediu a impressão. Por favor, permita popups para este site.");
            return;
        }

        const logoHtml = data.logo 
            ? `<img src="${data.logo}" style="max-height: 80px; max-width: 200px; object-fit: contain;" alt="Logo" />` 
            : '<div></div>';

        // Generate Table Header
        const headers = data.columns
            .filter(c => c.visible)
            .map(col => {
                const align = (col.type === 'currency' || col.type === 'computed' || col.type === 'number') ? 'right' : 'left';
                const width = col.id === 'index' ? 'width: 50px;' : '';
                return `<th style="text-align: ${align}; ${width}">${col.label}</th>`;
            })
            .join('');

        // Generate Table Rows with Color Persistence
        const rowsHtml = data.rows.map((row, idx) => {
            const cells = data.columns
                .filter(c => c.visible)
                .map(col => {
                    let value = row[col.id];
                    let cellStyle = "";
                    
                    if (col.id === 'index') value = idx + 1;
                    
                    // Formatting & Coloring
                    if (col.type === 'currency' || col.type === 'computed') {
                        const numValue = Number(value) || 0;
                        value = formatCurrency(numValue);
                        
                        // Cores específicas para as colunas financeiras
                        if (col.id === 'income') cellStyle = "color: #059669; font-weight: 800;"; // Emerald 600
                        else if (col.id === 'expense') cellStyle = "color: #dc2626; font-weight: 800;"; // Red 600
                        else if (col.id === 'balance') cellStyle = `color: ${numValue < 0 ? '#dc2626' : '#0f172a'}; font-weight: 900;`;
                    }
                    
                    const align = (col.type === 'currency' || col.type === 'computed' || col.type === 'number') ? 'right' : 'left';
                    return `<td style="text-align: ${align}; ${cellStyle}">${value !== undefined && value !== null ? value : ''}</td>`;
                })
                .join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        // Calculate Totals for Footer
        const totals = data.columns
            .filter(c => c.visible)
            .map(col => {
                 if (col.id === 'description') return `<td style="font-weight:900; text-align:right; padding-right: 15px;">TOTAIS GERAIS:</td>`;
                 if (col.id === 'index') return `<td></td>`;
                 
                 if (col.type === 'currency' || col.type === 'computed') {
                     const sum = data.rows.reduce((acc, r) => acc + (Number(r[col.id]) || 0), 0);
                     let totalStyle = "text-align: right; font-weight: 900; font-size: 12px;";
                     
                     if (col.id === 'income') totalStyle += " color: #059669;";
                     else if (col.id === 'expense') totalStyle += " color: #dc2626;";
                     else if (col.id === 'balance') totalStyle += ` color: ${sum < 0 ? '#dc2626' : '#0f172a'};`;

                     return `<td style="${totalStyle}">${formatCurrency(sum)}</td>`;
                 }
                 
                 if (col.id === 'qty') {
                     const sum = data.rows.reduce((acc, r) => acc + (Number(r[col.id]) || 0), 0);
                     return `<td style="text-align: right; font-weight: 900;">${sum}</td>`;
                 }
                 
                 return `<td></td>`;
            })
            .join('');

        // Signatures
        const signaturesHtml = data.signatures && data.signatures.length > 0 
            ? data.signatures.map(sig => `
                <div style="flex: 1; min-width: 200px; max-width: 300px; text-align: center;">
                    <div style="border-top: 1px solid #334155; margin-bottom: 8px; width: 100%;"></div>
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; white-space: pre-line; line-height: 1.4;">${sig}</div>
                </div>
              `).join('')
            : '';

        const html = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>${data.title}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                    
                    body { 
                        font-family: 'Inter', sans-serif; 
                        padding: 40px; 
                        color: #0f172a; 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                    }
                    
                    .header { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-start; 
                        margin-bottom: 40px; 
                        border-bottom: 3px solid #0f172a; 
                        padding-bottom: 20px; 
                    }
                    
                    .report-info h1 { 
                        margin: 0; 
                        font-size: 28px; 
                        font-weight: 900; 
                        text-transform: uppercase; 
                        letter-spacing: -0.5px; 
                        color: #0f172a;
                    }
                    
                    .report-info p {
                        margin: 5px 0 0;
                        font-size: 12px;
                        font-weight: 600;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }

                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-bottom: 40px; 
                    }
                    
                    th { 
                        background-color: #f1f5f9 !important; 
                        color: #475569; 
                        font-size: 10px; 
                        font-weight: 900; 
                        text-transform: uppercase; 
                        letter-spacing: 0.5px; 
                        padding: 12px 10px; 
                        border-bottom: 2px solid #cbd5e1; 
                    }
                    
                    td { 
                        padding: 10px; 
                        border-bottom: 1px solid #e2e8f0; 
                        font-size: 11px; 
                        font-weight: 500; 
                        color: #334155;
                    }
                    
                    tr:nth-child(even) { background-color: #f8fafc !important; }
                    
                    tfoot tr { 
                        background-color: #f1f5f9 !important; 
                        border-top: 2px solid #94a3b8; 
                    }
                    
                    .signatures { 
                        display: flex; 
                        justify-content: space-around; 
                        flex-wrap: wrap; 
                        gap: 40px; 
                        margin-top: 80px; 
                        page-break-inside: avoid; 
                    }
                    
                    .footer {
                        margin-top: 40px;
                        padding-top: 10px;
                        border-top: 1px solid #e2e8f0;
                        font-size: 9px;
                        color: #94a3b8;
                        text-align: right;
                        display: flex;
                        justify-content: space-between;
                    }

                    @media print {
                        body { padding: 0; }
                        @page { margin: 1.5cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="report-info">
                        <h1>${data.title}</h1>
                        <p>Relatório Analítico Gerencial</p>
                    </div>
                    ${logoHtml}
                </div>

                <table>
                    <thead><tr>${headers}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot>
                        <tr>${totals}</tr>
                    </tfoot>
                </table>

                <div class="signatures">
                    ${signaturesHtml}
                </div>

                <div class="footer">
                    <span>IdentificaPix Intelligence System</span>
                    <span>Impressão: ${new Date().toLocaleString('pt-BR')}</span>
                </div>

                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                        }, 600);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    }
};
