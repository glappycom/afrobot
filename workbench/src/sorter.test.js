import test from 'node:test';
import assert from 'node:assert/strict';
import { createSorterState, stepSorter, MIN_CONFIDENCE, MIN_MARGIN } from './sorter.js';

const paper = { paper: 0.94, plastic: 0.03, 'no-item': 0.03 };
const plastic = { paper: 0.04, plastic: 0.92, 'no-item': 0.04 };
const empty = { paper: 0.02, plastic: 0.03, 'no-item': 0.95 };

test('constants match the lesson rules', () => {
  assert.equal(MIN_CONFIDENCE, 0.7);
  assert.equal(MIN_MARGIN, 0.15);
});

test('paper goes to the paper bin once', () => {
  const step = stepSorter({ scores: paper, feed: 'live', state: createSorterState() });
  assert.equal(step.decision, 'paper-bin');
  assert.equal(step.command, 'paper-bin');
  assert.equal(step.reason, 'paper');
  assert.equal(step.message, 'Paper scored 94%. The flap moves to the paper bin.');
  assert.deepEqual(step.state, { latched: 'paper-bin' });
});

test('plastic goes to the plastic bin', () => {
  const step = stepSorter({ scores: plastic, feed: 'live', state: createSorterState() });
  assert.equal(step.decision, 'plastic-bin');
  assert.equal(step.command, 'plastic-bin');
  assert.equal(step.reason, 'plastic');
  assert.equal(step.message, 'Plastic scored 92%. The flap moves to the plastic bin.');
});

test('an object held in view does not sort again', () => {
  const first = stepSorter({ scores: paper, feed: 'live', state: createSorterState() });
  const second = stepSorter({ scores: paper, feed: 'live', state: first.state });
  const third = stepSorter({ scores: { paper: 0.91, plastic: 0.05, 'no-item': 0.04 }, feed: 'live', state: second.state });
  assert.equal(second.command, null);
  assert.equal(second.decision, 'paper-bin');
  assert.equal(second.reason, 'held');
  assert.equal(second.message, 'Paper is still in view. The flap stays put and does not sort it again.');
  assert.equal(third.command, null);
  assert.equal(third.reason, 'held');
});

test('a new object after Hold sorts again', () => {
  const first = stepSorter({ scores: paper, feed: 'live', state: createSorterState() });
  const gap = stepSorter({ scores: empty, feed: 'live', state: first.state });
  const next = stepSorter({ scores: paper, feed: 'live', state: gap.state });
  assert.equal(gap.decision, 'hold');
  assert.equal(gap.command, null);
  assert.equal(gap.reason, 'no-item');
  assert.equal(next.command, 'paper-bin');
});

test('switching class while in view sends a new command', () => {
  const first = stepSorter({ scores: paper, feed: 'live', state: createSorterState() });
  const next = stepSorter({ scores: plastic, feed: 'live', state: first.state });
  assert.equal(next.command, 'plastic-bin');
  assert.equal(next.decision, 'plastic-bin');
});

test('No item holds even when the score is high', () => {
  const step = stepSorter({ scores: empty, feed: 'live', state: createSorterState() });
  assert.equal(step.decision, 'hold');
  assert.equal(step.command, null);
  assert.equal(step.reason, 'no-item');
  assert.equal(step.message, 'No item scored 95%. The flap stays at Hold.');
  assert.equal(step.state.latched, null);
});

test('low confidence holds and clears the latch', () => {
  const armed = stepSorter({ scores: paper, feed: 'live', state: createSorterState() });
  const step = stepSorter({
    scores: { paper: 0.52, plastic: 0.45, 'no-item': 0.03 },
    feed: 'live',
    state: armed.state,
  });
  assert.equal(step.decision, 'hold');
  assert.equal(step.command, null);
  assert.equal(step.reason, 'low-confidence');
  assert.equal(step.message, 'Paper scored 52%, which is below 70%. The flap stays at Hold.');
  assert.equal(step.state.latched, null);
});

test('a close call above the confidence line still holds', () => {
  const step = stepSorter({
    scores: { paper: 0.78, plastic: 0.66, 'no-item': 0.04 },
    feed: 'live',
    state: createSorterState(),
  });
  assert.equal(step.reason, 'uncertain');
  assert.equal(step.decision, 'hold');
  assert.equal(step.command, null);
  assert.equal(step.message, 'Paper leads Plastic by 12 points. The scores are too close, so the flap stays at Hold.');
});

test('confidence and margin boundaries', () => {
  const accept = stepSorter({
    scores: { paper: 0.7, plastic: 0.55, 'no-item': 0.05 },
    feed: 'live',
    state: createSorterState(),
  });
  assert.equal(accept.command, 'paper-bin');
  const under = stepSorter({
    scores: { paper: 0.699, plastic: 0.2, 'no-item': 0.1 },
    feed: 'live',
    state: createSorterState(),
  });
  assert.equal(under.reason, 'low-confidence');
  assert.equal(under.message.includes('69%'), true);
  const onMargin = stepSorter({
    scores: { paper: 0.8, plastic: 0.65, 'no-item': 0 },
    feed: 'live',
    state: createSorterState(),
  });
  assert.equal(onMargin.command, 'paper-bin');
  const insideMargin = stepSorter({
    scores: { paper: 0.8, plastic: 0.6501, 'no-item': 0 },
    feed: 'live',
    state: createSorterState(),
  });
  assert.equal(insideMargin.reason, 'uncertain');
});

test('a stopped feed returns to Hold and does not repeat the last command', () => {
  const first = stepSorter({ scores: paper, feed: 'live', state: createSorterState() });
  const stopped = stepSorter({ scores: paper, feed: 'stopped', state: first.state });
  const stillStopped = stepSorter({ scores: paper, feed: 'stopped', state: stopped.state });
  assert.equal(stopped.decision, 'hold');
  assert.equal(stopped.command, null);
  assert.equal(stopped.reason, 'feed-stopped');
  assert.equal(stopped.message, 'The feed is stopped. The flap returns to Hold and does not repeat the last command.');
  assert.equal(stopped.state.latched, null);
  assert.equal(stillStopped.command, null);
  assert.equal(stillStopped.reason, 'feed-stopped');
});

test('a stale feed returns to Hold and does not repeat the last command', () => {
  const first = stepSorter({ scores: plastic, feed: 'live', state: createSorterState() });
  const stale = stepSorter({ scores: plastic, feed: 'stale', state: first.state });
  const again = stepSorter({ scores: plastic, feed: 'stale', state: stale.state });
  assert.equal(stale.decision, 'hold');
  assert.equal(stale.command, null);
  assert.equal(stale.reason, 'feed-stale');
  assert.equal(stale.message, 'The feed stopped updating. The flap returns to Hold and does not repeat the last command.');
  assert.equal(again.command, null);
});

test('an unknown feed fails safe to Hold', () => {
  const armed = stepSorter({ scores: paper, feed: 'live', state: createSorterState() });
  for (const feed of [undefined, null, '', 'paused', 'closed']) {
    const step = stepSorter({ scores: paper, feed, state: armed.state });
    assert.equal(step.decision, 'hold');
    assert.equal(step.command, null);
    assert.equal(step.reason, 'feed-stopped');
  }
});

test('a live feed with no scores holds without a command', () => {
  const step = stepSorter({ scores: null, feed: 'live', state: createSorterState() });
  assert.equal(step.reason, 'no-scores');
  assert.equal(step.command, null);
  assert.equal(step.decision, 'hold');
});

test('missing and invalid score fields are treated as zero', () => {
  const step = stepSorter({
    scores: { paper: Number.NaN, plastic: -1 },
    feed: 'live',
    state: createSorterState(),
  });
  assert.equal(step.reason, 'low-confidence');
  assert.equal(step.command, null);
});

test('the input state is not mutated', () => {
  const state = createSorterState();
  stepSorter({ scores: paper, feed: 'live', state });
  assert.deepEqual(state, { latched: null });
});

test('after a stop, a later object may be sorted', () => {
  const first = stepSorter({ scores: paper, feed: 'live', state: createSorterState() });
  const stopped = stepSorter({ scores: paper, feed: 'stopped', state: first.state });
  const later = stepSorter({ scores: paper, feed: 'live', state: stopped.state });
  assert.equal(stopped.command, null);
  assert.equal(later.command, 'paper-bin');
});
