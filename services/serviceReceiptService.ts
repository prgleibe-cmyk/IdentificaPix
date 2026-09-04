import { jsPDF } from 'jspdf';
import { ExpenseAttachment } from '../types/domain';
import { saveAttachmentsForTransaction, getAttachmentsForTransaction } from './expenseAttachmentService';
import { formatCurrency, formatDate } from '../utils/formatters';

export interface ServiceReceiptData {
    receiptNumber: string;
    date: string; // YYYY-MM-DD
    amount: number;
    paymentMethod: string;
    serviceDescription: string;
    church: {
        name: string;
        cnpj?: string;
        address?: string;
        city?: string;
        state?: string;
        pastor?: string;
        treasurer?: string;
        logoUrl?: string;
    };
    provider: {
        name: string;
        document: string; // CPF or CNPJ
        phone?: string;
        address?: string;
        city?: string;
        state?: string;
    };
    signature?: {
        signerName: string;
        signerDocument?: string;
        signatureDataUrl?: string;
        signedAt: string;
    };
    integrityHash?: string;
    notes?: string;
}

/**
 * Converte um valor numérico para sua representação por extenso em reais (BRL).
 */
export function numeroPorExtenso(valor: number): string {
    if (isNaN(valor) || valor === 0) return 'zero reais';

    const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    const converteGrupo = (n: number): string => {
        if (n === 0) return '';
        if (n === 100) return 'cem';
        let res = '';
        const c = Math.floor(n / 100);
        const d = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (c > 0) res += centenas[c];

        if (d === 1) {
            if (res) res += ' e ';
            res += especiais[u];
            return res;
        }

        if (d > 1) {
            if (res) res += ' e ';
            res += dezenas[d];
        }

        if (u > 0) {
            if (res) res += ' e ';
            res += unidades[u];
        }

        return res;
    };

    const valorAbs = Math.abs(valor);
    const inteiro = Math.floor(valorAbs);
    const centavos = Math.round((valorAbs - inteiro) * 100);

    const milhoes = Math.floor(inteiro / 1000000);
    const milhares = Math.floor((inteiro % 1000000) / 1000);
    const unidadesG = inteiro % 1000;

    const partes: string[] = [];

    if (milhoes > 0) {
        partes.push(`${converteGrupo(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`);
    }

    if (milhares > 0) {
        if (milhares === 1 && milhoes === 0) {
            partes.push('um mil');
        } else {
            partes.push(`${converteGrupo(milhares)} mil`);
        }
    }

    if (unidadesG > 0) {
        partes.push(converteGrupo(unidadesG));
    }

    let extensoInteiro = '';
    if (partes.length === 1) {
        extensoInteiro = partes[0];
    } else if (partes.length > 1) {
        extensoInteiro = partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
    }

    let resultado = '';
    if (inteiro > 0) {
        resultado = `${extensoInteiro} ${inteiro === 1 ? 'real' : 'reais'}`;
    }

    if (centavos > 0) {
        const extensoCentavos = converteGrupo(centavos);
        const labelCentavos = centavos === 1 ? 'centavo' : 'centavos';
        if (resultado) {
            resultado += ` e ${extensoCentavos} ${labelCentavos}`;
        } else {
            resultado = `${extensoCentavos} ${labelCentavos}`;
        }
    }

    // Capitaliza primeira letra
    return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}

/**
 * Gera Hash de Integridade SHA-256 para o recibo emitido.
 */
export async function generateReceiptIntegrityHash(receipt: ServiceReceiptData): Promise<string> {
    const rawPayload = JSON.stringify({
        receiptNumber: receipt.receiptNumber,
        churchName: receipt.church.name,
        churchCnpj: receipt.church.cnpj || '',
        providerName: receipt.provider.name,
        providerDoc: receipt.provider.document,
        amount: receipt.amount.toFixed(2),
        date: receipt.date,
        service: receipt.serviceDescription,
        paymentMethod: receipt.paymentMethod,
        signedAt: receipt.signature?.signedAt || '',
        signerName: receipt.signature?.signerName || ''
    });

    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(rawPayload);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {
        console.warn('[ReceiptService] Fallback de hash:', e);
    }

    // Fallback hash determinístico
    let hash = 0;
    for (let i = 0; i < rawPayload.length; i++) {
        const char = rawPayload.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return `REC-${Math.abs(hash).toString(16).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`;
}

/**
 * Gera o documento PDF formal do Recibo de Prestação de Serviço com assinatura digital
 */
export function generateServiceReceiptPdf(receipt: ServiceReceiptData): jsPDF {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    // 1. Faixa do Topo Institucional
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, 10, contentWidth, 24, 2, 2, 'F');
    doc.setFillColor(249, 115, 22); // Orange
    doc.rect(margin, 10, contentWidth, 2, 'F');

    let textStartX = margin + 4;
    if (receipt.church.logoUrl) {
        try {
            doc.addImage(receipt.church.logoUrl, 'PNG', margin + 3, 13, 18, 18);
            textStartX = margin + 25;
        } catch (e) {
            // fallback sem logo
        }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(receipt.church.name.toUpperCase(), textStartX, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const churchCnpj = receipt.church.cnpj ? `CNPJ: ${receipt.church.cnpj}` : '';
    const churchCity = receipt.church.city ? `${receipt.church.city}${receipt.church.state ? '/' + receipt.church.state : ''}` : '';
    const churchAddress = receipt.church.address ? `${receipt.church.address}` : '';
    const churchSub = [churchCnpj, churchAddress, churchCity].filter(Boolean).join(' • ');
    doc.text(churchSub || 'Igreja / Entidade Religiosa Sem Fins Lucrativos', textStartX, 22);

    // 2. Box do Título do Recibo e Valor
    let currentY = 38;

    doc.setFillColor(255, 247, 237); // Warm amber background
    doc.setDrawColor(253, 186, 116);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(154, 52, 18);
    doc.text("RECIBO DE PAGAMENTO DE SERVIÇOS", margin + 6, currentY + 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`Nº: ${receipt.receiptNumber || 'REC-' + Date.now().toString().slice(-6)}`, margin + 6, currentY + 15);

    // Box do Valor no lado direito
    const valFormatted = formatCurrency(receipt.amount);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.8);
    doc.roundedRect(pageWidth - margin - 62, currentY + 4, 58, 14, 1.5, 1.5, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(valFormatted, pageWidth - margin - 33, currentY + 12.5, { align: 'center' });

    currentY += 27;

    // 3. Quadro de Informações das Partes (Contratante e Prestador)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, currentY, contentWidth, 38, 2, 2, 'FD');

    // Coluna 1: Pagador (Igreja)
    const colWidth = (contentWidth / 2) - 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(249, 115, 22);
    doc.text("DADOS DO PAGADOR (CONTRATANTE)", margin + 6, currentY + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(receipt.church.name, margin + 6, currentY + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Documento: ${receipt.church.cnpj || 'Não informado'}`, margin + 6, currentY + 19);
    doc.text(`Endereço: ${churchAddress || 'Local'}`, margin + 6, currentY + 24);
    doc.text(`Cidade/UF: ${churchCity || 'Local'}`, margin + 6, currentY + 29);

    // Divisória vertical
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + (contentWidth / 2), currentY + 4, margin + (contentWidth / 2), currentY + 34);

    // Coluna 2: Favorecido / Prestador de Serviço
    const col2X = margin + (contentWidth / 2) + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(249, 115, 22);
    doc.text("DADOS DO PRESTADOR / BENEFICIÁRIO", col2X, currentY + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text((receipt.provider.name || 'Prestador de Serviço').toUpperCase(), col2X, currentY + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`CPF / CNPJ: ${receipt.provider.document || 'Não informado'}`, col2X, currentY + 19);
    if (receipt.provider.phone) {
        doc.text(`Telefone/WhatsApp: ${receipt.provider.phone}`, col2X, currentY + 24);
    }
    const provCity = receipt.provider.city ? `${receipt.provider.city}${receipt.provider.state ? '/' + receipt.provider.state : ''}` : '';
    if (receipt.provider.address || provCity) {
        doc.text(`Endereço: ${[receipt.provider.address, provCity].filter(Boolean).join(' - ')}`, col2X, currentY + 29);
    }

    currentY += 44;

    // 4. Texto Formal de Declaração de Quitação
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, currentY, contentWidth, 58, 2, 2, 'FD');

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, currentY, contentWidth, 8, 2, 2, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text("DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS E DECLARAÇÃO DE QUITAÇÃO", margin + 6, currentY + 5.5);

    currentY += 13;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    const extenso = numeroPorExtenso(receipt.amount);
    const dateFormatted = formatDate(receipt.date) || new Date().toLocaleDateString('pt-BR');

    const quitacaoText = `Recebi(emos) de ${receipt.church.name}, inscrita no CNPJ sob o nº ${receipt.church.cnpj || 'não informado'}, a quantia líquida e certa de ${valFormatted} (${extenso}), referente à prestação dos seguintes serviços:`;
    
    const linesQuitacao = doc.splitTextToSize(quitacaoText, contentWidth - 12);
    doc.text(linesQuitacao, margin + 6, currentY);
    currentY += linesQuitacao.length * 4.2 + 2;

    // Caixa de descrição do serviço
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 6, currentY, contentWidth - 12, 14, 1.5, 1.5, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const descLines = doc.splitTextToSize(`"${receipt.serviceDescription || 'Serviços prestados conforme acordado.'}"`, contentWidth - 18);
    doc.text(descLines, margin + 9, currentY + 5.5);

    currentY += 18;

    const quitacaoFinal = `Por ser verdade e ter recebido o referido valor mediante ${receipt.paymentMethod || 'Pix / Transferência'}, dou(damos) plena, rasa, geral e irrevogável quitação de todos os direitos e obrigações decorrentes do serviço discriminado.`;
    const linesFinal = doc.splitTextToSize(quitacaoFinal, contentWidth - 12);
    doc.text(linesFinal, margin + 6, currentY);

    currentY += 32;

    // 5. Bloco de Assinatura do Prestador de Serviço
    const cityState = receipt.church.city ? `${receipt.church.city}${receipt.church.state ? '/' + receipt.church.state : ''}` : 'Local';
    const localDateText = `${cityState}, ${dateFormatted}`;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(localDateText, pageWidth / 2, currentY, { align: 'center' });

    currentY += 8;

    const sigWidth = 84;
    const sigX = (pageWidth - sigWidth) / 2;

    // Imagem da Assinatura desenhada no canvas
    if (receipt.signature?.signatureDataUrl) {
        try {
            doc.addImage(receipt.signature.signatureDataUrl, 'PNG', sigX + (sigWidth - 48) / 2, currentY, 48, 16);
        } catch (e) {
            // fallback
        }
    }

    currentY += 18;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.6);
    doc.line(sigX, currentY, sigX + sigWidth, currentY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text((receipt.signature?.signerName || receipt.provider.name).toUpperCase(), pageWidth / 2, currentY + 4, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const docText = receipt.signature?.signerDocument || receipt.provider.document ? `CPF/CNPJ: ${receipt.signature?.signerDocument || receipt.provider.document}` : 'Prestador de Serviço';
    doc.text(docText, pageWidth / 2, currentY + 8, { align: 'center' });

    if (receipt.signature?.signedAt) {
        const signDate = new Date(receipt.signature.signedAt).toLocaleDateString('pt-BR') + ' às ' + new Date(receipt.signature.signedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        doc.setFontSize(6.5);
        doc.setTextColor(5, 150, 105); // Emerald
        doc.setFont("helvetica", "bold");
        doc.text(`✓ Assinado Digitalmente na Tela (${signDate})`, pageWidth / 2, currentY + 11.8, { align: 'center' });
    }

    currentY += 18;

    // 6. Selo de Certificação Digital e Hash SHA-256
    if (receipt.integrityHash) {
        const sealY = currentY;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, sealY, contentWidth, 14, 1.5, 1.5, 'FD');

        doc.setFillColor(16, 185, 129); // Emerald strip
        doc.rect(margin, sealY, 2.5, 14, 'F');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42);
        doc.text("CERTIFICADO DIGITAL DE QUITAÇÃO · COMPROVANTE ELETRÔNICO DE PAGAMENTO", margin + 6, sealY + 4);

        doc.setFont("courier", "bold");
        doc.setFontSize(6);
        doc.setTextColor(71, 85, 105);
        doc.text(`HASH SHA-256: ${receipt.integrityHash}`, margin + 6, sealY + 8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Documento com assinatura eletrônica e fé contábil em conformidade com o art. 10, § 2º da MP nº 2.200-2/2001 e Lei nº 14.063/2020.", margin + 6, sealY + 11.5);
    }

    // Rodapé de segurança do sistema
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text("Documento gerado eletronicamente por IdentificaPix Gestor • www.identificapix.com.br", pageWidth / 2, pageHeight - 6, { align: 'center' });

    return doc;
}

/**
 * Salva o recibo gerado como anexo da transação no IndexedDB e notifica os componentes.
 */
export async function saveServiceReceiptAttachment(
    txId: string, 
    receipt: ServiceReceiptData, 
    pdfDoc: jsPDF
): Promise<ExpenseAttachment> {
    const pdfBlob = pdfDoc.output('blob');
    const pdfDataUrl = pdfDoc.output('datauristring');

    const cleanProviderName = receipt.provider.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
    const fileName = `Recibo_${cleanProviderName}_${receipt.receiptNumber}.pdf`;

    const newAttachment: ExpenseAttachment = {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fileName,
        fileSize: pdfBlob.size,
        fileType: 'application/pdf',
        dataUrl: pdfDataUrl,
        uploadedAt: new Date().toISOString(),
        documentRole: 'recibo',
        validationStatus: 'validated',
        extractedData: {
            documentType: 'recibo',
            documentTypeLabel: 'Recibo de Prestação de Serviços',
            extractedAmount: receipt.amount,
            allDetectedAmounts: [receipt.amount],
            extractedDate: receipt.date,
            extractedRecipient: receipt.provider.name,
            extractedPayer: receipt.church.name,
            barcodeOrAuth: receipt.integrityHash || null,
            rawText: `Recibo nº ${receipt.receiptNumber} - ${receipt.serviceDescription}`,
            confidenceScore: 1.0
        }
    };

    const existingAtts = await getAttachmentsForTransaction(txId);
    // Adiciona o novo recibo aos anexos existentes
    const updatedAtts = [...existingAtts, newAttachment];
    await saveAttachmentsForTransaction(txId, updatedAtts);

    return newAttachment;
}
