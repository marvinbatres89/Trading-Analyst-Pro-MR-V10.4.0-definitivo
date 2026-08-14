/* ==========================================
   TRADING ANALYZER
   QUALITY-FILTER.JS
   FIX13.6 - EQUILIBRIO FINAL

   Timing controla ejecución.
   No aumenta la confianza direccional.
   ========================================== */

import { ENGINE } from "./config.js";

function clamp(value) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(Number(value) || 0)
    )
  );
}

function getThreshold(strategy) {
  const configured =
    Number(
      ENGINE?.qualityThresholds?.[strategy]
    );

  return Number.isFinite(configured)
    ? configured
    : 76;
}

function hardGuard(strategy, opportunity, consensus) {
  const metadata =
    consensus?.metadata ||
    opportunity?.metadata ||
    {};

  /*
    FIX13.6:
    validationFreshData ya no es bloqueo duro.
    Engine2 ya aplicó penalización si no llegó tick nuevo.
  */

  if (
    strategy === "even_odd" ||
    strategy === "over_under"
  ) {
    if (Number(metadata.agreement) !== 3) {
      return {
        ok: false,
        reason: "Las tres ventanas de dígitos no están alineadas."
      };
    }

    if (
      Number(metadata.shortDiff) < 8 ||
      Number(metadata.mediumDiff) < 4 ||
      Number(metadata.longDiff) < 2
    ) {
      return {
        ok: false,
        reason: "La diferencia entre ventanas de dígitos es demasiado débil."
      };
    }
  }

  if (strategy === "rise_fall") {
    if (metadata.lateral === true) {
      return {
        ok: false,
        reason: "Rise/Fall bloqueado por lateralidad."
      };
    }

    if (metadata.volatilityLevel === "VERY HIGH") {
      return {
        ok: false,
        reason: "Rise/Fall bloqueado por volatilidad extrema."
      };
    }

    if (metadata.alignment?.conflicting === true) {
      return {
        ok: false,
        reason: "Rise/Fall bloqueado por indicadores contradictorios."
      };
    }

    if (
      Number(
        metadata.alignment?.agreement
      ) < 3
    ) {
      return {
        ok: false,
        reason: "Rise/Fall sin alineación suficiente."
      };
    }
  }

  if (strategy === "match") {
    if (
      Number(metadata.leaderVotes) < 2 ||
      Number(metadata.separation) < 0.9 ||
      Number(metadata.recentHits) < 2
    ) {
      return {
        ok: false,
        reason: "Matches no mantiene soporte suficiente."
      };
    }
  }

  return { ok: true };
}

export function applyQualityFilter({
  strategy,
  opportunity,
  consensus,
  timing
}) {
  const threshold =
    getThreshold(strategy);

  const score =
    clamp(consensus?.score || 0);

  const executionAdjustment =
    Number(
      timing?.scoreAdjustment || 0
    );

  if (
    opportunity?.direction ===
    "NO_OPERAR"
  ) {
    return {
      approved: false,
      state: "NO_OPERAR",
      score,
      threshold,
      executionAdjustment,
      reason: "El candidato es 0. Regla oficial: no operar."
    };
  }

  if (!timing?.approved) {
    return {
      approved: false,
      state: "WAIT",
      score,
      threshold,
      executionAdjustment,
      reason:
        timing?.reason ||
        "Timing no aprobado."
    };
  }

  if (!consensus?.approved) {
    return {
      approved: false,
      state: "WAIT",
      score,
      threshold,
      executionAdjustment,
      reason: "Los dos motores no lograron una validación suficiente."
    };
  }

  const guard =
    hardGuard(
      strategy,
      opportunity,
      consensus
    );

  if (!guard.ok) {
    return {
      approved: false,
      state: "WAIT",
      score,
      threshold,
      executionAdjustment,
      reason: guard.reason
    };
  }

  if (score < threshold) {
    return {
      approved: false,
      state: "WAIT",
      score,
      threshold,
      executionAdjustment,
      reason: `Calidad insuficiente (${score}/${threshold}).`
    };
  }

  return {
    approved: true,
    state: "READY",
    score,
    threshold,
    executionAdjustment,
    reason: "Los motores y los filtros de calidad fueron superados."
  };
}
