
// content.js - Sensores de interface v1.0.2

let localTrainingState = { active: false };
const isIdentificaPixPage = window.location.href.includes("identificapix.com.br") || window.location.hostname === "localhost";

// Função segura para enviar mensagens
function safeSendMessage(message) {
    try {
        if (chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage(message);
        }
    } catch (e) {
        if (e.message.includes("context invalidated")) {
            console.warn("[IdentificaPix IA] Extensão atualizada. Por favor, recarregue a página (F5).");
        } else {
            console.error("[IdentificaPix IA] Erro ao enviar mensagem:", e);
        }
    }
}

// Sincroniza estado inicial e mudanças
function syncState() {
    try {
        chrome.storage.local.get(['trainingState'], (result) => {
            if (chrome.runtime.lastError) return;
            if (result.trainingState) {
                localTrainingState = result.trainingState;
                if (localTrainingState.active) {
                    console.log("[IdentificaPix IA] Modo Treino está ATIVO nesta aba.");
                }
            }
        });
    } catch (e) { /* Silencia erro de contexto */ }
}

chrome.storage.onChanged.addListener((changes) => {
    if (changes.trainingState) {
        localTrainingState = changes.trainingState.newValue;
    }
});

syncState();

// Bridge: Mensagens do Background -> WebApp
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SAVE_TRAINING" && isIdentificaPixPage) {
        console.log("%c[IdentificaPix IA] Recebido SAVE_TRAINING. Repassando ao App...", "color: #8b5cf6; font-weight: bold;");
        window.postMessage({ 
            source: "IdentificaPixExt", 
            type: "SAVE_TRAINING", 
            payload: msg.payload 
        }, "*");
    }
    
    // Encaminha fim de execução para o App
    if (msg.type === "ITEM_DONE" && isIdentificaPixPage) {
        window.postMessage({ source: "IdentificaPixExt", type: "ITEM_DONE", payload: msg.payload }, "*");
    }
});

// Bridge: WebApp -> Extension
window.addEventListener("message", (event) => {
    if (!event.data || event.data.source !== "IdentificaPixIA") return;
    safeSendMessage(event.data);
});

// CAPTURA DE CLIQUES
document.addEventListener("click", (e) => {
    if (!localTrainingState.active) return;
    
    if (isIdentificaPixPage) {
        console.log("[IdentificaPix IA] Clique ignorado (dentro do IdentificaPix)");
        return;
    }

    const selector = generateSelector(e.target);
    console.log("%c[IdentificaPix IA] Capturando Clique no Alvo: " + selector, "color: #10b981; font-weight: bold;");
    
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

    // Tenta mapear o valor digitado ao item de exemplo do treino
    const sample = localTrainingState.sampleItem;
    if (sample) {
        const valStr = String(value).toLowerCase();
        if (valStr === String(sample.name).toLowerCase()) mappedProperty = "name";
        else if (valStr === String(sample.amount).toLowerCase()) mappedProperty = "amount";
        else if (valStr === String(sample.date).toLowerCase()) mappedProperty = "date";
    }

    console.log("%c[IdentificaPix IA] Capturando Digitação no Alvo: " + selector, "color: #3b82f6; font-weight: bold;");
    
    safeSendMessage({
        type: "ACTION_CAPTURED",
        payload: { type: "input", selector, value, mappedProperty, timestamp: new Date().toISOString() }
    });
}, true);

function generateSelector(el) {
    if (!el) return "unknown";
    if (el.id) return "#" + el.id;
    if (el.name) return `[name="${el.name}"]`;
    
    let selector = el.tagName.toLowerCase();
    if (el.className && typeof el.className === "string") {
        const classes = el.className.trim()
            .split(/\s+/)
            .filter(c => !c.includes(':') && c.length > 0 && !/^\d/.test(c) && !c.includes('[') && !c.includes('/'))
            .join('.');
        if (classes) selector += "." + classes;
    }
    return selector;
}
