import { ContributorMockProfile, ProfileCompletenessResult, ProfileMissingField } from '../types/portal';

/**
 * Checks the completeness of a contributor profile in the Portal do Contribuinte.
 * Evaluates core identification, contact, date of birth, and location details.
 */
export function checkProfileCompleteness(
    profile: ContributorMockProfile | null | undefined
): ProfileCompletenessResult {
    if (!profile) {
        return {
            score: 0,
            isComplete: false,
            missingFields: [
                { key: 'name', label: 'Nome Completo', iconName: 'user', importance: 'critical', hint: 'Identificação oficial do contribuinte' },
                { key: 'cpf', label: 'CPF / CNPJ', iconName: 'idCard', importance: 'critical', hint: 'Necessário para identificação bancária e conciliação' },
                { key: 'phone', label: 'WhatsApp / Telefone', iconName: 'phone', importance: 'critical', hint: 'Para envio de comprovantes e informativos' },
                { key: 'email', label: 'E-mail', iconName: 'mail', importance: 'recommended', hint: 'Para recibos digitais e relatórios anuais' },
                { key: 'birth_date', label: 'Data de Nascimento', iconName: 'calendar', importance: 'recommended', hint: 'Para felicitações e aniversariantes' },
                { key: 'address', label: 'Endereço Completo', iconName: 'mapPin', importance: 'recommended', hint: 'CEP, rua, número e cidade' },
                { key: 'congregation', label: 'Congregação / Vínculo', iconName: 'church', importance: 'optional', hint: 'Igreja ou congregação que congrega' }
            ],
            totalFields: 7,
            filledFields: 0,
            statusText: 'Não identificado',
            badgeColor: 'rose'
        };
    }

    const missingFields: ProfileMissingField[] = [];
    let score = 0;
    const totalFields = 7;
    let filledFields = 0;

    // 1. Nome Completo (20 points - Critical)
    const nameVal = (profile.name || profile.canonical_name || '').trim();
    if (nameVal && nameVal.length >= 3) {
        score += 20;
        filledFields++;
    } else {
        missingFields.push({
            key: 'name',
            label: 'Nome Completo',
            iconName: 'user',
            importance: 'critical',
            hint: 'Informe seu nome completo para emissão correta dos comprovantes.'
        });
    }

    // 2. CPF / CNPJ (20 points - Critical)
    const cleanCpf = (profile.cpf || '').replace(/\D/g, '');
    if (cleanCpf && (cleanCpf.length === 11 || cleanCpf.length === 14)) {
        score += 20;
        filledFields++;
    } else {
        missingFields.push({
            key: 'cpf',
            label: 'CPF / CNPJ',
            iconName: 'idCard',
            importance: 'critical',
            hint: 'Informe seu CPF para identificação automática das suas ofertas Pix.'
        });
    }

    // 3. Telefone / WhatsApp (20 points - Critical for WhatsApp receipts)
    const phoneVal = (profile.phone || profile.whatsapp || '').replace(/\D/g, '');
    if (phoneVal && phoneVal.length >= 10) {
        score += 20;
        filledFields++;
    } else {
        missingFields.push({
            key: 'phone',
            label: 'WhatsApp / Telefone',
            iconName: 'phone',
            importance: 'critical',
            hint: 'Cadastre seu WhatsApp para receber os comprovantes oficiais instantaneamente.'
        });
    }

    // 4. E-mail (15 points - Recommended)
    const emailVal = (profile.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailVal && emailRegex.test(emailVal)) {
        score += 15;
        filledFields++;
    } else {
        missingFields.push({
            key: 'email',
            label: 'E-mail',
            iconName: 'mail',
            importance: 'recommended',
            hint: 'Cadastre seu e-mail para receber relatórios anuais de contribuições.'
        });
    }

    // 5. Data de Nascimento (10 points - Recommended)
    const birthVal = (profile.birth_date || '').trim();
    if (birthVal && birthVal.length >= 5) {
        score += 10;
        filledFields++;
    } else {
        missingFields.push({
            key: 'birth_date',
            label: 'Data de Nascimento',
            iconName: 'calendar',
            importance: 'recommended',
            hint: 'Informe seu aniversário para orações e felicitações pastorais.'
        });
    }

    // 6. Endereço (10 points - Recommended: CEP, Rua ou Cidade)
    const hasStreet = !!(profile.address_street || '').trim();
    const hasCity = !!(profile.address_city || profile.city || '').trim();
    const hasCep = !!(profile.address_cep || '').replace(/\D/g, '');

    if ((hasStreet && hasCity) || (hasCep && (hasStreet || hasCity))) {
        score += 10;
        filledFields++;
    } else {
        missingFields.push({
            key: 'address',
            label: 'Endereço Completo',
            iconName: 'mapPin',
            importance: 'recommended',
            hint: 'Preencha seu CEP, rua e cidade para correspondências e registros da igreja.'
        });
    }

    // 7. Congregação / Vínculo (5 points - Optional)
    const congVal = (profile.congregation || '').trim();
    if (congVal && congVal !== 'Sede Central' && congVal.length >= 2) {
        score += 5;
        filledFields++;
    } else if (profile.role_position || congVal) {
        score += 5;
        filledFields++;
    } else {
        missingFields.push({
            key: 'congregation',
            label: 'Congregação / Vínculo',
            iconName: 'church',
            importance: 'optional',
            hint: 'Selecione ou confirme a congregação onde você frequenta.'
        });
    }

    const isComplete = score >= 90 && missingFields.filter(f => f.importance === 'critical').length === 0;

    // 8. Periodic 6-month (180 days) review check
    let needsPeriodicReview = false;
    let daysSinceLastUpdate = 0;
    let lastConfirmedDateFormatted: string | undefined = undefined;

    const rawLastDate = profile.last_confirmed_at || profile.updated_at;
    if (rawLastDate) {
        try {
            const lastDate = new Date(rawLastDate);
            if (!isNaN(lastDate.getTime())) {
                const diffTime = Math.abs(Date.now() - lastDate.getTime());
                daysSinceLastUpdate = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                lastConfirmedDateFormatted = lastDate.toLocaleDateString('pt-BR');
                
                // If 180 days (6 months) or more have passed since last update
                if (daysSinceLastUpdate >= 180) {
                    needsPeriodicReview = true;
                }
            }
        } catch (e) {
            console.warn('[portalProfileCompleteness] Error parsing last update date:', e);
        }
    }

    let badgeColor: 'rose' | 'amber' | 'blue' | 'emerald' = 'rose';
    let statusText = 'Cadastro Incompleto';

    if (needsPeriodicReview) {
        badgeColor = 'amber';
        statusText = `Revisão Semestral (${daysSinceLastUpdate} dias)`;
    } else if (score >= 95) {
        badgeColor = 'emerald';
        statusText = 'Cadastro Completo (100%)';
    } else if (score >= 75) {
        badgeColor = 'blue';
        statusText = `Cadastro Quase Completo (${score}%)`;
    } else if (score >= 50) {
        badgeColor = 'amber';
        statusText = `Cadastro Parcial (${score}%)`;
    } else {
        badgeColor = 'rose';
        statusText = `Cadastro Incompleto (${score}%)`;
    }

    return {
        score,
        isComplete,
        missingFields,
        totalFields,
        filledFields,
        statusText,
        badgeColor,
        needsPeriodicReview,
        daysSinceLastUpdate,
        lastConfirmedDateFormatted
    };
}
