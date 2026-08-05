export interface PresetTemplate {
    id: string;
    title: string;
    badge: string;
    text: string;
}

// Verses & Themes for Treasury
const BIBLE_VERSES_TREASURY = [
    { ref: '2 Coríntios 9:7', quote: 'Cada um dê conforme determinou em seu coração, não com desgosto ou por obrigação, pois Deus ama quem dá com alegria.' },
    { ref: 'Malaquias 3:10', quote: 'Tragam o dízimo todo ao depósito do templo, para que haja alimento em minha casa. Ponde-me à prova, diz o Senhor.' },
    { ref: 'Provérbios 3:9-10', quote: 'Honre o Senhor com todos os seus bens e com as primeiras colheitas de todos os seus frutos.' },
    { ref: 'Lucas 6:38', quote: 'Dêem e lhes será dado: uma boa medida, recalcada, sacudida e transbordante será dada a vocês.' },
    { ref: '2 Coríntios 9:6', quote: 'Lembrem-se: aquele que semear pouco, também colherá pouco; e aquele que semear com fartura, também colherá com fartura.' },
    { ref: 'Salmos 126:5', quote: 'Os que semearam com lágrimas, com cantos de alegria colherão.' },
    { ref: 'Gálatas 6:9', quote: 'E não nos cansemos de fazer o bem, pois no tempo próprio colheremos, se não desanimarmos.' },
    { ref: 'Provérbios 11:25', quote: 'A pessoa generosa prosperará; quem dá alívio aos outros, alívio receberá.' },
    { ref: 'Eclesiastes 11:1', quote: 'Atire o seu pão sobre as águas, porque depois de muitos dias você voltará a encontrá-lo.' },
    { ref: '1 Crônicas 29:14', quote: 'Tudo vem de ti, Senhor, e nós apenas te damos do que vem das tuas mãos.' },
    { ref: 'Filipenses 4:19', quote: 'O meu Deus suprirá todas as necessidades de vocês, de acordo com as suas gloriosas riquezas em Cristo Jesus.' },
    { ref: 'Hebreus 6:10', quote: 'Deus não é injusto; ele não se esquecerá do trabalho de vocês e do amor que demonstraram por ele, pois ajudaram os santos.' },
    { ref: 'Salmos 112:3', quote: 'Em sua casa há prosperidade e riqueza, e a sua justiça permanece para sempre.' },
    { ref: 'Mateus 6:20', quote: 'Mas ajuntem tesouros no céu, onde a traça e a ferrugem não destroem, e onde os ladrões não arrombam nem furtam.' },
    { ref: 'Deuteronômio 28:12', quote: 'O Senhor abrirá os céus, o depósito do seu tesouro, para enviar chuva à sua terra no devido tempo e abençoar todo o trabalho das suas mãos.' },
    { ref: 'Salmos 20:1-3', quote: 'Que o Senhor te responda no dia da angústia; lembre-se de todas as tuas ofertas de cereais e aceite os teus holocaustos.' },
    { ref: 'Romanos 12:8', quote: 'Se o seu dom é contribuir, contribua generosamente.' },
    { ref: 'Salmos 37:5', quote: 'Entregue o seu caminho ao Senhor; confie nele, e ele agirá.' },
    { ref: 'Salmos 23:1', quote: 'O Senhor é o meu pastor; nada me faltará.' },
    { ref: 'Provérbios 10:22', quote: 'A bênção do Senhor traz riqueza, e não traz dores com ela.' }
];

const GREETINGS_TREASURY = [
    "Olá, querido(a) *{NOME}*! 🕊️",
    "Paz do Senhor, irmão(ã) *{NOME}*! 🙏",
    "Graça e Paz, estimado(a) *{NOME}*! 🌱",
    "Saudações no amor de Cristo, *{NOME}*! ✨",
    "A paz de Cristo seja com você, *{NOME}*! 🌾",
    "Que a graça do Senhor envolva você, *{NOME}*! ☀️",
    "Abraços fraternos, querido(a) *{NOME}*! 🕯️",
    "Com muita alegria saudamos você, *{NOME}*! 👑",
    "Deus abençoe seu dia, *{NOME}*! 🕊️",
    "A paz do Nosso Senhor Jesus Cristo, *{NOME}*! ✝️"
];

const INTROS_TREASURY = [
    "Confirmamos com profunda gratidão o recebimento do seu *{TIPO}* no valor de *{VALOR}* em *{DATA}* para a *{IGREJA}*.",
    "Registramos com louvor a sua contribuição de *{VALOR}* ({TIPO}) realizada no dia *{DATA}* junto à tesouraria da *{IGREJA}*.",
    "Com muita alegria, confirmamos a entrada da sua semente no valor de *{VALOR}* ({TIPO}) em *{DATA}* em prol do Reino na *{IGREJA}*.",
    "A tesouraria da *{IGREJA}* informa e agradece o recebimento da sua contribuição no valor de *{VALOR}* ({TIPO}) em *{DATA}*.",
    "Agradecemos de coração a sua oferta/dízimo de *{VALOR}* em *{DATA}*, dedicada aos trabalhos sagrados da *{IGREJA}*.",
    "Recebemos e homologamos a sua contribuição de *{VALOR}* ({TIPO}) em *{DATA}*. Louvamos a Deus por sua vida na *{IGREJA}*!",
    "Sua contribuição no valor de *{VALOR}* ({TIPO}) foi devidamente registrada em *{DATA}* pela Tesouraria da *{IGREJA}*.",
    "Passando para confirmar o recebimento do seu abençoado *{TIPO}* no valor de *{VALOR}* em *{DATA}* na *{IGREJA}*.",
    "É com gratidão ao Senhor que acusamo o recebimento de *{VALOR}* ({TIPO}) em *{DATA}* para os projetos e missões da *{IGREJA}*.",
    "Sua fidelidade registrada no valor de *{VALOR}* ({TIPO}) em *{DATA}* fortalece a manutenção e ampliação da *{IGREJA}*."
];

const CLOSINGS_TREASURY = [
    "Que o Senhor recompense e multiplique abundantemente suas colheitas e projetos!",
    "Declaramos bênçãos sem medida sobre o seu lar, trabalho e saúde em nome de Jesus!",
    "Sua fidelidade edifica a casa do Pai e espalha a luz do Evangelho em nossa comunidade.",
    "Que as janelas dos céus se abram sobre a sua vida e a sua família continuamente!",
    "Oramos para que o Deus da provisão supra cada uma de suas necessidades em glória.",
    "Que o Senhor guarde a sua entrada e a sua saída hoje e para todo o sempre.",
    "Que a alegria de servir ao Rei transborde no seu coração todos os dias da sua vida.",
    "Agradecemos por caminhar conosco nessa missão de fé e transformação.",
    "Permanecemos à disposição para servir e orar por você e pela sua família.",
    "Que a graça e a paz do Criador sejam o seu sustento diário!"
];

// Helper to construct 100 Treasury Presets
export const TREASURY_PRESETS: PresetTemplate[] = Array.from({ length: 100 }, (_, i) => {
    const idx = i + 1;
    const verse = BIBLE_VERSES_TREASURY[i % BIBLE_VERSES_TREASURY.length];
    const greeting = GREETINGS_TREASURY[i % GREETINGS_TREASURY.length];
    const intro = INTROS_TREASURY[i % INTROS_TREASURY.length];
    const closing = CLOSINGS_TREASURY[i % CLOSINGS_TREASURY.length];

    const badges = ['Gratidão', 'Fidelidade', 'Colheita', 'Providência', 'Reino', 'Edificação', 'Semeadura', 'Semente', 'Transparência', 'Bênção'];
    const badge = badges[i % badges.length];

    const titles = [
        `Gratidão & Colheita`, `Fidelidade Abençoada`, `Semente do Reino`, `Providência Divina`,
        `Altar da Generosidade`, `Fruto da Fé`, `Apoio às Missões`, `Orvalho de Hermom`,
        `Obra de Excelência`, `Coração Voluntário`, `Transparência & Honra`, `Luz nas Nações`,
        `Multiplicação da Semente`, `Guarda do Senhor`, `Provedoria no Lar`, `Bênção do Trabalho`,
        `Fidelidade que Edifica`, `Alegria de Contribuir`, `Paz no Coração`, `Consagração & Louvor`
    ];
    const title = `#${idx < 10 ? '0' + idx : idx} ${titles[i % titles.length]}`;

    return {
        id: `treasury_${idx}`,
        title,
        badge,
        text: `${greeting}\n\n${intro}\n\nSeu apoio é fundamental para o avanço da obra e manutenção do templo.\n\n_"${verse.quote}" (${verse.ref})_\n\n${closing}\n\nCom louvor e consideração,\n*Equipe de Tesouraria - {IGREJA}*`
    };
});


// Verses & Themes for Pastor
const BIBLE_VERSES_PASTOR = [
    { ref: 'Filipenses 4:19', quote: 'O meu Deus suprirá todas as necessidades de vocês, de acordo com as suas gloriosas riquezas em Cristo Jesus.' },
    { ref: 'Números 6:24-26', quote: 'O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e te dê a paz.' },
    { ref: 'Salmos 121:7-8', quote: 'O Senhor o guardará de todo o mal; guardará a sua vida. O Senhor guardará a sua saída e a sua chegada, desde agora e para sempre.' },
    { ref: 'Deuteronômio 28:2-3', quote: 'Se você obedecer ao Senhor, o seu Deus, todas estas bênçãos virão sobre você: Você será abençoado na cidade e no campo.' },
    { ref: 'Salmos 91:1-2', quote: 'Aquele que habita no abrigo do Altíssimo e descansa à sombra do Onipotente pode dizer ao Senhor: Tu és o meu refúgio e a minha fortaleza.' },
    { ref: 'Isaías 58:11', quote: 'O Senhor o guiará constantemente; satisfará os seus desejos em uma terra ressequida e fortalecerá os seus ossos.' },
    { ref: 'Salmos 1:1-3', quote: 'Abençoado é aquele que medita na lei do Senhor dia e noite. Ele é como árvore plantada à beira de águas correntes.' },
    { ref: 'Provérbios 10:22', quote: 'A bênção do Senhor traz riqueza, e não traz dores com ela.' },
    { ref: 'Salmos 34:8', quote: 'Provem e vejam como o Senhor é bom. Como é feliz aquele que nele se refugia!' },
    { ref: '3 João 1:2', quote: 'Amado, oro para que você tenha boa saúde e tudo corra bem, assim como vai bem a sua alma.' },
    { ref: 'Salmos 128:1-2', quote: 'Bem-aventurado aquele que teme ao Senhor e anda nos seus caminhos. Do trabalho de suas mãos você comerá!' },
    { ref: 'Jeremias 17:7-8', quote: 'Abençoado é o homem que confia no Senhor, cuja confiança nele está. Ele será como árvore plantada junto às águas.' },
    { ref: 'Colossenses 3:23-24', quote: 'Tudo o que fizerem, façam de todo o coração, como para o Senhor, e não para os homens. Vocês receberão a herança!' },
    { ref: 'Salmos 37:25', quote: 'Já fui jovem e agora sou velho, mas nunca vi o justo desamparado, nem seus filhos mendigando o pão.' },
    { ref: 'Efésios 3:20', quote: 'Àquele que é capaz de fazer infinitamente mais do que tudo o que pedimos ou pensamos, a ele seja a glória!' },
    { ref: 'Salmos 115:14', quote: 'Que o Senhor os multiplique cada vez mais, a vocês e aos seus filhos!' },
    { ref: 'Mateus 6:33', quote: 'Busquem pois em primeiro lugar o Reino de Deus e a sua justiça, e todas estas coisas lhes serão acrescentadas.' },
    { ref: 'Salmos 20:4', quote: 'Que ele lhe conceda o desejo do seu coração e realize todos os seus planos!' },
    { ref: 'João 14:27', quote: 'Deixo com vocês a paz; a minha paz lhes dou. Não a dou como o mundo a dá. Não se perturbe o seu coração.' },
    { ref: 'Josué 1:9', quote: 'Seja forte e corajoso! Não se apavore nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.' }
];

const GREETINGS_PASTOR = [
    "A Paz do Senhor Jesus, amado(a) irmão(ã) *{NOME}*! 🙏✨",
    "Graça e Paz multiplicadas, estimado(a) *{NOME}*! 🕊️",
    "Paz de Cristo ao seu coração e ao seu lar, *{NOME}*! 🌾",
    "Com carinho pastoral e gratidão no Senhor, querido(a) *{NOME}*! 🌱",
    "Que a luz do nosso Salvador ilumine seu dia, *{NOME}*! ☀️",
    "A bênção do Pai seja abundante sobre você, *{NOME}*! ✨",
    "Saudações fraternas do seu pastor, *{NOME}*! ✝️",
    "Que a alegria do Espírito Santo encha sua vida, *{NOME}*! 🕊️",
    "Amado(a) *{NOME}*, a paz do Senhor Jesus! 🌿",
    "Graça, misericórdia e paz sobre a sua casa, *{NOME}*! 🏰"
];

const PASTORAL_PRAYERS = [
    "Oração Pastoral: \"Senhor Deus, abençoe rica e abundantemente a vida do(a) {NOME}. Derrama das janelas dos céus sobre o seu lar, suprindo cada necessidade com saúde, paz, unção e prosperidade no trabalho. Em nome de Jesus, Amém!\"",
    "Oração da Família: \"Pai Celeste, coloca Teu escudo de proteção sobre o lar do(a) {NOME}. Que a Tua paz que excede o entendimento guarde seus pensamentos, abençoando seus filhos, cônjuge e projetos em Cristo Jesus. Amém!\"",
    "Oração do Trabalho & Provedoria: \"Deus Provedor, prospera a obra das mãos do(a) {NOME}. Abre portas de oportunidades, concede sabedoria nas decisões e multiplica o fruto do seu suor. Em nome do Senhor Jesus, Amém!\"",
    "Oração de Saúde e Paz: \"Senhor Jesus, Médico dos médicos, sopra vigor, renovo e saúde perfeita sobre o corpo e a mente do(a) {NOME}. Guarde-o(a) de todo o mal e encha sua casa com a Tua presença gloriosa. Amém!\"",
    "Oração de Cobertura Espiritual: \"Deus de toda Graça, cobrimos a vida do(a) {NOME} com Teu sangue precioso. Que o Teu Santo Espírito o(a) fortaleça diariamente na fé, dando vitórias e alegrias constantes. Amém!\""
];

const CLOSINGS_PASTOR = [
    "Conte sempre com a minha constante oração e cobertura pastoral pela sua vida e família.",
    "Que o amor de Deus Pai, a graça de Jesus e a comunhão do Espírito Santo sejam com você!",
    "Estou em constante oração para que o Senhor realize os desejos mais nobres do seu coração.",
    "Lembre-se sempre de que você é precioso(a) para Deus e vital para a nossa comunidade de fé.",
    "Que o seu caminhar seja firmado na Rocha e a sua casa repleta da presença do Altíssimo.",
    "Com abraço fraterno e bênção pastoral,",
    "No amor de Cristo que nos uniu como família na fé,",
    "Que a paz que excede todo o entendimento guarde o seu coração hoje e sempre.",
    "Seguimos juntos edificando a Igreja de Cristo e espalhando a Sua mensagem de amor.",
    "Que as promessas de Deus se cumpram no seu tempo com alegria e fartura."
];

// Helper to construct 100 Pastor Presets
export const PASTOR_PRESETS: PresetTemplate[] = Array.from({ length: 100 }, (_, i) => {
    const idx = i + 1;
    const verse = BIBLE_VERSES_PASTOR[i % BIBLE_VERSES_PASTOR.length];
    const greeting = GREETINGS_PASTOR[i % GREETINGS_PASTOR.length];
    const prayer = PASTORAL_PRAYERS[i % PASTORAL_PRAYERS.length];
    const closing = CLOSINGS_PASTOR[i % CLOSINGS_PASTOR.length];

    const badges = ['Bênção Pastoral', 'Oração', 'Provedoria', 'Família', 'Saúde & Paz', 'Encorajamento', 'Unção', 'Proteção', 'Acolhimento', 'Vida com Deus'];
    const badge = badges[i % badges.length];

    const titles = [
        `Carinho Pastoral & Oração`, `Provedoria em Filipenses`, `Proteção do Salmo 121`, `Bênção sobre a Família`,
        `Oração do Trabalho`, `Aarônica Números 6`, `Abrigo do Altíssimo`, `Cuidado & Acolhimento`,
        `Prosperidade do Salmo 1`, `Renovo & Saúde`, `Caminhar em Paz`, `Consolação & Alegria`,
        `Frutos da Obediência`, `Herança de Deus`, `Vitória na Prova`, `Fidelidade Abençoada`,
        `Unção de Crescimento`, `Luz no Lar`, `Fortaleza em Cristo`, `Paz que Excede`
    ];
    const title = `#${idx < 10 ? '0' + idx : idx} ${titles[i % titles.length]}`;

    return {
        id: `pastor_${idx}`,
        title,
        badge,
        text: `${greeting}\n\nPassando como seu pastor para deixar uma palavra de carinho e gratidão por sua fidelidade de *{VALOR}* ({TIPO}) registrada em *{DATA}* na *{IGREJA}*.\n\n_"${verse.quote}" (${verse.ref})_\n\n*${prayer}*\n\n${closing}\n\nCom carinho e oração pastoral,\n*Pr. {PASTOR}* - {IGREJA}`
    };
});


// 20 Closing Presets
export const CLOSING_PRESETS: PresetTemplate[] = [
    {
        id: 'closing_1',
        title: '#01 Extrato Transparência do Reino',
        badge: 'Portal & Transparência',
        text: `A Paz do Senhor, *{NOME}*! 🙏✨\n\nO relatório financeiro do mês da *{IGREJA}* foi encerrado com a bênção de Deus. Sua fidelidade e apoio são pedras fundamentais para o crescimento da obra do Reino!\n\n📊 Acesse seu *Extrato de Fidelidade & Transparência do Reino* exclusivo no nosso Portal do Contribuinte:\n🔗 {LINK_PORTAL}\n\n_"Cada um contribua segundo propôs no seu coração; não com tristeza, ou por necessidade; porque Deus ama ao que dá com alegria." (2 Coríntios 9:7)_\n\nQue o Senhor recompense e multiplique a sua semente!\n*Tesouraria & Pastores - {IGREJA}*`
    },
    {
        id: 'closing_2',
        title: '#02 Fechamento Mensal & Prestação de Contas',
        badge: 'Relatório Mensal',
        text: `Graça e Paz, estimado(a) *{NOME}*! 🕊️\n\nFinalizamos o fechamento contábil deste mês na *{IGREJA}*. Louvamos a Deus pela sua preciosa vida e constante fidelidade.\n\nSeu histórico consolidado e prestação de contas transparente já estão disponíveis em seu Portal:\n🔗 {LINK_PORTAL}\n\n_"Buscai em primeiro lugar o Reino de Deus e a sua justiça, e todas estas coisas vos serão acrescentadas." (Mateus 6:33)_\n\nFraterno abraço,\n*Conselho Fiscal & Tesouraria - {IGREJA}*`
    },
    {
        id: 'closing_3',
        title: '#03 Resumo Anual de Contribuições',
        badge: 'Histórico Completo',
        text: `A Paz do Senhor, *{NOME}*! 🌱\n\nDisponibilizamos o seu demonstrativo de contribuições no Portal do Contribuinte da *{IGREJA}*.\n\nConfira seus recibos e extrato de dízimos/ofertas com toda a segurança e transparência:\n🔗 {LINK_PORTAL}\n\nObrigado por investir no Reino de Deus!\n*Tesouraria - {IGREJA}*`
    },
    {
        id: 'closing_4',
        title: '#04 Gratidão pelas Missões do Mês',
        badge: 'Missões & Obras',
        text: `Paz de Cristo, amado(a) *{NOME}*! ✨\n\nGraças às suas ofertas e dízimos do mês na *{IGREJA}*, nossas obras sociais e projetos missionários alcançaram vidas!\n\nAcesse seu extrato do mês e veja os frutos da sua semeadura:\n🔗 {LINK_PORTAL}\n\nCom gratidão e bênção,\n*Pr. {PASTOR} & Tesouraria - {IGREJA}*`
    },
    {
        id: 'closing_5',
        title: '#05 Portal do Dizimista Abençoado',
        badge: 'Acesso Direto',
        text: `Olá, querido(a) *{NOME}*! 🌾\n\nSeu Portal de Transparência da *{IGREJA}* foi atualizado. Lá você pode acompanhar todas as suas contribuições e imprimir seus recibos quando quiser:\n🔗 {LINK_PORTAL}\n\nQue o Senhor continue abençoando o trabalho das suas mãos!\n*Equipe de Finanças - {IGREJA}*`
    }
];

// LocalStorage history manager to avoid repeating templates for the same contributor
const HISTORY_STORAGE_KEY = 'identificapix_whatsapp_sent_preset_history';

interface PresetHistoryStore {
    [contributorIdentifier: string]: string[]; // Array of sent preset IDs
}

export const getSentPresetHistory = (contributorIdentifier: string): string[] => {
    try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (!raw) return [];
        const store: PresetHistoryStore = JSON.parse(raw);
        return store[contributorIdentifier || 'default'] || [];
    } catch {
        return [];
    }
};

export const recordSentPreset = (contributorIdentifier: string, presetId: string) => {
    try {
        const key = contributorIdentifier || 'default';
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        const store: PresetHistoryStore = raw ? JSON.parse(raw) : {};
        const currentList = store[key] || [];

        if (!currentList.includes(presetId)) {
            currentList.push(presetId);
            // Limit history to last 80 items per user so it rolls over after extensive usage
            if (currentList.length > 80) {
                currentList.shift();
            }
            store[key] = currentList;
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(store));
        }
    } catch (e) {
        console.warn('Error saving preset history:', e);
    }
};

/**
 * Returns a random preset from the selected role list that has NOT been sent to this contributor recently.
 */
export const getRandomNonRepeatingPreset = (
    senderRole: 'treasury' | 'pastor' | 'closing',
    contributorIdentifier: string
): PresetTemplate => {
    const fullList = senderRole === 'pastor' ? PASTOR_PRESETS : senderRole === 'closing' ? CLOSING_PRESETS : TREASURY_PRESETS;
    const history = getSentPresetHistory(contributorIdentifier);

    // Filter out presets already sent to this contributor
    const unUsed = fullList.filter(p => !history.includes(p.id));

    if (unUsed.length > 0) {
        const randomIndex = Math.floor(Math.random() * unUsed.length);
        return unUsed[randomIndex];
    }

    // If all presets have been used, pick any random preset (resets loop)
    const randomIndex = Math.floor(Math.random() * fullList.length);
    return fullList[randomIndex];
};
