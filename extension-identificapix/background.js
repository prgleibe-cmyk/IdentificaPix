
// background.js - O cérebro persistente v1.0.3

async function getTrainingState() {
  try {
    const result = await chrome.storage.local.get(['trainingState']);
    return result.trainingState || { active: false, steps: [], appTabId: null };
  } catch (e) {
    return { active: false, steps: [], appTabId: null };
  }
}

async function updateTrainingState(newState) {
  await chrome.storage.local.set({ trainingState: newState });
}

// Escuta mensagens de todas as abas
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  (async () => {
    let state = await getTrainingState();

    // 1. Início do Treino (Vindo do App)
    if (msg.type === "START_TRAINING") {
      state = {
        active: true,
        bankName: msg.payload?.bankName || "Sistema Alvo",
        steps: [],
        appTabId: sender.tab.id,
        sampleItem: msg.payload?.sampleItem
      };
      await updateTrainingState(state);
      console.log("[IdentificaPix BG] Treino Iniciado.");
    }

    // 2. Captura de Ação (Vindo do Banco)
    if (msg.type === "ACTION_CAPTURED" && state.active) {
      state.steps.push(msg.payload);
      await updateTrainingState(state);
    }

    // 3. Fim do Treino (Vindo do App)
    if (msg.type === "STOP_TRAINING") {
      console.log("[IdentificaPix BG] Finalizando treino. Passos capturados:", state.steps.length);
      
      const finalMacro = {
        bankName: state.bankName,
        steps: state.steps,
        targetUrl: sender.tab.url
      };
      
      // Reseta estado
      await updateTrainingState({ active: false, steps: [], appTabId: null });

      // BUSCA DINÂMICA: Encontra a aba do IdentificaPix para entregar o presente
      chrome.tabs.query({url: ["*://*.identificapix.com.br/*", "*://localhost/*"]}, (tabs) => {
          if (tabs.length > 0) {
              // Tenta enviar para a aba que iniciou, ou a primeira que encontrar
              const targetTab = tabs.find(t => t.id === state.appTabId) || tabs[0];
              chrome.tabs.sendMessage(targetTab.id, {
                type: "SAVE_TRAINING",
                payload: finalMacro
              }, () => {
                  if (chrome.runtime.lastError) {
                      console.warn("[IdentificaPix BG] Aba destino não respondeu.");
                  }
              });
          }
      });
    }

    // 4. Execução Automática
    if (msg.type === "EXECUTE_ITEM") {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id !== sender.tab.id) {
            chrome.tabs.sendMessage(tab.id, msg, () => { if (chrome.runtime.lastError) {} });
          }
        });
      });
    }

    // 5. Notificação de Sucesso
    if (msg.type === "ITEM_DONE") {
      chrome.tabs.query({url: ["*://*.identificapix.com.br/*", "*://localhost/*"]}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, msg, () => { if (chrome.runtime.lastError) {} });
        });
      });
    }

    sendResponse({ status: "ok" });
  })();

  return true;
});
