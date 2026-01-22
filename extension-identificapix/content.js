
// content.js - Sensores de interface v1.0.3

let localTrainingState = { active: false };
const isIdentificaPixPage = window.location.href.includes("identificapix.com.br") || window.location.hostname === "localhost";

// Função para verificar se a extensão ainda é válida
function isExtensionValid() {
    return !!(chrome.runtime && chrome.runtime.id);
}

function safeSendMessage(message) {
    if (!isExtensionValid()) return;
    try {
        chrome.runtime.sendMessage(message);
    } catch (e) {
        // Silencia erros de contexto invalidado
    }
}

// Sincroniza estado inicial
function syncState() {
    if (!isExtensionValid()) return;
    try {
        chrome.storage.local.get(['trainingState'], (result) => {
            if (chrome.runtime.lastError) return;
            if (result.trainingState) {
                localTrainingState = result.trainingState;
            }
        });
    } catch (e) {}
}

if (isExtensionValid()) {
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.trainingState) {
            localTrainingState = changes.trainingState.newValue;
        }
    });
    syncState();
}

// Bridge: Background -> WebApp
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SAVE_TRAINING" && isIdentificaPixPage) {
        window.postMessage({ source: "IdentificaPixExt", type: "SAVE_TRAINING", payload: msg.payload }, "*");
    }
    if (msg.type === "ITEM_DONE" && isIdentificaPixPage) {
        window.postMessage({ source: "IdentificaPixExt", type: "ITEM_DONE", payload: msg.payload }, "*");
    }
});

// Bridge: WebApp -> Extension
window.addEventListener("message", (event) => {
    if (!event.data || event.data.source !== "IdentificaPixIA") return;
    safeSendMessage(event.data);
});

// CAPTURA DE CLIQUES (Melhorada)
document.addEventListener("click", (e) => {
    if (!localTrainingState.active || isIdentificaPixPage) return;

    const selector = generateSelector(e.target);
    console.log("%c[IdentificaPix IA] Capturando Clique: " + selector, "color: #10b981; font-weight: bold;");
    
    safeSendMessage({
        type: "ACTION_CAPTURED",
        payload: { type: "click", selector, timestamp: new Date().toISOString() }
    });
}, true);

// CAPTURA DE DIGITAÇÃO
document.addEventListener("input", (e) => {
    if (!localTrainingState.active || isIdentificaPixPage) return;
    
    const el = e.target;
    const selector = generateSelector(el);
    const value = el.value;
    let mappedProperty = null;

    const sample = localTrainingState.sampleItem;
    if (sample) {
        const valStr = String(value).toLowerCase().trim();
        if (valStr === String(sample.name).toLowerCase().trim()) mappedProperty = "name";
        else if (valStr === String(sample.amount).toLowerCase().trim()) mappedProperty = "amount";
        else if (valStr === String(sample.date).toLowerCase().trim()) mappedProperty = "date";
        else if (valStr === String(sample.church).toLowerCase().trim()) mappedProperty = "church";
    }

    console.log("%c[IdentificaPix IA] Capturando Texto: " + selector, "color: #3b82f6; font-weight: bold;");
    
    safeSendMessage({
        type: "ACTION_CAPTURED",
        payload: { type: "input", selector, value, mappedProperty, timestamp: new Date().toISOString() }
    });
}, true);

function generateSelector(el) {
    if (!el) return "unknown";
    if (el.id) return "#" + el.id;
    
    // Tenta por nome (comum em formulários de banco)
    if (el.name) return `[name="${el.name}"]`;
    
    // Tenta por ARIA label
    const aria = el.getAttribute('aria-label');
    if (aria) return `[aria-label="${aria}"]`;

    let selector = el.tagName.toLowerCase();
    if (el.className && typeof el.className === "string") {
        // Filtra classes dinâmicas ou muito longas (comum em SPAs)
        const classes = el.className.trim()
            .split(/\s+/)
            .filter(c => c.length > 0 && c.length < 30 && !/\d/.test(c) && !c.includes(':') && !c.includes('[') && !c.includes('/'))
            .join('.');
        if (classes) selector += "." + classes;
    }

    // Se o seletor for muito genérico (ex: "div"), adiciona o texto interno se for curto
    if (selector === "span" || selector === "button" || selector === "div") {
        const text = el.innerText?.trim();
        if (text && text.length > 0 && text.length < 20) {
            // Seletor por texto é frágil, mas melhor que nada para botões sem ID
            return `${selector}:contains("${text}")`; // Nota: :contains é interpretado pelo nosso executor
        }
    }

    return selector;
}
