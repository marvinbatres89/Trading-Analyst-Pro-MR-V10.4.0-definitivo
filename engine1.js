const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, Number(value) || 0));

function output(strategy, direction, score, reasons, warnings = [], metadata = {}) {
  return {
    source: "ENGINE_1",
    strategy,
    direction,
    score: Math.round(clamp(score, 0, 100)),
    reasons,
    warnings,
    metadata,
    createdAt: Date.now()
  };
}

function riseFall(snapshot) {
  let bullish = 0;
  let bearish = 0;
  const upReasons = [];
  const downReasons = [];
  const warnings = [];

  if (snapshot.trend.direction === "BULLISH") {
    bullish += 26 + snapshot.trend.strength * 4;
    upReasons.push("Tendencia principal alcista.");
  }

  if (snapshot.trend.direction === "BEARISH") {
    bearish += 26 + snapshot.trend.strength * 4;
    downReasons.push("Tendencia principal bajista.");
  }

  if (snapshot.momentum.direction === "POSITIVE") {
    bullish += 18 + snapshot.momentum.strength * 3;
    upReasons.push("Momentum positivo.");
  }

  if (snapshot.momentum.direction === "NEGATIVE") {
    bearish += 18 + snapshot.momentum.strength * 3;
    downReasons.push("Momentum negativo.");
  }

  if (snapshot.shortFlow.direction === "BULLISH") {
    bullish += 18 + snapshot.shortFlow.strength * 3;
    upReasons.push("Flujo corto alcista.");
  }

  if (snapshot.shortFlow.direction === "BEARISH") {
    bearish += 18 + snapshot.shortFlow.strength * 3;
    downReasons.push("Flujo corto bajista.");
  }

  if (snapshot.mediumFlow.direction === "BULLISH") bullish += 8;
  if (snapshot.mediumFlow.direction === "BEARISH") bearish += 8;
  if (snapshot.rsiState === "BULLISH") bullish += 10;
  if (snapshot.rsiState === "BEARISH") bearish += 10;

  if (snapshot.lateral) {
    bullish -= 12;
    bearish -= 12;
    warnings.push("Mercado lateral.");
  }

  if (snapshot.volatility.level === "VERY HIGH") {
    bullish -= 14;
    bearish -= 14;
    warnings.push("Volatilidad extrema.");
  }

  const direction = bullish >= bearish ? "RISE" : "FALL";
  const score = Math.max(bullish, bearish);
  const difference = Math.abs(bullish - bearish);

  return output(
    "rise_fall",
    difference < 8 ? "WAIT" : direction,
    difference < 8 ? score - 10 : score,
    direction === "RISE" ? upReasons : downReasons,
    warnings,
    { difference }
  );
}

function digitBinary(strategy, snapshot) {
  const short = snapshot.digits.short;
  const medium = snapshot.digits.medium;
  const long = snapshot.digits.long;

  if (short.count < 20) {
    return output(strategy, "WAIT", 0, ["Recopilando dígitos."]);
  }

  let shortA, shortB, mediumA, mediumB, longA, longB, direction, labelA, labelB;

  if (strategy === "even_odd") {
    shortA = short.evenPercent;
    shortB = short.oddPercent;
    mediumA = medium.evenPercent;
    mediumB = medium.oddPercent;
    longA = long.evenPercent;
    longB = long.oddPercent;
    direction = shortA >= shortB ? "EVEN" : "ODD";
    labelA = "pares";
    labelB = "impares";
  } else {
    shortA = short.highPercent;
    shortB = short.lowPercent;
    mediumA = medium.highPercent;
    mediumB = medium.lowPercent;
    longA = long.highPercent;
    longB = long.lowPercent;
    direction = shortA >= shortB ? "OVER" : "UNDER";
    labelA = "altos";
    labelB = "bajos";
  }

  const shortDiff = Math.abs(shortA - shortB);
  const mediumDiff = Math.abs(mediumA - mediumB);
  const longDiff = Math.abs(longA - longB);

  const shortSideA = shortA >= shortB;
  const mediumSideA = mediumA >= mediumB;
  const longSideA = longA >= longB;

  const agreement =
    Number(shortSideA === mediumSideA) +
    Number(shortSideA === longSideA);

  let score =
    50 +
    shortDiff * 1.25 +
    mediumDiff * 0.65 +
    longDiff * 0.25 +
    agreement * 5;

  if (shortDiff < 6) score -= 10;

  return output(
    strategy,
    score >= 55 ? direction : "WAIT",
    score,
    [
      `Ventana corta: ${shortDiff.toFixed(1)}% de diferencia.`,
      `Comparación de ${labelA} frente a ${labelB}.`,
      `Coincidencia entre ventanas: ${agreement + 1} de 3.`
    ],
    ["La distribución histórica no garantiza el siguiente dígito."],
    { shortDiff, mediumDiff, longDiff, agreement }
  );
}

function matches(snapshot) {
  const windows = [
    snapshot.digits.short,
    snapshot.digits.medium,
    snapshot.digits.long
  ];

  if (windows[0].count < 20) {
    return output("match", "WAIT", 0, ["Recopilando dígitos para Matches."]);
  }

  const candidateScores = Array(10).fill(0);

  windows.forEach((window, index) => {
    const weight = [0.5, 0.3, 0.2][index];
    const divisor = Math.max(1, window.count);

    window.frequency.forEach((count, digit) => {
      candidateScores[digit] += (count / divisor) * 100 * weight;
    });
  });

  let candidate = 1;
  for (let digit = 1; digit <= 9; digit += 1) {
    if (candidateScores[digit] > candidateScores[candidate]) {
      candidate = digit;
    }
  }

  const zeroScore = candidateScores[0];
  const candidateScore = candidateScores[candidate];
  const sorted = candidateScores.slice(1).sort((a, b) => b - a);
  const separation = sorted[0] - (sorted[1] || 0);
  const score = 52 + Math.max(0, candidateScore - 10) * 2.2 + separation * 3;

  if (zeroScore >= candidateScore) {
    return output(
      "match",
      "NO_OPERAR",
      Math.round(score),
      ["El número 0 aparece como candidato principal."],
      ["Regla oficial: 0 = NO OPERAR."],
      { digit: 0, candidateScore, zeroScore, separation }
    );
  }

  return output(
    "match",
    score >= 60 ? "MATCH" : "WAIT",
    score,
    [
      `El número ${candidate} lidera las ventanas combinadas.`,
      `Separación frente al segundo candidato: ${separation.toFixed(1)} puntos.`,
      "El 0 ha sido excluido por regla."
    ],
    ["Matches requiere un filtro de calidad más alto."],
    { digit: candidate, candidateScore, zeroScore, separation }
  );
}

export function exploreOpportunity(strategy, snapshot) {
  if (!snapshot) return output(strategy, "WAIT", 0, ["Sin análisis."]);
  if (strategy === "rise_fall") return riseFall(snapshot);
  if (strategy === "even_odd") return digitBinary("even_odd", snapshot);
  if (strategy === "over_under") return digitBinary("over_under", snapshot);
  return matches(snapshot);
}
