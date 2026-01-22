
// background.js - O cérebro da extensão

let trainingState = {
  active: false,
  bankName: "",
  steps: [],
  appTabId: null,
  sampleItem: null
};

// Listener para mensagens de qualquer aba (App ou Banco)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  // 1. Início do Treino (Vem do WebApp)
  if (msg.type === "START_TRAINING") {
    trainingState = {
      active: true,
      bankName: msg.payload.bankName,
      steps: [],
      appTabId: sender.tab.id,
      sampleItem: msg.payload.sampleItem
    };
    chrome.storage.local.set({ trainingState });
    console.log("[IdentificaPix BG] Treino Iniciado na aba:", sender.tab.id);
  }

  // 2. Captura de Ação (Vem do Content Script do Banco)
  if (msg.type === "ACTION_CAPTURED" && trainingState.active) {
    trainingState.steps.push(msg.payload);
    chrome.storage.local.set({ trainingState });
  }

  // 3. Fim do Treino (Vem do WebApp)
  if (msg.type === "STOP_TRAINING") {
    const finalMacro = {
      bankName: trainingState.bankName,
      steps: trainingState.steps,
      targetUrl: msg.payload.targetUrl
    };
    
    trainingState.active = false;
    chrome.storage.local.set({ trainingState });

    if (trainingState.appTabId) {
      chrome.tabs.sendMessage(trainingState.appTabId, {
        type: "SAVE_TRAINING",
        payload: finalMacro
      }, () => {
          if (chrome.runtime.lastError) {
              console.warn("[IdentificaPix BG] Aba do app não respondeu ao salvamento.");
          }
      });
    }
  }

  // 4. Execução de Lançamento (Vem do WebApp)
  if (msg.type === "EXECUTE_ITEM") {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            // Envia apenas para abas que NÃO são a do aplicativo
            if (tab.id !== sender.tab.id) {
                chrome.tabs.sendMessage(tab.id, msg, () => {
                    if (chrome.runtime.lastError) { /* Silencia erro se a aba não tiver o listener */ }
                });
            }
        });
    });
  }

  // 5. Item Concluído (Vem do Banco -> Volta pro App)
  if (msg.type === "ITEM_DONE" && trainingState.appTabId) {
    chrome.tabs.sendMessage(trainingState.appTabId, msg, () => {
        if (chrome.runtime.lastError) { /* Silencia erro */ }
    });
  }

  sendResponse({ status: "ok" });
  return true;
});
