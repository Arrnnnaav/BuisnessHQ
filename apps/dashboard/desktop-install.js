if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js");

let installPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  const button = document.createElement("button");
  button.className = "primary desktop-install";
  button.textContent = "Install desktop app";
  button.onclick = async () => {
    await installPrompt.prompt();
    installPrompt = null;
    button.remove();
  };
  document.body.append(button);
});
