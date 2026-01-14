
import { FileModel } from '../../types';
import { CanonicalDocumentNormalizer } from './CanonicalDocumentNormalizer';

// Detecta delimitador de forma estatística
export const detectDelimiter = (line: string): string => {
    const candidates = [';', ',', '\t', '|'];
    const counts = candidates.map(char => ({ char, count: line.split(char).length - 1 }));
    counts.sort((a, b) => b.count - a.count);
    return counts[0].count > 0 ? counts[0].char : ';';
};

// Gera o DNA do arquivo (Structural Signature) para reconhecimento independente de formato
export const generateFingerprint = (content: string): FileModel['fingerprint'] | null => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return null;

    const delimiter = detectDelimiter(lines[0]);
    const header = lines[0];
    const cells = header.split(delimiter);
    
    // --- ASSINATURA ESTRUTURAL LEGADA (Retrocompatibilidade) ---
    const normalizedHeader = header.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const headerHash = normalizedHeader.split('').reduce((a, b) => { 
        a = ((a << 5) - a) + b.charCodeAt(0); 
        return a & a; 
    }, 0).toString(36);

    // --- ASSINATURA CANÔNICA (Hash de Conteúdo - Formato Agnóstico) ---
    const canonicalSignature = CanonicalDocumentNormalizer.generateSignature(lines);

    // --- PADRÃO ESTRUTURAL LÓGICO (Canonical Document Shape - CDS) ---
    // Este é o campo CRÍTICO para unificação PDF/IMG/XLS.
    // Ele representa a sequência lógica de entidades (ex: "DT-TX-NM").
    const structuralPattern = CanonicalDocumentNormalizer.generateStructuralPattern(lines);

    // Topologia simples (N=Number, S=String) das primeiras linhas
    // Mantida para compatibilidade com lógica antiga de desempate
    const dataRows = lines.slice(1, 6);
    let topology = "";
    if (dataRows.length > 0) {
        // Tenta pegar uma linha que tenha o mesmo número de colunas do header
        const sampleRow = dataRows.find(r => r.split(delimiter).length === cells.length) || dataRows[0];
        topology = sampleRow.split(delimiter).map(c => {
            const clean = c.trim().replace(/[R$\s]/g, '').replace(',', '.');
            return isNaN(parseFloat(clean)) ? 'S' : 'N';
        }).join(',');
    }

    return { 
        columnCount: cells.length, 
        delimiter, // Mantém o delimitador detectado para uso no parser
        headerHash, 
        dataTopology: topology,
        canonicalSignature,
        structuralPattern // O "DNA" Lógico Unificado
    };
};
