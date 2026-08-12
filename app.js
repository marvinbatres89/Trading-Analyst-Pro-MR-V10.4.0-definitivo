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
import {
  visualDirection,
  briefExplanation
} from "./prediction.js";
import {
  executionCalibrator
} from "./execution-calibrator.js";
import { i18n } from "./i18n.js";
import {
  marketRegistry
} from "./market-registry.js";


const $ =
  (id) =>
    document.getElementById(id);


/* ==========================================
   UI
   ========================================== */

const UI = {};

[
  "connectionStatus",
  "engineStatus",
  "memoryStatus",
  "latencyStatus",

  "marketSelect",
  "strategySelect",
  "modeSelect",

  "connectButton",
  "disconnectButton",
  "engineButton",
  "predictionButton",

  "controlMessage",
  "marketName",
  "price",
  "tickCount",
  "lastDigit",
  "updateTime",

  "digits",
  "trend",
  "rsi",
  "momentum",
  "volatility",

  "engineStage",
  "engineDetail",
  "engineProgress",

  "signalCard",
  "signalState",
  "signalTitle",
  "signalValue",
  "signalScore",
  "signalBar",
  "signalReasons",
  "countdown",

  "floatingSignal",
  "floatingState",
  "floatingValue",
  "floatingDetail",

  "voiceButton",
  "voiceSelect",
  "voiceRate",
  "voiceRateValue",
  "voiceTest",

  "diagnosticButton",
  "diagnosticPanel",
  "diagnosticContent",
  "copyDiagnostic",
  "clearDiagnostic",

  "activityLog",
  "clearLog",

  "statsTests",
  "statsSuccess",
  "statsFailed",
  "statsAccuracy",
  "resetStats",

  "calibrationStatus",
  "calibrationSummary",
  "executedSecond",
  "manualResult",
  "saveCalibration",
  "resetCalibration",
  "calibrationTable",

  "languageSelect",

  "tickerMarketName",
  "tickerConnection",
  "tickerPrice",
  "tickerLastDigit",
  "tickerDigits",
  "tickerEven",
  "tickerOdd",
  "tickerRises",
  "tickerFalls",

  "refreshMarkets",
  "manualMarketSymbol",
  "manualMarketName",
  "manualMarketOneSecond",
  "addManualMarket",
  "marketRegistryMessage",

  "entryAlertEnabled",
  "entryAlertSecond",
  "entryAlertDelay",
  "entryFlash",

  "appUpdateStatus"

].forEach(
  (id) => {

    UI[id] =
      $(id);

  }
);


/* ==========================================
   ESTADO
   ========================================== */

const state = {

  connected:
    false,

  engineOn:
    false,

  predictionActive:
    false,

  cooldown:
    false,

  symbol:
    "1HZ100V",

  strategy:
    "rise_fall",

  mode:
    "fast",

  snapshot:
    null,

  lastOpportunity:
    null,

  latency:
    latencyMonitor.current,

  countdownTimer:
    null,

  cooldownTimer:
    null,

  lastPredictionResult:
    null

};


/* ==========================================
   UTILIDADES
   ========================================== */

function setText(
  element,
  value
) {

  if (
    element
  ) {

    element.textContent =
      String(
        value
      );

  }

}


function log(
  message,
  level = ""
) {

  if (
    !UI.activityLog
  ) {

    return;

  }


  const line =
    document.createElement(
      "p"
    );


  line.textContent =
    `[${new Date().toLocaleTimeString("es-SV")}] ${message}`;


  line.className =
    level;


  UI.activityLog.prepend(
    line
  );


  while (
    UI.activityLog.children.length >
    ENGINE.maxLogLines
  ) {

    UI.activityLog
      .lastElementChild
      ?.remove();

  }

}


/* ==========================================
   ESTADÍSTICAS
   ========================================== */

function statsKey() {

  return [
    state.symbol,
    state.strategy,
    state.mode
  ].join("|");

}


function renderStats() {

  const value =
    statistics.get(
      statsKey()
    );


  const accuracy =
    value.tests
      ? (
          value.success /
          value.tests
        ) *
        100
      : null;


  setText(
    UI.statsTests,
    value.tests
  );


  setText(
    UI.statsSuccess,
    value.success
  );


  setText(
    UI.statsFailed,
    value.failed
  );


  setText(
    UI.statsAccuracy,
    accuracy ===
      null
      ? "NO DATA"
      : `${accuracy.toFixed(1)}%`
  );

}


/* ==========================================
   MOTOR
   ========================================== */

function minimumTicks() {

  if (
    state.strategy ===
    "match"
  ) {

    return ENGINE.minMatchTicks;

  }


  if (
    state.strategy ===
      "boom" ||
    state.strategy ===
      "crash"
  ) {

    return ENGINE.minSpikeTicks;

  }


  return state.mode ===
    "deep"
    ? ENGINE.minDeepTicks
    : ENGINE.minFastTicks;

}


function marketSupportsStrategy(
  symbol = state.symbol,
  strategy = state.strategy
) {

  const market =
    marketRegistry.all()[
      symbol
    ];


  return Boolean(
    market
      ?.strategies
      ?.includes(
        strategy
      )
  );

}


function canPredict() {

  return (

    state.connected &&

    state.engineOn &&

    !state.predictionActive &&

    !state.cooldown &&

    marketBuffer.prices.length >=
      minimumTicks() &&

    state.latency.operable &&

    marketSupportsStrategy()

  );

}


/* ==========================================
   CONTROLES
   ========================================== */

function renderControls() {

  setText(
    UI.engineStatus,
    state.engineOn
      ? "ON"
      : "OFF"
  );


  UI.engineButton.textContent =
    state.engineOn
      ? i18n.t(
          "stopEngine"
        )
      : i18n.t(
          "startEngine"
        );


  UI.connectButton.textContent =
    i18n.t(
      "connect"
    );


  UI.disconnectButton.textContent =
    i18n.t(
      "disconnect"
    );


  UI.predictionButton.disabled =
    !canPredict();


  UI.predictionButton.textContent =
    state.cooldown
      ? i18n.t(
          "waitButton"
        )
      : i18n.t(
          "prediction"
        );


  const locked =
    state.predictionActive ||
    state.cooldown;


  [
    UI.marketSelect,
    UI.strategySelect,
    UI.modeSelect
  ]
    .forEach(
      (element) => {

        element.disabled =
          locked;

      }
    );

}


/* ==========================================
   CONEXIÓN
   ========================================== */

function renderConnection(
  status,
  label
) {

  state.connected =
    status ===
    "live";


  setText(
    UI.connectionStatus,
    label
  );


  UI.connectButton.disabled =
    status ===
      "connecting" ||
    status ===
      "live";


  UI.disconnectButton.disabled =
    status !==
    "live";


  UI.engineButton.disabled =
    status !==
    "live";


  if (
    !state.connected &&
    state.engineOn
  ) {

    stopEngine(
      false
    );

  }


  renderControls();

}


/* ==========================================
   LATENCIA
   ========================================== */

function renderLatency() {

  const value =
    state.latency;


  setText(
    UI.latencyStatus,

    value.latencyMs ===
      null
      ? "NO DATA"
      : `${value.status} · ${Math.round(value.latencyMs)} ms`
  );


  UI.latencyStatus.className =
    `status-pill ${
      value.operable
        ? "live"
        : value.status ===
            "NO OPERAR"
          ? "danger-pill"
          : ""
    }`;

}


/* ==========================================
   DÍGITOS
   ========================================== */

function renderDigits() {

  UI.digits.innerHTML =
    "";


  marketBuffer.digits
    .slice(
      -20
    )
    .forEach(
      (
        digit,
        index,
        array
      ) => {

        const item =
          document.createElement(
            "span"
          );


        item.className =
          `digit${
            index ===
            array.length -
              1
              ? " current"
              : ""
          }`;


        item.textContent =
          digit;


        UI.digits
          .appendChild(
            item
          );

      }
    );

}


/* ==========================================
   INDICADORES
   ========================================== */

function renderIndicators(
  snapshot
) {

  setText(
    UI.trend,
    i18n.translateState(
      snapshot
        .trend
        .direction
    )
  );


  setText(
    UI.rsi,
    snapshot.rsi ===
      null
      ? "--"
      : snapshot.rsi.toFixed(
          1
        )
  );


  setText(
    UI.momentum,
    i18n.translateState(
      snapshot
        .momentum
        .direction
    )
  );


  setText(
    UI.volatility,
    i18n.translateState(
      snapshot
        .volatility
        .level
    )
  );

}


/* ==========================================
   IDIOMA
   ========================================== */

function renderLanguage() {

  document
    .querySelectorAll(
      "[data-i18n]"
    )
    .forEach(
      (element) => {

        element.textContent =
          i18n.t(
            element
              .dataset
              .i18n
          );

      }
    );


  document
    .querySelectorAll(
      "[data-i18n-option]"
    )
    .forEach(
      (option) => {

        option.textContent =
          i18n.t(
            option
              .dataset
              .i18nOption
          );

      }
    );


  if (
    UI.languageSelect
  ) {

    UI.languageSelect.value =
      i18n.language;

  }


  UI.modeSelect
    ?.dispatchEvent(
      new Event(
        "optionsupdated"
      )
    );


  renderControls();


  if (
    state.snapshot
  ) {

    renderIndicators(
      state.snapshot
    );

  }

}


/* ==========================================
   MERCADOS
   ========================================== */

function populateMarketSelector() {

  const previous =
    state.symbol;


  const markets =
    marketRegistry.all();


  UI.marketSelect.innerHTML =
    "";


  const compatible =
    Object
      .entries(
        markets
      )
      .filter(
        (
          [
            ,
            market
          ]
        ) =>

          market.enabled !==
            false &&

          Array.isArray(
            market.strategies
          ) &&

          market
            .strategies
            .includes(
              state.strategy
            )

      )
      .sort(
        (
          a,
          b
        ) => {

          const rank =
            (
              [
                symbol,
                market
              ]
            ) => {

              const name =
                String(
                  market.name ||
                  ""
                );


              const match =
                name.match(
                  /(?:Volatility\s+|Boom\s+|Crash\s+)(\d+)/i
                );


              const n =
                Number(
                  match?.[1] ||
                  999
                );


              if (
                /^R_\d+$/.test(
                  symbol
                )
              ) {

                return [
                  0,
                  n,
                  name
                ];

              }


              if (
                /^1HZ\d+V$/.test(
                  symbol
                ) ||
                /\(1s\)/i.test(
                  name
                )
              ) {

                return [
                  1,
                  n,
                  name
                ];

              }


              if (
                /boom/i.test(
                  name
                )
              ) {

                return [
                  2,
                  n,
                  name
                ];

              }


              if (
                /crash/i.test(
                  name
                )
              ) {

                return [
                  3,
                  n,
                  name
                ];

              }


              return [
                4,
                n,
                name
              ];

            };


          const ra =
            rank(
              a
            );


          const rb =
            rank(
              b
            );


          return (
            ra[0] -
              rb[0] ||
            ra[1] -
              rb[1] ||
            ra[2].localeCompare(
              rb[2]
            )
          );

        }
      );


  compatible.forEach(
    (
      [
        symbol,
        market
      ]
    ) => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        symbol;


      option.textContent =
        market.name;


      option.dataset.marketFamily =

        /boom/i.test(
          market.name
        )
          ? "boom"

          : /crash/i.test(
              market.name
            )
            ? "crash"

            : (
                /^1HZ/.test(
                  symbol
                ) ||
                /\(1s\)/i.test(
                  market.name
                )
              )
              ? "1s"

              : /^R_/.test(
                  symbol
                )
                ? "standard"

                : "other";


      UI.marketSelect
        .appendChild(
          option
        );

    }
  );


  if (
    compatible.some(
      (
        [
          symbol
        ]
      ) =>
        symbol ===
        previous
    )
  ) {

    UI.marketSelect.value =
      previous;

  }

  else if (
    UI.marketSelect
      .options
      .length
  ) {

    state.symbol =
      UI.marketSelect
        .options[0]
        .value;


    UI.marketSelect.value =
      state.symbol;

  }


  UI.marketSelect.disabled =
    !UI.marketSelect
      .options
      .length;


  UI.marketSelect
    .dispatchEvent(
      new Event(
        "optionsupdated"
      )
    );


  return previous !==
    state.symbol;

}


/* ==========================================
   TICKER
   ========================================== */

function renderTicker() {

  setText(
    UI.tickerMarketName,
    marketRegistry.all()[
      state.symbol
    ]?.name ||
    state.symbol
  );


  setText(
    UI.tickerConnection,
    state.connected
      ? `● ${i18n.t("connected")}`
      : "● OFFLINE"
  );


  setText(
    UI.tickerPrice,
    UI.price
      ?.textContent ||
    "--"
  );


  setText(
    UI.tickerLastDigit,
    UI.lastDigit
      ?.textContent ||
    "--"
  );


  const digits =
    marketBuffer.digits
      .slice(
        -20
      );


  UI.tickerDigits.innerHTML =
    "";


  digits.forEach(
    (
      digit,
      index
    ) => {

      const node =
        document.createElement(
          "span"
        );


      node.className =
        `ticker-digit ${
          digit %
            2 ===
            0
            ? "even"
            : "odd"
        }${
          index ===
          digits.length -
            1
            ? " current"
            : ""
        }`;


      node.textContent =
        digit;


      UI.tickerDigits
        .appendChild(
          node
        );

    }
  );


  const even =
    digits.filter(
      (digit) =>
        digit %
          2 ===
        0
    ).length;


  setText(
    UI.tickerEven,
    even
  );


  setText(
    UI.tickerOdd,
    digits.length -
      even
  );


  const prices =
    marketBuffer.prices
      .slice(
        -21
      );


  let rises =
    0;


  let falls =
    0;


  for (
    let index =
      1;

    index <
    prices.length;

    index +=
      1
  ) {

    if (
      prices[index] >
      prices[
        index -
        1
      ]
    ) {

      rises +=
        1;

    }


    if (
      prices[index] <
      prices[
        index -
        1
      ]
    ) {

      falls +=
        1;

    }

  }


  setText(
    UI.tickerRises,
    rises
  );


  setText(
    UI.tickerFalls,
    falls
  );

}


/* ==========================================
   PROCESAR TICK
   ========================================== */

function processTick(
  tick
) {

  if (
    tick.symbol !==
    state.symbol
  ) {

    return;

  }


  const rendered =
    marketBuffer.push(
      tick
    );


  state.latency =
    latencyMonitor.update(
      tick
    );


  setText(
    UI.price,
    rendered.formatted
  );


  setText(
    UI.tickCount,
    marketBuffer.ticks
  );


  setText(
    UI.lastDigit,
    rendered.digit ??
    "--"
  );


  setText(
    UI.updateTime,
    new Date(
      tick.epoch *
      1000
    )
      .toLocaleTimeString(
        "es-SV"
      )
  );


  setText(
    UI.memoryStatus,
    marketBuffer.prices.length
  );


  renderDigits();

  renderLatency();

  renderTicker();


  if (
    state.engineOn
  ) {

    state.snapshot =
      buildSnapshot({

        prices:
          marketBuffer.prices,

        digits:
          marketBuffer.digits,

        mode:
          state.mode

      });


    state.lastOpportunity =
      exploreOpportunity(
        state.strategy,
        state.snapshot
      );


    renderIndicators(
      state.snapshot
    );

  }


  renderControls();

}


/* ==========================================
   MOTOR ON
   ========================================== */

function startEngine() {

  if (
    !state.connected
  ) {

    return;

  }


  state.engineOn =
    true;


  state.snapshot =
    null;


  state.lastOpportunity =
    null;


  setText(
    UI.controlMessage,
    "Motor encendido. Análisis continuo activo en segundo plano."
  );


  setText(
    UI.engineStage,
    "ANÁLISIS CONTINUO"
  );


  setText(
    UI.engineDetail,
    "Los motores preparan oportunidades; no se mostrará ninguna hasta pulsar PREDICTION."
  );


  UI.engineProgress.style.width =
    "25%";


  voiceAssistant.speak(
    `Motor encendido. ${
      marketRegistry.all()[
        state.symbol
      ]?.name ||
      state.symbol
    }. Estrategia ${
      STRATEGIES[
        state.strategy
      ].voice
    }.`
  );


  diagnostics.ok(
    "Motor encendido.",
    {

      symbol:
        state.symbol,

      strategy:
        state.strategy

    }
  );


  log(
    "Análisis continuo activado.",
    "ok"
  );


  renderControls();

}


/* ==========================================
   MOTOR OFF
   ========================================== */

function stopEngine(
  announce = true
) {

  state.engineOn =
    false;


  state.predictionActive =
    false;


  state.cooldown =
    false;


  clearInterval(
    state.countdownTimer
  );


  clearTimeout(
    state.cooldownTimer
  );


  memoryManager.clean(
    "stop-engine"
  );


  marketBuffer.reset();


  latencyMonitor.reset();


  state.latency =
    latencyMonitor.current;


  setText(
    UI.controlMessage,
    "Motor apagado y memoria temporal liberada."
  );


  setText(
    UI.engineStage,
    "MOTOR APAGADO"
  );


  setText(
    UI.engineDetail,
    "Encienda el motor para comenzar un análisis limpio."
  );


  UI.engineProgress.style.width =
    "0%";


  setText(
    UI.price,
    "--"
  );


  setText(
    UI.tickCount,
    0
  );


  setText(
    UI.lastDigit,
    "--"
  );


  setText(
    UI.memoryStatus,
    0
  );


  UI.digits.innerHTML =
    "";


  renderLatency();


  if (
    announce
  ) {

    voiceAssistant.speak(
      "Motor apagado. Memoria temporal liberada."
    );

  }


  renderControls();

}


/* ==========================================
   SEÑAL FLOTANTE
   ========================================== */

function showFloating(
  type,
  stateText,
  value,
  detail
) {

  UI.floatingSignal.className =
    `signal-toast ${type} visible`;


  setText(
    UI.floatingState,
    stateText
  );


  setText(
    UI.floatingValue,
    value
  );


  setText(
    UI.floatingDetail,
    detail
  );

}


function hideFloating() {

  UI.floatingSignal
    .classList
    .remove(
      "visible"
    );

}


/* ==========================================
   MOTIVOS
   ========================================== */

function showReasons(
  result
) {

  UI.signalReasons.innerHTML =
    "";


  [
    ...(
      result.reasons ||
      []
    ),

    ...(
      result.warnings ||
      []
    )
      .map(
        (x) =>
          `⚠ ${x}`
      )

  ]
    .slice(
      0,
      5
    )
    .forEach(
      (reason) => {

        const item =
          document.createElement(
            "li"
          );


        item.textContent =
          reason;


        UI.signalReasons
          .appendChild(
            item
          );

      }
    );

}


/* ==========================================
   FINALIZAR PREDICCIÓN
   ========================================== */

function finishPrediction(
  message
) {

  clearInterval(
    state.countdownTimer
  );


  state.predictionActive =
    false;


  state.cooldown =
    true;


  setText(
    UI.engineStage,
    "PREDICCIÓN FINALIZADA"
  );


  setText(
    UI.engineDetail,
    "No se generará otra señal automáticamente."
  );


  UI.engineProgress.style.width =
    "0%";


  setText(
    UI.controlMessage,
    `${message} Puede cambiar mercado o solicitar otra predicción.`
  );


  hideFloating();


  voiceAssistant.speak(
    "Predicción finalizada. Genera una nueva señal.",
    {
      replace:
        true,

      rate:
        1.05
    }
  );


  diagnostics.info(
    "Predicción finalizada.",
    {
      message
    }
  );


  renderControls();


  clearTimeout(
    state.cooldownTimer
  );


  state.cooldownTimer =
    setTimeout(
      () => {

        state.cooldown =
          false;


        setText(
          UI.engineStage,
          "ANÁLISIS CONTINUO"
        );


        setText(
          UI.engineDetail,
          "Pulse PREDICTION para solicitar otra decisión."
        );


        renderControls();

      },
      ENGINE.cooldownMs
    );

}


/* ==========================================
   SOLICITAR PREDICCIÓN
   ========================================== */

async function requestPrediction() {

  if (
    !canPredict()
  ) {

    return;

  }


  state.predictionActive =
    true;


  renderControls();


  setText(
    UI.engineStage,
    "PREDICIENDO MERCADO"
  );


  setText(
    UI.engineDetail,
    `${
      marketRegistry.all()[
        state.symbol
      ]?.name ||
      state.symbol
    } · ${
      STRATEGIES[
        state.strategy
      ].name
    }`
  );


  UI.engineProgress.style.width =
    "55%";


  setText(
    UI.signalState,
    "ANALYZING"
  );


  setText(
    UI.signalTitle,
    "Validación rápida"
  );


  setText(
    UI.signalValue,
    "--"
  );


  setText(
    UI.countdown,
    "--"
  );


  voiceAssistant.speak(
    `Prediciendo ${
      marketRegistry.all()[
        state.symbol
      ]?.name ||
      state.symbol
    }.`
  );


  diagnostics.info(
    "Predicción solicitada.",
    {

      symbol:
        state.symbol,

      strategy:
        state.strategy,

      mode:
        state.mode

    }
  );


  const validationDelay =

    state.strategy ===
      "match"

      ? Math.min(
          900,
          ENGINE.quickValidationMs
        )

      : state.strategy ===
          "rise_fall"

        ? ENGINE.riseFallValidationMs

        : (
            state.strategy ===
              "boom" ||
            state.strategy ===
              "crash"
          )

          ? ENGINE.spikeValidationMs

          : ENGINE.quickValidationMs;


  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        validationDelay
      )
  );


  const first =
    exploreOpportunity(
      state.strategy,
      state.snapshot
    );


  const freshSnapshot =
    buildSnapshot({

      prices:
        marketBuffer.prices,

      digits:
        marketBuffer.digits,

      mode:
        state.mode

    });


  const fresh =
    exploreOpportunity(
      state.strategy,
      freshSnapshot
    );


  const validation =
    validateOpportunity(
      first,
      fresh,
      freshSnapshot
    );


  const consensus =
    buildConsensus(
      first,
      validation
    );


  const timing =
    evaluateTiming({

      strategy:
        state.strategy,

      snapshot:
        freshSnapshot,

      latency:
        state.latency

    });


  const quality =
    applyQualityFilter({

      strategy:
        state.strategy,

      opportunity:
        first,

      consensus,

      timing

    });


  const result = {

    ...consensus,

    strategy:
      state.strategy,

    direction:
      first.direction,

    score:
      quality.score,

    reasons:
      consensus.reasons,

    warnings:
      consensus.warnings,

    metadata:
      consensus.metadata

  };


  setText(
    UI.signalScore,
    `${quality.score}/100`
  );


  UI.signalBar.style.width =
    `${quality.score}%`;


  showReasons(
    result
  );


  if (
    first.direction ===
    "NO_OPERAR"
  ) {

    UI.signalCard.className =
      "card signal-card no-operate";


    setText(
      UI.signalState,
      "NO OPERAR"
    );


    setText(
      UI.signalTitle,
      "Matches descartado"
    );


    setText(
      UI.signalValue,
      "MATCHES 0"
    );


    showFloating(
      "no-operate",
      "NO OPERAR",
      "MATCHES 0",
      "El número 0 está excluido."
    );


    voiceAssistant.speak(
      "Coincidencia cero. No operar."
    );


    setTimeout(
      () =>
        finishPrediction(
          "El candidato fue 0 y se descartó."
        ),
      2200
    );


    return;

  }


  if (
    !quality.approved
  ) {

    UI.signalCard.className =
      "card signal-card wait";


    setText(
      UI.signalState,
      "ESPERAR"
    );


    setText(
      UI.signalTitle,
      "Sin entrada suficientemente clara"
    );


    setText(
      UI.signalValue,
      "ESPERAR"
    );


    showFloating(
      "prepare",
      "ESPERAR",
      "SIN ENTRADA",
      quality.reason
    );


    voiceAssistant.speak(
      "No hay una entrada suficientemente clara. Espere y vuelva a solicitar una predicción."
    );


    setTimeout(
      () =>
        finishPrediction(
          quality.reason
        ),
      2600
    );


    return;

  }


  const value =
    visualDirection(
      result
    );


  const explanation =
    briefExplanation(
      result
    );


  UI.signalCard.className =
    "card signal-card confirmed";


  setText(
    UI.signalState,
    "READY"
  );


  setText(
    UI.signalTitle,
    "Predicción confirmada"
  );


  setText(
    UI.signalValue,
    value
  );


  showFloating(
    "confirmed",
    "EJECUTAR",
    value,
    explanation ||
      "Filtros superados."
  );


  setText(
    UI.engineStage,
    "VENTANA DE EJECUCIÓN"
  );


  setText(
    UI.engineDetail,
    "Elija manualmente el segundo dentro del conteo."
  );


  UI.engineProgress.style.width =
    "100%";


  await beginPredictionSequence(
    result
  );

}


/* ==========================================
   DIAGNÓSTICOS
   ========================================== */

function renderDiagnostics(
  entries
) {

  if (
    !entries.length
  ) {

    UI.diagnosticContent.textContent =
      "Sin eventos.";


    return;

  }


  UI.diagnosticContent.innerHTML =
    "";


  entries
    .slice()
    .reverse()
    .forEach(
      (entry) => {

        const line =
          document.createElement(
            "div"
          );


        line.className =
          `diagnostic-line ${entry.level}`;


        const extra =
          entry.data
            ? `\n${JSON.stringify(entry.data, null, 2)}`
            : "";


        line.textContent =
          `[${entry.time}] ${entry.message}${extra}`;


        UI.diagnosticContent
          .appendChild(
            line
          );

      }
    );

}


/* ==========================================
   CALIBRACIÓN MANUAL DE LA HERRAMIENTA
   ========================================== */

function calibrationContext() {

  return {

    symbol:
      state.symbol,

    strategy:
      state.strategy,

    mode:
      state.mode

  };

}


function renderCalibration() {

  const recommendation =
    executionCalibrator.recommendation(
      calibrationContext()
    );


  setText(
    UI.calibrationStatus,
    recommendation.status
  );


  setText(
    UI.calibrationSummary,

    recommendation.second

      ? `${recommendation.status}: segundo ${recommendation.second} · ${recommendation.accuracy.toFixed(1)}% en ${recommendation.tests} pruebas.`

      : "Registre al menos 20 resultados por segundo antes de mostrar una recomendación."
  );


  UI.calibrationTable.innerHTML =
    "";


  recommendation.rows
    .forEach(
      (row) => {

        const line =
          document.createElement(
            "div"
          );


        line.className =
          "calibration-row";


        line.innerHTML = `

          <strong>
            Seg. ${row.second}
          </strong>

          <span>
            ${row.tests} pruebas
          </span>

          <span>
            ${row.success} +
          </span>

          <span>
            ${row.failed} -
          </span>

        `;


        UI.calibrationTable
          .appendChild(
            line
          );

      }
    );

}


/* ==========================================
   ESPERA
   ========================================== */

function sleep(
  ms
) {

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );

}


/* ==========================================
   SINCRONIZACIÓN BOT V1 MR
   FIX11
   ========================================== */

const BOT_CHANNEL_NAME =
  "trading-analyzer-bot-v1-mr";


const botChannel =

  "BroadcastChannel" in
    window

    ? new BroadcastChannel(
        BOT_CHANNEL_NAME
      )

    : null;


/*
  PREAVISO FIX11

  La herramienta avisa al BOT
  1 segundo antes del instante
  objetivo.

  Así el BOT puede programar:

  -0.3
  -0.2
  -0.1
   0.0
  +0.1
  +0.2
  +0.3
*/

const BOT_PREAVISO_MS =
  1000;


/* ==========================================
   ENVIAR SEÑAL FIX11
   ========================================== */

function enviarSenalAlBot(
  result,
  segundoEntrada,
  targetExecutionAt
) {

  const ultimoPrecio =

    marketBuffer.prices.length

      ? marketBuffer.prices[
          marketBuffer.prices.length -
          1
        ]

      : null;


  const ultimoDigito =

    marketBuffer.digits.length

      ? marketBuffer.digits[
          marketBuffer.digits.length -
          1
        ]

      : null;


  const target =
    Number(
      targetExecutionAt
    );


  const targetValido =

    Number.isFinite(
      target
    ) &&

    target >
      0;


  const senal = {

    id:
      `${Date.now()}-${state.symbol}-${state.strategy}`,

    mercado:
      state.symbol,

    estrategia:
      state.strategy,

    direccion:
      result.direction,

    confianza:
      Number(
        result.score ||
        0
      ),

    precio:
      ultimoPrecio,

    ultimoDigito:
      ultimoDigito,

    tendencia:
      state.snapshot
        ?.trend
        ?.direction ??
      null,

    rsi:
      state.snapshot
        ?.rsi ??
      null,

    momentum:
      state.snapshot
        ?.momentum
        ?.direction ??
      null,

    volatilidad:
      state.snapshot
        ?.volatility
        ?.level ??
      null,

    segundosEntrada:
      segundoEntrada,

    modo:
      state.mode,


    /* FIX11 */

    targetExecutionAt:

      targetValido

        ? target

        : null,


    metadata: {

      ...(result.metadata ||
        {}),

      targetExecutionAt:

        targetValido

          ? target

          : null,

      preavisoMs:
        BOT_PREAVISO_MS,

      fix:
        "FIX11"

    },


    timestamp:
      Date.now(),

    origen:
      `Trading Analyst Pro MR V${APP_VERSION}`

  };


  /* BROADCAST CHANNEL */

  try {

    botChannel
      ?.postMessage(
        senal
      );

  }

  catch (
    error
  ) {

    diagnostics.error(
      "Error enviando señal al BOT.",
      {

        message:
          error.message

      }
    );

  }


  /* LOCAL STORAGE */

  try {

    localStorage.setItem(
      "TA_BOT_SIGNAL_V1",
      JSON.stringify(
        senal
      )
    );

  }

  catch {}


  diagnostics.ok(
    "Señal FIX11 enviada al BOT V1 MR.",
    {

      mercado:
        senal.mercado,

      estrategia:
        senal.estrategia,

      direccion:
        senal.direccion,

      confianza:
        senal.confianza,

      segundoEntrada:
        senal.segundosEntrada,

      targetExecutionAt:
        senal.targetExecutionAt,

      preavisoMs:
        BOT_PREAVISO_MS

    }
  );


  log(
    `BOT FIX11 → ${senal.mercado} · ${senal.direccion} · ${senal.confianza}% · objetivo ${segundoEntrada} · target ${senal.targetExecutionAt}`,
    "ok"
  );

}


/* ==========================================
   CUENTA REGRESIVA FIX11
   ========================================== */

async function runCountdown(
  seconds,
  result
) {

  clearInterval(
    state.countdownTimer
  );


  return new Promise(
    (resolve) => {

      const startedAtPerf =
        performance.now();


      const startedAtDate =
        Date.now();


      let lastShown =
        null;


      let alertRunId =
        0;


      let senalBotEnviada =
        false;


      const flashEntry =
        () => {

          if (
            !UI.entryAlertEnabled
              ?.checked ||
            !UI.entryFlash
          ) {

            return;

          }


          UI.entryFlash.hidden =
            false;


          UI.entryFlash
            .classList
            .remove(
              "pulse"
            );


          void UI.entryFlash
            .offsetWidth;


          UI.entryFlash
            .classList
            .add(
              "pulse"
            );


          setTimeout(
            () => {

              UI.entryFlash.hidden =
                true;

            },
            650
          );

        };


      const update =
        () => {

          const elapsedMs =

            performance.now() -
            startedAtPerf;


          const elapsed =
            elapsedMs /
            1000;


          const remaining =

            Math.max(
              0,
              seconds -
              Math.floor(
                elapsed
              )
            );


          const target =

            Number(
              UI.entryAlertSecond
                ?.value ||
              10
            );


          /*
            INSTANTE OBJETIVO ABSOLUTO

            Si la cuenta comienza en 15
            y el target es 10:

            el instante objetivo ocurre
            5 segundos después del inicio.
          */

          const targetOffsetMs =

            Math.max(
              0,
              (
                Number(
                  seconds
                ) -
                target
              ) *
              1000
            );


          const targetExecutionAt =

            startedAtDate +
            targetOffsetMs;


          const momentoPreaviso =

            targetExecutionAt -
            BOT_PREAVISO_MS;


          /*
            ENVIAR AL BOT ANTES
            DEL INSTANTE OBJETIVO
          */

          if (
            !senalBotEnviada &&
            Date.now() >=
              momentoPreaviso
          ) {

            senalBotEnviada =
              true;


            enviarSenalAlBot(
              result,
              target,
              targetExecutionAt
            );


            diagnostics.info(
              "FIX11 preaviso enviado.",
              {

                mercado:
                  state.symbol,

                target,

                targetExecutionAt,

                enviadoAt:
                  Date.now(),

                anticipacionAproxMs:
                  targetExecutionAt -
                  Date.now()

              }
            );

          }


          /*
            VISUAL Y VOZ
          */

          if (
            remaining !==
            lastShown
          ) {

            lastShown =
              remaining;


            setText(
              UI.countdown,
              remaining
            );


            const thisRun =
              ++alertRunId;


            const spoken =

              voiceAssistant
                .speakCountdownNumber(
                  remaining
                );


            if (
              UI.entryAlertEnabled
                ?.checked &&

              remaining ===
                target &&

              spoken &&

              typeof spoken.then ===
                "function"
            ) {

              spoken.then(
                () => {

                  if (
                    thisRun !==
                    alertRunId
                  ) {

                    return;

                  }


                  const delay =

                    Math.max(
                      0,

                      Number(
                        UI.entryAlertDelay
                          ?.value ||
                        0
                      )
                    );


                  setTimeout(
                    flashEntry,
                    delay
                  );

                }
              );

            }

          }


          /*
            FIN DEL CONTEO
          */

          if (
            elapsed >=
            seconds
          ) {

            clearInterval(
              state.countdownTimer
            );


            setText(
              UI.countdown,
              0
            );


            resolve();

          }

        };


      update();


      /*
        FIX11:
        40 ms en lugar de 80 ms
        para detectar con mejor resolución
        el instante de preaviso.
      */

      state.countdownTimer =

        setInterval(
          update,
          40
        );

    }
  );

}


/* ==========================================
   SECUENCIA DE PREDICCIÓN
   ========================================== */

async function beginPredictionSequence(
  result
) {

  const explanation =
    briefExplanation(
      result
    );


  state.lastPredictionResult =
    result;


  setText(
    UI.engineStage,
    "PREDICCIÓN CONFIRMADA"
  );


  setText(
    UI.engineDetail,
    "Escuche la señal y ejecute dentro del conteo."
  );


  UI.engineProgress.style.width =
    "88%";


  showFloating(
    "confirmed",
    "EJECUTAR",
    visualDirection(
      result
    ),
    explanation ||
      "Filtros superados."
  );


  await voiceAssistant
    .announcePredictionAndExecution(
      result,
      explanation
    );


  setText(
    UI.engineStage,
    "VENTANA DE EJECUCIÓN"
  );


  setText(
    UI.engineDetail,
    "Conteo sincronizado con segundos reales."
  );


  UI.engineProgress.style.width =
    "100%";


  await runCountdown(
    ENGINE.executionSeconds,
    result
  );


  await sleep(
    450
  );


  finishPrediction(
    "La ventana de ejecución terminó."
  );

}


/* ==========================================
   CONFIGURACIÓN DE ALERTA
   ========================================== */

const ENTRY_SETTINGS_KEY =
  "trading-entry-alert-v11-3-4";


function loadEntrySettings() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          ENTRY_SETTINGS_KEY
        ) ||
        "{}"
      );


    if (
      UI.entryAlertEnabled
    ) {

      UI.entryAlertEnabled.checked =
        saved.enabled ??
        true;

    }


    if (
      UI.entryAlertSecond
    ) {

      UI.entryAlertSecond.value =
        String(
          saved.second ??
          10
        );

    }


    if (
      UI.entryAlertDelay
    ) {

      UI.entryAlertDelay.value =
        String(
          saved.delayMs ??
          100
        );

    }

  }

  catch {}

}


function saveEntrySettings() {

  try {

    localStorage.setItem(
      ENTRY_SETTINGS_KEY,

      JSON.stringify({

        enabled:
          Boolean(
            UI.entryAlertEnabled
              ?.checked
          ),

        second:
          Number(
            UI.entryAlertSecond
              ?.value ||
            10
          ),

        delayMs:
          Number(
            UI.entryAlertDelay
              ?.value ||
            100
          )

      })
    );

  }

  catch {}

}


/* ==========================================
   INIT
   ========================================== */

async function init() {

  await voiceAssistant.init();


  voiceAssistant.voices
    .forEach(
      (voice) => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          `${voice.name}|${voice.lang}`;


        option.textContent =
          `${voice.name} · ${voice.lang}`;


        UI.voiceSelect
          .appendChild(
            option
          );

      }
    );


  diagnostics.subscribe(
    renderDiagnostics
  );


  diagnostics.ok(
    `Trading Analyst Pro MR V${APP_VERSION} iniciado.`
  );


  loadEntrySettings();


  populateMarketSelector();


  renderLanguage();


  renderTicker();


  renderStats();


  renderCalibration();


  renderControls();


  renderLatency();


  setText(
    UI.marketName,

    marketRegistry.all()[
      state.symbol
    ]?.name ||
    state.symbol
  );


  log(
    `Trading Analyst Pro MR V${APP_VERSION} listo.`,
    "ok"
  );

}


/* ==========================================
   EVENTOS PRINCIPALES
   ========================================== */

UI.connectButton
  .addEventListener(
    "click",
    () =>
      derivAPI.connect(
        state.symbol
      )
  );


UI.disconnectButton
  .addEventListener(
    "click",
    () => {

      stopEngine(
        false
      );


      derivAPI.disconnect();

    }
  );


UI.engineButton
  .addEventListener(
    "click",
    () => {

      state.engineOn
        ? stopEngine()
        : startEngine();

    }
  );


UI.predictionButton
  .addEventListener(
    "click",
    requestPrediction
  );


/* ==========================================
   CAMBIO DE MERCADO
   ========================================== */

UI.marketSelect
  .addEventListener(
    "change",
    () => {

      const wasEngineOn =
        state.engineOn;


      state.symbol =
        UI.marketSelect.value;


      memoryManager.clean(
        "market-change"
      );


      marketBuffer.reset();


      latencyMonitor.reset();


      state.latency =
        latencyMonitor.current;


      state.snapshot =
        null;


      state.lastOpportunity =
        null;


      setText(
        UI.marketName,

        marketRegistry.all()[
          state.symbol
        ]?.name ||
        state.symbol
      );


      setText(
        UI.price,
        "--"
      );


      setText(
        UI.tickCount,
        0
      );


      setText(
        UI.lastDigit,
        "--"
      );


      setText(
        UI.memoryStatus,
        0
      );


      UI.digits.innerHTML =
        "";


      if (
        state.connected
      ) {

        derivAPI.changeSymbol(
          state.symbol
        );

      }


      if (
        wasEngineOn
      ) {

        state.engineOn =
          true;


        setText(
          UI.engineStage,
          "SINCRONIZANDO NUEVO MERCADO"
        );


        setText(
          UI.engineDetail,
          "Recopilando datos limpios sin apagar el motor."
        );


        voiceAssistant.speak(
          `Cambiando a ${
            marketRegistry.all()[
              state.symbol
            ]?.name ||
            state.symbol
          }.`
        );

      }


      populateMarketSelector();


      renderLanguage();


      renderTicker();


      renderStats();


      renderCalibration();


      renderControls();

    }
  );


/* ==========================================
   CAMBIO DE ESTRATEGIA
   ========================================== */

UI.strategySelect
  .addEventListener(
    "change",
    () => {

      state.strategy =
        UI.strategySelect.value;


      state.snapshot =
        null;


      state.lastOpportunity =
        null;


      const previous =
        state.symbol;


      const changedMarket =
        populateMarketSelector();


      if (
        !UI.marketSelect
          .options
          .length
      ) {

        setText(
          UI.controlMessage,

          state.connected

            ? `No se detectó todavía un mercado compatible con ${STRATEGIES[state.strategy].name}. Actualizando desde Deriv...`

            : `Conecte la herramienta para cargar mercados compatibles con ${STRATEGIES[state.strategy].name}.`
        );


        if (
          state.connected
        ) {

          derivAPI
            .requestActiveSymbols();

        }

      }

      else if (
        changedMarket &&
        state.connected &&
        state.symbol !==
          previous
      ) {

        memoryManager.clean(
          "strategy-market-change"
        );


        marketBuffer.reset();


        latencyMonitor.reset();


        state.latency =
          latencyMonitor.current;


        derivAPI.changeSymbol(
          state.symbol
        );


        setText(
          UI.marketName,

          marketRegistry.all()[
            state.symbol
          ]?.name ||
          state.symbol
        );

      }


      setText(
        UI.engineStage,

        state.engineOn
          ? "ESTRATEGIA ACTUALIZADA"
          : "EN ESPERA"
      );


      setText(
        UI.engineDetail,

        state.engineOn

          ? `Analizando ${STRATEGIES[state.strategy].name} sin apagar el motor.`

          : "Encienda el motor para comenzar."
      );


      voiceAssistant.speak(
        `Estrategia ${
          STRATEGIES[
            state.strategy
          ].voice
        }.`
      );


      renderLanguage();


      renderTicker();


      renderStats();


      renderCalibration();


      renderControls();

    }
  );


/* ==========================================
   CAMBIO DE MODO
   ========================================== */

UI.modeSelect
  .addEventListener(
    "change",
    () => {

      state.mode =
        UI.modeSelect.value;


      state.snapshot =
        null;


      state.lastOpportunity =
        null;


      renderCalibration();


      renderControls();

    }
  );


/* ==========================================
   VOZ
   ========================================== */

UI.voiceButton
  .addEventListener(
    "click",
    () => {

      setText(
        UI.voiceButton,

        voiceAssistant.toggle()
          ? "🔊"
          : "🔇"
      );

    }
  );


UI.voiceSelect
  .addEventListener(
    "change",
    () => {

      voiceAssistant.voice =

        voiceAssistant.voices.find(
          (voice) =>
            `${voice.name}|${voice.lang}` ===
            UI.voiceSelect.value
        ) ||

        voiceAssistant.voice;

    }
  );


UI.voiceRate
  .addEventListener(
    "input",
    () => {

      voiceAssistant.rate =
        Number(
          UI.voiceRate.value
        );


      setText(
        UI.voiceRateValue,
        `${voiceAssistant.rate.toFixed(2)}x`
      );

    }
  );


UI.voiceTest
  .addEventListener(
    "click",
    () => {

      voiceAssistant.speak(
        "Asistente de voz funcionando. Matches se pronuncia coincidencia."
      );

    }
  );


/* ==========================================
   DIAGNÓSTICOS
   ========================================== */

UI.diagnosticButton
  .addEventListener(
    "click",
    () => {

      const open =
        UI.diagnosticPanel.hidden;


      UI.diagnosticPanel.hidden =
        !open;


      UI.diagnosticButton.textContent =
        open
          ? "🛠 CERRAR"
          : "🛠 ABRIR";

    }
  );


UI.copyDiagnostic
  .addEventListener(
    "click",
    async () => {

      try {

        await navigator
          .clipboard
          .writeText(
            diagnostics.exportText() ||
            "Sin eventos."
          );


        log(
          "Diagnóstico copiado.",
          "ok"
        );

      }

      catch (
        error
      ) {

        diagnostics.error(
          "No se pudo copiar el diagnóstico.",
          {

            message:
              error.message

          }
        );

      }

    }
  );


UI.clearDiagnostic
  .addEventListener(
    "click",
    () =>
      diagnostics.clear()
  );


UI.clearLog
  .addEventListener(
    "click",
    () => {

      UI.activityLog.innerHTML =
        "";

    }
  );


UI.resetStats
  .addEventListener(
    "click",
    () => {

      statistics.reset(
        statsKey()
      );


      renderStats();

    }
  );


/* ==========================================
   CALIBRACIÓN MANUAL
   ========================================== */

UI.saveCalibration
  .addEventListener(
    "click",
    () => {

      const second =
        Number(
          UI.executedSecond.value
        );


      const result =
        UI.manualResult.value;


      if (
        !second ||
        ![
          "success",
          "failed"
        ]
          .includes(
            result
          )
      ) {

        log(
          "Seleccione segundo y resultado antes de guardar.",
          "warn"
        );


        return;

      }


      executionCalibrator.record(
        calibrationContext(),
        second,
        result ===
          "success"
      );


      statistics.record(
        statsKey(),
        result ===
          "success"
      );


      populateMarketSelector();


      renderLanguage();


      renderTicker();


      renderStats();


      renderCalibration();


      UI.executedSecond.value =
        "";


      UI.manualResult.value =
        "";


      log(
        `Resultado guardado para el segundo ${second}.`,
        "ok"
      );

    }
  );


UI.resetCalibration
  .addEventListener(
    "click",
    () => {

      executionCalibrator.reset(
        calibrationContext()
      );


      renderCalibration();


      log(
        "Calibración reiniciada para esta configuración.",
        "warn"
      );

    }
  );


/* ==========================================
   ALERTAS DE ENTRADA
   ========================================== */

UI.entryAlertEnabled
  ?.addEventListener(
    "change",
    saveEntrySettings
  );


UI.entryAlertSecond
  ?.addEventListener(
    "change",
    saveEntrySettings
  );


UI.entryAlertDelay
  ?.addEventListener(
    "change",
    saveEntrySettings
  );


/* ==========================================
   IDIOMA
   ========================================== */

UI.languageSelect
  .addEventListener(
    "change",
    () => {

      i18n.setLanguage(
        UI.languageSelect.value
      );


      renderLanguage();


      renderTicker();


      UI.marketSelect
        .dispatchEvent(
          new Event(
            "optionsupdated"
          )
        );


      UI.strategySelect
        .dispatchEvent(
          new Event(
            "optionsupdated"
          )
        );


      UI.modeSelect
        .dispatchEvent(
          new Event(
            "optionsupdated"
          )
        );

    }
  );


window.addEventListener(
  "languagechange",
  () => {

    renderLanguage();

    renderTicker();

  }
);


/* ==========================================
   REGISTRO DE MERCADOS
   ========================================== */

UI.refreshMarkets
  .addEventListener(
    "click",
    () => {

      derivAPI
        .requestActiveSymbols();


      setText(
        UI.marketRegistryMessage,
        "Solicitando mercados activos a Deriv..."
      );

    }
  );


UI.addManualMarket
  .addEventListener(
    "click",
    () => {

      try {

        marketRegistry.addManual({

          symbol:
            UI.manualMarketSymbol.value,

          name:
            UI.manualMarketName.value,

          oneSecond:
            UI.manualMarketOneSecond.checked

        });


        populateMarketSelector();


        setText(
          UI.marketRegistryMessage,
          "Mercado agregado correctamente."
        );


        UI.manualMarketSymbol.value =
          "";


        UI.manualMarketName.value =
          "";


        UI.manualMarketOneSecond.checked =
          false;

      }

      catch (
        error
      ) {

        setText(
          UI.marketRegistryMessage,
          error.message
        );

      }

    }
  );


/* ==========================================
   EVENTOS DERIV
   ========================================== */

derivAPI.on(
  "activeSymbols",
  (
    {
      items
    }
  ) => {

    marketRegistry
      .ingestActiveSymbols(
        items
      );


    const previous =
      state.symbol;


    const changedMarket =
      populateMarketSelector();


    if (
      changedMarket &&
      state.connected &&
      state.symbol !==
        previous
    ) {

      memoryManager.clean(
        "active-symbols-market-change"
      );


      marketBuffer.reset();


      latencyMonitor.reset();


      state.latency =
        latencyMonitor.current;


      derivAPI.changeSymbol(
        state.symbol
      );


      setText(
        UI.marketName,

        marketRegistry.all()[
          state.symbol
        ]?.name ||
        state.symbol
      );

    }


    setText(
      UI.marketRegistryMessage,
      `${items.length} símbolos recibidos; se mostraron los mercados compatibles con la estrategia.`
    );


    renderTicker();


    renderControls();

  }
);


derivAPI.on(
  "state",
  (
    {
      state:
        status,

      label
    }
  ) =>
    renderConnection(
      status,
      label
    )
);


derivAPI.on(
  "tick",
  processTick
);


derivAPI.on(
  "error",
  (
    {
      message
    }
  ) =>
    log(
      message,
      "error"
    )
);


derivAPI.on(
  "log",
  (
    {
      message,
      level
    }
  ) =>
    log(
      message,
      level
    )
);


/* ==========================================
   MEMORIA
   ========================================== */

memoryManager.register(
  () => {

    clearInterval(
      state.countdownTimer
    );


    clearTimeout(
      state.cooldownTimer
    );


    state.predictionActive =
      false;


    state.cooldown =
      false;


    hideFloating();

  }
);


/* ==========================================
   CIERRE
   ========================================== */

window.addEventListener(
  "beforeunload",
  () => {

    derivAPI.disconnect();


    memoryManager.clean(
      "before-unload"
    );

  }
);


/* ==========================================
   INICIAR
   ========================================== */

init()
  .catch(
    (error) => {

      diagnostics.error(
        "Error durante init().",
        {

          name:
            error.name,

          message:
            error.message,

          stack:
            error.stack

        }
      );

    }
  );
