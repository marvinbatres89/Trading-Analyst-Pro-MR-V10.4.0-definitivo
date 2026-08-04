import {
  APP_VERSION,
  ENGINE,
  MARKETS,
  STRATEGIES
} from "./config.js";
import { diagnostics } from "./diagnostics.js";
import { derivAPI } from "./deriv-api.js";
import { marketBuffer } from "./market-buffer.js";
import { latencyMonitor } from "./latency-monitor.js";
import { buildSnapshot } from "./indicators.js";
import { exploreOpportunity } from "./engine1.js";
import { validateOpportunity } from "./engine2.js";
import { buildConsensus } from "./consensus.js";
import { evaluateTiming } from "./timing.js";
import { applyQualityFilter } from "./quality-filter.js";
import { statistics } from "./statistics.js";
import { memoryManager } from "./memory-manager.js";
import { voiceAssistant } from "./voice.js";
import { visualDirection, briefExplanation } from "./prediction.js";
import { executionCalibrator } from "./execution-calibrator.js";

const $ = (id) => document.getElementById(id);

const UI = {};
[
  "connectionStatus","engineStatus","memoryStatus","latencyStatus",
  "marketSelect","strategySelect","modeSelect",
  "connectButton","disconnectButton","engineButton","predictionButton",
  "controlMessage","marketName","price","tickCount","lastDigit","updateTime",
  "digits","trend","rsi","momentum","volatility",
  "engineStage","engineDetail","engineProgress",
  "signalCard","signalState","signalTitle","signalValue","signalScore",
  "signalBar","signalReasons","countdown",
  "floatingSignal","floatingState","floatingValue","floatingDetail",
  "voiceButton","voiceSelect","voiceRate","voiceRateValue","voiceTest",
  "diagnosticButton","diagnosticPanel","diagnosticContent","copyDiagnostic","clearDiagnostic",
  "activityLog","clearLog",
  "statsTests","statsSuccess","statsFailed","statsAccuracy","resetStats",
  "calibrationStatus","calibrationSummary","executedSecond","manualResult",
  "saveCalibration","resetCalibration","calibrationTable"
].forEach((id) => { UI[id] = $(id); });

const state = {
  connected: false,
  engineOn: false,
  predictionActive: false,
  cooldown: false,
  symbol: "1HZ100V",
  strategy: "rise_fall",
  mode: "fast",
  snapshot: null,
  lastOpportunity: null,
  latency: latencyMonitor.current,
  countdownTimer: null,
  cooldownTimer: null,
  lastPredictionResult: null
};

function setText(element, value) {
  if (element) element.textContent = String(value);
}

function log(message, level = "") {
  if (!UI.activityLog) return;

  const line = document.createElement("p");
  line.textContent = `[${new Date().toLocaleTimeString("es-SV")}] ${message}`;
  line.className = level;
  UI.activityLog.prepend(line);

  while (UI.activityLog.children.length > ENGINE.maxLogLines) {
    UI.activityLog.lastElementChild?.remove();
  }
}

function statsKey() {
  return [state.symbol, state.strategy, state.mode].join("|");
}

function renderStats() {
  const value = statistics.get(statsKey());
  const accuracy = value.tests ? (value.success / value.tests) * 100 : null;

  setText(UI.statsTests, value.tests);
  setText(UI.statsSuccess, value.success);
  setText(UI.statsFailed, value.failed);
  setText(UI.statsAccuracy, accuracy === null ? "NO DATA" : `${accuracy.toFixed(1)}%`);
}

function minimumTicks() {
  return state.mode === "deep" ? ENGINE.minDeepTicks : ENGINE.minFastTicks;
}

function canPredict() {
  return (
    state.connected &&
    state.engineOn &&
    !state.predictionActive &&
    !state.cooldown &&
    marketBuffer.prices.length >= minimumTicks() &&
    state.latency.operable
  );
}

function renderControls() {
  setText(UI.engineStatus, state.engineOn ? "ON" : "OFF");
  UI.engineButton.textContent = state.engineOn ? "STOP ENGINE" : "START ENGINE";

  UI.predictionButton.disabled = !canPredict();
  UI.predictionButton.textContent = state.cooldown
    ? "ESPERE..."
    : "PREDICTION";

  const locked = state.predictionActive || state.cooldown;
  [UI.marketSelect, UI.strategySelect, UI.modeSelect]
    .forEach((element) => { element.disabled = locked; });
}

function renderConnection(status, label) {
  state.connected = status === "live";
  setText(UI.connectionStatus, label);
  UI.connectButton.disabled = status === "connecting" || status === "live";
  UI.disconnectButton.disabled = status !== "live";
  UI.engineButton.disabled = status !== "live";

  if (!state.connected && state.engineOn) stopEngine(false);
  renderControls();
}

function renderLatency() {
  const value = state.latency;
  setText(
    UI.latencyStatus,
    value.latencyMs === null
      ? "NO DATA"
      : `${value.status} · ${Math.round(value.latencyMs)} ms`
  );

  UI.latencyStatus.className = `status-pill ${
    value.operable ? "live" : value.status === "NO OPERAR" ? "danger-pill" : ""
  }`;
}

function renderDigits() {
  UI.digits.innerHTML = "";

  marketBuffer.digits.slice(-20).forEach((digit, index, array) => {
    const item = document.createElement("span");
    item.className = `digit${index === array.length - 1 ? " current" : ""}`;
    item.textContent = digit;
    UI.digits.appendChild(item);
  });
}

function renderIndicators(snapshot) {
  setText(UI.trend, snapshot.trend.direction);
  setText(UI.rsi, snapshot.rsi === null ? "--" : snapshot.rsi.toFixed(1));
  setText(UI.momentum, snapshot.momentum.direction);
  setText(UI.volatility, snapshot.volatility.level);
}

function processTick(tick) {
  if (tick.symbol !== state.symbol) return;

  const rendered = marketBuffer.push(tick);
  state.latency = latencyMonitor.update(tick);

  setText(UI.price, rendered.formatted);
  setText(UI.tickCount, marketBuffer.ticks);
  setText(UI.lastDigit, rendered.digit ?? "--");
  setText(UI.updateTime, new Date(tick.epoch * 1000).toLocaleTimeString("es-SV"));
  setText(UI.memoryStatus, marketBuffer.prices.length);

  renderDigits();
  renderLatency();

  if (state.engineOn) {
    state.snapshot = buildSnapshot({
      prices: marketBuffer.prices,
      digits: marketBuffer.digits,
      mode: state.mode
    });
    state.lastOpportunity = exploreOpportunity(state.strategy, state.snapshot);
    renderIndicators(state.snapshot);
  }

  renderControls();
}

function startEngine() {
  if (!state.connected) return;

  state.engineOn = true;
  state.snapshot = null;
  state.lastOpportunity = null;

  setText(UI.controlMessage, "Motor encendido. Análisis continuo activo en segundo plano.");
  setText(UI.engineStage, "ANÁLISIS CONTINUO");
  setText(UI.engineDetail, "Los motores preparan oportunidades; no se mostrará ninguna hasta pulsar PREDICTION.");
  UI.engineProgress.style.width = "25%";

  voiceAssistant.speak(
    `Motor encendido. ${MARKETS[state.symbol].name}. Estrategia ${STRATEGIES[state.strategy].voice}.`
  );

  diagnostics.ok("Motor encendido.", {
    symbol: state.symbol,
    strategy: state.strategy
  });
  log("Análisis continuo activado.", "ok");
  renderControls();
}

function stopEngine(announce = true) {
  state.engineOn = false;
  state.predictionActive = false;
  state.cooldown = false;
  clearInterval(state.countdownTimer);
  clearTimeout(state.cooldownTimer);

  memoryManager.clean("stop-engine");
  marketBuffer.reset();
  latencyMonitor.reset();
  state.latency = latencyMonitor.current;

  setText(UI.controlMessage, "Motor apagado y memoria temporal liberada.");
  setText(UI.engineStage, "MOTOR APAGADO");
  setText(UI.engineDetail, "Encienda el motor para comenzar un análisis limpio.");
  UI.engineProgress.style.width = "0%";
  setText(UI.price, "--");
  setText(UI.tickCount, 0);
  setText(UI.lastDigit, "--");
  setText(UI.memoryStatus, 0);
  UI.digits.innerHTML = "";
  renderLatency();

  if (announce) voiceAssistant.speak("Motor apagado. Memoria temporal liberada.");
  renderControls();
}

function showFloating(type, stateText, value, detail) {
  UI.floatingSignal.className = `signal-toast ${type} visible`;
  setText(UI.floatingState, stateText);
  setText(UI.floatingValue, value);
  setText(UI.floatingDetail, detail);
}

function hideFloating() {
  UI.floatingSignal.classList.remove("visible");
}

function showReasons(result) {
  UI.signalReasons.innerHTML = "";

  [...(result.reasons || []), ...(result.warnings || []).map((x) => `⚠ ${x}`)]
    .slice(0, 5)
    .forEach((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      UI.signalReasons.appendChild(item);
    });
}

function finishPrediction(message) {
  clearInterval(state.countdownTimer);
  state.predictionActive = false;
  state.cooldown = true;

  setText(UI.engineStage, "PREDICCIÓN FINALIZADA");
  setText(UI.engineDetail, "No se generará otra señal automáticamente.");
  UI.engineProgress.style.width = "0%";
  setText(UI.controlMessage, `${message} Puede cambiar mercado o solicitar otra predicción.`);
  hideFloating();

  voiceAssistant.speak("Predicción finalizada. Genera una nueva señal.");
  diagnostics.info("Predicción finalizada.", { message });
  renderControls();

  clearTimeout(state.cooldownTimer);
  state.cooldownTimer = setTimeout(() => {
    state.cooldown = false;
    setText(UI.engineStage, "ANÁLISIS CONTINUO");
    setText(UI.engineDetail, "Pulse PREDICTION para solicitar otra decisión.");
    renderControls();
  }, ENGINE.cooldownMs);
}



async function requestPrediction() {
  if (!canPredict()) return;

  state.predictionActive = true;
  renderControls();

  setText(UI.engineStage, "PREDICIENDO MERCADO");
  setText(UI.engineDetail, `${MARKETS[state.symbol].name} · ${STRATEGIES[state.strategy].name}`);
  UI.engineProgress.style.width = "55%";
  setText(UI.signalState, "ANALYZING");
  setText(UI.signalTitle, "Validación rápida");
  setText(UI.signalValue, "--");
  setText(UI.countdown, "--");

  voiceAssistant.speak(`Prediciendo ${MARKETS[state.symbol].name}.`);
  diagnostics.info("Predicción solicitada.", {
    symbol: state.symbol,
    strategy: state.strategy,
    mode: state.mode
  });

  await new Promise((resolve) => setTimeout(resolve, ENGINE.quickValidationMs));

  const first = exploreOpportunity(state.strategy, state.snapshot);
  const freshSnapshot = buildSnapshot({
    prices: marketBuffer.prices,
    digits: marketBuffer.digits,
    mode: state.mode
  });
  const fresh = exploreOpportunity(state.strategy, freshSnapshot);
  const validation = validateOpportunity(first, fresh, freshSnapshot);
  const consensus = buildConsensus(first, validation);
  const timing = evaluateTiming({
    strategy: state.strategy,
    snapshot: freshSnapshot,
    latency: state.latency
  });
  const quality = applyQualityFilter({
    strategy: state.strategy,
    opportunity: first,
    consensus,
    timing
  });

  const result = {
    ...consensus,
    strategy: state.strategy,
    direction: first.direction,
    score: quality.score,
    reasons: consensus.reasons,
    warnings: consensus.warnings,
    metadata: consensus.metadata
  };

  setText(UI.signalScore, `${quality.score}/100`);
  UI.signalBar.style.width = `${quality.score}%`;
  showReasons(result);

  if (first.direction === "NO_OPERAR") {
    UI.signalCard.className = "card signal-card no-operate";
    setText(UI.signalState, "NO OPERAR");
    setText(UI.signalTitle, "Matches descartado");
    setText(UI.signalValue, "MATCHES 0");
    showFloating("no-operate", "NO OPERAR", "MATCHES 0", "El número 0 está excluido.");
    voiceAssistant.speak("Coincidencia cero. No operar.");
    setTimeout(() => finishPrediction("El candidato fue 0 y se descartó."), 2200);
    return;
  }

  if (!quality.approved) {
    UI.signalCard.className = "card signal-card wait";
    setText(UI.signalState, "ESPERAR");
    setText(UI.signalTitle, "Sin entrada suficientemente clara");
    setText(UI.signalValue, "ESPERAR");
    showFloating("prepare", "ESPERAR", "SIN ENTRADA", quality.reason);
    voiceAssistant.speak("No hay una entrada suficientemente clara. Espere y vuelva a solicitar una predicción.");
    setTimeout(() => finishPrediction(quality.reason), 2600);
    return;
  }

  const value = visualDirection(result);
  const explanation = briefExplanation(result);

  UI.signalCard.className = "card signal-card confirmed";
  setText(UI.signalState, "READY");
  setText(UI.signalTitle, "Predicción confirmada");
  setText(UI.signalValue, value);
  showFloating("confirmed", "EJECUTAR", value, explanation || "Filtros superados.");

  voiceAssistant.speak(
    `${voiceAssistant.describeDirection(result)}. ${explanation}`
  );

  setText(UI.engineStage, "VENTANA DE EJECUCIÓN");
  setText(UI.engineDetail, "Elija manualmente el segundo dentro del conteo.");
  UI.engineProgress.style.width = "100%";

  await beginPredictionSequence(result);
}

function renderDiagnostics(entries) {
  if (!entries.length) {
    UI.diagnosticContent.textContent = "Sin eventos.";
    return;
  }

  UI.diagnosticContent.innerHTML = "";

  entries.slice().reverse().forEach((entry) => {
    const line = document.createElement("div");
    line.className = `diagnostic-line ${entry.level}`;
    const extra = entry.data ? `\n${JSON.stringify(entry.data, null, 2)}` : "";
    line.textContent = `[${entry.time}] ${entry.message}${extra}`;
    UI.diagnosticContent.appendChild(line);
  });
}


function calibrationContext() {
  return { symbol: state.symbol, strategy: state.strategy, mode: state.mode };
}

function renderCalibration() {
  const recommendation = executionCalibrator.recommendation(calibrationContext());
  setText(UI.calibrationStatus, recommendation.status);

  setText(
    UI.calibrationSummary,
    recommendation.second
      ? `${recommendation.status}: segundo ${recommendation.second} · ${recommendation.accuracy.toFixed(1)}% en ${recommendation.tests} pruebas.`
      : "Registre al menos 20 resultados por segundo antes de mostrar una recomendación."
  );

  UI.calibrationTable.innerHTML = "";
  recommendation.rows.forEach((row) => {
    const line = document.createElement("div");
    line.className = "calibration-row";
    line.innerHTML = `
      <strong>Seg. ${row.second}</strong>
      <span>${row.tests} pruebas</span>
      <span>${row.success} +</span>
      <span>${row.failed} -</span>
    `;
    UI.calibrationTable.appendChild(line);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCountdown(seconds, prepare = false) {
  clearInterval(state.countdownTimer);

  return new Promise((resolve) => {
    let remaining = seconds;
    UI.countdown.classList.toggle("prepare-countdown", prepare);
    setText(UI.countdown, remaining);
    voiceAssistant.speak(String(remaining), { replace: false });

    state.countdownTimer = setInterval(() => {
      remaining -= 1;
      setText(UI.countdown, Math.max(0, remaining));
      voiceAssistant.speak(String(Math.max(0, remaining)), { replace: false });

      if (remaining <= 0) {
        clearInterval(state.countdownTimer);
        UI.countdown.classList.remove("prepare-countdown");
        resolve();
      }
    }, 1000);
  });
}

async function beginPredictionSequence(result) {
  const explanation = briefExplanation(result);
  const recommendation = executionCalibrator.recommendation(calibrationContext());
  state.lastPredictionResult = result;

  await voiceAssistant.announcePrediction(result, explanation);

  setText(UI.engineStage, "PREPARAR OPERACIÓN");
  setText(UI.engineDetail, "Utilice estos 10 segundos para seleccionar la entrada en el bot.");
  UI.engineProgress.style.width = "75%";
  showFloating("prepare", "PREPARE", visualDirection(result), "Preparando el bot.");

  await runCountdown(ENGINE.prepareSeconds, true);
  await voiceAssistant.announceExecutionWindow(recommendation.second);

  setText(UI.engineStage, "VENTANA DE EJECUCIÓN");
  setText(
    UI.engineDetail,
    recommendation.second
      ? `Momento observado: segundo ${recommendation.second}. La decisión final sigue siendo manual.`
      : "Elija manualmente el segundo dentro del conteo."
  );
  UI.engineProgress.style.width = "100%";
  showFloating("confirmed", "EJECUTAR", visualDirection(result), explanation || "Filtros superados.");

  await runCountdown(ENGINE.executionSeconds, false);
  await sleep(700);
  finishPrediction("La ventana de ejecución terminó.");
}

async function init() {
  await voiceAssistant.init();

  voiceAssistant.voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = `${voice.name}|${voice.lang}`;
    option.textContent = `${voice.name} · ${voice.lang}`;
    UI.voiceSelect.appendChild(option);
  });

  diagnostics.subscribe(renderDiagnostics);
  diagnostics.ok(`Trading Analyst Pro MR V${APP_VERSION} iniciado.`);

  renderStats();
  renderCalibration();
  renderControls();
  renderLatency();
  setText(UI.marketName, MARKETS[state.symbol].name);
  log(`Trading Analyst Pro MR V${APP_VERSION} listo.`, "ok");
}

UI.connectButton.addEventListener("click", () => derivAPI.connect(state.symbol));
UI.disconnectButton.addEventListener("click", () => {
  stopEngine(false);
  derivAPI.disconnect();
});
UI.engineButton.addEventListener("click", () => {
  state.engineOn ? stopEngine() : startEngine();
});
UI.predictionButton.addEventListener("click", requestPrediction);

UI.marketSelect.addEventListener("change", () => {
  const wasEngineOn = state.engineOn;
  state.symbol = UI.marketSelect.value;

  memoryManager.clean("market-change");
  marketBuffer.reset();
  latencyMonitor.reset();
  state.latency = latencyMonitor.current;
  state.snapshot = null;
  state.lastOpportunity = null;

  setText(UI.marketName, MARKETS[state.symbol].name);
  setText(UI.price, "--");
  setText(UI.tickCount, 0);
  setText(UI.lastDigit, "--");
  setText(UI.memoryStatus, 0);
  UI.digits.innerHTML = "";

  if (state.connected) derivAPI.changeSymbol(state.symbol);

  if (wasEngineOn) {
    state.engineOn = true;
    setText(UI.engineStage, "SINCRONIZANDO NUEVO MERCADO");
    setText(UI.engineDetail, "Recopilando datos limpios sin apagar el motor.");
    voiceAssistant.speak(`Cambiando a ${MARKETS[state.symbol].name}.`);
  }

  renderStats();
  renderCalibration();
  renderControls();
});

UI.strategySelect.addEventListener("change", () => {
  state.strategy = UI.strategySelect.value;
  state.snapshot = null;
  state.lastOpportunity = null;
  setText(UI.engineStage, state.engineOn ? "ESTRATEGIA ACTUALIZADA" : "EN ESPERA");
  setText(
    UI.engineDetail,
    state.engineOn
      ? `Analizando ${STRATEGIES[state.strategy].name} sin apagar el motor.`
      : "Encienda el motor para comenzar."
  );
  voiceAssistant.speak(`Estrategia ${STRATEGIES[state.strategy].voice}.`);
  renderStats();
  renderCalibration();
  renderControls();
});

UI.modeSelect.addEventListener("change", () => {
  state.mode = UI.modeSelect.value;
  state.snapshot = null;
  state.lastOpportunity = null;
  renderCalibration();
  renderControls();
});

UI.voiceButton.addEventListener("click", () => {
  setText(UI.voiceButton, voiceAssistant.toggle() ? "🔊" : "🔇");
});

UI.voiceSelect.addEventListener("change", () => {
  voiceAssistant.voice =
    voiceAssistant.voices.find(
      (voice) => `${voice.name}|${voice.lang}` === UI.voiceSelect.value
    ) || voiceAssistant.voice;
});

UI.voiceRate.addEventListener("input", () => {
  voiceAssistant.rate = Number(UI.voiceRate.value);
  setText(UI.voiceRateValue, `${voiceAssistant.rate.toFixed(2)}x`);
});

UI.voiceTest.addEventListener("click", () => {
  voiceAssistant.speak("Asistente de voz funcionando. Matches se pronuncia coincidencia.");
});

UI.diagnosticButton.addEventListener("click", () => {
  const open = UI.diagnosticPanel.hidden;
  UI.diagnosticPanel.hidden = !open;
  UI.diagnosticButton.textContent = open ? "🛠 CERRAR" : "🛠 ABRIR";
});

UI.copyDiagnostic.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(diagnostics.exportText() || "Sin eventos.");
    log("Diagnóstico copiado.", "ok");
  } catch (error) {
    diagnostics.error("No se pudo copiar el diagnóstico.", { message: error.message });
  }
});

UI.clearDiagnostic.addEventListener("click", () => diagnostics.clear());
UI.clearLog.addEventListener("click", () => { UI.activityLog.innerHTML = ""; });
UI.resetStats.addEventListener("click", () => {
  statistics.reset(statsKey());
  renderStats();
});


UI.saveCalibration.addEventListener("click", () => {
  const second = Number(UI.executedSecond.value);
  const result = UI.manualResult.value;

  if (!second || !["success", "failed"].includes(result)) {
    log("Seleccione segundo y resultado antes de guardar.", "warn");
    return;
  }

  executionCalibrator.record(calibrationContext(), second, result === "success");
  statistics.record(statsKey(), result === "success");
  renderStats();
  renderCalibration();

  UI.executedSecond.value = "";
  UI.manualResult.value = "";
  log(`Resultado guardado para el segundo ${second}.`, "ok");
});

UI.resetCalibration.addEventListener("click", () => {
  executionCalibrator.reset(calibrationContext());
  renderCalibration();
  log("Calibración reiniciada para esta configuración.", "warn");
});

derivAPI.on("state", ({ state: status, label }) => renderConnection(status, label));
derivAPI.on("tick", processTick);
derivAPI.on("error", ({ message }) => log(message, "error"));
derivAPI.on("log", ({ message, level }) => log(message, level));

memoryManager.register(() => {
  clearInterval(state.countdownTimer);
  clearTimeout(state.cooldownTimer);
  state.predictionActive = false;
  state.cooldown = false;
  hideFloating();
});

window.addEventListener("beforeunload", () => {
  derivAPI.disconnect();
  memoryManager.clean("before-unload");
});

init().catch((error) => {
  diagnostics.error("Error durante init().", {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
});
