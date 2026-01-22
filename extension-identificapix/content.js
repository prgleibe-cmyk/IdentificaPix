
// content.js - Sensores de interface

let localTrainingState = { active: false };
const isIdentificaPixPage = window.location.href.includes("identificapix.com.br") || window.location.hostname === "localhost";

// Sincroniza estado inicial e mudanças
function syncState() {
    chrome.storage.local.get(['trainingState'], (result) => {
        if (result.trainingState) {
            localTrainingState = result.trainingState;
            if (localTrainingState.active) {
                console.log("[IdentificaPix IA] Modo Treino está ATIVO nesta aba.");
            }
        }
    });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.trainingState) {
    localTrainingState = changes.trainingState.newValue;
  }
});

syncState();

// Bridge: Mensagens do Background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SAVE_TRAINING" && isIdentificaPixPage) {
    console.log("[IdentificaPix IA] Recebido SAVE_TRAINING do BG. Repassando para o WebApp...");
    window.postMessage({ source: "IdentificaPixExt", type: "SAVE_TRAINING", payload: msg.payload }, "*");
  }
  
  if (msg.type === "EXECUTE_ITEM" && !isIdentificaPixPage) {
    // Lógica de execução automática aqui...
  }
});

// Bridge: WebApp -> Extension
window.addEventListener("message", (event) => {
  if (!event.data || event.data.source !== "IdentificaPixIA") return;
  chrome.runtime.sendMessage(event.data);
});

// CAPTURA DE CLIQUES
document.addEventListener("click", (e) => {
  if (!localTrainingState.active) return;
  
  if (isIdentificaPixPage) {
      console.log("[IdentificaPix IA] Clique ignorado (aba do aplicativo)");
      return;
  }

  const selector = generateSelector(e.target);
  console.log("%c[IdentificaPix IA] Capturando Clique no Alvo: " + selector, "color: #10b981; font-weight: bold;");
  
  chrome.runtime.sendMessage({
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
    if (value === String(sample.name)) mappedProperty = "name";
    else if (value === String(sample.amount)) mappedProperty = "amount";
    else if (value === String(sample.date)) mappedProperty = "date";
  }

  console.log("%c[IdentificaPix IA] Capturando Digitação no Alvo: " + selector, "color: #3b82f6; font-weight: bold;");
  
  chrome.runtime.sendMessage({
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
    // Remove classes do tailwind dinâmicas (que começam com - ou números) para estabilidade
    const classes = el.className.trim().split(/\s+/).filter(c => !c.includes(':') && c.length > 0 && !/^\d/.test(c)).join('.');
    if (classes) selector += "." + classes;
  }
  return selector;
}
