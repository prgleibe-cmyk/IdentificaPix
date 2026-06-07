import React from 'react';
import { getBankIdentity } from './bankIdentity';

export type BankKey = 
    | 'SICREDI' 
    | 'SICOOB' 
    | 'BB' 
    | 'CAIXA' 
    | 'BRADESCO' 
    | 'ITAU' 
    | 'SANTANDER' 
    | 'NUBANK' 
    | 'INTER' 
    | 'MERCADO_PAGO'
    | 'GENERIC';

export interface BankColors {
    primary: string;
    bg: string;
    border: string;
    text: string;
}

/**
 * Normaliza o nome do banco para determinar seu identificador único de marca.
 */
export const getBankKey = (name: string): BankKey => {
    if (!name) return 'GENERIC';
    const lower = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
    
    if (lower.includes('sicredi')) return 'SICREDI';
    if (lower.includes('sicoob')) return 'SICOOB';
    if (lower.includes('brasil') || lower.includes('banco do brasil') || lower.includes('bb') || lower.trim() === 'b.brasil') return 'BB';
    if (lower.includes('caixa') || lower.includes('cef') || lower.includes('economica')) return 'CAIXA';
    if (lower.includes('bradesco')) return 'BRADESCO';
    if (lower.includes('itau')) return 'ITAU';
    if (lower.includes('santander')) return 'SANTANDER';
    if (lower.includes('nubank') || lower.includes('nu pagamentos') || lower.includes('nu ')) return 'NUBANK';
    if (lower.includes('inter')) return 'INTER';
    if (lower.includes('mercado pago') || lower.includes('mercadopago')) return 'MERCADO_PAGO';
    
    return 'GENERIC';
};

/**
 * Traduz valores de identidade para a chave estrita BankKey.
 */
export const mapIdentityToBankKey = (idVal: string): BankKey => {
    const upper = idVal.toUpperCase();
    if (upper === 'BANCO_DO_BRASIL' || upper === 'BB') return 'BB';
    if (upper === 'SICREDI') return 'SICREDI';
    if (upper === 'SICOOB') return 'SICOOB';
    if (upper === 'CAIXA') return 'CAIXA';
    if (upper === 'BRADESCO') return 'BRADESCO';
    if (upper === 'ITAU') return 'ITAU';
    if (upper === 'SANTANDER') return 'SANTANDER';
    if (upper === 'NUBANK') return 'NUBANK';
    if (upper === 'INTER') return 'INTER';
    if (upper === 'MERCADO_PAGO') return 'MERCADO_PAGO';
    return 'GENERIC';
};

/**
 * Resolve a chave de banco única (BankKey) do sistema de forma 100% determinística (Fase 6):
 * 1. bank.bank_key (única fonte confiável) -> mapIdentityToBankKey(bank_key)
 * 2. Se bank_key não estiver preenchido, cai para GENERIC.
 * 3. O uso de name/includes/substring é banido da decisão primária e serve apenas
 *    como compatibilidade histórica silenciosa de último recurso para evitar quebra de UI.
 */
export const resolveBankKey = (bank: { name: string; bank_key?: string | null } | string): BankKey => {
    // Se for recebido como string, tentamos mapear diretamente
    if (typeof bank === 'string') {
        const keyFromString = mapIdentityToBankKey(bank);
        if (keyFromString !== 'GENERIC') return keyFromString;
        // Compatibilidade histórica silenciosa extra
        const legacyKey = getBankKey(bank);
        return legacyKey;
    }

    const bankObject = bank;

    // 1. bank.bank_key (Única fonte confiável e prioritária)
    if (bankObject && bankObject.bank_key) {
        const key = mapIdentityToBankKey(bankObject.bank_key);
        if (key !== 'GENERIC') return key;
    }

    // 2. getBankIdentity(bank) como segunda verificação
    const identity = getBankIdentity(bankObject);
    if (identity && identity !== 'GENERIC') {
        const keyFromIdentity = mapIdentityToBankKey(identity);
        if (keyFromIdentity !== 'GENERIC') return keyFromIdentity;
    }

    // 3. Compatibilidade histórica de último nível (não decisória)
    // Caso o registro seja legado e esteja sem bank_key cadastrada
    if (bankObject && bankObject.name) {
        const legacyKey = getBankKey(bankObject.name);
        if (legacyKey !== 'GENERIC') return legacyKey;
    }

    // 4. GENERIC (fallback visual neutro)
    return 'GENERIC';
};

/**
 * Retorna o logotipo em formato SVG do banco correspondente.
 * Utiliza React.createElement para garantir compatibilidade estrutural estrita
 * compilando perfeitamente sem depender de arquivos .tsx especiais.
 */
export const resolveBankBrand = (bank: { name: string; bank_key?: string | null } | string): React.ReactNode => {
    const key = resolveBankKey(bank);

    switch (key) {
        case 'SICREDI':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain p-1.5',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ffffff' }),
                React.createElement('g', { key: 'pinwheel', transform: 'translate(51, 51)' }, 
                    Array.from({ length: 7 }).map((_, i) => {
                        const angle = i * (360 / 7);
                        return React.createElement('g', { key: `leaf-${i}`, transform: `rotate(${angle.toFixed(2)})` }, [
                            // 1. Dark green fold (outer/left facet)
                            React.createElement('path', {
                                key: 'dark-fold',
                                d: 'M 0 -7 L -16 -35 C -24 -28, -22 -17, -17 -13 Z',
                                fill: '#006f3c'
                            }),
                            // 2. Medium green fold (middle crease facet)
                            React.createElement('path', {
                                key: 'med-fold',
                                d: 'M 0 -7 L -16 -35 C -11 -33, -6 -22, -3 -13 Z',
                                fill: '#009f4d'
                            }),
                            // 3. Light green fold (inner/right accent facet)
                            React.createElement('path', {
                                key: 'light-fold',
                                d: 'M 0 -7 L -10 -22 C -7 -20, -4 -14, -2 -9 Z',
                                fill: '#6cb33f'
                            })
                        ]);
                    })
                )
            ]);

        case 'SICOOB':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain p-1',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ffffff' }),
                React.createElement('g', { key: 'sicoob-mark', transform: 'translate(0, 2)' }, [
                    // Green segment (Top-Left)
                    React.createElement('path', {
                        key: 'green-segment',
                        d: 'M 50 22 L 24 22 C 19 22, 17.5 24.5, 19.5 28 L 33.5 52 C 34.5 53.5, 36 55.5, 38 56.5 L 40 57.5 L 50 40 Z',
                        fill: '#70bd44'
                    }),
                    // Teal segment (Top-Right)
                    React.createElement('path', {
                        key: 'teal-segment',
                        d: 'M 50 22 L 76 22 C 81 22, 82.5 24.5, 80.5 28 L 66.5 52 C 65.5 53.5, 64 55.5, 62 56.5 L 60 57.5 L 50 40 Z',
                        fill: '#00b2a9'
                    }),
                    // Lime segment (Bottom)
                    React.createElement('path', {
                        key: 'lime-segment',
                        d: 'M 40 57.5 L 60 57.5 L 66.5 52 L 53 75.5 C 51.5 78, 48.5 78, 47 75.5 L 33.5 52 Z',
                        fill: '#a3d132'
                    })
                ])
            ]);

        case 'BB':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain p-1',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ffe600' }),
                React.createElement('g', { key: 'bb-brand', transform: 'translate(50, 40)' }, [
                    // Top loop (Shape 1)
                    React.createElement('path', {
                        key: 'top-loop',
                        d: 'M -3.5 -3.5 L -16.5 -16.5 L 0 -33 L 16.5 -16.5 L 6.5 -6.5 L 0 -13 L -6.5 -6.5',
                        stroke: '#002d72',
                        strokeWidth: '4.8',
                        strokeLinecap: 'round',
                        strokeLinejoin: 'miter',
                        fill: 'none'
                    }),
                    // Bottom loop (Shape 2 - perfect 180deg rotation of the top loop)
                    React.createElement('path', {
                        key: 'bottom-loop',
                        d: 'M 3.5 3.5 L 16.5 16.5 L 0 33 L -16.5 16.5 L -6.5 6.5 L 0 13 L 6.5 6.5',
                        stroke: '#002d72',
                        strokeWidth: '4.8',
                        strokeLinecap: 'round',
                        strokeLinejoin: 'miter',
                        fill: 'none'
                    }),
                    // Top-right accent slash
                    React.createElement('line', {
                        key: 'top-slash',
                        x1: '14.5',
                        y1: '-22.5',
                        x2: '21.5',
                        y2: '-15.5',
                        stroke: '#002d72',
                        strokeWidth: '4.8',
                        strokeLinecap: 'round'
                    }),
                    // Bottom-left accent slash
                    React.createElement('line', {
                        key: 'bottom-slash',
                        x1: '-21.5',
                        y1: '15.5',
                        x2: '-14.5',
                        y2: '22.5',
                        stroke: '#002d72',
                        strokeWidth: '4.8',
                        strokeLinecap: 'round'
                    })
                ]),
                React.createElement('text', {
                    key: 'bb-text',
                    x: '50',
                    y: '80',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    fontSize: '7.8',
                    fontWeight: '900',
                    fill: '#002d72',
                    textAnchor: 'middle',
                    letterSpacing: '-0.3'
                }, 'BANCO DO BRASIL')
            ]);

        case 'CAIXA':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain p-1',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ffffff' }),
                React.createElement('g', { key: 'caixa-brand', transform: 'translate(4, 2)' }, [
                    // C
                    React.createElement('path', {
                        key: 'char-c',
                        d: 'M 22,36 L 12,36 C 9,36 7,38 7,50 C 7,62 9,64 12,64 L 22,64 L 22,55 L 14,55 C 13,55 13,53 13,50 C 13,47 13,45 14,45 L 22,45 Z',
                        fill: '#3c628e'
                    }),
                    // A
                    React.createElement('path', {
                        key: 'char-a1',
                        d: 'M 25,64 L 30,64 L 31.5,52 L 37.5,52 L 39,64 L 44,64 L 38,36 L 31,36 Z',
                        fill: '#3c628e'
                    }),
                    React.createElement('polygon', {
                        key: 'char-a1-hole',
                        points: '33.5,45 35.5,45 34.5,39',
                        fill: '#ffffff'
                    }),
                    // I
                    React.createElement('path', {
                        key: 'char-i',
                        d: 'M 47,36 L 52,36 L 52,64 L 47,64 Z',
                        fill: '#3c628e'
                    }),
                    // X - Blue segment
                    React.createElement('polygon', {
                        key: 'char-x-blue',
                        points: '55,36 60,36 71,64 66,64',
                        fill: '#3c628e'
                    }),
                    // X - Orange segment
                    React.createElement('polygon', {
                        key: 'char-x-orange',
                        points: '55,64 60,64 71,36 66,36',
                        fill: '#f29325'
                    }),
                    // A
                    React.createElement('path', {
                        key: 'char-a2',
                        d: 'M 74,64 L 79,64 L 80.5,52 L 86.5,52 L 88,64 L 93,64 L 87,36 L 80,36 Z',
                        fill: '#3c628e'
                    }),
                    React.createElement('polygon', {
                        key: 'char-a2-hole',
                        points: '82.5,45 84.5,45 83.5,39',
                        fill: '#ffffff'
                    }),
                    // Subtitle
                    React.createElement('text', {
                        key: 'subtitle',
                        x: '46',
                        y: '78',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: '4.8',
                        fontWeight: '700',
                        fill: '#3c628e',
                        textAnchor: 'middle',
                        letterSpacing: '0.2'
                    }, 'CAIXA ECONÔMICA FEDERAL')
                ])
            ]);

        case 'BRADESCO':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain p-1',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ffffff' }),
                React.createElement('g', { key: 'bradesco-emblem', fill: '#e30613' }, [
                    // Top crescent hood
                    React.createElement('path', {
                        key: 'top-hood',
                        d: 'M 39.2,28.5 C 47.5,22 56.5,25 59.5,29.5 C 53.5,27.5 46.5,29 40.5,36 C 39.5,33.5 39.2,31 39.2,28.5 Z'
                    }),
                    // Main swooping branch
                    React.createElement('path', {
                        key: 'main-swoop',
                        d: 'M 35.2,36.5 C 39,31 54,31.5 64,39 C 65,43 61,50.5 55.2,50.5 C 59.5,49.5 61,45.5 57.5,41 C 53,34.5 44.5,35 39,44.5 C 38.5,41.2 37,39 35.2,36.5 Z'
                    }),
                    // Shorter left pillar block
                    React.createElement('path', {
                        key: 'left-pillar',
                        d: 'M 46.5,49 L 49.5,48 L 49.5,60 L 46.5,60 Z'
                    }),
                    // Taller right pillar block
                    React.createElement('path', {
                        key: 'right-pillar',
                        d: 'M 51.5,46.5 L 54.5,45.5 L 54.5,60 L 51.5,60 Z'
                    })
                ]),
                React.createElement('text', {
                    key: 'bradesco-lowercase-text',
                    x: '50',
                    y: '81',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    fontSize: '13.5',
                    fontWeight: '800',
                    fill: '#e30613',
                    textAnchor: 'middle',
                    letterSpacing: '-0.4'
                }, 'bradesco')
            ]);

        case 'ITAU':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ff6f00' }),
                React.createElement('rect', { key: 'blue-box', x: '18', y: '18', width: '64', height: '64', rx: '16', fill: '#002f87' }),
                React.createElement('text', {
                    key: 'itau-text',
                    x: '50',
                    y: '60',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '26',
                    fontWeight: '900',
                    fill: '#ff6f00',
                    textAnchor: 'middle'
                }, 'itaú')
            ]);

        case 'SANTANDER':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ec0000' }),
                React.createElement('path', {
                    key: 'flame',
                    d: 'M50 22 C53 32 40 45 50 58 C62 45 48 32 50 22 Z',
                    fill: '#ffffff'
                }),
                React.createElement('path', {
                    key: 'base',
                    d: 'M32 68 C32 54 68 54 68 68 Z',
                    stroke: '#ffffff',
                    strokeWidth: '8',
                    fill: 'none'
                })
            ]);

        case 'NUBANK':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#820ad1' }),
                React.createElement('path', {
                    key: 'nu-monogram',
                    d: 'M32 35 V65 C32 70 38 72 42 68 L68 35 C72 30 68 28 64 28 H58 L32 60',
                    stroke: '#ffffff',
                    strokeWidth: '7',
                    strokeLinecap: 'round',
                    fill: 'none'
                })
            ]);

        case 'INTER':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ff7a00' }),
                React.createElement('g', { key: 'inter-grid', stroke: '#ffffff', strokeWidth: '8', strokeLinecap: 'round', fill: 'none' }, [
                    React.createElement('path', { key: 'outer-box', d: 'M35 30 H65 V70 H35 Z' }),
                    React.createElement('path', { key: 'line1', d: 'M45 45 H55' }),
                    React.createElement('path', { key: 'line2', d: 'M45 55 H55' })
                ])
            ]);

        case 'MERCADO_PAGO':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain p-1',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#ffffff' }),
                React.createElement('g', { key: 'mp-logo', transform: 'translate(0, 0)' }, [
                    // Sky blue top and bottom backdrop parts
                    React.createElement('path', {
                        key: 'sky-upper',
                        d: 'M 10 50 C 10 32, 90 32, 90 50 Q 70 42, 50 50 Q 30 58, 10 50 Z',
                        fill: '#20b2ff'
                    }),
                    React.createElement('path', {
                        key: 'sky-lower',
                        d: 'M 10 50 C 10 68, 90 68, 90 50 Q 70 42, 50 50 Q 30 58, 10 50 Z',
                        fill: '#20b2ff'
                    }),
                    // Outer oval container
                    React.createElement('ellipse', { key: 'outer-oval', cx: '50', cy: '50', rx: '44', ry: '28', stroke: '#001e62', strokeWidth: '5', fill: 'none' }),
                    // Shaking hands vector
                    React.createElement('path', {
                        key: 'handshake-silhouette',
                        d: 'M 25 45 Q 35 44, 45 50 Q 55 56, 62 48 Q 50 38, 38 38 Z',
                        fill: '#ffffff',
                        stroke: '#001e62',
                        strokeWidth: '4.5',
                        strokeLinejoin: 'round'
                    }),
                    React.createElement('path', {
                        key: 'left-sleeve',
                        d: 'M 15 50 C 20 46, 24 45, 28 47',
                        stroke: '#001e62',
                        strokeWidth: '4.5',
                        strokeLinecap: 'round'
                    }),
                    React.createElement('path', {
                        key: 'right-sleeve',
                        d: 'M 85 50 C 80 46, 76 45, 72 47',
                        stroke: '#001e62',
                        strokeWidth: '4.5',
                        strokeLinecap: 'round'
                    }),
                    React.createElement('path', {
                        key: 'hand-detail-1',
                        d: 'M 40 45 C 44 48, 48 44, 46 40',
                        stroke: '#001e62',
                        strokeWidth: '4.5',
                        strokeLinecap: 'round'
                    }),
                    React.createElement('path', {
                        key: 'hand-detail-2',
                        d: 'M 43 49 C 47 52, 51 48, 49 44',
                        stroke: '#001e62',
                        strokeWidth: '4.5',
                        strokeLinecap: 'round'
                    }),
                    React.createElement('path', {
                        key: 'hand-detail-3',
                        d: 'M 46 53 C 50 56, 54 52, 52 48',
                        stroke: '#001e62',
                        strokeWidth: '4.5',
                        strokeLinecap: 'round'
                    })
                ])
            ]);

        default:
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#64748b' }),
                React.createElement('g', { key: 'bank-facade', stroke: '#ffffff', strokeWidth: '5', strokeLinecap: 'round', fill: 'none' }, [
                    React.createElement('path', { key: 'base', d: 'M25 75 H75' }),
                    React.createElement('path', { key: 'pediment', d: 'M25 35 L50 18 L75 35 Z' }),
                    React.createElement('path', { key: 'col1', d: 'M32 45 V65' }),
                    React.createElement('path', { key: 'col2', d: 'M44 45 V65' }),
                    React.createElement('path', { key: 'col3', d: 'M56 45 V65' }),
                    React.createElement('path', { key: 'col4', d: 'M68 45 V65' })
                ])
            ]);
    }
};

/**
 * Retorna a lista de formatos aceitos e sugeridos para cada banco.
 */
export const resolveBankFormats = (bank: { name: string; bank_key?: string | null } | string): string[] => {
    const key = resolveBankKey(bank);

    switch (key) {
        case 'SICREDI':
            return ['OFX', 'XLSX', 'CSV'];
        case 'SICOOB':
            return ['OFX', 'XLSX', 'CSV'];
        case 'BB':
            return ['OFX', 'XLSX', 'PDF'];
        case 'CAIXA':
            return ['OFX', 'TXT', 'CSV'];
        case 'BRADESCO':
            return ['OFX', 'XLSX', 'PDF'];
        case 'ITAU':
            return ['OFX', 'XLSX', 'PDF'];
        case 'SANTANDER':
            return ['OFX', 'XLSX', 'CSV'];
        case 'NUBANK':
            return ['OFX', 'CSV'];
        case 'INTER':
            return ['OFX', 'PDF', 'CSV'];
        case 'MERCADO_PAGO':
            return ['XLSX', 'CSV'];
        default:
            return ['OFX', 'PDF', 'XLSX', 'CSV', 'TXT'];
    }
};

/**
 * Retorna as instruções amigáveis de exportação associadas a cada instituição.
 */
export const resolveBankInstructions = (bank: { name: string; bank_key?: string | null } | string): string => {
    const key = resolveBankKey(bank);

    switch (key) {
        case 'SICREDI':
            return 'Acesse o Internet Banking Sicredi, acesse Conta Corrente > Extrato > Salvar em OFX ou Excel.';
        case 'SICOOB':
            return 'No aplicativo ou portal Sicoob, acesse Conta Corrente > Extrato > Exportar nos formatos OFX ou Planilha.';
        case 'BB':
            return 'No portal Banco do Brasil, vá em Conta Corrente > Extrato > Clique em Salvar em formato OFX (ou Extrato Completo PDF/XLSX).';
        case 'CAIXA':
            return 'No Internet Banking Caixa, selecione Extrato > Clique com botão direito ou em salvar nas opções e selecione exportar .OFX de preferência.';
        case 'BRADESCO':
            return 'Acesse o menu de Extratos do Bradesco, escolha o período e clique em salvar em arquivos para exportar em formato OFX ou Excel.';
        case 'ITAU':
            return 'Acesse o extrato no portal Itaú, clique em Saldo e Extrato > Extrato Mensal/Período, depois escolha Exportar para OFX ou PDF.';
        case 'SANTANDER':
            return 'No portal Santander, acesse o extrato detalhado do período desejado, clique no botão de exportação e escolha OFX ou CSV.';
        case 'NUBANK':
            return 'Pelo aplicativo móvel do Nubank, acesse sua tela de conta > Exportar Extrato. Escolha o período e selecione OFX ou CSV.';
        case 'INTER':
            return 'No Internet Banking ou App do Banco Inter, acesse o painel de Conta Corrente > Extrato > Exportar Extrato nos formatos OFX ou PDF.';
        case 'MERCADO_PAGO':
            return 'No portal ou aplicativo do Mercado Pago, acesse Extrato > Baixar Extrato e escolha o formato CSV ou Excel (XLSX).';
        default:
            return 'Exporte o extrato bancário diretamente no portal do seu banco utilizando de preferência o formato OFX original.';
    }
};

/**
 * Retorna um mapeamento ideal de cores CSS baseadas nas bandeiras institucionais de cada banco.
 */
export const resolveBankColors = (bank: { name: string; bank_key?: string | null } | string): BankColors => {
    const key = resolveBankKey(bank);

    switch (key) {
        case 'SICREDI':
            return {
                primary: '#00a859',
                bg: '#00a8590d',
                border: '#00a85930',
                text: '#008744'
            };
        case 'SICOOB':
            return {
                primary: '#003641',
                bg: '#a3d8420d',
                border: '#00364130',
                text: '#003641'
            };
        case 'BB':
            return {
                primary: '#00509d',
                bg: '#fcf20608',
                border: '#00509d25',
                text: '#003875'
            };
        case 'CAIXA':
            return {
                primary: '#0064a3',
                bg: '#0064a30d',
                border: '#0064a330',
                text: '#005285'
            };
        case 'BRADESCO':
            return {
                primary: '#cc092f',
                bg: '#cc092f08',
                border: '#cc092f25',
                text: '#a80726'
            };
        case 'ITAU':
            return {
                primary: '#ff6f00',
                bg: '#002f8708',
                border: '#ff6f0025',
                text: '#002f87'
            };
        case 'SANTANDER':
            return {
                primary: '#ec0000',
                bg: '#ec000008',
                border: '#ec000025',
                text: '#c40000'
            };
        case 'NUBANK':
            return {
                primary: '#820ad1',
                bg: '#820ad10a',
                border: '#820ad125',
                text: '#6805ab'
            };
        case 'INTER':
            return {
                primary: '#ff7a00',
                bg: '#ff7a000d',
                border: '#ff7a0025',
                text: '#d66700'
            };
        case 'MERCADO_PAGO':
            return {
                primary: '#001e62',
                bg: '#20b2ff0f',
                border: '#001e6225',
                text: '#001e62'
            };
        default:
            return {
                primary: '#64748b',
                bg: '#64748b0a',
                border: '#64748b20',
                text: '#475569'
            };
    }
};
