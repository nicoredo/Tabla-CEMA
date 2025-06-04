chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Mensaje recibido:", request);
  sendResponse({ ok: true });
  return true;
});
// vacío