// --- ESTADO DE TREINAMENTO ---
let trainingMode = false;
let capturedSteps = [];
let currentBankName = "Desconhecido";

// --- EXECUTOR MODULAR (PREPARAÇÃO PARA AÇÕES REAIS) ---
/**
 * Função responsável por traduzir o comando da IA em ações no DOM.
 */
async function executeItemInPage(item) {
  console.log("%c[IdentificaPix IA] Executor pronto para agir:", "color: #f59e0b; font-weight: bold;", item);

  // Simulação de latência de processamento
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("%c[IdentificaPix IA] Simulação de execução concluída para item:", "color: #10b981;", item.id);
      resolve({ success: true });
    }, 1000);
  });
}

// Bridge: WebApp -> Extension
window.addEventListener("message", async (event) => {
  // Security and source check
  if (!event.data || event.data.source !== "IdentificaPixIA") return;

  const { type, payload } = event.data;

  // Gerenciamento de Treinamento (Observação)
  if (type === "START_TRAINING") {
    trainingMode = true;
    capturedSteps = [];
    currentBankName = payload.bankName || "Desconhecido";
    console.log(`%c[IdentificaPix IA] Modo Treinamento ATIVADO (${currentBankName}). Observando interações...`, "color: #8b5cf6; font-weight: bold;");
  }

  if (type === "STOP_TRAINING") {
    trainingMode = false;
    console.log("%c[IdentificaPix IA] Modo Treinamento FINALIZADO.", "color: #8b5cf6; font-weight: bold;", capturedSteps);
    
    // Enviar passos capturados para a aplicação para persistência no Supabase
    window.postMessage({
        source: "IdentificaPixExt",
        type: "SAVE_TRAINING",
        payload: { 
            bankName: currentBankName,
            steps: capturedSteps 
        }
    }, "*");
  }

  // Handle specific message types from IdentificaPix IA Engine
  if (type === "EXECUTE_ITEM") {
    console.log("%c[IdentificaPix Ext] Recebido comando via postMessage:", "color: #3b82f6; font-weight: bold;", payload);
    await executeItemInPage(payload);
  }

  if (type === "ITEM_DONE") {
    console.log("%c[IdentificaPix Ext] Registro de finalização:", "color: #10b981; font-weight: bold;", payload);
  }
});

// Helper: Generates unique CSS selector for learning mode
function generateSelector(el) {
  if (!el) return "unknown";
  if (el.id) return "#" + el.id;
  if (el.name) return `[name="${el.name}"]`;
  
  let selector = el.tagName.toLowerCase();
  if (el.className && typeof el.className === "string") {
    const classes = el.className.trim().split(/\s+/).filter(c => !c.includes(':')).join('.');
    if (classes) selector += "." + classes;
  }
  return selector;
}

// CAPTURA DE CLIQUES (Learning Mode)
document.addEventListener("click", (e) => {
  if (!trainingMode) return;

  const el = e.target;
  const selector = generateSelector(el);

  capturedSteps.push({
    type: "click",
    selector,
    text: el.innerText?.substring(0, 50) || null,
    timestamp: new Date().toISOString()
  });

  console.log("%c[IA Learn] Clique capturado:", "color: #a855f7;", selector);
}, true);

// CAPTURA DE DIGITAÇÃO (Learning Mode)
document.addEventListener("input", (e) => {
  if (!trainingMode) return;

  const el = e.target;
  if (!el) return;

  const selector = generateSelector(el);

  // Captura o valor final digitado
  capturedSteps.push({
    type: "input",
    selector,
    value: el.value,
    timestamp: new Date().toISOString()
  });

  console.log("%c[IA Learn] Input capturado:", "color: #a855f7;", selector, el.value);
}, true);

// Execution Listener (Automation Mode - Response to Background relay)
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "EXECUTE_ITEM") {
    console.log("%c[IdentificaPix IA] Executor acionado via Background Relay...", "color: #f59e0b; font-weight: bold;");
    await executeItemInPage(msg.payload);
  }
});