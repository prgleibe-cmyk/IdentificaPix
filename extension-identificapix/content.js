
// content.js - Injetado em todas as páginas

let localTrainingState = { active: false };
let executionMode = false;
let successObserver = null;
const SUCCESS_KEYWORDS = ["sucesso", "salvo", "concluido", "finalizado", "realizado", "gravado", "success", "saved"];

// Trava de segurança: Não grava ações se estivermos dentro do IdentificaPix
const isIdentificaPixPage = window.location.href.includes("identificapix.com.br") || window.location.hostname === "localhost";

// Sincroniza estado de treino do storage continuamente
chrome.storage.onChanged.addListener((changes) => {
  if (changes.trainingState) {
    localTrainingState = changes.trainingState.newValue;
    console.log("[IdentificaPix IA] Sincronização de Estado:", localTrainingState.active);
  }
});

// Carga inicial do estado
chrome.storage.local.get(['trainingState'], (result) => {
  if (result.trainingState) localTrainingState = result.trainingState;
});

// --- LISTENER DE MENSAGENS DO BACKGROUND ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[IdentificaPix IA] Mensagem recebida do Background:", msg.type);

  if (msg.type === "SAVE_TRAINING") {
    // Tenta postar a mensagem para a janela atual (WebApp) apenas se for a página do app
    if (isIdentificaPixPage) {
        window.postMessage({ 
          source: "IdentificaPixExt", 
          type: "SAVE_TRAINING", 
          payload: msg.payload 
        }, "*");
        console.log("[IdentificaPix IA] Encaminhado SAVE_TRAINING para o App");
    }
  }
  
  if (msg.type === "EXECUTE_ITEM" && !isIdentificaPixPage) {
    executeItemInPage(msg.payload);
  }

  if (msg.type === "ITEM_DONE" && isIdentificaPixPage) {
     window.postMessage({ source: "IdentificaPixExt", type: "ITEM_DONE", payload: msg.payload }, "*");
  }
});

// --- BRIDGE: WEBAPP -> EXTENSION ---
window.addEventListener("message", (event) => {
  if (!event.data || event.data.source !== "IdentificaPixIA") return;
  
  console.log("[IdentificaPix IA] Comando vindo do App:", event.data.type);
  chrome.runtime.sendMessage(event.data);
});

// --- CAPTURA DE EVENTOS (MODO TREINO) ---
function generateSelector(el) {
  if (!el) return "unknown";
  if (el.id) return "#" + el.id;
  if (el.name) return `[name="${el.name}"]`;
  
  let selector = el.tagName.toLowerCase();
  if (el.className && typeof el.className === "string") {
    const classes = el.className.trim().split(/\s+/).filter(c => !c.includes(':') && !c.includes('.') && c.length > 0).join('.');
    if (classes) selector += "." + classes;
  }
  return selector;
}

document.addEventListener("click", (e) => {
  if (!localTrainingState.active || isIdentificaPixPage) return;
  const selector = generateSelector(e.target);
  console.log("[IdentificaPix IA] Capturando Clique no Alvo:", selector);
  chrome.runtime.sendMessage({
    type: "ACTION_CAPTURED",
    payload: { type: "click", selector, timestamp: new Date().toISOString() }
  });
}, true);

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
    else if (value === String(sample.church)) mappedProperty = "church";
  }

  console.log("[IdentificaPix IA] Capturando Input no Alvo:", selector);
  chrome.runtime.sendMessage({
    type: "ACTION_CAPTURED",
    payload: { type: "input", selector, value, mappedProperty, timestamp: new Date().toISOString() }
  });
}, true);

// --- EXECUTOR (MODO EXECUÇÃO) ---
async function executeItemInPage(payload) {
  const { macro, data } = payload;
  executionMode = true;
  startSuccessObserver();

  console.log("[IdentificaPix IA] Iniciando automação no alvo...");

  for (const step of macro.steps) {
    if (!executionMode) break;
    const element = document.querySelector(step.selector);
    if (!element) continue;

    await new Promise(r => setTimeout(r, 600));

    if (step.type === "click") {
      element.click();
    } 
    else if (step.type === "input") {
      let valueToInject = step.value;
      if (step.mappedProperty === "name") valueToInject = data.name;
      else if (step.mappedProperty === "amount") valueToInject = data.amount;
      else if (step.mappedProperty === "date") valueToInject = data.date;
      else if (step.mappedProperty === "church") valueToInject = data.church;

      element.value = valueToInject;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

function notifyDone(id) {
    executionMode = false;
    if (successObserver) successObserver.disconnect();
    chrome.runtime.sendMessage({ type: "ITEM_DONE", payload: { id } });
}

function startSuccessObserver() {
    successObserver = new MutationObserver(() => {
        const text = document.body.innerText.toLowerCase();
        if (SUCCESS_KEYWORDS.some(k => text.includes(k))) {
            notifyDone("auto-detect");
        }
    });
    successObserver.observe(document.body, { childList: true, subtree: true });
}
