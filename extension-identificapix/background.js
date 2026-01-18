
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[IdentificaPix Ext] Message received in background:", msg);

  if (msg.type === "EXECUTE_ITEM" && sender.tab) {
    // Relay command to the content script of the same tab
    chrome.tabs.sendMessage(sender.tab.id, msg);
  }

  if (msg.type === "LEARN_SELECTOR") {
    // Logic to store or pass back to the app for training
    console.debug("[IdentificaPix Ext] Selector learned:", msg.payload);
  }

  sendResponse({ status: "ok" });
  return true;
});
