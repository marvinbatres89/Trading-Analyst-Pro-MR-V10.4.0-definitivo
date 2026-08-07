const TRANSLATIONS = {
  es: {
    engineStatus: "ESTADO DE LOS MOTORES",
    liveMarket: "MERCADO EN VIVO",
    signal: "SEÑAL",
    trend: "TENDENCIA",
    momentum: "IMPULSO",
    volatility: "VOLATILIDAD",
    noData: "SIN DATOS",
    bullish: "ALCISTA",
    bearish: "BAJISTA",
    neutral: "NEUTRO",
    positive: "POSITIVO",
    negative: "NEGATIVO",
    low: "BAJA",
    medium: "MEDIA",
    high: "ALTA",
    veryHigh: "MUY ALTA",
    connect: "CONECTAR",
    disconnect: "DESCONECTAR",
    startEngine: "INICIAR MOTOR",
    stopEngine: "DETENER MOTOR",
    prediction: "PREDICCIÓN",
    wait: "ESPERAR",
    ready: "LISTA PARA OPERAR",
    connected: "CONECTADO",
    last20: "ÚLTIMOS 20 DÍGITOS",
    even: "PARES",
    odd: "IMPARES",
    rises: "SUBIDAS",
    falls: "BAJADAS",
    currentPrice: "PRECIO ACTUAL",
    lastDigit: "ÚLTIMO DÍGITO",
    liveTicker: "TICKER EN VIVO",
    language: "IDIOMA",
    risk: "RIESGO",
    filters: "FILTROS",
    reasons: "MOTIVOS",
    results: "RESULTADOS OBSERVADOS"
  },
  en: {
    engineStatus: "ENGINE STATUS",
    liveMarket: "LIVE MARKET",
    signal: "SIGNAL",
    trend: "TREND",
    momentum: "MOMENTUM",
    volatility: "VOLATILITY",
    noData: "NO DATA",
    bullish: "BULLISH",
    bearish: "BEARISH",
    neutral: "NEUTRAL",
    positive: "POSITIVE",
    negative: "NEGATIVE",
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    veryHigh: "VERY HIGH",
    connect: "CONNECT",
    disconnect: "DISCONNECT",
    startEngine: "START ENGINE",
    stopEngine: "STOP ENGINE",
    prediction: "PREDICTION",
    wait: "WAIT",
    ready: "READY",
    connected: "CONNECTED",
    last20: "LAST 20 DIGITS",
    even: "EVEN",
    odd: "ODD",
    rises: "RISES",
    falls: "FALLS",
    currentPrice: "CURRENT PRICE",
    lastDigit: "LAST DIGIT",
    liveTicker: "LIVE TICKER",
    language: "LANGUAGE",
    risk: "RISK",
    filters: "FILTERS",
    reasons: "REASONS",
    results: "OBSERVED RESULTS"
  }
};

class I18n {
  constructor() {
    this.language = localStorage.getItem("trading-analyst-language") || "es";
  }

  t(key) {
    return TRANSLATIONS[this.language]?.[key] ?? TRANSLATIONS.es[key] ?? key;
  }

  setLanguage(language) {
    if (!TRANSLATIONS[language]) return;
    this.language = language;
    localStorage.setItem("trading-analyst-language", language);
    document.documentElement.lang = language;
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { language } }));
  }

  translateState(value) {
    const map = {
      BULLISH: "bullish",
      BEARISH: "bearish",
      LATERAL: "neutral",
      NEUTRAL: "neutral",
      POSITIVE: "positive",
      NEGATIVE: "negative",
      LOW: "low",
      MEDIUM: "medium",
      HIGH: "high",
      "VERY HIGH": "veryHigh",
      "NO DATA": "noData"
    };
    return this.t(map[value] || value);
  }
}

export const i18n = new I18n();
