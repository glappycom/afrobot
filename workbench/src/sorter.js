/**
 * Decides what the Smart Sorter flap does.
 *
 * The classifier reports class scores. This module turns those scores, plus
 * the state of the camera feed, into a flap position and at most one command.
 * A future hardware adapter can send `command` to a servo. Null means "do not
 * send anything". This file never sees pixels, the network, or the page.
 */
import { CLASS_IDS, CLASS_LABELS } from './classes.js';

export const MIN_CONFIDENCE = 0.7;
export const MIN_MARGIN = 0.15;

export function createSorterState() {
  return { latched: null };
}

function pct(score) {
  return Math.floor(Number(score) * 100 + 1e-9);
}

function hold(reason, message, state) {
  return {
    decision: 'hold',
    command: null,
    reason,
    message,
    state: state || createSorterState(),
  };
}

function rank(scores) {
  return CLASS_IDS.map((id) => {
    const raw = scores && typeof scores === 'object' ? Number(scores[id]) : NaN;
    const score = Number.isFinite(raw) && raw > 0 ? raw : 0;
    return { id, score };
  }).sort((a, b) => b.score - a.score || CLASS_IDS.indexOf(a.id) - CLASS_IDS.indexOf(b.id));
}

/**
 * @param {{ scores?: Record<string, number>|null, feed?: string, state?: { latched: string|null } }} input
 */
export function stepSorter(input) {
  const feed = input && input.feed;
  const previous = input && input.state && typeof input.state.latched !== 'undefined'
    ? { latched: input.state.latched }
    : createSorterState();

  if (feed === 'stale') {
    return hold(
      'feed-stale',
      'The feed stopped updating. The flap returns to Hold and does not repeat the last command.',
    );
  }
  if (feed !== 'live') {
    return hold(
      'feed-stopped',
      'The feed is stopped. The flap returns to Hold and does not repeat the last command.',
    );
  }

  const scores = input.scores;
  if (scores == null || typeof scores !== 'object' || Array.isArray(scores)) {
    return hold('no-scores', 'There is no prediction yet. The flap stays at Hold.', previous);
  }

  const ranked = rank(scores);
  const top = ranked[0];
  const second = ranked[1];
  const margin = top.score - second.score;
  const topLabel = CLASS_LABELS[top.id];
  const onLine = 1e-9;

  if (top.score + onLine < MIN_CONFIDENCE) {
    return hold(
      'low-confidence',
      `${topLabel} scored ${pct(top.score)}%, which is below ${pct(MIN_CONFIDENCE)}%. The flap stays at Hold.`,
      createSorterState(),
    );
  }
  if (margin + onLine < MIN_MARGIN) {
    return hold(
      'uncertain',
      `${topLabel} leads ${CLASS_LABELS[second.id]} by ${pct(margin)} points. The scores are too close, so the flap stays at Hold.`,
      createSorterState(),
    );
  }
  if (top.id === 'no-item') {
    return hold(
      'no-item',
      `No item scored ${pct(top.score)}%. The flap stays at Hold.`,
      createSorterState(),
    );
  }

  const decision = top.id === 'paper' ? 'paper-bin' : 'plastic-bin';
  if (previous.latched === decision) {
    return {
      decision,
      command: null,
      reason: 'held',
      message: `${topLabel} is still in view. The flap stays put and does not sort it again.`,
      state: { latched: decision },
    };
  }
  return {
    decision,
    command: decision,
    reason: top.id,
    message: `${topLabel} scored ${pct(top.score)}%. The flap moves to the ${top.id === 'paper' ? 'paper' : 'plastic'} bin.`,
    state: { latched: decision },
  };
}
