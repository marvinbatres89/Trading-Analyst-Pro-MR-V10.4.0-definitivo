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
import { marketRegistry } from "./market-registry.js";


/* ==========================================
   TRADING ANALYZER
   APP.JS

   FIX13.4.1
   VOZ + TARGET 10 CORREGIDOS

   SECUENCIA:

   1. ANALIZA
   2. SI NO HAY ENTRADA, TERMINA
   3. SI HAY ENTRADA, DA EXPLICACIÓN BREVE
   4. ENVÍA LA SEÑAL AL BOT CON ANTICIPACIÓN
      TÉCNICA SILENCIOSA
   5. DICE:
      "TIENES DIEZ SEGUNDOS PARA
       REALIZAR LA OPERACIÓN"
   6. SIN PAUSA LARGA COMIENZA:
      10, 9, 8, 7...
   7. CADA NÚMERO USA RELOJ REAL
   8. EL 10 ES LA REFERENCIA CENTRAL
      PARA LA CALIBRACIÓN DEL BOT

   PRONUNCIACIÓN:
   EVEN  -> PAR
   ODD   -> IMPAR
   RISE  -> SUBE
   FALL  -> BAJA
   OVER  -> MÁS
   UNDER -> MENOS
   MATCH -> COINCIDENCIA

   CONSERVA:
   - BLOQUEO DE PREDICCIONES VIEJAS
   - DERIV
   - INDICADORES
   - ESTADÍSTICAS
   - CALIBRADOR
   - DIAGNÓSTICOS
   - MERCADOS
   - BRIDGE AL BOT
   ========================================== */


const $ = (id) =>
  document.getElementById(id);


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
].forEach((id) => {
  UI[id] = $(id);
});


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
    null,

  predictionRunId:
    0

};


/* ==========================================
   FIX13.4.1
   TIEMPOS

   EL USUARIO NO ESCUCHA ESTE PREAVISO.

   EL BOT RECIBE LA SEÑAL 2.6 s
   ANTES DEL TARGET VISUAL.

   0.4 s DESPUÉS COMIENZA LA FRASE:

   "Tienes diez segundos para
    realizar la operación."

   El objetivo es que al terminar esa
   frase el número 10 aparezca sin una
   pausa grande.

   Estos valores NO son todavía la
   calibración STANDARD / 1S del BUY.
   Esa calibración permanece en el BOT.
   ========================================== */

const ANTICIPACION_BOT_MS =
  2600;


const FRASE_ANTES_TARGET_MS =
  2200;


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


function sleep(
  ms
) {

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        Math.max(
          0,
          Number(ms) || 0
        )
      )
  );

}


/* ==========================================
   CONTROL DE PREDICCIÓN FIX13.4
   ========================================== */

function nuevaPrediccionId() {

  state.predictionRunId +=
    1;


  return state.predictionRunId;

}


function prediccionSigueActiva(
  runId
) {

  return (
    state.predictionActive ===
      true &&
    state.predictionRunId ===
      runId
  );

}


function invalidarPrediccionActual() {

  state.predictionRunId +=
    1;


  clearInterval(
    state.countdownTimer
  );


  state.countdownTimer =
    null;

}


/* ==========================================
   REGISTRO
   ========================================== */

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
        ) * 100
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
   TICKS MÍNIMOS
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


/* ==========================================
   COMPATIBILIDAD MERCADO
   ========================================== */

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


/* ==========================================
   PUEDE PREDECIR
   ========================================== */

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


  if (
    UI.engineButton
  ) {

    UI.engineButton.textContent =
      state.engineOn
        ? i18n.t(
            "stopEngine"
          )
        : i18n.t(
            "startEngine"
          );

  }


  if (
    UI.connectButton
  ) {

    UI.connectButton.textContent =
      i18n.t(
        "connect"
      );

  }


  if (
    UI.disconnectButton
  ) {

    UI.disconnectButton.textContent =
      i18n.t(
        "disconnect"
      );

  }


  if (
    UI.predictionButton
  ) {

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

  }


  const locked =
    state.predictionActive ||
    state.cooldown;


  [
    UI.marketSelect,
    UI.strategySelect,
    UI.modeSelect
  ].forEach(
    (element) => {

      if (
        element
      ) {

        element.disabled =
          locked;

      }

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


  if (
    UI.connectButton
  ) {

    UI.connectButton.disabled =
      status ===
        "connecting" ||
      status ===
        "live";

  }


  if (
    UI.disconnectButton
  ) {

    UI.disconnectButton.disabled =
      status !==
      "live";

  }


  if (
    UI.engineButton
  ) {

    UI.engineButton.disabled =
      status !==
      "live";

  }


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
      : `${value.status} · ${Math.round(
          value.latencyMs
        )} ms`
  );


  if (
    UI.latencyStatus
  ) {

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

}


/* ==========================================
   DÍGITOS
   ========================================== */

function renderDigits() {

  if (
    !UI.digits
  ) {

    return;

  }


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


        UI.digits.appendChild(
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

  if (
    !snapshot
  ) {

    return;

  }


  setText(
    UI.trend,
    i18n.translateState(
      snapshot.trend.direction
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

  if (
    !UI.marketSelect
  ) {

    return false;

  }


  const previous =
    state.symbol;


  const markets =
    marketRegistry.all();


  UI.marketSelect.innerHTML =
    "";


  const compatible =
    Object.entries(
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
          market.strategies.includes(
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
            rank(a);


          const rb =
            rank(b);


          return (
            ra[0] -
              rb[0] ||
            ra[1] -
              rb[1] ||
            ra[2]
              .localeCompare(
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


      UI.marketSelect.appendChild(
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


  UI.marketSelect.dispatchEvent(
    new Event(
      "optionsupdated"
    )
  );


  return (
    previous !==
    state.symbol
  );

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
      ? `● ${i18n.t(
          "connected"
        )}`
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


  if (
    UI.tickerDigits
  ) {

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


        UI.tickerDigits.appendChild(
          node
        );

      }
    );

  }


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
   TICKS
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
    ).toLocaleTimeString(
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
   MOTOR
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


  if (
    UI.engineProgress
  ) {

    UI.engineProgress.style.width =
      "25%";

  }


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
    }.`,
    {
      replace:
        true
    }
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


function stopEngine(
  announce = true
) {

  invalidarPrediccionActual();


  state.engineOn =
    false;


  state.predictionActive =
    false;


  state.cooldown =
    false;


  clearTimeout(
    state.cooldownTimer
  );


  state.cooldownTimer =
    null;


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


  if (
    UI.engineProgress
  ) {

    UI.engineProgress.style.width =
      "0%";

  }


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


  if (
    UI.digits
  ) {

    UI.digits.innerHTML =
      "";

  }


  renderLatency();


  if (
    announce
  ) {

    voiceAssistant.speak(
      "Motor apagado. Memoria temporal liberada.",
      {
        replace:
          true
      }
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

  if (
    !UI.floatingSignal
  ) {

    return;

  }


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
    ?.classList
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

  if (
    !UI.signalReasons
  ) {

    return;

  }


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
    ).map(
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


        UI.signalReasons.appendChild(
          item
        );

      }
    );

}


/* ==========================================
   FIX13.4.1
   DIRECCIÓN HABLADA

   NO DELETREAR PALABRAS TÉCNICAS.
   ========================================== */

function direccionParaVoz(
  result
) {

  const direccion =
    String(
      result?.direction ||
      ""
    )
      .trim()
      .toUpperCase();


  const digit =
    result
      ?.metadata
      ?.digit ??
    result
      ?.metadata
      ?.numero ??
    result
      ?.metadata
      ?.barrier;


  if (
    direccion ===
      "EVEN" ||
    direccion ===
      "PAR"
  ) {

    return "par";

  }


  if (
    direccion ===
      "ODD" ||
    direccion ===
      "IMPAR"
  ) {

    return "impar";

  }


  if (
    direccion ===
      "RISE" ||
    direccion ===
      "UP" ||
    direccion ===
      "SUBE"
  ) {

    return "sube";

  }


  if (
    direccion ===
      "FALL" ||
    direccion ===
      "DOWN" ||
    direccion ===
      "BAJA"
  ) {

    return "baja";

  }


  if (
    direccion ===
      "OVER" ||
    direccion ===
      "MAS" ||
    direccion ===
      "MÁS"
  ) {

    return Number.isFinite(
      Number(
        digit
      )
    )
      ? `más de ${digit}`
      : "más";

  }


  if (
    direccion ===
      "UNDER" ||
    direccion ===
      "MENOS"
  ) {

    return Number.isFinite(
      Number(
        digit
      )
    )
      ? `menos de ${digit}`
      : "menos";

  }


  if (
    direccion ===
    "MATCH"
  ) {

    return Number.isFinite(
      Number(
        digit
      )
    )
      ? `coincidencia ${digit}`
      : "coincidencia";

  }


  return String(
    visualDirection(
      result
    ) ||
    "entrada"
  )
    .toLowerCase();

}


/* ==========================================
   EXPLICACIÓN BREVE
   ========================================== */

function construirResumenVoz(
  result,
  explanation
) {

  const direccion =
    direccionParaVoz(
      result
    );


  const mercado =
    marketRegistry.all()[
      state.symbol
    ]?.name ||
    state.symbol;


  const detalle =
    String(
      explanation ||
      ""
    )
      .trim();


  /*
    EVITAMOS REPETIR UNA EXPLICACIÓN
    DEMASIADO LARGA.

    briefExplanation ya limita
    normalmente a los dos motivos
    principales.
  */

  if (
    detalle
  ) {

    return `Predicción confirmada. ${direccion}. Mercado ${mercado}. ${detalle}`;

  }


  return `Predicción confirmada. ${direccion}. Mercado ${mercado}.`;

}


/* ==========================================
   FINALIZAR
   ========================================== */

function finishPrediction(
  message,
  runId =
    state.predictionRunId
) {

  if (
    runId !==
    state.predictionRunId
  ) {

    return;

  }


  clearInterval(
    state.countdownTimer
  );


  state.countdownTimer =
    null;


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


  if (
    UI.engineProgress
  ) {

    UI.engineProgress.style.width =
      "0%";

  }


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
    "Predicción finalizada FIX13.4.1.",
    {
      message,
      runId
    }
  );


  renderControls();


  clearTimeout(
    state.cooldownTimer
  );


  state.cooldownTimer =
    setTimeout(
      () => {

        if (
          runId !==
          state.predictionRunId
        ) {

          return;

        }


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
   PUENTE BOT
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


/* ==========================================
   ENVIAR SEÑAL AL BOT
   ========================================== */

function enviarSenalAlBot(
  result,
  segundoEntrada,
  targetVisualAt
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


  const visualTarget =
    Number(
      targetVisualAt
    );


  if (
    !Number.isFinite(
      visualTarget
    ) ||
    visualTarget <=
      Date.now()
  ) {

    diagnostics.error(
      "FIX13.4.1: targetVisualAt inválido.",
      {
        targetVisualAt:
          visualTarget
      }
    );


    log(
      "BOT FIX13.4.1 ERROR → target visual inválido.",
      "error"
    );


    return false;

  }


  const ahoraEpoch =
    Date.now();


  const senal = {

    id:
      `${ahoraEpoch}-${state.symbol}-${state.strategy}`,

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


    /*
      COMPATIBILIDAD CON EL BOT ACTUAL.

      POR AHORA targetExecutionAt
      SIGUE SIENDO EL PUNTO VISUAL 10.

      EL BOT APLICA SU CALIBRACIÓN
      EN MILISEGUNDOS SOBRE ESTE TARGET.
    */

    targetExecutionAt:
      visualTarget,


    /*
      NUEVO NOMBRE MÁS CLARO.
    */

    targetVisualAt:
      visualTarget,


    analyzerSentEpoch:
      ahoraEpoch,

    timestamp:
      ahoraEpoch,


    metadata: {

      ...(
        result.metadata ||
        {}
      ),

      targetExecutionAt:
        visualTarget,

      targetVisualAt:
        visualTarget,

      analyzerSentEpoch:
        ahoraEpoch,

      anticipacionTecnicaMs:
        ANTICIPACION_BOT_MS,

      referenciaEntrada:
        "INICIO_VISUAL_10",

      fix:
        "FIX13.4.1"

    },


    origen:
      `Trading Analyst Pro MR V${APP_VERSION}`

  };


  let broadcastOk =
    false;


  let storageOk =
    false;


  try {

    if (
      botChannel
    ) {

      botChannel.postMessage(
        senal
      );


      broadcastOk =
        true;

    }

  }

  catch (
    error
  ) {

    diagnostics.error(
      "Error BroadcastChannel hacia BOT.",
      {
        message:
          error.message
      }
    );

  }


  try {

    localStorage.setItem(
      "TA_BOT_SIGNAL_V1",
      JSON.stringify(
        senal
      )
    );


    storageOk =
      true;

  }

  catch (
    error
  ) {

    diagnostics.error(
      "Error localStorage hacia BOT.",
      {
        message:
          error.message
      }
    );

  }


  const anticipacion =
    visualTarget -
    Date.now();


  diagnostics.ok(
    "Señal FIX13.4.1 enviada al BOT.",
    {
      mercado:
        senal.mercado,

      direccion:
        senal.direccion,

      confianza:
        senal.confianza,

      targetVisualAt:
        senal.targetVisualAt,

      anticipacionMs:
        anticipacion,

      BroadcastChannel:
        broadcastOk,

      localStorage:
        storageOk
    }
  );


  log(
    `BOT FIX13.4.1 → ${senal.mercado} · ${senal.direccion} · TARGET 10 · anticipación ${(anticipacion / 1000).toFixed(2)} s`,
    "ok"
  );


  return (
    broadcastOk ||
    storageOk
  );

}


/* ==========================================
   CUENTA REGRESIVA REAL
   ========================================== */

async function runCountdown(
  seconds,
  runId
) {

  clearInterval(
    state.countdownTimer
  );


  return new Promise(
    (resolve) => {

      const startedAt =
        performance.now();


      let lastShown =
        null;


      const flashEntry =
        () => {

          if (
            runId !==
              state.predictionRunId ||
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


          void UI.entryFlash.offsetWidth;


          UI.entryFlash
            .classList
            .add(
              "pulse"
            );


          setTimeout(
            () => {

              if (
                runId ===
                state.predictionRunId
              ) {

                UI.entryFlash.hidden =
                  true;

              }

            },
            650
          );

        };


      const update =
        () => {

          if (
            runId !==
            state.predictionRunId
          ) {

            clearInterval(
              state.countdownTimer
            );


            state.countdownTimer =
              null;


            resolve();


            return;

          }


          const elapsed =
            (
              performance.now() -
              startedAt
            ) /
            1000;


          /*
            floor(elapsed) garantiza:

            0.000 - 0.999 = 10
            1.000 - 1.999 = 9
            2.000 - 2.999 = 8

            CADA NÚMERO RESPETA
            UN SEGUNDO REAL.
          */

          const remaining =
            Math.max(
              0,
              Number(
                seconds
              ) -
              Math.floor(
                elapsed
              )
            );


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


            /*
              EL RELOJ MANDA.

              LA VOZ NO PUEDE ATRASAR
              EL CAMBIO DEL NÚMERO.
            */

            try {

              const spoken =
                voiceAssistant
                  .speakCountdownNumber(
                    remaining
                  );


              if (
                spoken &&
                typeof spoken.catch ===
                  "function"
              ) {

                spoken.catch(
                  () => {}
                );

              }

            }

            catch {}


            const target =
              Number(
                UI.entryAlertSecond
                  ?.value ||
                10
              );


            if (
              UI.entryAlertEnabled
                ?.checked &&
              remaining ===
                target
            ) {

              flashEntry();

            }

          }


          if (
            elapsed >=
            Number(
              seconds
            )
          ) {

            clearInterval(
              state.countdownTimer
            );


            state.countdownTimer =
              null;


            setText(
              UI.countdown,
              0
            );


            resolve();

          }

        };


      update();


      state.countdownTimer =
        setInterval(
          update,
          25
        );

    }
  );

}


/* ==========================================
   FIX13.4.1
   SECUENCIA PRINCIPAL

   CORRECTA:

   PREDICCIÓN
        ↓
   EXPLICACIÓN BREVE
        ↓
   [BOT RECIBE SEÑAL EN SILENCIO]
        ↓
   "TIENES DIEZ SEGUNDOS..."
        ↓
   10
        ↓ 1 SEGUNDO
   9
        ↓ 1 SEGUNDO
   8...
   ========================================== */

async function beginPredictionSequence(
  result,
  runId
) {

  if (
    !prediccionSigueActiva(
      runId
    )
  ) {

    return;

  }


  const explanation =
    briefExplanation(
      result
    );


  state.lastPredictionResult =
    result;


  const targetSecond =
    Number(
      UI.entryAlertSecond
        ?.value ||
      10
    );


  /* ======================================
     1. EXPLICACIÓN BREVE
     ====================================== */

  setText(
    UI.engineStage,
    "SEÑAL CONFIRMADA"
  );


  setText(
    UI.engineDetail,
    "Explicando brevemente la entrada."
  );


  const resumenVoz =
    construirResumenVoz(
      result,
      explanation
    );


  try {

    const anuncio =
      voiceAssistant.speak(
        resumenVoz,
        {
          replace:
            true,

          rate:
            1.04
        }
      );


    if (
      anuncio &&
      typeof anuncio.then ===
        "function"
    ) {

      await anuncio;

    }

  }

  catch (
    error
  ) {

    diagnostics.info(
      "FIX13.4.1: explicación de voz incompleta.",
      {
        message:
          error?.message ||
          String(
            error
          )
      }
    );

  }


  if (
    !prediccionSigueActiva(
      runId
    )
  ) {

    return;

  }


  /* ======================================
     2. CREAR TARGET 10

     NO HAY PREAVISO HABLADO DE 9 s.
     ====================================== */

  const targetVisualAt =
    Date.now() +
    ANTICIPACION_BOT_MS;


  /* ======================================
     3. BOT RECIBE LA SEÑAL
        INMEDIATAMENTE Y EN SILENCIO
     ====================================== */

  const enviada =
    enviarSenalAlBot(
      result,
      targetSecond,
      targetVisualAt
    );


  if (
    !enviada
  ) {

    diagnostics.error(
      "FIX13.4.1: no se pudo transmitir la señal al BOT."
    );


    log(
      "BOT FIX13.4.1 → FALLO DE TRANSMISIÓN.",
      "error"
    );

  }


  setText(
    UI.engineStage,
    "PREPARANDO ENTRADA"
  );


  setText(
    UI.engineDetail,
    `Preparando punto ${targetSecond}.`
  );


  if (
    UI.engineProgress
  ) {

    UI.engineProgress.style.width =
      "92%";

  }


  /*
    SOLO ESPERAMOS UNA FRACCIÓN PEQUEÑA.

    EL USUARIO NO ESCUCHA:
    "TIENES 9 SEGUNDOS".
  */

  const fraseAt =
    targetVisualAt -
    FRASE_ANTES_TARGET_MS;


  await sleep(
    Math.max(
      0,
      fraseAt -
      Date.now()
    )
  );


  if (
    !prediccionSigueActiva(
      runId
    )
  ) {

    return;

  }


  /* ======================================
     4. FRASE FINAL ANTES DEL 10

     NO USAMOS await.

     EL TARGET YA ESTÁ FIJADO.
     ====================================== */

  try {

    const aviso =
      voiceAssistant.speak(
        "Tienes diez segundos para realizar la operación.",
        {
          replace:
            true,

          rate:
            1.08
        }
      );


    if (
      aviso &&
      typeof aviso.catch ===
        "function"
    ) {

      aviso.catch(
        () => {}
      );

    }

  }

  catch {}


  /* ======================================
     5. ESPERAR TARGET REAL
     ====================================== */

  await sleep(
    Math.max(
      0,
      targetVisualAt -
      Date.now()
    )
  );


  if (
    !prediccionSigueActiva(
      runId
    )
  ) {

    return;

  }


  /* ======================================
     6. INICIO EXACTO DEL 10
     ====================================== */

  const visualReachedAt =
    Date.now();


  const desviacionVisualMs =
    visualReachedAt -
    targetVisualAt;


  setText(
    UI.engineStage,
    "VENTANA DE EJECUCIÓN"
  );


  setText(
    UI.engineDetail,
    `PUNTO ${targetSecond} · REFERENCIA DE EJECUCIÓN.`
  );


  if (
    UI.engineProgress
  ) {

    UI.engineProgress.style.width =
      "100%";

  }


  diagnostics.ok(
    "FIX13.4.1 TARGET 10 ALCANZADO.",
    {
      runId,
      targetVisualAt,
      visualReachedAt,
      desviacionVisualMs
    }
  );


  log(
    `FIX13.4.1 → 10 ALCANZADO · desviación ${desviacionVisualMs} ms.`,
    "ok"
  );


  /* ======================================
     7. 10, 9, 8...
     ====================================== */

  await runCountdown(
    ENGINE.executionSeconds,
    runId
  );


  if (
    !prediccionSigueActiva(
      runId
    )
  ) {

    return;

  }


  await sleep(
    300
  );


  if (
    !prediccionSigueActiva(
      runId
    )
  ) {

    return;

  }


  finishPrediction(
    "La ventana de ejecución terminó.",
    runId
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


  const runId =
    nuevaPrediccionId();


  state.predictionActive =
    true;


  state.lastPredictionResult =
    null;


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


  if (
    UI.engineProgress
  ) {

    UI.engineProgress.style.width =
      "55%";

  }


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
    }.`,
    {
      replace:
        true
    }
  );


  diagnostics.info(
    "Predicción FIX13.4.1 solicitada.",
    {
      runId,
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


  await sleep(
    validationDelay
  );


  if (
    !prediccionSigueActiva(
      runId
    )
  ) {

    return;

  }


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


  if (
    !prediccionSigueActiva(
      runId
    )
  ) {

    return;

  }


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


  if (
    UI.signalBar
  ) {

    UI.signalBar.style.width =
      `${quality.score}%`;

  }


  showReasons(
    result
  );


  /* ======================================
     NO OPERAR
     ====================================== */

  if (
    first.direction ===
    "NO_OPERAR"
  ) {

    if (
      UI.signalCard
    ) {

      UI.signalCard.className =
        "card signal-card no-operate";

    }


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
      "Coincidencia cero. No operar.",
      {
        replace:
          true
      }
    );


    await sleep(
      2200
    );


    if (
      prediccionSigueActiva(
        runId
      )
    ) {

      finishPrediction(
        "El candidato fue 0 y se descartó.",
        runId
      );

    }


    return;

  }


  /* ======================================
     CALIDAD INSUFICIENTE
     ====================================== */

  if (
    !quality.approved
  ) {

    if (
      UI.signalCard
    ) {

      UI.signalCard.className =
        "card signal-card wait";

    }


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
      `No hay una entrada suficientemente clara. ${quality.reason || ""}`,
      {
        replace:
          true
      }
    );


    diagnostics.info(
      "FIX13.4.1 señal descartada por calidad.",
      {
        runId,
        score:
          quality.score,
        reason:
          quality.reason
      }
    );


    await sleep(
      2600
    );


    if (
      prediccionSigueActiva(
        runId
      )
    ) {

      finishPrediction(
        quality.reason ||
        "Calidad insuficiente.",
        runId
      );

    }


    return;

  }


  /* ======================================
     SEÑAL APROBADA
     ====================================== */

  const value =
    visualDirection(
      result
    );


  const explanation =
    briefExplanation(
      result
    );


  if (
    UI.signalCard
  ) {

    UI.signalCard.className =
      "card signal-card confirmed";

  }


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
    "PREDICCIÓN CONFIRMADA"
  );


  setText(
    UI.engineDetail,
    "Preparando explicación y punto 10."
  );


  if (
    UI.engineProgress
  ) {

    UI.engineProgress.style.width =
      "88%";

  }


  await beginPredictionSequence(
    result,
    runId
  );

}


/* ==========================================
   DIAGNÓSTICOS
   ========================================== */

function renderDiagnostics(
  entries
) {

  if (
    !UI.diagnosticContent
  ) {

    return;

  }


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
            ? `\n${JSON.stringify(
                entry.data,
                null,
                2
              )}`
            : "";


        line.textContent =
          `[${entry.time}] ${entry.message}${extra}`;


        UI.diagnosticContent.appendChild(
          line
        );

      }
    );

}


/* ==========================================
   CALIBRADOR
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
    executionCalibrator
      .recommendation(
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


  if (
    !UI.calibrationTable
  ) {

    return;

  }


  UI.calibrationTable.innerHTML =
    "";


  recommendation.rows.forEach(
    (row) => {

      const line =
        document.createElement(
          "div"
        );


      line.className =
        "calibration-row";


      line.innerHTML = `
        <strong>Seg. ${row.second}</strong>
        <span>${row.tests} pruebas</span>
        <span>${row.success} +</span>
        <span>${row.failed} -</span>
      `;


      UI.calibrationTable.appendChild(
        line
      );

    }
  );

}


/* ==========================================
   AJUSTES
   ========================================== */

const ENTRY_SETTINGS_KEY =
  "trading-entry-alert-v13-4-1";


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
          0
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
            0
          )

      })
    );

  }

  catch {}

}


/* ==========================================
   INICIO
   ========================================== */

async function init() {

  await voiceAssistant.init();


  if (
    UI.voiceSelect
  ) {

    UI.voiceSelect.innerHTML =
      "";


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


          UI.voiceSelect.appendChild(
            option
          );

        }
      );

  }


  diagnostics.subscribe(
    renderDiagnostics
  );


  diagnostics.ok(
    `Trading Analyst Pro MR V${APP_VERSION} iniciado · FIX13.4.1 · TARGET 10.`
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


  setText(
    UI.appUpdateStatus,
    "FIX13.4.1"
  );


  log(
    `Trading Analyst Pro MR V${APP_VERSION} listo · FIX13.4.1 · TARGET 10.`,
    "ok"
  );

}


/* ==========================================
   BOTONES PRINCIPALES
   ========================================== */

UI.connectButton
  ?.addEventListener(
    "click",
    () =>
      derivAPI.connect(
        state.symbol
      )
  );


UI.disconnectButton
  ?.addEventListener(
    "click",
    () => {

      stopEngine(
        false
      );


      derivAPI.disconnect();

    }
  );


UI.engineButton
  ?.addEventListener(
    "click",
    () => {

      state.engineOn
        ? stopEngine()
        : startEngine();

    }
  );


UI.predictionButton
  ?.addEventListener(
    "click",
    requestPrediction
  );


/* ==========================================
   MERCADO
   ========================================== */

UI.marketSelect
  ?.addEventListener(
    "change",
    () => {

      const wasEngineOn =
        state.engineOn;


      invalidarPrediccionActual();


      state.predictionActive =
        false;


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


      if (
        UI.digits
      ) {

        UI.digits.innerHTML =
          "";

      }


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
          }.`,
          {
            replace:
              true
          }
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
   ESTRATEGIA
   ========================================== */

UI.strategySelect
  ?.addEventListener(
    "change",
    () => {

      invalidarPrediccionActual();


      state.predictionActive =
        false;


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

          derivAPI.requestActiveSymbols();

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
        }.`,
        {
          replace:
            true
        }
      );


      renderLanguage();

      renderTicker();

      renderStats();

      renderCalibration();

      renderControls();

    }
  );


/* ==========================================
   MODO
   ========================================== */

UI.modeSelect
  ?.addEventListener(
    "change",
    () => {

      invalidarPrediccionActual();


      state.predictionActive =
        false;


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
  ?.addEventListener(
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
  ?.addEventListener(
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
  ?.addEventListener(
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
  ?.addEventListener(
    "click",
    () => {

      voiceAssistant.speak(
        "Asistente de voz funcionando. Par, impar, sube, baja, más, menos y coincidencia.",
        {
          replace:
            true
        }
      );

    }
  );


/* ==========================================
   DIAGNÓSTICOS
   ========================================== */

UI.diagnosticButton
  ?.addEventListener(
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
  ?.addEventListener(
    "click",
    async () => {

      try {

        await navigator.clipboard.writeText(
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
  ?.addEventListener(
    "click",
    () =>
      diagnostics.clear()
  );


UI.clearLog
  ?.addEventListener(
    "click",
    () => {

      if (
        UI.activityLog
      ) {

        UI.activityLog.innerHTML =
          "";

      }

    }
  );


UI.resetStats
  ?.addEventListener(
    "click",
    () => {

      statistics.reset(
        statsKey()
      );


      renderStats();

    }
  );


/* ==========================================
   CALIBRACIÓN
   ========================================== */

UI.saveCalibration
  ?.addEventListener(
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
        ].includes(
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
  ?.addEventListener(
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
   AJUSTES DE ENTRADA
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
  ?.addEventListener(
    "change",
    () => {

      i18n.setLanguage(
        UI.languageSelect.value
      );


      renderLanguage();

      renderTicker();


      UI.marketSelect
        ?.dispatchEvent(
          new Event(
            "optionsupdated"
          )
        );


      UI.strategySelect
        ?.dispatchEvent(
          new Event(
            "optionsupdated"
          )
        );


      UI.modeSelect
        ?.dispatchEvent(
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
   MERCADOS DINÁMICOS
   ========================================== */

UI.refreshMarkets
  ?.addEventListener(
    "click",
    () => {

      derivAPI.requestActiveSymbols();


      setText(
        UI.marketRegistryMessage,
        "Solicitando mercados activos a Deriv..."
      );

    }
  );


UI.addManualMarket
  ?.addEventListener(
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
  ({
    items
  }) => {

    marketRegistry.ingestActiveSymbols(
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
  ({
    state:
      status,
    label
  }) =>
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
  ({
    message
  }) =>
    log(
      message,
      "error"
    )
);


derivAPI.on(
  "log",
  ({
    message,
    level
  }) =>
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

    invalidarPrediccionActual();


    clearTimeout(
      state.cooldownTimer
    );


    state.cooldownTimer =
      null;


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

    invalidarPrediccionActual();


    derivAPI.disconnect();


    memoryManager.clean(
      "before-unload"
    );


    try {

      botChannel
        ?.close();

    }

    catch {}

  }
);


/* ==========================================
   INICIAR
   ========================================== */

init()
  .catch(
    (
      error
    ) => {

      diagnostics.error(
        "Error durante init() FIX13.4.1.",
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


/* ==========================================
   FIN APP.JS
   FIX13.4.1
   ========================================== */
