
// background.js - O cérebro persistente da extensão

// Função auxiliar para gerenciar o estado no storage (Necessário no Manifest V3)
async function getTrainingState() {
  const result = await chrome.storage.local.get(['trainingState']);
  return result.trainingState || { active: false, steps: [], appTabId: null };
}

async function updateTrainingState(newState) {
  await chrome.storage.local.set({ trainingState: newState });
}

// Listener para mensagens
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  (async () => {
    let state = await getTrainingState();

    // 1. Início do Treino
    if (msg.type === "START_TRAINING") {
      state = {
        active: true,
        bankName: msg.payload.bankName || "Sistema Alvo",
        steps: [],
        appTabId: sender.tab.id,
        sampleItem: msg.payload.sampleItem
      };
      await updateTrainingState(state);
      console.log("[IdentificaPix BG] Treino Iniciado e Persistido. Tab App:", sender.tab.id);
    }

    // 2. Captura de Ação
    if (msg.type === "ACTION_CAPTURED" && state.active) {
      state.steps.push(msg.payload);
      await updateTrainingState(state);
      console.log("[IdentificaPix BG] Ação gravada. Total de passos:", state.steps.length);
    }

    // 3. Fim do Treino
    if (msg.type === "STOP_TRAINING") {
      console.log("[IdentificaPix BG] Finalizando treino. Passos capturados:", state.steps.length);
      
      const finalMacro = {
        bankName: state.bankName,
        steps: state.steps,
        targetUrl: sender.tab.url // Salva a URL onde o treino ocorreu
      };
      
      const appTabId = state.appTabId;

      // Reseta estado
      await updateTrainingState({ active: false, steps: [], appTabId: null });

      if (appTabId) {
        chrome.tabs.sendMessage(appTabId, {
          type: "SAVE_TRAINING",
          payload: finalMacro
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("[IdentificaPix BG] Erro ao enviar para o App:", chrome.runtime.lastError.message);
            } else {
                console.log("[IdentificaPix BG] Macro enviada para o App com sucesso.");
            }
        });
      }
    }

    // 4. Execução de Lançamento (Automático)
    if (msg.type === "EXECUTE_ITEM") {
      chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
              if (tab.id !== sender.tab.id) {
                  chrome.tabs.sendMessage(tab.id, msg, () => {
                      if (chrome.runtime.lastError) { /* Ignora abas sem script */ }
                  });
              }
          });
      });
    }

    // 5. Item Concluído
    if (msg.type === "ITEM_DONE") {
      const currentState = await getTrainingState();
      // Tenta enviar para a aba do app que estava gravada ou para qualquer aba do identificapix aberta
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

  return true; // Mantém o canal aberto para o async
});
