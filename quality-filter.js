import { ENGINE } from "./config.js";

const MINIMUM_THRESHOLDS = {
  rise_fall: 76,
  even_odd: 78,
  over_under: 78,
  match: 82,
  boom: 80,
  crash: 80
};

const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function getThreshold(strategy) {
  const configured = Number(ENGINE?.qualityThresholds?.[strategy]);
  const minimum = MINIMUM_THRESHOLDS[strategy] ?? 76;
  return Number.isFinite(configured) ? Math.max(configured, minimum) : minimum;
}

function hardGuard(strategy, opportunity, consensus) {
  const metadata = consensus?.metadata || opportunity?.metadata || {};

  if (metadata.validationFreshData === false) {
    return { ok: false, reason: "La segunda validación no recibió datos nuevos." };
  }

  if (strategy === "even_odd" || strategy === "over_under") {
    if (Number(metadata.agreement) !== 3) return { ok: false, reason: "Las tres ventanas de dígitos no están alineadas." };
    if (Number(metadata.shortDiff) < 10 || Number(metadata.mediumDiff) < 6 || Number(metadata.longDiff) < 4) {
      return { ok: false, reason: "La diferencia entre ventanas de dígitos es demasiado débil." };
    }
  }

  if (strategy === "rise_fall") {
    if (metadata.lateral === true) return { ok: false, reason: "Rise/Fall bloqueado por lateralidad." };
    if (metadata.volatilityLevel === "VERY HIGH") return { ok: false, reason: "Rise/Fall bloqueado por volatilidad extrema." };
    if (metadata.alignment?.conflicting === true) return { ok: false, reason: "Rise/Fall bloqueado por indicadores contradictorios." };
    if (Number(metadata.alignment?.agreement) < 3) return { ok: false, reason: "Rise/Fall sin alineación suficiente." };
  }

  if (strategy === "match") {
    if (Number(metadata.leaderVotes) !== 3 || Number(metadata.separation) < 1.0 || Number(metadata.recentHits) < 2) {
      return { ok: false, reason: "Matches no mantiene soporte suficiente." };
    }
  }

  return { ok: true };
}

export function applyQualityFilter({ strategy, opportunity, consensus, timing }) {
  const threshold = getThreshold(strategy);
  const score = clamp(consensus?.score || 0);
  const executionAdjustment = Number(timing?.scoreAdjustment || 0);

  if (opportunity?.direction === "NO_OPERAR") {
    return { approved: false, state: "NO_OPERAR", score, threshold, executionAdjustment, reason: "El candidato es 0. Regla oficial: no operar." };
  }

  if (!timing?.approved) {
    return { approved: false, state: "WAIT", score, threshold, executionAdjustment, reason: timing?.reason || "Timing no aprobado." };
  }

  if (!consensus?.approved) {
    return { approved: false, state: "WAIT", score, threshold, executionAdjustment, reason: "Los dos motores no lograron una validación suficiente." };
  }

  const guard = hardGuard(strategy, opportunity, consensus);
  if (!guard.ok) {
    return { approved: false, state: "WAIT", score, threshold, executionAdjustment, reason: guard.reason };
  }

  if (score < threshold) {
    return { approved: false, state: "WAIT", score, threshold, executionAdjustment, reason: `Calidad insuficiente (${score}/${threshold}).` };
  }

  return {
    approved: true,
    state: "READY",
    score,
    threshold,
    executionAdjustment,
    reason: "Los motores, la validación fresca y los filtros de calidad fueron superados."
  };
}
