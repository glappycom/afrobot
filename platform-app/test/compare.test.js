import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalString, sha256 } from '../src/canonical.js';
import { COMPARISONS } from '../src/constants.js';
import { compareSeasons, comparisonPhrase } from '../src/compare.js';
import { rateLabel } from '../src/format.js';

const like = COMPARISONS.find((row) => row.id === 'cmp-like-for-like');

test('24/24 versus 36/18 coach-hours is 1 versus 2 per hour and 2×', () => {
  const result = compareSeasons(like.baseline, like.candidate, like.guardrail);
  assert.equal(result.baselinePerHour, 1);
  assert.equal(result.candidatePerHour, 2);
  assert.equal(result.multiplier, 2);
  assert.equal(result.suppressed, false);
  assert.equal(comparisonPhrase(result), '1 versus 2 per hour and 2×');
  assert.notEqual(result.multiplier, 10);
});

test('the multiplier is suppressed when scope, rubric, baseline, or coverage does not match', () => {
  for (const id of ['cmp-scope', 'cmp-rubric', 'cmp-baseline', 'cmp-coverage']) {
    const row = COMPARISONS.find((item) => item.id === id);
    const result = compareSeasons(row.baseline, row.candidate, row.guardrail);
    assert.equal(result.suppressed, true, id);
    assert.equal(result.multiplier, null, id);
    assert.equal(result.decision, 'suppressed', id);
    assert.doesNotMatch(comparisonPhrase(result), /and 2×/);
  }
  const scope = compareSeasons(
    COMPARISONS.find((row) => row.id === 'cmp-scope').baseline,
    COMPARISONS.find((row) => row.id === 'cmp-scope').candidate,
    { learning: 'unchanged', access: 'unchanged' },
  );
  assert.ok(scope.reasons.includes('scope_differs'));
  const rubric = compareSeasons(
    COMPARISONS.find((row) => row.id === 'cmp-rubric').baseline,
    COMPARISONS.find((row) => row.id === 'cmp-rubric').candidate,
    { learning: 'unchanged', access: 'unchanged' },
  );
  assert.ok(rubric.reasons.includes('rubric_differs'));
  const baseline = compareSeasons(
    COMPARISONS.find((row) => row.id === 'cmp-baseline').baseline,
    COMPARISONS.find((row) => row.id === 'cmp-baseline').candidate,
    { learning: 'unchanged', access: 'unchanged' },
  );
  assert.ok(baseline.reasons.includes('baseline_missing'));
  const coverage = compareSeasons(
    COMPARISONS.find((row) => row.id === 'cmp-coverage').baseline,
    COMPARISONS.find((row) => row.id === 'cmp-coverage').candidate,
    { learning: 'unchanged', access: 'unchanged' },
  );
  assert.ok(coverage.reasons.includes('coverage_missing'));
});

test('a learning guardrail holds an efficiency gain', () => {
  const row = COMPARISONS.find((item) => item.id === 'cmp-guardrail');
  const pending = compareSeasons(row.baseline, row.candidate, row.guardrail);
  assert.equal(pending.multiplier, 2);
  assert.equal(pending.guardrailFail, true);
  assert.equal(pending.decision, 'hold_required');
  const held = compareSeasons(row.baseline, row.candidate, row.guardrail, 'hold');
  assert.equal(held.decision, 'hold');
  assert.match(comparisonPhrase(held), /1 versus 2 per hour and 2×/);
  assert.match(comparisonPhrase(held), /Human decision: hold/);
});

test('a zero baseline per hour does not produce a multiplier', () => {
  const result = compareSeasons(
    { ...like.baseline, completions: 0 },
    like.candidate,
    like.guardrail,
  );
  assert.equal(result.multiplier, null);
  assert.ok(result.reasons.includes('baseline_rate_zero'));
});

test('missing rates stay blank instead of becoming zero', () => {
  assert.equal(rateLabel(null, 8), null);
  assert.equal(rateLabel(5, null), null);
  assert.equal(rateLabel(5, 0), null);
  assert.equal(rateLabel(6, 8), '6/8 = 75%');
  assert.equal(rateLabel(5, 8), '5/8 = 62.5%');
});

test('snapshot JSON is stable and order-independent', () => {
  const first = canonicalString({ b: 1, a: { d: 2, c: 3 } });
  const second = canonicalString({ a: { c: 3, d: 2 }, b: 1 });
  assert.equal(first, second);
  assert.equal(sha256(first), sha256(second));
});
