export function buildConsensus(engine1, engine2) {
  if (!engine1 || !engine2) {
    return {
      approved: false,
      score: 0,
      direction: "WAIT",
      reasons: ["Sin consenso disponible."],
      warnings: ["Falta información de uno de los motores."],
      metadata: {}
    };
  }

  const approved = engine2.approved === true && engine1.direction === engine2.direction && !["WAIT", "NO_OPERAR"].includes(engine1.direction);
  const score = Math.round(Math.min(Number(engine1.score) || 0, Number(engine2.score) || 0));

  return {
    approved,
    score,
    direction: approved ? engine1.direction : "WAIT",
    reasons: [...(engine1.reasons || []), ...(engine2.reasons || [])],
    warnings: [...(engine1.warnings || []), ...(engine2.warnings || [])],
    metadata: {
      ...(engine1.metadata || {}),
      validationFreshData: engine2.freshData === true,
      validationStrategyOk: engine2.strategyValidation === true
    }
  };
}
