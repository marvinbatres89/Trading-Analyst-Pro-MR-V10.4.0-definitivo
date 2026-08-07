(function () {
  "use strict";

  const SELECT_IDS = ["marketSelect", "strategySelect", "modeSelect"];

  function closeAll(except = null) {
    document.querySelectorAll(".custom-select-shell.open").forEach((shell) => {
      if (shell === except) return;
      shell.classList.remove("open");
      shell.querySelector(".custom-select-trigger")?.setAttribute("aria-expanded", "false");
    });
  }

  function makeOption(nativeSelect, option, panel, triggerText) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "custom-select-option";
    item.setAttribute("role", "option");
    item.dataset.value = option.value;

    const text = document.createElement("span");
    text.className = "custom-select-option-text";
    text.textContent = option.textContent;

    const indicator = document.createElement("span");
    indicator.className = "custom-select-radio";
    indicator.setAttribute("aria-hidden", "true");

    item.append(text, indicator);

    function syncSelected() {
      const selected = nativeSelect.value === option.value;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-selected", String(selected));
      if (selected) triggerText.textContent = option.textContent;
    }

    item.addEventListener("click", () => {
      nativeSelect.value = option.value;
      nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      panel.closest(".custom-select-shell")?.classList.remove("open");
      panel.closest(".custom-select-shell")
        ?.querySelector(".custom-select-trigger")
        ?.setAttribute("aria-expanded", "false");
      syncSelected();
    });

    nativeSelect.addEventListener("change", syncSelected);
    syncSelected();

    return item;
  }

  function enhance(nativeSelect) {
    if (!nativeSelect || nativeSelect.dataset.enhanced === "true") return;
    nativeSelect.dataset.enhanced = "true";
    nativeSelect.classList.add("native-select-hidden");

    const shell = document.createElement("div");
    shell.className = "custom-select-shell";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const triggerText = document.createElement("span");
    triggerText.className = "custom-select-trigger-text";
    triggerText.textContent =
      nativeSelect.options[nativeSelect.selectedIndex]?.textContent || "Seleccione";

    const arrow = document.createElement("span");
    arrow.className = "custom-select-arrow";
    arrow.setAttribute("aria-hidden", "true");

    trigger.append(triggerText, arrow);

    const panel = document.createElement("div");
    panel.className = "custom-select-panel";
    panel.setAttribute("role", "listbox");

    [...nativeSelect.options].forEach((option) => {
      panel.appendChild(makeOption(nativeSelect, option, panel, triggerText));
    });

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (nativeSelect.disabled) return;
      const willOpen = !shell.classList.contains("open");
      closeAll(shell);
      shell.classList.toggle("open", willOpen);
      trigger.setAttribute("aria-expanded", String(willOpen));
    });

    const observer = new MutationObserver(() => {
      shell.classList.toggle("disabled", nativeSelect.disabled);
      trigger.disabled = nativeSelect.disabled;
    });

    observer.observe(nativeSelect, {
      attributes: true,
      attributeFilter: ["disabled"]
    });

    nativeSelect.parentNode.insertBefore(shell, nativeSelect.nextSibling);
    shell.append(trigger, panel);
    shell.classList.toggle("disabled", nativeSelect.disabled);
    trigger.disabled = nativeSelect.disabled;
  }

  document.addEventListener("click", () => closeAll());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });

  function init() {
    SELECT_IDS.forEach((id) => enhance(document.getElementById(id)));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
