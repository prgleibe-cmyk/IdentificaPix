
// background.js - O cérebro persistente v1.0.2

async function getTrainingState() {
  const result = await chrome.storage.local.get(['trainingState']);
  return result.trainingState || { active: false, steps: [], appTabId: null };
}

async function updateTrainingState(newState) {
  await chrome.storage.local.set({ trainingState: newState });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  (async () => {
    let state = await getTrainingState();

    if (msg.type === "START_TRAINING") {
      state = {
        active: true,
        bankName: msg.payload.bankName || "Sistema Alvo",
        steps: [],
        appTabId: sender.tab.id,
        sampleItem: msg.payload.sampleItem
      };
      await updateTrainingState(state);
      console.log("[IdentificaPix BG] Treino Iniciado. App Tab:", sender.tab.id);
    }

    if (msg.type === "ACTION_CAPTURED" && state.active) {
      state.steps.push(msg.payload);
      await updateTrainingState(state);
    }

    if (msg.type === "STOP_TRAINING") {
      console.log("[IdentificaPix BG] Finalizando treino. Passos:", state.steps.length);
      
      const finalMacro = {
        bankName: state.bankName,
        steps: state.steps,
        targetUrl: sender.tab.url
      };
      
      // Reseta estado imediatamente no storage
      await updateTrainingState({ active: false, steps: [], appTabId: null });

      // Busca dinamicamente qualquer aba do IdentificaPix para enviar o resultado
      chrome.tabs.query({url: ["*://*.identificapix.com.br/*", "*://localhost/*"]}, (tabs) => {
          if (tabs.length > 0) {
              // Tenta enviar para a aba original, se falhar, tenta na primeira encontrada
              const targetTab = tabs.find(t => t.id === state.appTabId) || tabs[0];
              chrome.tabs.sendMessage(targetTab.id, {
                type: "SAVE_TRAINING",
                payload: finalMacro
              }, (response) => {
                  if (chrome.runtime.lastError) {
                      console.error("[IdentificaPix BG] Falha ao entregar para o App:", chrome.runtime.lastError.message);
                  } else {
                      console.log("[IdentificaPix BG] Macro entregue com sucesso à aba:", targetTab.id);
                  }
              });
          } else {
              console.error("[IdentificaPix BG] Nenhuma aba do IdentificaPix encontrada para salvar!");
          }
      });
    }

    if (msg.type === "EXECUTE_ITEM") {
      chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
              if (tab.id !== sender.tab.id) {
                  chrome.tabs.sendMessage(tab.id, msg, () => {
                      if (chrome.runtime.lastError) { /* ignore */ }
                  });
              }
          });
      });
    }

    if (msg.type === "ITEM_DONE") {
      chrome.tabs.query({url: ["*://*.identificapix.com.br/*", "*://localhost/*"]}, (tabs) => {
          tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, msg, () => {
                  if (chrome.runtime.lastError) { /* ignore */ }
              });
          });
      });
    }

    sendResponse({ status: "processed" });
  })();

  return true;
});
