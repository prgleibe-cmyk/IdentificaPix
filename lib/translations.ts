
/**
 * IDENTIFICAPIX - DICIONÁRIO DE TRADUÇÕES (ARQUITETURA MODULAR V2)
 * Orquestrador central que compõe os módulos de UI e Business para o idioma Português.
 */

import { ptUi } from './i18n/pt_ui';
import { ptBiz } from './i18n/pt_biz';

export const translations = {
    pt: {
        ...ptUi,
        ...ptBiz
    },
};
