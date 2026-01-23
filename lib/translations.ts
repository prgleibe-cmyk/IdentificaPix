/**
 * IDENTIFICAPIX - DICIONÁRIO DE TRADUÇÕES (ARQUITETURA MODULAR V2)
 * Orquestrador central que compõe os módulos de UI e Business para cada idioma.
 */

import { ptUi } from './i18n/pt_ui';
import { ptBiz } from './i18n/pt_biz';
import { enUi } from './i18n/en_ui';
import { enBiz } from './i18n/en_biz';
import { esUi } from './i18n/es_ui';
import { esBiz } from './i18n/es_biz';

export const translations = {
    pt: {
        ...ptUi,
        ...ptBiz
    },
    en: {
        ...enUi,
        ...enBiz
    },
    es: {
        ...esUi,
        ...esBiz
    },
};
