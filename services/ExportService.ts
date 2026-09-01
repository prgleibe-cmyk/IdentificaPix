
import { MatchResult, Language } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { NameResolver } from '../core/processors/NameResolver';
import { getResolvedDisplayName } from './utils/parsingUtils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helpers para cabeçalho com Logo/Igreja e rodapé com assinaturas do Pastor e Tesoureiro
const resolveChurch = (churchesOrChurch?: any, selectedChurchId?: string, data?: any[]): any => {
    if (!churchesOrChurch) return null;
    let churchesList: any[] = [];
    if (Array.isArray(churchesOrChurch)) {
        churchesList = churchesOrChurch;
    } else if (typeof churchesOrChurch === 'object') {
        return churchesOrChurch;
    }

    // 1. Se selectedChurchId for um ID de igreja específico (não-geral)
    if (selectedChurchId && selectedChurchId !== 'general' && selectedChurchId !== 'general_all' && selectedChurchId !== 'GERAL') {
        const found = churchesList.find((c: any) => c.id === selectedChurchId || c.name === selectedChurchId);
        if (found) return found;
    }

    // 2. Se temos transações/dados (data): verificar se pertencem a uma única igreja específica
    if (Array.isArray(data) && data.length > 0) {
        const detectedChurches: any[] = [];
        for (const item of data) {
            if (!item) continue;
            const ch = item.church || item.contributor?.church;
            const chId = item.churchId || item.church_id || (typeof ch === 'object' ? ch?.id : null) || item.contributor?.churchId || item.contributor?.church_id;
            const chName = typeof ch === 'string' ? ch : ch?.name || item.contributor?.churchName;

            if (chId) {
                const foundInList = churchesList.find((c: any) => c.id === chId);
                if (foundInList) {
                    detectedChurches.push(foundInList);
                    continue;
                }
            }
            if (chName && chName !== '---' && chName !== 'Igreja Geral' && chName !== 'GERAL') {
                const foundInList = churchesList.find((c: any) => (c.name || '').trim().toLowerCase() === chName.trim().toLowerCase());
                if (foundInList) {
                    detectedChurches.push(foundInList);
                    continue;
                }
                if (typeof ch === 'object' && ch?.name) {
                    detectedChurches.push(ch);
                    continue;
                }
            }
        }

        if (detectedChurches.length > 0) {
            const firstId = detectedChurches[0].id || detectedChurches[0].name;
            const allSame = detectedChurches.every((c: any) => (c.id || c.name) === firstId);
            if (allSame) {
                return detectedChurches[0];
            }
        }
    }

    // 3. Se for relatório geral com dados de múltiplas igrejas (ou sem dados): buscar Sede / Matriz
    if (churchesList.length > 0) {
        const sede = churchesList.find((c: any) => {
            if (!c) return false;
            const name = (c.name || '').toLowerCase();
            return (
                c.is_sede || 
                c.isSede || 
                c.is_matriz || 
                c.isMatriz || 
                c.type === 'sede' || 
                c.type === 'matriz' || 
                c.role === 'sede' ||
                name === 'sede' ||
                name.startsWith('sede ') ||
                name.includes('sede') || 
                name.includes('matriz') || 
                name.includes('principal') ||
                name.includes('central')
            );
        });
        if (sede) return sede;

        return churchesList[0] || null;
    }

    return null;
};

const drawChurchHeader = (doc: jsPDF, church: any, title: string, subtitle?: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header background bar
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 8, pageWidth - 20, 26, 'F');
    
    // Primary Orange top accent line
    doc.setFillColor(249, 115, 22);
    doc.rect(10, 8, pageWidth - 20, 2, 'F');

    let textStartX = 14;

    if (church?.logoUrl) {
        try {
            doc.addImage(church.logoUrl, 'PNG', 14, 11, 20, 20);
            textStartX = 38;
        } catch (e) {
            try {
                doc.addImage(church.logoUrl, 'JPEG', 14, 11, 20, 20);
                textStartX = 38;
            } catch (err) {
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(14, 11, 20, 20, 2, 2, 'F');
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(71, 85, 105);
                const initials = (church?.name || 'IP').substring(0, 2).toUpperCase();
                doc.text(initials, 24, 23, { align: 'center' });
                textStartX = 38;
            }
        }
    }

    const churchName = (church?.name || 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS').toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(churchName, textStartX, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    const cnpjStr = church?.cnpj ? `CNPJ: ${church.cnpj}` : '';
    const cityState = church?.city ? `${church.city}${church.state ? '/' + church.state : ''}` : '';
    const addrParts = [church?.address, cityState, church?.cep ? `CEP: ${church.cep}` : ''].filter(Boolean).join(' • ');
    const line2 = [cnpjStr, addrParts].filter(Boolean).join(' | ');
    if (line2) {
        doc.text(line2, textStartX, 19.5);
    }

    const contactParts = [church?.phone ? `Tel: ${church.phone}` : '', church?.email ? `E-mail: ${church.email}` : ''].filter(Boolean).join(' | ');
    const pastorStr = church?.pastor ? `Pastor: ${church.pastor}` : '';
    const treasurerStr = church?.treasurer ? `Tesoureiro: ${church.treasurer}` : '';
    const leaderParts = [pastorStr, treasurerStr].filter(Boolean).join(' • ');
    const line3 = [contactParts, leaderParts].filter(Boolean).join(' | ');

    if (line3) {
        doc.text(line3, textStartX, 24);
    } else {
        doc.text("Sistema IdentificaPix · Gestão Financeira e Conciliação", textStartX, 24);
    }

    // Right Side: Title & Timestamp
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(249, 115, 22);
    doc.text(title.toUpperCase(), pageWidth - 14, 15, { align: 'right' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100);
    const dateStr = `Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(dateStr, pageWidth - 14, 20, { align: 'right' });

    if (subtitle) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text(subtitle, pageWidth - 14, 24.5, { align: 'right' });
    }
};

const drawChurchFooterSignatures = (doc: jsPDF, church: any, startY: number): number => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let currentY = startY + 14;

    if (currentY + 38 > pageHeight - 12) {
        doc.addPage();
        currentY = 44;
    }

    const cityState = church?.city ? `${church.city}${church.state ? '/' + church.state : ''}` : 'Local';
    const dateFormatted = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const localDateText = `${cityState}, ${dateFormatted}`;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(localDateText, pageWidth / 2, currentY, { align: 'center' });

    currentY += 16;

    const colWidth = 72;
    const col1X = (pageWidth / 2) - colWidth - 10;
    const col2X = (pageWidth / 2) + 10;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(col1X, currentY, col1X + colWidth, currentY);
    doc.line(col2X, currentY, col2X + colWidth, currentY);

    currentY += 4;

    const pastorRaw = church?.pastor || 'Pastor Presidente';
    const pastorName = pastorRaw.toLowerCase().startsWith('pr') ? pastorRaw : `Pr. ${pastorRaw}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(pastorName.toUpperCase(), col1X + (colWidth / 2), currentY, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text("Pastor Presidente / Responsável", col1X + (colWidth / 2), currentY + 3.5, { align: 'center' });

    const treasurerName = church?.treasurer || 'Tesoureiro Geral';
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(treasurerName.toUpperCase(), col2X + (colWidth / 2), currentY, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text("Tesoureiro / Resp. Financeiro", col2X + (colWidth / 2), currentY + 3.5, { align: 'center' });

    return currentY + 12;
};

const applyHeadersAndPageNumbers = (doc: jsPDF, church: any, title: string, subtitle?: string) => {
    const totalPages = doc.getNumberOfPages();
    const pHeight = doc.internal.pageSize.getHeight();
    const pWidth = doc.internal.pageSize.getWidth();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawChurchHeader(doc, church, title, subtitle);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`IdentificaPix · Gestão Financeira`, 10, pHeight - 6);
        doc.text(`Página ${i} de ${totalPages}`, pWidth - 10, pHeight - 6, { align: 'right' });
    }
};

export const ExportService = {
    /**
     * Gera e dispara o download de um arquivo CSV a partir dos resultados da conciliação.
     */
    downloadCsv: (data: MatchResult[], filename: string = 'relatorio_conciliacao.csv') => {
        const headers = ["Data", "Nome / Lançamento", "Descrição", "Status", "Valor", "Igreja"];
        const csvContent = [
            headers.join(";"),
            ...data.flatMap(r => {
                const date = formatDate(r.transaction.date);
                
                // FIDELIDADE TOTAL: Usa o nome resolvido sem ruído numérico/valor
                const desc = getResolvedDisplayName(r).replace(/;/g, ' ').toUpperCase();
                
                const status = r.status === 'IDENTIFICADO' ? (r.matchMethod || 'AUTO') : r.status;
                const church = (r.church?.name || '---').replace(/;/g, ' ');

                if (r.splits && r.splits.length > 0) {
                    return r.splits.map(s => {
                        const splitDesc = s.description ? `${desc} - ${s.description.replace(/;/g, ' ').toUpperCase()}` : desc;
                        const splitType = s.contributionType.replace(/;/g, ' ');
                        const splitAmountVal = s.amount;
                        const splitAmount = Number(splitAmountVal).toFixed(2).replace('.', ',');
                        return [`"${date}"`, `"${splitDesc}"`, `"${splitType}"`, `"${status} (RATEADO)"`, `"${splitAmount}"`, `"${church}"`].join(";");
                    });
                } else {
                    const type = (r.contributor?.contributionType || r.transaction.contributionType || "").replace(/;/g, ' ');
                    const rawAmount = r.transaction.amount;
                    const amount = Number(rawAmount).toFixed(2).replace('.', ',');
                    return [`"${date}"`, `"${desc}"`, `"${type}"`, `"${status}"`, `"${amount}"`, `"${church}"`].join(";");
                }
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
    printHtml: (data: MatchResult[], title: string, summary: any, language: Language, churches?: any[], selectedChurchId?: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const church = resolveChurch(churches, selectedChurchId, data);

        const tableRows = data.flatMap(r => {
            const date = formatDate(r.transaction.date);
            
            // FIDELIDADE TOTAL: Usa o nome resolvido sem ruído numérico/valor
            const name = getResolvedDisplayName(r).toUpperCase();
            const churchName = r.church?.name || church?.name || '-';

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

            if (r.splits && r.splits.length > 0) {
                return r.splits.map(s => {
                    const splitName = s.description ? `${name} [${s.description.toUpperCase()}]` : name;
                    const isNegative = s.amount < 0;
                    const amount = formatCurrency(s.amount, language);
                    const type = s.contributionType;
                    return `
                        <tr>
                            <td>${date}</td>
                            <td style="font-weight: 600;">${splitName} <span style="font-size: 8px; font-weight: 800; color: #4f46e5; background: #e0e7ff; padding: 2px 5px; border-radius: 4px; margin-left: 5px;">RATEADO</span></td>
                            <td style="font-size: 9px; color: #475569;">${churchName}</td>
                            <td style="text-align: center; font-size: 9px; font-weight: bold;">${type}</td>
                            <td style="text-align: center; font-weight: 800; color: ${statusColor}; font-size: 9px;">${statusLabel}</td>
                            <td style="text-align: right; font-weight: 900; font-family: monospace; color: ${isNegative ? '#dc2626' : '#059669'};">${amount}</td>
                        </tr>
                    `;
                });
            } else {
                const amountVal = r.transaction.amount;
                const isNegative = amountVal < 0;
                const amount = formatCurrency(amountVal, language);
                const type = r.contributor?.contributionType || r.transaction.contributionType || '---';

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
            }
        }).join('');

        const pastorRaw = church?.pastor || 'Pastor Presidente';
        const pastorName = pastorRaw.toLowerCase().startsWith('pr') ? pastorRaw : `Pr. ${pastorRaw}`;
        const treasurerName = church?.treasurer || 'Tesoureiro Geral';

        const cityState = church?.city ? `${church.city}${church.state ? '/' + church.state : ''}` : 'Local';
        const dateFormatted = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title} - IdentificaPix</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
                        
                        body { 
                            font-family: 'Inter', sans-serif; 
                            padding: 20px; 
                            color: #1e293b;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        
                        .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 20px; }
                        .church-info-box { display: flex; align-items: center; gap: 14px; }
                        .church-logo { max-height: 55px; max-width: 90px; object-fit: contain; border-radius: 6px; border: 1px solid #e2e8f0; padding: 4px; background: #fff; }
                        .church-title { font-size: 15px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -0.01em; }
                        .church-sub { margin: 3px 0 0 0; font-size: 10px; color: #64748b; font-weight: 600; }
                        .church-leader { margin: 3px 0 0 0; font-size: 10px; color: #f97316; font-weight: 700; text-transform: uppercase; }
                        .report-title-box { text-align: right; }
                        .report-title { font-size: 16px; margin: 0; color: #f97316; text-transform: uppercase; font-weight: 900; }
                        .report-date { font-size: 10px; color: #64748b; font-weight: 600; }

                        .summary { 
                            display: flex; 
                            gap: 20px; 
                            margin-bottom: 20px; 
                            padding: 12px 16px; 
                            background: #f8fafc !important; 
                            border-radius: 10px; 
                            border: 1px solid #e2e8f0; 
                        }
                        
                        .summary-item { display: flex; flex-direction: column; }
                        .summary-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
                        .summary-value { font-size: 15px; font-weight: 900; color: #0f172a; }
                        
                        table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
                        th { 
                            text-align: left; 
                            background: #f8fafc !important; 
                            padding: 8px; 
                            border-bottom: 2px solid #0f172a; 
                            text-transform: uppercase; 
                            font-size: 8.5px; 
                            font-weight: 900;
                            color: #475569; 
                        }
                        
                        td { padding: 8px; border-bottom: 1px solid #e2e8f0; word-break: break-word; vertical-align: middle; }
                        tr:nth-child(even) { background: #f8fafc !important; }

                        .footer-signatures { margin-top: 50px; page-break-inside: avoid; }
                        .sig-container { display: flex; justify-content: space-around; text-align: center; margin-top: 30px; }
                        .sig-block { width: 240px; }
                        .sig-line { border-bottom: 1px solid #64748b; margin-bottom: 6px; }
                        .sig-name { display: block; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
                        .sig-role { font-size: 9px; color: #64748b; font-weight: 600; }
                    </style>
                </head>
                <body>
                    <div class="header-container">
                        <div class="church-info-box">
                            ${church?.logoUrl ? `<img src="${church.logoUrl}" class="church-logo" alt="Logo" />` : ''}
                            <div>
                                <h2 class="church-title">${church?.name || 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS'}</h2>
                                <p class="church-sub">
                                    ${[church?.cnpj ? `CNPJ: ${church.cnpj}` : '', church?.address, church?.city ? `${church.city}${church.state ? '/' + church.state : ''}` : ''].filter(Boolean).join(' • ')}
                                </p>
                                ${church?.pastor ? `<p class="church-leader">Pastor: ${church.pastor} ${church?.treasurer ? `| Tesoureiro: ${church.treasurer}` : ''}</p>` : ''}
                            </div>
                        </div>
                        <div class="report-title-box">
                            <h1 class="report-title">${title}</h1>
                            <span class="report-date">Gerado em: ${new Date().toLocaleString('pt-BR')}</span>
                        </div>
                    </div>

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
                                <th style="width: 10%; text-align: center;">Descrição</th>
                                <th style="width: 10%; text-align: center;">Status</th>
                                <th style="width: 13%; text-align: right;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>

                    <div class="footer-signatures">
                        <p style="text-align: center; font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 25px;">
                            ${cityState}, ${dateFormatted}
                        </p>
                        <div class="sig-container">
                            <div class="sig-block">
                                <div class="sig-line"></div>
                                <span class="sig-name">${pastorName}</span>
                                <span class="sig-role">Pastor Presidente / Responsável</span>
                            </div>
                            <div class="sig-block">
                                <div class="sig-line"></div>
                                <span class="sig-name">${treasurerName}</span>
                                <span class="sig-role">Tesoureiro / Resp. Financeiro</span>
                            </div>
                        </div>
                    </div>

                    <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    },

    /**
     * Gera e dispara o download de um arquivo Excel (.xlsx) a partir dos resultados da conciliação.
     */
    downloadExcel: (data: MatchResult[], filename: string = 'relatorio_conciliacao.xlsx') => {
        const rows = data.flatMap(r => {
            const date = formatDate(r.transaction.date);
            
            const desc = getResolvedDisplayName(r).toUpperCase();
            
            const status = r.status === 'IDENTIFICADO' ? (r.matchMethod || 'AUTO') : r.status;
            const church = r.church?.name || '---';

            if (r.splits && r.splits.length > 0) {
                return r.splits.map(s => {
                    const splitDesc = s.description ? `${desc} - ${s.description.toUpperCase()}` : desc;
                    const splitType = s.contributionType;
                    const splitAmount = Number(s.amount);
                    return {
                        "Data": date,
                        "Descrição do Lançamento": splitDesc,
                        "Descrição": `${splitType} (RATEADO)`,
                        "Status": status,
                        "Valor": splitAmount,
                        "Igreja / Unidade": church
                    };
                });
            } else {
                const type = r.contributor?.contributionType || r.transaction.contributionType || "---";
                const rawAmount = r.transaction.amount;
                const amount = Number(rawAmount);
                return {
                    "Data": date,
                    "Descrição do Lançamento": desc,
                    "Descrição": type,
                    "Status": status,
                    "Valor": amount,
                    "Igreja / Unidade": church
                };
            }
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Conciliação");
        XLSX.writeFile(wb, filename);
    },

    /**
     * Gera e dispara o download de um arquivo OFX (.ofx) compatível com sistemas contábeis e ERPs bancários.
     */
    downloadOfx: (data: MatchResult[], filename: string = 'relatorio_conciliacao.ofx') => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);

        let dtStart = '99999999';
        let dtEnd = '00000000';

        const transactionsOfx = data.flatMap((r, index) => {
            const rawDateStr = r.transaction.date;
            
            let formattedDate = timestamp.slice(0, 8);
            if (rawDateStr) {
                const cleanDate = String(rawDateStr).split('T')[0].replace(/-/g, '');
                if (cleanDate.length === 8) {
                    formattedDate = cleanDate;
                }
            }

            if (formattedDate < dtStart) dtStart = formattedDate;
            if (formattedDate > dtEnd) dtEnd = formattedDate;

            const desc = String(getResolvedDisplayName(r) || 'LANCAMENTO').replace(/[<>&]/g, '').toUpperCase();
            const church = String(r.church?.name || '').replace(/[<>&]/g, '').toUpperCase();
            const fitId = r.transaction?.id || `TRN-${formattedDate}-${index + 1}`;
            const status = r.status === 'IDENTIFICADO' ? (r.matchMethod || 'AUTO') : r.status;

            if (r.splits && r.splits.length > 0) {
                return r.splits.map((s, sIdx) => {
                    const splitDesc = s.description ? `${desc} - ${String(s.description).replace(/[<>&]/g, '').toUpperCase()}` : desc;
                    const splitAmount = Number(s.amount);
                    const trnType = splitAmount < 0 ? 'DEBIT' : 'CREDIT';
                    const memo = [splitDesc, church, s.contributionType, status].filter(Boolean).join(' | ');

                    return `<STMTTRN>
<TRNTYPE>${trnType}</TRNTYPE>
<DTPOSTED>${formattedDate}120000</DTPOSTED>
<TRNAMT>${splitAmount.toFixed(2)}</TRNAMT>
<FITID>${fitId}-S${sIdx + 1}</FITID>
<MEMO>${memo}</MEMO>
</STMTTRN>`;
                });
            } else {
                const rawAmount = r.transaction.amount;
                const amount = Number(rawAmount);
                const trnType = amount < 0 ? 'DEBIT' : 'CREDIT';
                const type = r.contributor?.contributionType || r.transaction.contributionType || '';
                const memo = [desc, church, type, status].filter(Boolean).join(' | ');

                return [`<STMTTRN>
<TRNTYPE>${trnType}</TRNTYPE>
<DTPOSTED>${formattedDate}120000</DTPOSTED>
<TRNAMT>${amount.toFixed(2)}</TRNAMT>
<FITID>${fitId}</FITID>
<MEMO>${memo}</MEMO>
</STMTTRN>`];
            }
        }).join('\n');

        if (dtStart === '99999999') dtStart = timestamp.slice(0, 8);
        if (dtEnd === '00000000') dtEnd = timestamp.slice(0, 8);

        const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<DTSERVER>${timestamp}</DTSERVER>
<LANGUAGE>POR</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${timestamp}</TRNUID>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>0000</BANKID>
<ACCTID>IDENTIFICAPIX</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${dtStart}000000</DTSTART>
<DTEND>${dtEnd}235959</DTEND>
${transactionsOfx}
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

        const blob = new Blob([ofxContent], { type: 'application/x-ofx;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Gera e dispara o download de um arquivo PDF (.pdf) formatado com jspdf e jspdf-autotable.
     */
    downloadPdf: (data: MatchResult[], title: string, filename: string = 'relatorio_conciliacao.pdf', churches?: any[], selectedChurchId?: string) => {
        const doc = new jsPDF();
        const targetChurch = resolveChurch(churches, selectedChurchId, data);
        
        let totalAmount = 0;
        data.forEach((r: MatchResult) => {
            const isGhost = r.status === 'PENDENTE';
            if (r.splits && r.splits.length > 0) {
                r.splits.forEach(s => {
                    totalAmount += Number(s.amount || 0);
                });
            } else {
                const rawAmount = isGhost ? (r.contributorAmount || r.contributor?.amount || 0) : (r.transaction?.amount || 0);
                totalAmount += Number(rawAmount || 0);
            }
        });

        const totalFormatted = Number(totalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const subtitle = `Total de Lançamentos: ${data.length} | Montante Total: ${totalFormatted}`;
        
        // Desenha o box de resumo no topo da primeira página
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFillColor(248, 250, 252); // Slate 50
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.roundedRect(10, 36, pageWidth - 20, 11, 2, 2, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text("REGISTROS", 14, 40.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Slate 900
        doc.text(`${data.length}`, 14, 44.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("MONTANTE TOTAL", 65, 40.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(totalAmount < 0 ? 220 : 5, totalAmount < 0 ? 38 : 150, totalAmount < 0 ? 38 : 105);
        doc.text(totalFormatted, 65, 44.5);

        const headers = [["Data", "Descrição do Lançamento", "Igreja / Unidade", "Descrição", "Status", "Valor"]];
        
        const rows: any[] = data.flatMap((r: MatchResult) => {
            const isGhost = r.status === 'PENDENTE';
            const date = formatDate(isGhost ? (r.contributor?.date || r.transaction.date) : r.transaction.date);
            
            const rawName = r.contributor?.cleanedName || r.contributor?.name || r.transaction.cleanedDescription || r.transaction.description;
            const desc = String(rawName).toUpperCase();
            
            const status = r.status === 'IDENTIFICADO' ? (r.matchMethod || 'AUTO') : r.status;
            const church = r.church?.name || targetChurch?.name || '---';

            if (r.splits && r.splits.length > 0) {
                return r.splits.map(s => {
                    const splitDesc = s.description ? `${desc} - ${s.description.toUpperCase()}` : desc;
                    const splitType = s.contributionType;
                    const splitAmount = Number(s.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    return [date, splitDesc, church, `${splitType} (RATEADO)`, status, splitAmount];
                });
            } else {
                const type = r.contributor?.contributionType || r.transaction.contributionType || "---";
                const rawAmount = isGhost ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount;
                const amount = Number(rawAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                return [[date, desc, church, type, status, amount]];
            }
        });

        autoTable(doc, {
            head: headers,
            body: rows,
            startY: 50,
            margin: { top: 38, bottom: 18, left: 10, right: 10 },
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' }, // Slate 900
            bodyStyles: { fontSize: 7 },
            alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate 50
            styles: { overflow: 'linebreak', cellPadding: 2 }
        });

        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 100;

        // Draw Pastor and Treasurer Signatures
        drawChurchFooterSignatures(doc, targetChurch, finalY);

        // Apply Header and Page Numbers on all pages
        applyHeadersAndPageNumbers(doc, targetChurch, title, subtitle);

        doc.save(filename);
    },

    /**
     * Exporta a lista de Pessoas / Contribuintes em CSV.
     */
    downloadContributorsCsv: (contributors: any[], churches: any[], filename: string = 'relatorio_cadastros_contribuintes.csv') => {
        const getChurchName = (cId: string) => churches.find(c => c.id === cId)?.name || 'Igreja Geral';
        const headers = ["Nome / Razão Social", "Tipo", "CPF / CNPJ", "Igreja / Congregação", "Cargo / Vínculo", "Telefone", "E-mail", "Cidade / UF"];
        
        const csvContent = [
            headers.join(";"),
            ...contributors.map(c => {
                const name = (c.name || c.fullName || 'NÃO INFORMADO').replace(/;/g, ' ').toUpperCase();
                const type = c.personType === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física';
                const doc = c.cpfCnpj || c.cpf || c.document || '---';
                const church = getChurchName(c.churchId).replace(/;/g, ' ');
                const role = (c.role || c.churchRole || 'Membro').replace(/;/g, ' ');
                const phone = (c.phone || c.mobile || '---').replace(/;/g, ' ');
                const email = (c.email || '---').replace(/;/g, ' ');
                const location = c.city ? `${c.city}${c.state ? `/${c.state}` : ''}` : '---';

                return [`"${name}"`, `"${type}"`, `"${doc}"`, `"${church}"`, `"${role}"`, `"${phone}"`, `"${email}"`, `"${location}"`].join(";");
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
     * Exporta a lista de Pessoas / Contribuintes em Excel (.xlsx).
     */
    downloadContributorsExcel: (contributors: any[], churches: any[], filename: string = 'relatorio_cadastros_contribuintes.xlsx') => {
        const getChurchName = (cId: string) => churches.find(c => c.id === cId)?.name || 'Igreja Geral';

        const excelData = contributors.map(c => ({
            "Nome / Razão Social": (c.name || c.fullName || 'NÃO INFORMADO').toUpperCase(),
            "Tipo": c.personType === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física',
            "CPF / CNPJ": c.cpfCnpj || c.cpf || c.document || '---',
            "Igreja / Congregação": getChurchName(c.churchId),
            "Cargo / Vínculo": c.role || c.churchRole || 'Membro',
            "Telefone": c.phone || c.mobile || '---',
            "E-mail": c.email || '---',
            "Cidade / UF": c.city ? `${c.city}${c.state ? `/${c.state}` : ''}` : '---'
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cadastros");
        XLSX.writeFile(workbook, filename);
    },

    /**
     * Exporta a lista de Pessoas / Contribuintes em PDF formatado.
     */
    downloadContributorsPdf: (contributors: any[], churches: any[], title: string = 'Relatório de Cadastros e Contribuintes', filename: string = 'relatorio_cadastros.pdf', selectedChurchId?: string) => {
        const doc = new jsPDF();
        const targetChurch = resolveChurch(churches, selectedChurchId, contributors);
        const getChurchName = (cId: string) => churches.find(c => c.id === cId)?.name || targetChurch?.name || 'Igreja Geral';
        const subtitle = `Total de Registros Encontrados: ${contributors.length}`;
        
        const headers = [["Nome / Razão Social", "Tipo", "CPF / CNPJ", "Igreja", "Vínculo", "Contato"]];
        
        const rows = contributors.map(c => {
            const name = (c.name || c.fullName || 'NÃO INFORMADO').toUpperCase();
            const type = c.personType === 'PJ' ? 'PJ' : 'PF';
            const documentNum = c.cpfCnpj || c.cpf || c.document || '---';
            const church = getChurchName(c.churchId);
            const role = c.role || c.churchRole || 'Membro';
            const contact = c.phone || c.email || '---';

            return [name, type, documentNum, church, role, contact];
        });

        autoTable(doc, {
            head: headers,
            body: rows,
            startY: 38,
            margin: { top: 38, bottom: 18, left: 10, right: 10 },
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22], fontSize: 8, fontStyle: 'bold' }, // Orange 500
            bodyStyles: { fontSize: 7 },
            alternateRowStyles: { fillColor: [255, 247, 237] }, // Orange 50
            styles: { overflow: 'linebreak', cellPadding: 2 }
        });

        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 100;
        drawChurchFooterSignatures(doc, targetChurch, finalY);
        applyHeadersAndPageNumbers(doc, targetChurch, title, subtitle);

        doc.save(filename);
    },

    /**
     * Imprime a lista de Pessoas / Contribuintes formatada em HTML/CSS para impressão ou salvamento PDF via browser.
     */
    printContributorsHtml: (contributors: any[], churches: any[], title: string = 'Relatório de Cadastros e Contribuintes', selectedChurchId?: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const targetChurch = resolveChurch(churches, selectedChurchId, contributors);
        const getChurchName = (cId: string) => churches.find(c => c.id === cId)?.name || targetChurch?.name || 'Igreja Geral';

        const pfCount = contributors.filter(c => c.personType !== 'PJ').length;
        const pjCount = contributors.filter(c => c.personType === 'PJ').length;

        const tableRows = contributors.map(c => {
            const name = (c.name || c.fullName || 'NÃO INFORMADO').toUpperCase();
            const type = c.personType === 'PJ' ? 'PJ' : 'PF';
            const documentNum = c.cpfCnpj || c.cpf || c.document || '---';
            const churchName = getChurchName(c.churchId);
            const role = c.role || c.churchRole || 'Membro';
            const contact = c.phone || c.email || '---';

            return `
                <tr>
                    <td style="font-weight: 700;">${name}</td>
                    <td style="text-align: center;"><span style="background: ${type === 'PJ' ? '#e0f2fe' : '#f1f5f9'}; color: ${type === 'PJ' ? '#0369a1' : '#475569'}; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 8.5px;">${type}</span></td>
                    <td style="font-family: monospace; font-size: 9.5px;">${documentNum}</td>
                    <td>${churchName}</td>
                    <td>${role}</td>
                    <td>${contact}</td>
                </tr>
            `;
        }).join('');

        const pastorRaw = targetChurch?.pastor || 'Pastor Presidente';
        const pastorName = pastorRaw.toLowerCase().startsWith('pr') ? pastorRaw : `Pr. ${pastorRaw}`;
        const treasurerName = targetChurch?.treasurer || 'Tesoureiro Geral';

        const cityState = targetChurch?.city ? `${targetChurch.city}${targetChurch.state ? '/' + targetChurch.state : ''}` : 'Local';
        const dateFormatted = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
                        
                        body { 
                            font-family: 'Inter', sans-serif; 
                            color: #0f172a; 
                            margin: 20px; 
                            -webkit-print-color-adjust: exact !important; 
                            print-color-adjust: exact !important;
                        }
                        
                        .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 20px; }
                        .church-info-box { display: flex; align-items: center; gap: 14px; }
                        .church-logo { max-height: 55px; max-width: 90px; object-fit: contain; border-radius: 6px; border: 1px solid #e2e8f0; padding: 4px; background: #fff; }
                        .church-title { font-size: 15px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -0.01em; }
                        .church-sub { margin: 3px 0 0 0; font-size: 10px; color: #64748b; font-weight: 600; }
                        .church-leader { margin: 3px 0 0 0; font-size: 10px; color: #f97316; font-weight: 700; text-transform: uppercase; }
                        .report-title-box { text-align: right; }
                        .report-title { font-size: 15px; margin: 0; color: #f97316; text-transform: uppercase; font-weight: 900; }
                        .report-date { font-size: 10px; color: #64748b; font-weight: 600; }

                        .summary { 
                            display: flex; 
                            gap: 20px; 
                            margin-bottom: 20px; 
                            padding: 12px 16px; 
                            background: #f8fafc !important; 
                            border-radius: 10px; 
                            border: 1px solid #e2e8f0; 
                        }
                        
                        .summary-item { display: flex; flex-direction: column; }
                        .summary-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
                        .summary-value { font-size: 15px; font-weight: 900; color: #0f172a; }
                        
                        table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
                        th { 
                            background: #f8fafc !important; 
                            padding: 8px; 
                            border-bottom: 2px solid #0f172a; 
                            text-transform: uppercase; 
                            font-size: 8.5px; 
                            font-weight: 900;
                            color: #475569; 
                            text-align: left;
                        }
                        td { padding: 8px; border-bottom: 1px solid #e2e8f0; word-break: break-word; vertical-align: middle; }
                        tr:nth-child(even) { background: #f8fafc !important; }

                        .footer-signatures { margin-top: 50px; page-break-inside: avoid; }
                        .sig-container { display: flex; justify-content: space-around; text-align: center; margin-top: 30px; }
                        .sig-block { width: 240px; }
                        .sig-line { border-bottom: 1px solid #64748b; margin-bottom: 6px; }
                        .sig-name { display: block; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
                        .sig-role { font-size: 9px; color: #64748b; font-weight: 600; }
                    </style>
                </head>
                <body>
                    <div class="header-container">
                        <div class="church-info-box">
                            ${targetChurch?.logoUrl ? `<img src="${targetChurch.logoUrl}" class="church-logo" alt="Logo" />` : ''}
                            <div>
                                <h2 class="church-title">${targetChurch?.name || 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS'}</h2>
                                <p class="church-sub">
                                    ${[targetChurch?.cnpj ? `CNPJ: ${targetChurch.cnpj}` : '', targetChurch?.address, targetChurch?.city ? `${targetChurch.city}${targetChurch.state ? '/' + targetChurch.state : ''}` : ''].filter(Boolean).join(' • ')}
                                </p>
                                ${targetChurch?.pastor ? `<p class="church-leader">Pastor: ${targetChurch.pastor} ${targetChurch?.treasurer ? `| Tesoureiro: ${targetChurch.treasurer}` : ''}</p>` : ''}
                            </div>
                        </div>
                        <div class="report-title-box">
                            <h1 class="report-title">${title}</h1>
                            <span class="report-date">Gerado em: ${new Date().toLocaleString('pt-BR')}</span>
                        </div>
                    </div>

                    <div class="summary">
                        <div class="summary-item">
                            <span class="summary-label">Total Cadastros</span>
                            <span class="summary-value">${contributors.length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Pessoas Físicas (PF)</span>
                            <span class="summary-value">${pfCount}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Pessoas Jurídicas (PJ)</span>
                            <span class="summary-value">${pjCount}</span>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 28%;">Nome / Razão Social</th>
                                <th style="width: 8%; text-align: center;">Tipo</th>
                                <th style="width: 18%;">CPF / CNPJ</th>
                                <th style="width: 18%;">Igreja</th>
                                <th style="width: 14%;">Vínculo</th>
                                <th style="width: 14%;">Contato</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>

                    <div class="footer-signatures">
                        <p style="text-align: center; font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 25px;">
                            ${cityState}, ${dateFormatted}
                        </p>
                        <div class="sig-container">
                            <div class="sig-block">
                                <div class="sig-line"></div>
                                <span class="sig-name">${pastorName}</span>
                                <span class="sig-role">Pastor Presidente / Responsável</span>
                            </div>
                            <div class="sig-block">
                                <div class="sig-line"></div>
                                <span class="sig-name">${treasurerName}</span>
                                <span class="sig-role">Tesoureiro / Resp. Financeiro</span>
                            </div>
                        </div>
                    </div>

                    <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    },

    /**
     * Exporta os cadastros em formato estruturado XML/OFX para integração contábil.
     */
    downloadContributorsOfx: (contributors: any[], churches: any[], filename: string = 'cadastros_contribuintes.ofx') => {
        const getChurchName = (cId: string) => churches.find(c => c.id === cId)?.name || 'Igreja Geral';
        const now = new Date();
        const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);

        const itemsOfx = contributors.map((c, i) => {
            const name = String(c.name || c.fullName || 'CONTRIBUINTE').replace(/[<>&]/g, '').toUpperCase();
            const doc = String(c.cpfCnpj || c.cpf || c.document || '').replace(/\D/g, '');
            const church = String(getChurchName(c.churchId)).replace(/[<>&]/g, '').toUpperCase();
            const role = String(c.role || c.churchRole || 'MEMBRO').replace(/[<>&]/g, '').toUpperCase();
            const fitId = c.id || `CONTRIB-${i+1}`;
            const memo = `${name} | ${doc} | ${church} | ${role}`;

            return `<STMTTRN>
<TRNTYPE>INFO</TRNTYPE>
<DTPOSTED>${timestamp}</DTPOSTED>
<TRNAMT>0.00</TRNAMT>
<FITID>${fitId}</FITID>
<MEMO>${memo}</MEMO>
</STMTTRN>`;
        }).join('\n');

        const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<DTSERVER>${timestamp}</DTSERVER>
<LANGUAGE>POR</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${timestamp}</TRNUID>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>0000</BANKID>
<ACCTID>IDENTIFICAPIX_CADASTROS</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${timestamp}</DTSTART>
<DTEND>${timestamp}</DTEND>
${itemsOfx}
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

        const blob = new Blob([ofxContent], { type: 'application/x-ofx;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Exporta o Livro Caixa (Extrato Analítico) em Excel (.xlsx).
     */
    downloadLivroCaixaExcel: (transactions: any[], churches: any[], filename: string = 'livro_caixa.xlsx') => {
        const getChurchName = (item: any) => item.church || churches.find(c => c.id === item.churchId)?.name || 'Igreja Sede';
        
        const excelRows = transactions.map(tx => {
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const amount = Math.abs(Number(tx.amount) || Number(tx.val) || 0);

            return {
                "Data": tx.date || '---',
                "Descrição / Histórico": (tx.desc || tx.description || tx.historico || 'Lançamento').toUpperCase(),
                "Contribuinte / Favorecido": tx.payer || tx.contribuinte || tx.nome || '---',
                "Categoria": tx.category || tx.categoria || 'Geral',
                "Igreja": getChurchName(tx),
                "Descrição": isExpense ? 'Saída' : 'Entrada',
                "Valor (R$)": isExpense ? -amount : amount
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Livro Caixa");
        XLSX.writeFile(workbook, filename);
    },

    /**
     * Calcula a apuração detalhada de caixa para relatórios e PDFs
     */
    calculateLivroCaixaBreakdown: (transactions: any[], allReportData: any[] = [], customStartDate?: string, selectionMode?: string) => {
        let saldoAnterior = 0;
        let entradasDinheiro = 0;
        let entradasPix = 0;
        let entradasOutras = 0;
        let transfRecebidas = 0;

        let saidasDinheiro = 0;
        let saidasPix = 0;
        let saidasBoletoFaturas = 0;
        let saidasOutras = 0;
        let transfEnviadas = 0;

        if (customStartDate && allReportData.length > 0) {
            allReportData.forEach((item: any) => {
                const itemDate = item.date ? (item.date.includes('T') ? item.date.split('T')[0] : item.date) : '';
                if (itemDate && itemDate < customStartDate) {
                    const amt = Math.abs(Number(item.amount) || Number(item.val) || 0);
                    const isExp = item.type === 'expense' || Number(item.amount) < 0 || (item.category && item.category.toLowerCase().includes('saida'));
                    if (isExp) {
                        saldoAnterior -= amt;
                    } else {
                        saldoAnterior += amt;
                    }
                }
            });
        }

        transactions.forEach((item: any) => {
            const amt = Math.abs(Number(item.amount) || Number(item.val) || 0);
            const pm = (item.paymentMethod || item.forma || '').toString().toUpperCase();
            const cat = (item.category || item.categoria || '').toString().toUpperCase();
            const desc = (item.desc || item.description || item.historico || '').toString().toUpperCase();
            const isExp = item.type === 'expense' || Number(item.amount) < 0 || cat.includes('SAIDA') || cat.includes('SAÍDA');

            const isTransf = pm.includes('TRANSFER') || pm.includes('TED') || pm.includes('DOC') || cat.includes('TRANSFER') || desc.includes('TRANSFER');

            if (isExp) {
                if (isTransf) {
                    transfEnviadas += amt;
                } else if (pm.includes('DINHEIRO') || pm.includes('ESPÉCIE') || pm.includes('ESPECIE')) {
                    saidasDinheiro += amt;
                } else if (pm.includes('PIX')) {
                    saidasPix += amt;
                } else if (pm.includes('BOLETO') || pm.includes('FATURA') || pm.includes('CARTÃO') || pm.includes('CARTAO')) {
                    saidasBoletoFaturas += amt;
                } else {
                    saidasOutras += amt;
                }
            } else {
                if (isTransf) {
                    transfRecebidas += amt;
                } else if (pm.includes('DINHEIRO') || pm.includes('ESPÉCIE') || pm.includes('ESPECIE')) {
                    entradasDinheiro += amt;
                } else if (pm.includes('PIX')) {
                    entradasPix += amt;
                } else {
                    entradasOutras += amt;
                }
            }
        });

        const totalEntradas = entradasDinheiro + entradasPix + entradasOutras;
        const totalSaidas = saidasDinheiro + saidasPix + saidasBoletoFaturas + saidasOutras;

        const totalEntradasPlusTransf = totalEntradas + transfRecebidas;
        const totalSaidasPlusTransf = totalSaidas + transfEnviadas;

        const saldoFinal = saldoAnterior + totalEntradasPlusTransf - totalSaidasPlusTransf;

        return {
            saldoAnterior,
            entradasDinheiro,
            entradasPix,
            totalEntradas,
            saidasDinheiro,
            saidasPix,
            saidasBoletoFaturas,
            totalSaidas,
            transfRecebidas,
            transfEnviadas,
            totalEntradasPlusTransf,
            totalSaidasPlusTransf,
            saldoFinal
        };
    },

    /**
     * Exporta o Livro Caixa em PDF formatado com Cabeçalho da Igreja, Logomarca, Número de Páginas, Resumo Consolidado no Final e Assinaturas no Rodapé.
     */
    downloadLivroCaixaPdf: (transactions: any[], churches: any[], title: string = 'Livro Caixa - Extrato Analítico', filename: string = 'livro_caixa.pdf', selectedChurchId?: string, allReportData: any[] = [], customStartDate?: string, selectionMode?: string) => {
        const doc = new jsPDF();
        const targetChurch = resolveChurch(churches, selectedChurchId, transactions);
        const getChurchName = (item: any) => item.church || churches.find(c => c.id === item.churchId)?.name || targetChurch?.name || 'Igreja Sede';

        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(tx => {
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            if (isExpense) totalExpense += amt;
            else totalIncome += amt;
        });

        const netBalance = totalIncome - totalExpense;

        // Desenha o box de resumo discreto no topo da primeira página
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFillColor(248, 250, 252); // Slate 50
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.roundedRect(10, 32, pageWidth - 20, 10, 2, 2, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("ENTRADAS:", 14, 38.5);
        doc.setFontSize(8);
        doc.setTextColor(5, 150, 105);
        doc.text(`R$ ${totalIncome.toFixed(2)}`, 32, 38.5);

        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("SAÍDAS:", 68, 38.5);
        doc.setFontSize(8);
        doc.setTextColor(220, 38, 38);
        doc.text(`R$ ${totalExpense.toFixed(2)}`, 82, 38.5);

        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("SALDO OPERACIONAL:", 118, 38.5);
        doc.setFontSize(8);
        doc.setTextColor(netBalance < 0 ? 220 : 5, netBalance < 0 ? 38 : 150, netBalance < 0 ? 38 : 105);
        doc.text(`R$ ${netBalance.toFixed(2)}`, 154, 38.5);

        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("REGISTROS:", 182, 38.5);
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(`${transactions.length}`, 200, 38.5);

        const headers = [["Data", "Descrição / Histórico", "Contribuinte / Favorecido", "Categoria", "Igreja", "Descrição", "Valor (R$)"]];
        
        const rows = transactions.map(tx => {
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            const dateStr = tx.date || '---';
            const desc = (tx.desc || tx.description || tx.historico || 'Lançamento').toUpperCase();
            const payer = tx.payer || tx.contribuinte || tx.nome || '---';
            const cat = tx.category || tx.categoria || 'Geral';
            const church = getChurchName(tx);
            const typeStr = isExpense ? 'Saída' : 'Entrada';
            const formattedVal = `${isExpense ? '-' : '+'} R$ ${amt.toFixed(2)}`;

            return [dateStr, desc, payer, cat, church, typeStr, formattedVal];
        });

        autoTable(doc, {
            head: headers,
            body: rows,
            startY: 45,
            margin: { top: 38, bottom: 18, left: 10, right: 10 },
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 7 },
            alternateRowStyles: { fillColor: [255, 247, 237] },
            styles: { overflow: 'linebreak', cellPadding: 2 }
        });

        let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 100;

        // Calcular o resumo detalhado de caixa
        const breakdown = ExportService.calculateLivroCaixaBreakdown(transactions, allReportData, customStartDate, selectionMode);

        // Se o espaço na página atual for insuficiente para o quadro de resumo (~50mm), cria nova página
        if (finalY + 52 > pageHeight - 18) {
            doc.addPage();
            finalY = 32;
        } else {
            finalY += 8;
        }

        const fmtVal = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Tabela do Resumo Consolidado no final do relatório
        autoTable(doc, {
            startY: finalY,
            head: [["ENTRADAS E CRÉDITOS", "SAÍDAS E DÉBITOS", "SALDOS DO PERÍODO"]],
            body: [
                [
                    `• Entradas em dinheiro: R$ ${fmtVal(breakdown.entradasDinheiro)}\n` +
                    `• Entradas em Pix: R$ ${fmtVal(breakdown.entradasPix)}\n` +
                    `• Total de entradas: R$ ${fmtVal(breakdown.totalEntradas)}\n` +
                    `• Total transf. recebidas: R$ ${fmtVal(breakdown.transfRecebidas)}\n\n` +
                    `TOTAL ENTRADAS + TRANSF: R$ ${fmtVal(breakdown.totalEntradasPlusTransf)}`,

                    `• Saídas em dinheiro: R$ ${fmtVal(breakdown.saidasDinheiro)}\n` +
                    `• Saídas em Pix: R$ ${fmtVal(breakdown.saidasPix)}\n` +
                    `• Saídas boleto/faturas: R$ ${fmtVal(breakdown.saidasBoletoFaturas)}\n` +
                    `• Total de saídas: R$ ${fmtVal(breakdown.totalSaidas)}\n` +
                    `• Total transf. enviadas: R$ ${fmtVal(breakdown.transfEnviadas)}\n\n` +
                    `TOTAL SAÍDAS + TRANSF: R$ ${fmtVal(breakdown.totalSaidasPlusTransf)}`,

                    `• Saldo Anterior: R$ ${fmtVal(breakdown.saldoAnterior)}\n\n\n\n\n` +
                    `SALDO FINAL DO CAIXA: R$ ${fmtVal(breakdown.saldoFinal)}`
                ]
            ],
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { fontSize: 7.5, cellPadding: 3, textColor: [51, 65, 85] },
            margin: { left: 10, right: 10 },
            columnStyles: {
                0: { cellWidth: (pageWidth - 20) / 3 },
                1: { cellWidth: (pageWidth - 20) / 3 },
                2: { cellWidth: (pageWidth - 20) / 3 }
            }
        });

        const finalYAfterResumo = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : finalY + 40;

        // Desenhar assinaturas do Pastor e Tesoureiro no final do relatório
        drawChurchFooterSignatures(doc, targetChurch, finalYAfterResumo);

        // Aplicar cabeçalho institucional e paginação (sem subtitle longo para não sobrepor texto)
        applyHeadersAndPageNumbers(doc, targetChurch, title, undefined);

        doc.save(filename);
    },

    /**
     * Gera relatório de impressão formatado do Livro Caixa em janela de impressão.
     */
    printLivroCaixa: (transactions: any[], churches: any[], allReportData: any[] = [], customStartDate?: string, selectionMode?: string, selectedChurchId?: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const targetChurch = resolveChurch(churches, selectedChurchId, transactions);
        const churchName = targetChurch?.name || 'Igreja Sede';
        const cnpj = targetChurch?.cnpj ? `CNPJ: ${targetChurch.cnpj}` : '';
        const address = targetChurch?.address || '';
        const phone = targetChurch?.phone ? `Tel: ${targetChurch.phone}` : '';
        const email = targetChurch?.email ? `Email: ${targetChurch.email}` : '';
        const logo = targetChurch?.logo || targetChurch?.logoUrl || '';

        const breakdown = ExportService.calculateLivroCaixaBreakdown(transactions, allReportData, customStartDate, selectionMode);

        let totalIncome = 0;
        let totalExpense = 0;
        transactions.forEach(tx => {
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            if (isExpense) totalExpense += amt;
            else totalIncome += amt;
        });
        const netBalance = totalIncome - totalExpense;

        const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const tableRows = transactions.map(tx => {
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            const dateStr = tx.date || '---';
            const desc = (tx.desc || tx.description || tx.historico || 'Lançamento').toUpperCase();
            const payer = tx.payer || tx.contribuinte || tx.nome || '---';
            const cat = tx.category || tx.categoria || 'Geral';
            const church = tx.church || churches.find(c => c.id === tx.churchId)?.name || churchName;
            const typeStr = isExpense ? 'Saída' : 'Entrada';
            const valColor = isExpense ? '#dc2626' : '#059669';
            const formattedVal = `${isExpense ? '-' : '+'} ${formatBRL(amt)}`;

            return `
                <tr>
                    <td style="padding: 6px 8px; font-family: monospace;">${dateStr}</td>
                    <td style="padding: 6px 8px; font-weight: 500;">${desc}</td>
                    <td style="padding: 6px 8px;">${payer}</td>
                    <td style="padding: 6px 8px;">${cat}</td>
                    <td style="padding: 6px 8px;">${church}</td>
                    <td style="padding: 6px 8px;">${typeStr}</td>
                    <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold; color: ${valColor};">${formattedVal}</td>
                </tr>
            `;
        }).join('');

        const cityState = targetChurch?.city ? `${targetChurch.city}${targetChurch.state ? '/' + targetChurch.state : ''}` : 'Local';
        const dateFormatted = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const pastorName = (targetChurch?.pastor || 'Pastor Presidente').toUpperCase();
        const treasurerName = (targetChurch?.treasurer || 'Tesoureiro Geral').toUpperCase();

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Livro Caixa - ${churchName}</title>
                    <style>
                        @page { size: A4 portrait; margin: 12mm; }
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 0; }
                        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 10px; margin-bottom: 12px; }
                        .header-logo { max-height: 50px; max-width: 120px; margin-right: 12px; }
                        .header-info { flex: 1; }
                        .header-info h2 { margin: 0; font-size: 16px; color: #0f172a; font-weight: 800; text-transform: uppercase; }
                        .header-info p { margin: 2px 0 0 0; font-size: 9px; color: #64748b; }
                        .header-title { text-align: right; }
                        .header-title h3 { margin: 0; font-size: 14px; color: #f97316; text-transform: uppercase; font-weight: 800; }
                        .header-title p { margin: 2px 0 0 0; font-size: 9px; color: #94a3b8; }
                        
                        .discrete-summary { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; font-size: 11px; }
                        .discrete-summary-item { display: flex; gap: 6px; align-items: center; }
                        .discrete-summary-item span { font-weight: bold; }

                        table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
                        table.data-table th { background: #f97316; color: #ffffff; padding: 6px 8px; text-align: left; text-transform: uppercase; font-size: 9px; font-weight: 800; }
                        table.data-table td { border-bottom: 1px solid #f1f5f9; }
                        table.data-table tr:nth-child(even) { background: #fff7ed; }

                        .resumo-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-top: 16px; background: #ffffff; page-break-inside: avoid; }
                        .resumo-header { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; }
                        .resumo-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
                        .resumo-col { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
                        .resumo-col-title { font-size: 9px; font-weight: 800; text-transform: uppercase; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; margin-bottom: 6px; }
                        .resumo-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px; }
                        .resumo-row.total { font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px; }
                        
                        .signatures { margin-top: 30px; page-break-inside: avoid; }
                        .signatures-date { text-align: center; font-size: 10px; color: #475569; font-weight: 600; margin-bottom: 20px; }
                        .signatures-grid { display: flex; justify-content: space-around; }
                        .sig-block { text-align: center; width: 40%; }
                        .sig-line { border-top: 1px solid #94a3b8; margin-bottom: 4px; }
                        .sig-name { font-weight: bold; font-size: 10px; text-transform: uppercase; display: block; }
                        .sig-role { font-size: 9px; color: #64748b; display: block; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div style="display: flex; align-items: center;">
                            ${logo ? `<img src="${logo}" class="header-logo" />` : ''}
                            <div class="header-info">
                                <h2>${churchName}</h2>
                                <p>${[cnpj, address, phone, email].filter(Boolean).join(' | ')}</p>
                            </div>
                        </div>
                        <div class="header-title">
                            <h3>LIVRO CAIXA</h3>
                            <p>Extrato Analítico</p>
                            <p>Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>

                    <div class="discrete-summary">
                        <div class="discrete-summary-item">ENTRADAS: <span style="color: #059669;">${formatBRL(totalIncome)}</span></div>
                        <div class="discrete-summary-item">SAÍDAS: <span style="color: #dc2626;">${formatBRL(totalExpense)}</span></div>
                        <div class="discrete-summary-item">SALDO OPERACIONAL: <span style="color: ${netBalance >= 0 ? '#059669' : '#dc2626'};">${formatBRL(netBalance)}</span></div>
                        <div class="discrete-summary-item">REGISTROS: <span>${transactions.length}</span></div>
                    </div>

                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Descrição / Histórico</th>
                                <th>Contribuinte / Favorecido</th>
                                <th>Categoria</th>
                                <th>Igreja</th>
                                <th>Descrição</th>
                                <th style="text-align: right;">Valor (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>

                    <div class="resumo-box">
                        <div class="resumo-header">
                            <span>RESUMO DE ENTRADAS E SAÍDAS</span>
                            <span style="color: #64748b; font-size: 9px;">Demonstrativo Analítico do Caixa</span>
                        </div>
                        <div class="resumo-grid">
                            <div class="resumo-col">
                                <div class="resumo-col-title" style="color: #047857;">Entradas e Créditos</div>
                                <div class="resumo-row"><span>Entradas em dinheiro:</span><strong>${formatBRL(breakdown.entradasDinheiro)}</strong></div>
                                <div class="resumo-row"><span>Entradas em Pix:</span><strong>${formatBRL(breakdown.entradasPix)}</strong></div>
                                <div class="resumo-row total"><span>Total de entradas:</span><strong style="color: #047857;">${formatBRL(breakdown.totalEntradas)}</strong></div>
                                <div class="resumo-row"><span>Transf. recebidas:</span><strong>${formatBRL(breakdown.transfRecebidas)}</strong></div>
                                <div class="resumo-row total" style="color: #047857; font-size: 10px;"><span>Total Entradas + Transf.:</span><strong>${formatBRL(breakdown.totalEntradasPlusTransf)}</strong></div>
                            </div>

                            <div class="resumo-col">
                                <div class="resumo-col-title" style="color: #b91c1c;">Saídas e Débitos</div>
                                <div class="resumo-row"><span>Saídas em dinheiro:</span><strong>${formatBRL(breakdown.saidasDinheiro)}</strong></div>
                                <div class="resumo-row"><span>Saídas em Pix:</span><strong>${formatBRL(breakdown.saidasPix)}</strong></div>
                                <div class="resumo-row"><span>Saídas boletos/faturas:</span><strong>${formatBRL(breakdown.saidasBoletoFaturas)}</strong></div>
                                <div class="resumo-row total"><span>Total de saídas:</span><strong style="color: #b91c1c;">${formatBRL(breakdown.totalSaidas)}</strong></div>
                                <div class="resumo-row"><span>Transf. enviadas:</span><strong>${formatBRL(breakdown.transfEnviadas)}</strong></div>
                                <div class="resumo-row total" style="color: #b91c1c; font-size: 10px;"><span>Total Saídas + Transf.:</span><strong>${formatBRL(breakdown.totalSaidasPlusTransf)}</strong></div>
                            </div>

                            <div class="resumo-col" style="background: #fffbeb; border-color: #fde68a;">
                                <div class="resumo-col-title" style="color: #b45309;">Saldos do Período</div>
                                <div class="resumo-row"><span>Saldo Anterior:</span><strong>${formatBRL(breakdown.saldoAnterior)}</strong></div>
                                <div style="margin-top: 25px; padding: 8px; background: #ffffff; border: 1px solid #fcd34d; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 800; font-size: 10px;">SALDO FINAL:</span>
                                    <span style="font-weight: 900; font-size: 12px; color: ${breakdown.saldoFinal >= 0 ? '#047857' : '#b91c1c'};">${formatBRL(breakdown.saldoFinal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="signatures">
                        <div class="signatures-date">${cityState}, ${dateFormatted}</div>
                        <div class="signatures-grid">
                            <div class="sig-block">
                                <div class="sig-line"></div>
                                <span class="sig-name">${pastorName}</span>
                                <span class="sig-role">Pastor Presidente / Responsável</span>
                            </div>
                            <div class="sig-block">
                                <div class="sig-line"></div>
                                <span class="sig-name">${treasurerName}</span>
                                <span class="sig-role">Tesoureiro / Resp. Financeiro</span>
                            </div>
                        </div>
                    </div>

                    <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    },

    /**
     * Exporta o Livro Caixa em CSV.
     */
    downloadLivroCaixaCsv: (transactions: any[], churches: any[], filename: string = 'livro_caixa.csv') => {
        const getChurchName = (item: any) => item.church || churches.find(c => c.id === item.churchId)?.name || 'Igreja Sede';
        const headers = ["Data", "Descrição / Histórico", "Contribuinte / Favorecido", "Categoria", "Igreja", "Tipo", "Valor (R$)"];

        const csvRows = transactions.map(tx => {
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            const dateStr = tx.date || '---';
            const desc = (tx.desc || tx.description || tx.historico || 'Lançamento').replace(/;/g, ' ');
            const payer = (tx.payer || tx.contribuinte || tx.nome || '---').replace(/;/g, ' ');
            const cat = (tx.category || tx.categoria || 'Geral').replace(/;/g, ' ');
            const church = String(getChurchName(tx)).replace(/;/g, ' ');
            const typeStr = isExpense ? 'Saída' : 'Entrada';
            const valStr = (isExpense ? -amt : amt).toFixed(2).replace('.', ',');

            return [`"${dateStr}"`, `"${desc}"`, `"${payer}"`, `"${cat}"`, `"${church}"`, `"${typeStr}"`, `"${valStr}"`].join(';');
        });

        const csvContent = ['\uFEFF' + headers.join(';'), ...csvRows].join('\n');
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
     * Exporta o Livro Caixa em formato OFX para contabilidade.
     */
    downloadLivroCaixaOfx: (transactions: any[], churches: any[], filename: string = 'livro_caixa.ofx') => {
        const getChurchName = (item: any) => item.church || churches.find(c => c.id === item.churchId)?.name || 'Igreja Sede';
        const now = new Date();
        const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);

        const ofxTrns = transactions.map((tx, idx) => {
            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
            const rawAmt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            const amt = isExpense ? -rawAmt : rawAmt;

            const dateStr = (tx.date || timestamp.slice(0, 10)).replace(/-/g, '');
            const desc = (tx.desc || tx.description || tx.historico || 'LANCAMENTO').replace(/[<>&]/g, '').toUpperCase();
            const church = String(getChurchName(tx)).replace(/[<>&]/g, '').toUpperCase();
            const fitId = tx.id || `TX-${dateStr}-${idx + 1}`;
            const memo = `${desc} | ${church} | ${tx.category || 'GERAL'}`;

            return `<STMTTRN>
<TRNTYPE>${isExpense ? 'DEBIT' : 'CREDIT'}</TRNTYPE>
<DTPOSTED>${dateStr}120000</DTPOSTED>
<TRNAMT>${amt.toFixed(2)}</TRNAMT>
<FITID>${fitId}</FITID>
<MEMO>${memo}</MEMO>
</STMTTRN>`;
        }).join('\n');

        const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<DTSERVER>${timestamp}</DTSERVER>
<LANGUAGE>POR</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${timestamp}</TRNUID>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>0000</BANKID>
<ACCTID>IDENTIFICAPIX_LIVROCAIXA</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${timestamp}</DTSTART>
<DTEND>${timestamp}</DTEND>
${ofxTrns}
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

        const blob = new Blob([ofxContent], { type: 'application/x-ofx;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Exporta o Balancete (Sintético, Analítico ou Contábil) em Excel (.xlsx).
     */
    downloadBalanceteExcel: (totals: { income: number; expenses: number; balance: number; pending: number }, expenseCategories: any[], filename: string = 'balancete.xlsx', balanceteType: 'sintetico' | 'analitico' | 'contabil' = 'sintetico', rawTransactions: any[] = [], incomeCategories: any[] = []) => {
        const wb = XLSX.utils.book_new();

        if (balanceteType === 'contabil') {
            const contabilRows = [
                { "Código Conta": "1.1.01", "Plano de Contas": "RECEITAS - DÍZIMOS E OFERTAS", "Tipo": "CRÉDITO", "Entradas (R$)": totals.income, "Saídas (R$)": 0, "Saldo Atual (R$)": totals.income },
                ...incomeCategories.map((c, idx) => ({
                    "Código Conta": `1.1.0${idx + 2}`,
                    "Plano de Contas": `  • ${c.category.toUpperCase()}`,
                    "Tipo": "CRÉDITO",
                    "Entradas (R$)": c.amount,
                    "Saídas (R$)": 0,
                    "Saldo Atual (R$)": c.amount
                })),
                { "Código Conta": "2.1.01", "Plano de Contas": "DESPESAS OPERACIONAIS & MANUTENÇÃO", "Tipo": "DÉBITO", "Entradas (R$)": 0, "Saídas (R$)": totals.expenses, "Saldo Atual (R$)": -totals.expenses },
                ...expenseCategories.map((c, idx) => ({
                    "Código Conta": `2.1.0${idx + 2}`,
                    "Plano de Contas": `  • ${c.category.toUpperCase()}`,
                    "Tipo": "DÉBITO",
                    "Entradas (R$)": 0,
                    "Saídas (R$)": c.amount,
                    "Saldo Atual (R$)": -c.amount
                })),
                { "Código Conta": "3.1.01", "Plano de Contas": "RESULTADO OPERACIONAL LÍQUIDO", "Tipo": "SALDO", "Entradas (R$)": totals.income, "Saídas (R$)": totals.expenses, "Saldo Atual (R$)": totals.balance }
            ];
            const wsContabil = XLSX.utils.json_to_sheet(contabilRows);
            XLSX.utils.book_append_sheet(wb, wsContabil, "Balancete Contábil");
        } else if (balanceteType === 'analitico') {
            const summaryRows = [
                { "Item / Indicador": "Total de Entradas", "Valor (R$)": totals.income },
                { "Item / Indicador": "Total de Saídas", "Valor (R$)": totals.expenses },
                { "Item / Indicador": "Saldo Operacional Líquido", "Valor (R$)": totals.balance },
            ];

            const detailRows = rawTransactions.map(tx => {
                const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
                const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                return {
                    "Data": tx.date || '---',
                    "Descrição / Histórico": (tx.desc || tx.description || tx.historico || 'Lançamento').toUpperCase(),
                    "Contribuinte / Favorecido": tx.payer || tx.contribuinte || tx.nome || '---',
                    "Categoria": tx.category || tx.categoria || 'Geral',
                    "Igreja": tx.church || 'Igreja Sede',
                    "Tipo": isExpense ? 'Saída' : 'Entrada',
                    "Valor (R$)": isExpense ? -amt : amt
                };
            });

            const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
            const wsDetail = XLSX.utils.json_to_sheet(detailRows);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Executivo");
            XLSX.utils.book_append_sheet(wb, wsDetail, "Detalhamento Analítico");
        } else {
            const summaryRows = [
                { "Item / Indicador": "Total de Entradas (Dízimos & Ofertas)", "Valor (R$)": totals.income },
                { "Item / Indicador": "Total de Saídas (Despesas Operacionais)", "Valor (R$)": totals.expenses },
                { "Item / Indicador": "Saldo Operacional Líquido do Caixa", "Valor (R$)": totals.balance },
                { "Item / Indicador": "Montante Pendente de Conciliação", "Valor (R$)": totals.pending },
            ];

            const categoryRows = expenseCategories.map(cat => ({
                "Categoria de Saída / Custo": cat.category,
                "Quantidade de Lançamentos": cat.count,
                "Valor Total (R$)": cat.amount,
                "Representatividade (%)": totals.expenses > 0 ? ((cat.amount / totals.expenses) * 100).toFixed(1) + '%' : '0%'
            }));

            const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
            const wsCategories = XLSX.utils.json_to_sheet(categoryRows);

            XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Executivo");
            XLSX.utils.book_append_sheet(wb, wsCategories, "Saídas por Categoria");
        }

        XLSX.writeFile(wb, filename);
    },

    /**
     * Exporta o Balancete (Sintético, Analítico ou Contábil) em PDF.
     */
    downloadBalancetePdf: (
        totals: { income: number; expenses: number; balance: number; pending: number }, 
        expenseCategories: any[], 
        title: string = 'Balancete Financeiro', 
        filename: string = 'balancete.pdf', 
        churches?: any[], 
        selectedChurchId?: string,
        balanceteType: 'sintetico' | 'analitico' | 'contabil' = 'sintetico',
        rawTransactions: any[] = [],
        incomeCategories: any[] = []
    ) => {
        const doc = new jsPDF();
        const targetChurch = resolveChurch(churches, selectedChurchId);
        const subtitle = `Saldo Líquido: R$ ${totals.balance.toFixed(2)} | Entradas: R$ ${totals.income.toFixed(2)} | Saídas: R$ ${totals.expenses.toFixed(2)}`;

        if (balanceteType === 'contabil') {
            const contabilHeaders = [["Código", "Plano de Contas", "Tipo", "Entradas (R$)", "Saídas (R$)", "Saldo Final (R$)"]];
            const contabilBody: any[] = [
                ["1.0.00", "RECEITAS OPERACIONAIS", "GRUPO", `R$ ${totals.income.toFixed(2)}`, "R$ 0,00", `R$ ${totals.income.toFixed(2)}`],
                ...incomeCategories.map((c, i) => [
                    `1.1.0${i + 1}`,
                    `  ${c.category}`,
                    "Crédito",
                    `R$ ${c.amount.toFixed(2)}`,
                    "R$ 0,00",
                    `R$ ${c.amount.toFixed(2)}`
                ]),
                ["2.0.00", "DESPESAS OPERACIONAIS", "GRUPO", "R$ 0,00", `R$ ${totals.expenses.toFixed(2)}`, `- R$ ${totals.expenses.toFixed(2)}`],
                ...expenseCategories.map((c, i) => [
                    `2.1.0${i + 1}`,
                    `  ${c.category}`,
                    "Débito",
                    "R$ 0,00",
                    `R$ ${c.amount.toFixed(2)}`,
                    `- R$ ${c.amount.toFixed(2)}`
                ]),
                ["3.0.00", "RESULTADO DO EXERCÍCIO LÍQUIDO", "BALANÇO", `R$ ${totals.income.toFixed(2)}`, `R$ ${totals.expenses.toFixed(2)}`, `R$ ${totals.balance.toFixed(2)}`]
            ];

            autoTable(doc, {
                head: contabilHeaders,
                body: contabilBody,
                startY: 38,
                margin: { top: 38, bottom: 18, left: 10, right: 10 },
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                styles: { cellPadding: 2.5 }
            });
        } else if (balanceteType === 'analitico') {
            const summaryHeaders = [["Indicador", "Valor (R$)"]];
            const summaryBody = [
                ["Entradas Totais", `R$ ${totals.income.toFixed(2)}`],
                ["Saídas Totais", `R$ ${totals.expenses.toFixed(2)}`],
                ["Saldo Líquido", `R$ ${totals.balance.toFixed(2)}`]
            ];

            autoTable(doc, {
                head: summaryHeaders,
                body: summaryBody,
                startY: 38,
                margin: { top: 38, bottom: 18, left: 10, right: 10 },
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7.5 },
                styles: { cellPadding: 2 }
            });

            const nextY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : 70;

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("DETALHAMENTO ANALÍTICO DAS MOVIMENTAÇÕES", 10, nextY);

            const detailHeaders = [["Data", "Histórico / Descrição", "Contribuinte / Favorecido", "Categoria", "Tipo", "Valor (R$)"]];
            const detailBody = rawTransactions.map(tx => {
                const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
                const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                return [
                    tx.date || '---',
                    (tx.desc || tx.description || tx.historico || 'Lançamento').toUpperCase(),
                    tx.payer || tx.contribuinte || tx.nome || '---',
                    tx.category || tx.categoria || 'Geral',
                    isExpense ? 'Saída' : 'Entrada',
                    `${isExpense ? '-' : '+'} R$ ${amt.toFixed(2)}`
                ];
            });

            autoTable(doc, {
                head: detailHeaders,
                body: detailBody,
                startY: nextY + 4,
                margin: { top: 38, bottom: 18, left: 10, right: 10 },
                theme: 'striped',
                headStyles: { fillColor: [249, 115, 22], fontSize: 7.5, fontStyle: 'bold' },
                bodyStyles: { fontSize: 6.5 },
                styles: { cellPadding: 2 }
            });
        } else {
            // Sintético
            const summaryHeaders = [["Indicador Financeiro", "Valor (R$)"]];
            const summaryBody = [
                ["Total Entradas (Dízimos, Ofertas, Doações)", `R$ ${totals.income.toFixed(2)}`],
                ["Total Saídas (Despesas Operacionais, Manutenção)", `R$ ${totals.expenses.toFixed(2)}`],
                ["Saldo Operacional Líquido", `R$ ${totals.balance.toFixed(2)}`],
                ["Lançamentos Pendentes de Conciliação", `R$ ${totals.pending.toFixed(2)}`]
            ];

            autoTable(doc, {
                head: summaryHeaders,
                body: summaryBody,
                startY: 38,
                margin: { top: 38, bottom: 18, left: 10, right: 10 },
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], fontSize: 9, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 },
                styles: { cellPadding: 3 }
            });

            const categoryHeaders = [["Categoria de Saída", "Lançamentos", "Montante Total (R$)", "% do Total"]];
            const categoryBody = expenseCategories.map(c => [
                c.category,
                String(c.count),
                `R$ ${c.amount.toFixed(2)}`,
                totals.expenses > 0 ? `${((c.amount / totals.expenses) * 100).toFixed(1)}%` : '0%'
            ]);

            const summaryFinalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 80;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("DEMONSTRATIVO DE SAÍDAS POR CATEGORIA", 10, summaryFinalY);

            autoTable(doc, {
                head: categoryHeaders,
                body: categoryBody,
                startY: summaryFinalY + 4,
                margin: { top: 38, bottom: 18, left: 10, right: 10 },
                theme: 'striped',
                headStyles: { fillColor: [249, 115, 22], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                styles: { cellPadding: 2 }
            });
        }

        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 120;

        // Draw Pastor and Treasurer Signatures
        drawChurchFooterSignatures(doc, targetChurch, finalY);

        // Apply Header and Page Numbers
        applyHeadersAndPageNumbers(doc, targetChurch, title, subtitle);

        doc.save(filename);
    },

    /**
     * Exporta o Balancete em CSV.
     */
    downloadBalanceteCsv: (
        totals: { income: number; expenses: number; balance: number; pending: number }, 
        expenseCategories: any[], 
        filename: string = 'balancete.csv',
        balanceteType: 'sintetico' | 'analitico' | 'contabil' = 'sintetico',
        rawTransactions: any[] = [],
        incomeCategories: any[] = []
    ) => {
        const lines: string[] = [];

        if (balanceteType === 'contabil') {
            lines.push("CODIGO;PLANO DE CONTAS;TIPO;ENTRADAS (R$);SAIDAS (R$);SALDO (R$)");
            lines.push(`"1.0.00";"RECEITAS OPERACIONAIS";"GRUPO";"${totals.income.toFixed(2).replace('.', ',')}";"0,00";"${totals.income.toFixed(2).replace('.', ',')}"`);
            incomeCategories.forEach((c, idx) => {
                lines.push(`"1.1.0${idx + 1}";"${c.category.replace(/;/g, ' ')}";"CREDITO";"${c.amount.toFixed(2).replace('.', ',')}";"0,00";"${c.amount.toFixed(2).replace('.', ',')}"`);
            });
            lines.push(`"2.0.00";"DESPESAS OPERACIONAIS";"GRUPO";"0,00";"${totals.expenses.toFixed(2).replace('.', ',')}";"-${totals.expenses.toFixed(2).replace('.', ',')}"`);
            expenseCategories.forEach((c, idx) => {
                lines.push(`"2.1.0${idx + 1}";"${c.category.replace(/;/g, ' ')}";"DEBITO";"0,00";"${c.amount.toFixed(2).replace('.', ',')}";"-${c.amount.toFixed(2).replace('.', ',')}"`);
            });
            lines.push(`"3.0.00";"RESULTADO LIQUIDO";"SALDO";"${totals.income.toFixed(2).replace('.', ',')}";"${totals.expenses.toFixed(2).replace('.', ',')}";"${totals.balance.toFixed(2).replace('.', ',')}"`);
        } else if (balanceteType === 'analitico') {
            lines.push("DATA;HISTORICO;CONTRIBUINTE/FAVORECIDO;CATEGORIA;TIPO;VALOR (R$)");
            rawTransactions.forEach(tx => {
                const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
                const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                const desc = (tx.desc || tx.description || tx.historico || 'Lançamento').replace(/;/g, ' ');
                const payer = (tx.payer || tx.contribuinte || tx.nome || '---').replace(/;/g, ' ');
                const cat = (tx.category || tx.categoria || 'Geral').replace(/;/g, ' ');
                lines.push(`"${tx.date || '---'}";"${desc}";"${payer}";"${cat}";"${isExpense ? 'Saída' : 'Entrada'}";"${(isExpense ? -amt : amt).toFixed(2).replace('.', ',')}"`);
            });
        } else {
            lines.push("INDICADOR;VALOR (R$)");
            lines.push(`"Total Entradas";"${totals.income.toFixed(2).replace('.', ',')}"`);
            lines.push(`"Total Saídas";"${totals.expenses.toFixed(2).replace('.', ',')}"`);
            lines.push(`"Saldo Operacional";"${totals.balance.toFixed(2).replace('.', ',')}"`);
            lines.push(`"Pendentes de Conciliação";"${totals.pending.toFixed(2).replace('.', ',')}"`);
            lines.push("");
            lines.push("CATEGORIA DE SAÍDA;LANÇAMENTOS;VALOR TOTAL (R$);REPRESENTATIVIDADE");

            expenseCategories.forEach(cat => {
                const perc = totals.expenses > 0 ? ((cat.amount / totals.expenses) * 100).toFixed(1) + '%' : '0%';
                lines.push(`"${cat.category.replace(/;/g, ' ')}";"${cat.count}";"${cat.amount.toFixed(2).replace('.', ',')}";"${perc}"`);
            });
        }

        const csvContent = '\uFEFF' + lines.join('\n');
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
     * Exporta o Balancete em OFX.
     */
    downloadBalanceteOfx: (totals: { income: number; expenses: number; balance: number; pending: number }, expenseCategories: any[], filename: string = 'balancete_sintetico.ofx') => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);

        const itemsOfx = [
            `<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>${timestamp.slice(0, 8)}120000</DTPOSTED><TRNAMT>${totals.income.toFixed(2)}</TRNAMT><FITID>BAL-INC-01</FITID><MEMO>TOTAL ENTRADAS BRUTAS</MEMO></STMTTRN>`,
            `<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>${timestamp.slice(0, 8)}120000</DTPOSTED><TRNAMT>-${totals.expenses.toFixed(2)}</TRNAMT><FITID>BAL-EXP-01</FITID><MEMO>TOTAL SAIDAS OPERACIONAIS</MEMO></STMTTRN>`,
            ...expenseCategories.map((c, idx) => 
                `<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>${timestamp.slice(0, 8)}120000</DTPOSTED><TRNAMT>-${c.amount.toFixed(2)}</TRNAMT><FITID>BAL-CAT-${idx+1}</FITID><MEMO>SAIDA CATEGORIA: ${c.category.replace(/[<>&]/g, '').toUpperCase()}</MEMO></STMTTRN>`
            )
        ].join('\n');

        const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<DTSERVER>${timestamp}</DTSERVER>
<LANGUAGE>POR</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${timestamp}</TRNUID>
<STATUS>
<CODE>0</CODE>
<SEVERITY>INFO</SEVERITY>
</STATUS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>0000</BANKID>
<ACCTID>IDENTIFICAPIX_BALANCETE</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${timestamp}</DTSTART>
<DTEND>${timestamp}</DTEND>
${itemsOfx}
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

        const blob = new Blob([ofxContent], { type: 'application/x-ofx;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Imprime o Balancete (Sintético, Analítico ou Contábil) em versão de impressão HTML com cabeçalho e assinaturas.
     */
    printBalanceteHtml: (
        totals: { income: number; expenses: number; balance: number; pending: number }, 
        expenseCategories: any[], 
        incomeCategories: any[], 
        rawTransactions: any[], 
        churches: any[], 
        title: string = 'Balancete Financeiro', 
        selectedChurchId?: string, 
        balanceteType: 'sintetico' | 'analitico' | 'contabil' = 'sintetico'
    ) => {
        const targetChurch = resolveChurch(churches, selectedChurchId);
        const churchName = targetChurch?.name || 'IGREJA EVANGÉLICA - MATRIZ SEDE';
        const cnpj = targetChurch?.cnpj || targetChurch?.cnpJ || '00.000.000/0001-00';
        const address = targetChurch?.address || 'Endereço Institucional';
        const pastorName = targetChurch?.pastor || targetChurch?.pastorName || 'Pr. Responsável';
        const treasurerName = targetChurch?.treasurer || targetChurch?.treasurerName || 'Tesoureiro Geral';
        const logoUrl = targetChurch?.logoUrl || targetChurch?.logo || '';
        const dateFormatted = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const cityState = targetChurch?.city ? `${targetChurch.city} - ${targetChurch.state || 'UF'}` : 'Sede Principal';

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        let tableHtml = '';
        if (balanceteType === 'contabil') {
            tableHtml = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px;">
                    <thead>
                        <tr style="background: #0f172a; color: white;">
                            <th style="padding: 8px; text-align: left;">Código</th>
                            <th style="padding: 8px; text-align: left;">Plano de Contas</th>
                            <th style="padding: 8px; text-align: center;">Tipo</th>
                            <th style="padding: 8px; text-align: right;">Entradas (R$)</th>
                            <th style="padding: 8px; text-align: right;">Saídas (R$)</th>
                            <th style="padding: 8px; text-align: right;">Saldo (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #f8fafc; font-weight: bold;">
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">1.0.00</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">RECEITAS OPERACIONAIS</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">GRUPO</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #16a34a;">R$ ${totals.income.toFixed(2)}</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">R$ 0,00</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #16a34a;">R$ ${totals.income.toFixed(2)}</td>
                        </tr>
                        ${incomeCategories.map((c, i) => `
                            <tr>
                                <td style="padding: 5px 6px 5px 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">1.1.0${i + 1}</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; padding-left: 15px;">${c.category}</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #16a34a;">Crédito</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">R$ ${c.amount.toFixed(2)}</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">R$ 0,00</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; color: #16a34a;">R$ ${c.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background: #f8fafc; font-weight: bold;">
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">2.0.00</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">DESPESAS OPERACIONAIS</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">GRUPO</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">R$ 0,00</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626;">R$ ${totals.expenses.toFixed(2)}</td>
                            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626;">- R$ ${totals.expenses.toFixed(2)}</td>
                        </tr>
                        ${expenseCategories.map((c, i) => `
                            <tr>
                                <td style="padding: 5px 6px 5px 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">2.1.0${i + 1}</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; padding-left: 15px;">${c.category}</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #dc2626;">Débito</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">R$ 0,00</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace;">R$ ${c.amount.toFixed(2)}</td>
                                <td style="padding: 5px 6px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; color: #dc2626;">- R$ ${c.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background: #0f172a; color: white; font-weight: bold;">
                            <td style="padding: 8px;">3.0.00</td>
                            <td style="padding: 8px;">RESULTADO OPERACIONAL LÍQUIDO</td>
                            <td style="padding: 8px; text-align: center;">BALANÇO</td>
                            <td style="padding: 8px; text-align: right;">R$ ${totals.income.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: right;">R$ ${totals.expenses.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: right;">R$ ${totals.balance.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            `;
        } else if (balanceteType === 'analitico') {
            tableHtml = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px;">
                    <thead>
                        <tr style="background: #f97316; color: white;">
                            <th style="padding: 7px; text-align: left;">Data</th>
                            <th style="padding: 7px; text-align: left;">Histórico / Descrição</th>
                            <th style="padding: 7px; text-align: left;">Pessoa / Favorecido</th>
                            <th style="padding: 7px; text-align: left;">Categoria</th>
                            <th style="padding: 7px; text-align: center;">Descrição</th>
                            <th style="padding: 7px; text-align: right;">Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rawTransactions.map((tx, idx) => {
                            const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
                            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
                            return `
                                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fff7ed'}; border-bottom: 1px solid #fed7aa;">
                                    <td style="padding: 5px 7px;">${tx.date || '---'}</td>
                                    <td style="padding: 5px 7px; font-weight: 600;">${(tx.desc || tx.description || tx.historico || 'Lançamento').toUpperCase()}</td>
                                    <td style="padding: 5px 7px; color: #475569;">${tx.payer || tx.contribuinte || tx.nome || '---'}</td>
                                    <td style="padding: 5px 7px;">${tx.category || tx.categoria || 'Geral'}</td>
                                    <td style="padding: 5px 7px; text-align: center; font-weight: bold; color: ${isExpense ? '#dc2626' : '#16a34a'};">${isExpense ? 'Saída' : 'Entrada'}</td>
                                    <td style="padding: 5px 7px; text-align: right; font-family: monospace; font-weight: bold; color: ${isExpense ? '#dc2626' : '#16a34a'};">
                                        ${isExpense ? '-' : '+'} R$ ${amt.toFixed(2)}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            tableHtml = `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px; margin-bottom: 15px;">
                    <div style="padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc;">
                        <span style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #64748b;">Entradas Totais</span>
                        <div style="font-size: 16px; font-weight: bold; color: #16a34a; font-family: monospace; margin-top: 4px;">R$ ${totals.income.toFixed(2)}</div>
                    </div>
                    <div style="padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc;">
                        <span style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #64748b;">Saídas Totais</span>
                        <div style="font-size: 16px; font-weight: bold; color: #dc2626; font-family: monospace; margin-top: 4px;">R$ ${totals.expenses.toFixed(2)}</div>
                    </div>
                    <div style="padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc;">
                        <span style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #64748b;">Saldo Operacional</span>
                        <div style="font-size: 16px; font-weight: bold; color: #0f172a; font-family: monospace; margin-top: 4px;">R$ ${totals.balance.toFixed(2)}</div>
                    </div>
                </div>

                <h3 style="font-size: 12px; font-weight: bold; text-transform: uppercase; margin-top: 20px; color: #0f172a; border-bottom: 2px solid #f97316; padding-bottom: 4px;">
                    Demonstrativo de Saídas por Categoria
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
                    <thead>
                        <tr style="background: #0f172a; color: white;">
                            <th style="padding: 7px; text-align: left;">Categoria</th>
                            <th style="padding: 7px; text-align: center;">Lançamentos</th>
                            <th style="padding: 7px; text-align: right;">Montante Total (R$)</th>
                            <th style="padding: 7px; text-align: right;">Representatividade (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expenseCategories.map((cat, idx) => {
                            const perc = totals.expenses > 0 ? ((cat.amount / totals.expenses) * 100).toFixed(1) : '0';
                            return `
                                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 6px 7px; font-weight: bold; color: #334155;">${cat.category}</td>
                                    <td style="padding: 6px 7px; text-align: center; color: #64748b;">${cat.count}</td>
                                    <td style="padding: 6px 7px; text-align: right; font-family: monospace; font-weight: bold; color: #dc2626;">R$ ${cat.amount.toFixed(2)}</td>
                                    <td style="padding: 6px 7px; text-align: right; font-weight: bold; color: #475569;">${perc}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { size: A4 portrait; margin: 12mm; }
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; }
                        .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
                        .logo { max-height: 55px; max-width: 130px; object-fit: contain; }
                        .church-title { font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0; }
                        .church-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
                        .report-title { font-size: 13px; font-weight: 800; color: #ea580c; text-align: right; text-transform: uppercase; margin: 0; }
                        .footer-signatures { margin-top: 40px; page-break-inside: avoid; }
                        .sig-container { display: flex; justify-content: space-around; gap: 40px; }
                        .sig-block { flex: 1; text-align: center; }
                        .sig-line { border-top: 1px solid #475569; margin-bottom: 6px; width: 80%; margin-left: auto; margin-right: auto; }
                        .sig-name { font-size: 11px; font-weight: bold; color: #0f172a; display: block; }
                        .sig-role { font-size: 9px; color: #64748b; display: block; }
                    </style>
                </head>
                <body>
                    <table class="header-table">
                        <tr>
                            <td style="width: 70px;">
                                ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : `<div style="width: 50px; height: 50px; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; border-radius: 8px;">IgG</div>`}
                            </td>
                            <td>
                                <h1 class="church-title">${churchName}</h1>
                                <div class="church-sub">CNPJ: ${cnpj} | ${address}</div>
                            </td>
                            <td style="text-align: right;">
                                <h2 class="report-title">${title}</h2>
                                <div style="font-size: 10px; color: #64748b;">Emissão: ${dateFormatted}</div>
                            </td>
                        </tr>
                    </table>

                    ${tableHtml}

                    <div class="footer-signatures">
                        <p style="text-align: center; font-size: 10px; color: #64748b; font-weight: 600; margin-bottom: 25px;">
                            ${cityState}, ${dateFormatted}
                        </p>
                        <div class="sig-container">
                            <div class="sig-block">
                                <div class="sig-line"></div>
                                <span class="sig-name">${pastorName}</span>
                                <span class="sig-role">Pastor Presidente / Responsável</span>
                            </div>
                            <div class="sig-block">
                                <div class="sig-line"></div>
                                <span class="sig-name">${treasurerName}</span>
                                <span class="sig-role">Tesoureiro / Resp. Financeiro</span>
                            </div>
                        </div>
                    </div>

                    <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }
};

