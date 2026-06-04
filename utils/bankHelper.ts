import React from 'react';

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
    
    return 'GENERIC';
};

/**
 * Retorna o logotipo em formato SVG do banco correspondente.
 * Utiliza React.createElement para garantir compatibilidade estrutural estrita
 * compilando perfeitamente sem depender de arquivos .tsx especiais.
 */
export const resolveBankBrand = (name: string): React.ReactNode => {
    const key = getBankKey(name);

    switch (key) {
        case 'SICREDI':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#00a859' }),
                React.createElement('path', {
                    key: 'leaf-outer',
                    d: 'M50 20 C65 20 75 30 75 45 C75 60 65 70 50 80 C35 70 25 60 25 45 C25 30 35 20 50 20 Z',
                    fill: '#ffffff',
                    opacity: '0.9'
                }),
                React.createElement('path', {
                    key: 'leaf-inner',
                    d: 'M50 30 C58 30 65 37 65 45 C65 53 58 60 50 67 C42 60 35 53 35 45 C35 37 42 30 50 30 Z',
                    fill: '#00a859'
                })
            ]);

        case 'SICOOB':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#003641' }),
                React.createElement('circle', { key: 'outer', cx: '50', cy: '50', r: '22', fill: '#a3d842' }),
                React.createElement('circle', { key: 'inner', cx: '50', cy: '50', r: '14', fill: '#003641' })
            ]);

        case 'BB':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#fcf206' }),
                React.createElement('g', { key: 'brand-group', transform: 'translate(10, 10) scale(0.8)' }, [
                    React.createElement('path', {
                        key: 'p1',
                        d: 'M50 15 L25 40 L50 65 L75 40 Z',
                        stroke: '#00509d',
                        strokeWidth: '12',
                        fill: 'none',
                        strokeLinejoin: 'round'
                    }),
                    React.createElement('path', {
                        key: 'p2',
                        d: 'M50 35 L35 50 L50 65 L65 50 Z',
                        stroke: '#00509d',
                        strokeWidth: '8',
                        fill: 'none',
                        strokeLinejoin: 'round'
                    })
                ])
            ]);

        case 'CAIXA':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#0064a3' }),
                React.createElement('path', {
                    key: 'white-block',
                    d: 'M30 30 L55 30 L70 50 L55 70 L30 70 Z',
                    fill: '#ffffff'
                }),
                React.createElement('path', {
                    key: 'orange-block',
                    d: 'M58 30 L70 30 L85 50 L70 70 L58 70 L73 50 Z',
                    fill: '#f07f20'
                })
            ]);

        case 'BRADESCO':
            return React.createElement('svg', {
                viewBox: '0 0 100 100',
                className: 'w-full h-full object-contain',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg'
            }, [
                React.createElement('rect', { key: 'bg', width: '100', height: '100', rx: '24', fill: '#cc092f' }),
                React.createElement('g', { key: 'tree-group', stroke: '#ffffff', strokeWidth: '6', strokeLinecap: 'round', fill: 'none' }, [
                    React.createElement('path', { key: 'trunk', d: 'M50 75 V35' }),
                    React.createElement('path', { key: 'right-branch', d: 'M50 45 C65 35 75 40 75 55' }),
                    React.createElement('path', { key: 'left-branch', d: 'M50 55 C35 45 25 50 25 65' })
                ])
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
export const resolveBankFormats = (name: string): string[] => {
    const key = getBankKey(name);

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
        default:
            return ['OFX', 'PDF', 'XLSX', 'CSV', 'TXT'];
    }
};

/**
 * Retorna as instruções amigáveis de exportação associadas a cada instituição.
 */
export const resolveBankInstructions = (name: string): string => {
    const key = getBankKey(name);

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
        default:
            return 'Exporte o extrato bancário diretamente no portal do seu banco utilizando de preferência o formato OFX original.';
    }
};

/**
 * Retorna um mapeamento ideal de cores CSS baseadas nas bandeiras institucionais de cada banco.
 */
export const resolveBankColors = (name: string): BankColors => {
    const key = getBankKey(name);

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
        default:
            return {
                primary: '#64748b',
                bg: '#64748b0a',
                border: '#64748b20',
                text: '#475569'
            };
    }
};
