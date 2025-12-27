
import { FileModel } from '../../types';

// Detecta delimitador de forma estatística
export const detectDelimiter = (line: string): string => {
    const candidates = [';', ',', '\t', '|'];
    const counts = candidates.map(char => ({ char, count: line.split(char).length - 1 }));
    counts.sort((a, b) => b.count - a.count);
    return counts[0].count > 0 ? counts[0].char : ';';
};

// Gera o DNA do arquivo para que o Laboratório consiga salvar/carregar modelos
export const generateFingerprint = (content: string): FileModel['fingerprint'] | null => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return null;

    const delimiter = detectDelimiter(lines[0]);
    const header = lines[0];
    const cells = header.split(delimiter);
    
    // Hash simples do cabeçalho (checksum dos caracteres)
    const headerHash = header.split('').reduce((a, b) => { 
        a = ((a << 5) - a) + b.charCodeAt(0); 
        return a & a; 
    }, 0).toString(36);

    // Topologia simples (N=Number, S=String) das primeiras linhas
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
        delimiter, 
        headerHash, 
        dataTopology: topology 
    };
};
