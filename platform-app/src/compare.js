const REASON_TEXT = {
  scope_differs: 'scope differs',
  rubric_differs: 'rubric differs',
  metric_differs: 'metric differs',
  baseline_missing: 'baseline is missing',
  coverage_missing: 'coverage is missing',
  rate_missing: 'a count or the coach-hours figure is missing',
  baseline_rate_zero: 'baseline per hour is zero',
};

export function perHour(completions, coachHours) {
  if (completions == null || coachHours == null || coachHours === 0) return null;
  return completions / coachHours;
}

export function formatPerHour(value) {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatMultiplier(value) {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1000) / 1000;
  return `${Number.isInteger(rounded) ? String(rounded) : String(rounded)}×`;
}

function sameText(left, right) {
  return (left || '') === (right || '');
}

export function compareSeasons(baseline, candidate, guardrail = {}, humanDecision = null) {
  const reasons = [];
  if (!sameText(baseline.scopeKey, candidate.scopeKey)) reasons.push('scope_differs');
  if (!sameText(baseline.rubricVersion, candidate.rubricVersion)) reasons.push('rubric_differs');
  if (!sameText(baseline.metricVersion, candidate.metricVersion)) reasons.push('metric_differs');
  if (baseline.baselinePresent !== true || candidate.baselinePresent !== true) reasons.push('baseline_missing');
  if (baseline.coverage == null || candidate.coverage == null) reasons.push('coverage_missing');

  const baselinePerHour = perHour(baseline.completions, baseline.coachHours);
  const candidatePerHour = perHour(candidate.completions, candidate.coachHours);
  if (baselinePerHour == null || candidatePerHour == null) reasons.push('rate_missing');
  if (baselinePerHour === 0) reasons.push('baseline_rate_zero');

  const suppressed = reasons.length > 0;
  let multiplier = null;
  if (!suppressed) multiplier = candidatePerHour / baselinePerHour;

  const learningWorse = guardrail.learning === 'worsened';
  const accessWorse = guardrail.access === 'worsened';
  const guardrailFail = learningWorse || accessWorse;
  let decision = 'comparable';
  if (suppressed) decision = 'suppressed';
  else if (guardrailFail) decision = humanDecision === 'hold' ? 'hold' : 'hold_required';

  return {
    baselinePerHour,
    candidatePerHour,
    multiplier,
    suppressed,
    reasons,
    reasonText: reasons.map((code) => REASON_TEXT[code] || code),
    guardrailFail,
    decision,
    lever: candidate.lever || baseline.lever || null,
  };
}

export function comparisonPhrase(result) {
  if (result.baselinePerHour == null || result.candidatePerHour == null) {
    return 'Per hour is blank because a count or coach-hours figure is missing.';
  }
  const rates = `${formatPerHour(result.baselinePerHour)} versus ${formatPerHour(result.candidatePerHour)} per hour`;
  if (result.suppressed) {
    return `${rates}. Multiplier suppressed: ${result.reasonText.join('; ')}.`;
  }
  const phrase = `${rates} and ${formatMultiplier(result.multiplier)}`;
  if (result.decision === 'hold' || result.decision === 'hold_required') {
    return `${phrase}. Guardrail failed, so this is not a gain to act on. Human decision: hold.`;
  }
  return phrase;
}

export function uncertaintyNote(coverage) {
  if (coverage == null) return 'Coverage is missing, so no uncertainty figure is shown.';
  return `Evidence coverage is ${coverage}. No confidence interval is invented for these fictional counts.`;
}
