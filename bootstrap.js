(function () {
  "use strict";

  const VERSION = "11.1.0";

  function showFatal(message, error) {
    let panel = document.getElementById("fatalDiagnostic");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "fatalDiagnostic";
      panel.style.cssText = "margin:14px;padding:14px;border:2px solid #ff6b78;border-radius:14px;background:#321218;color:#ffe8ea;font-family:monospace;white-space:pre-wrap;word-break:break-word";
      document.body.prepend(panel);
    }

    panel.textContent += `${panel.textContent ? "\n\n" : ""}❌ ${message}\n${error?.name || "Error"}: ${error?.message || String(error || "")}\n${error?.stack || ""}`;
  }

  window.addEventListener("error", (event) => {
    showFatal(
      `Error global en ${event.filename?.split("/").pop() || "archivo desconocido"}, línea ${event.lineno || "?"}.`,
      event.error || new Error(event.message || "Error desconocido")
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    showFatal(
      "Promesa rechazada.",
      event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Sin detalle"))
    );
  });

  async function start() {
    try {
      await import(`./app.js?v=${VERSION}`);
    } catch (error) {
      showFatal("No se pudo iniciar app.js.", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
