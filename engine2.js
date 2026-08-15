/* ==========================================
   TRADING ANALYZER
   ENGINE2.JS
   FIX13.6 - VALIDACIÓN EQUILIBRADA

   La presencia de datos nuevos ayuda,
   pero ya no bloquea por sí sola una señal.
   ========================================== */

const clamp = (value) =>
  Math.max(
    0,
    Math.min(
      100,
      Math.round(Number(value) || 0)
    )
  );

function snapshotChanged(opportunity, freshOpportunity) {
  const previous = opportunity?.metadata?.snapshotMark;
  const current = freshOpportunity?.metadata?.snapshotMark;

  if (!previous || !current) return false;

  return (
    previous.priceSignature !== current.priceSignature ||
    previous.digitSignature !== current.digitSignature ||
    previous.lastPrice !== current.lastPrice ||
    previous.lastDigit !== current.lastDigit
  );
}

function validateRiseFall(direction, snapshot) {
  const reasons = [];
  const warnings = [];

  if (snapshot.lateral) {
    warnings.push("Mercado lateral durante la validación.");
  }

  if (snapshot.volatility.level === "VERY HIGH") {
    warnings.push("Volatilidad extrema durante la validación.");
  }

  const expectedTrend =
    direction === "RISE"
      ? "BULLISH"
      : "BEARISH";

  const expectedMomentum =
    direction === "RISE"
      ? "POSITIVE"
      : "NEGATIVE";

  const expectedFlow =
    direction === "RISE"
      ? "BULLISH"
      : "BEARISH";

  const trendOk =
    snapshot.trend.direction === expectedTrend;

  const momentumOk =
    snapshot.momentum.direction === expectedMomentum;

  const flowOk =
    snapshot.shortFlow.direction === expectedFlow;

  const alignmentOk =
    snapshot.alignment?.dominant === expectedTrend &&
    snapshot.alignment?.agreement >= 3 &&
    !snapshot.alignment?.conflicting;

  if (trendOk) reasons.push("Tendencia mantiene la dirección.");
  if (momentumOk) reasons.push("Momentum confirma la dirección.");
  if (flowOk) reasons.push("Flujo corto confirma la dirección.");
  if (alignmentOk) reasons.push("Alineación interna suficiente.");

  return {
    approved:
      !snapshot.lateral &&
      snapshot.volatility.level !== "VERY HIGH" &&
      trendOk &&
      momentumOk &&
      flowOk &&
      alignmentOk,

    reasons,
    warnings
  };
}

function validateDigitBinary(freshOpportunity) {
  const metadata =
    freshOpportunity?.metadata || {};

  const stable =
  Number(metadata.agreement) >= 2 &&
  Number(metadata.shortDiff) >= 6 &&
  Number(metadata.mediumDiff) >= 3 &&
  Number(metadata.longDiff) >= 1.5;

  return {
    approved: stable,

    reasons:
      stable
        ? ["Las tres ventanas mantienen el mismo lado con diferencias suficientes."]
        : [],

    warnings:
      stable
        ? []
        : ["La distribución entre ventanas no es suficientemente estable."]
  };
}

function validateMatch(opportunity, freshOpportunity) {
  const sameDigit =
    opportunity?.metadata?.digit ===
    freshOpportunity?.metadata?.digit;

  const metadata =
    freshOpportunity?.metadata || {};

  const approved =
    sameDigit &&
    metadata.support === true &&
    Number(metadata.leaderVotes) >= 2 &&
    Number(metadata.separation) >= 0.9 &&
    Number(metadata.recentHits) >= 2;

  return {
    approved,

    reasons:
      approved
        ? ["El mismo dígito mantiene soporte durante la validación."]
        : [],

    warnings:
      approved
        ? []
        : ["Matches no mantuvo soporte suficiente durante la validación."]
  };
}

export function validateOpportunity(
  opportunity,
  freshOpportunity,
  snapshot
) {
  if (!opportunity || !freshOpportunity || !snapshot) {
    return {
      approved: false,
      score: 0,
      direction: "WAIT",
      reasons: ["Información insuficiente."],
      warnings: []
    };
  }

  const sameDigit =
    opportunity.strategy !== "match" ||
    opportunity.metadata?.digit ===
      freshOpportunity.metadata?.digit;

  const sameDirection =
    opportunity.direction === freshOpportunity.direction &&
    opportunity.strategy === freshOpportunity.strategy &&
    sameDigit &&
    !["WAIT", "NO_OPERAR"].includes(opportunity.direction);

  const freshData =
    snapshotChanged(
      opportunity,
      freshOpportunity
    );

  let score =
    Math.round(
      (
        Number(opportunity.score) +
        Number(freshOpportunity.score)
      ) / 2
    );

  const reasons = [];
  const warnings = [];

  if (sameDirection) {
    reasons.push(
      opportunity.strategy === "match"
        ? "El mismo dígito se mantuvo."
        : "La dirección se mantuvo."
    );
  } else {
    score -= 28;
    warnings.push(
      opportunity.strategy === "match"
        ? "El candidato de Matches cambió."
        : "La dirección cambió durante la validación."
    );
  }

  /*
    FIX13.6:
    Datos nuevos = bonus.
    Sin datos nuevos = penalización moderada,
    pero no rechazo automático.
  */
  if (freshData) {
    reasons.push("La validación contiene datos nuevos del mercado.");
    score += 3;
  } else {
    score -= 6;
    warnings.push(
      "La validación no recibió un tick nuevo; se reduce la puntuación."
    );
  }

  let strategyValidation = {
    approved: true,
    reasons: [],
    warnings: []
  };

  if (opportunity.strategy === "rise_fall") {
    strategyValidation =
      validateRiseFall(
        opportunity.direction,
        snapshot
      );
  } else if (
    opportunity.strategy === "even_odd" ||
    opportunity.strategy === "over_under"
  ) {
    strategyValidation =
      validateDigitBinary(
        freshOpportunity
      );
  } else if (
    opportunity.strategy === "match"
  ) {
    strategyValidation =
      validateMatch(
        opportunity,
        freshOpportunity
      );
  }

  reasons.push(...(strategyValidation.reasons || []));
  warnings.push(...(strategyValidation.warnings || []));

  if (!strategyValidation.approved) {
    score -= 16;
  }

  const approved =
    sameDirection &&
    strategyValidation.approved &&
    score >= 64;

  return {
    approved,
    score: clamp(score),
    direction:
      approved
        ? opportunity.direction
        : "WAIT",
    reasons,
    warnings,
    freshData,
    strategyValidation:
      strategyValidation.approved
  };
}
