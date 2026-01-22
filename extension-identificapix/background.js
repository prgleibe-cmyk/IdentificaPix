
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
  console.log("[IdentificaPix BG] Mensagem:", msg.type);

  // 1. Início do Treino (Vem do WebApp)
  if (msg.type === "START_TRAINING") {
    trainingState = {
      active: true,
      bankName: msg.payload.bankName,
      steps: [],
      appTabId: sender.tab.id,
      sampleItem: msg.payload.sampleItem
    };
    // Sincroniza com o storage para os content scripts de outras abas lerem
    chrome.storage.local.set({ trainingState });
    console.log("[IdentificaPix BG] Treino Iniciado");
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
    
    // Reseta estado global
    trainingState.active = false;
    chrome.storage.local.set({ trainingState });

    // Envia o resultado de volta apenas para a aba do IdentificaPix
    if (trainingState.appTabId) {
      chrome.tabs.sendMessage(trainingState.appTabId, {
        type: "SAVE_TRAINING",
        payload: finalMacro
      });
    }
  }

  // 4. Execução de Lançamento (Vem do WebApp)
  if (msg.type === "EXECUTE_ITEM") {
    // Procura por abas que não sejam a do app para tentar executar
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id !== sender.tab.id) {
                chrome.tabs.sendMessage(tab.id, msg);
            }
        });
    });
  }

  // 5. Item Concluído (Vem do Banco -> Volta pro App)
  if (msg.type === "ITEM_DONE" && trainingState.appTabId) {
    chrome.tabs.sendMessage(trainingState.appTabId, msg);
  }

  sendResponse({ status: "ok" });
  return true;
});
