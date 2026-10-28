// How long the stages of an issue take. Implements "The digest shows how long each stage takes", "Only a stage that ends
// on the normal path is timed" and "Stage times are read from GitHub and stored nowhere" of the status specification.
//
// Pure: events in, samples out. The stages are paired from the `labeled` events only, in order of their `id`, because the
// `unlabeled` event of the old state may come before or after the `labeled` event of the new one, a second apart.

import { resolveLabelNames } from './labels.mjs';

/** The window of the digest, in days. Fixed, not a setting of relevo.yml. */
export const STAGE_DAYS = 7;

/** The stages in the order of the line: the gate, the build, the wait for the person, the device review, the peer review. */
export const STAGES = ['gate', 'build', 'wait', 'device', 'peer'];

// The labels that say where an issue is, and the one that follows each on the normal path. `ready` and `queued` are one
// stage: an issue that waits for capacity is still at the gate, and its time began when it became ready.
const LIFECYCLE = ['ready', 'queued', 'building', 'built', 'in-review', 'pr-open', 'needs-spec', 'blocked', 'qa-failed', 'changes-requested'];
const GATE = new Set(['ready', 'queued']);
const NEXT = { building: ['built', 'build'], built: ['in-review', 'wait'], 'in-review': ['pr-open', 'device'] };

/**
 * The stages that an issue finished, from its events (the objects of `issues/{n}/events`): [{ stage, ms, endedAt }].
 * `labels` maps the key of each lifecycle label to its name (see resolveLabelNames). Only the normal path counts: a
 * stage that is left for any other label, for a close with another reason or for a reopening ends without a sample.
 */
export function stagesOfIssue(events, labels = resolveLabelNames()) {
  const keyOf = new Map(LIFECYCLE.map((k) => [labels[k], k]));
  const samples = [];
  let cur = null;
  const finish = (stage, since, at) => {
    if (at >= since) samples.push({ stage, ms: at - since, endedAt: at });
  };
  [...events].sort((a, b) => a.id - b.id).forEach((e) => {
    const at = Date.parse(e.created_at);
    if (Number.isNaN(at)) return;
    if (e.event === 'labeled') {
      const key = keyOf.get(e.label?.name);
      if (!key) return; // an overlay such as `urgent`, or a label that is not Relevo's
      if (cur) {
        if (GATE.has(cur.key) && key === 'building') finish('gate', cur.gateSince, at);
        else if (NEXT[cur.key]?.[0] === key) finish(NEXT[cur.key][1], cur.at, at);
      }
      cur = { key, at, gateSince: GATE.has(key) ? (cur && GATE.has(cur.key) && cur.key !== key ? cur.gateSince : at) : null };
    } else if (e.event === 'closed') {
      if (cur?.key === 'pr-open' && e.state_reason === 'completed') finish('peer', cur.at, at);
      cur = null;
    } else if (e.event === 'reopened') {
      cur = null;
    }
  });
  return samples;
}

const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/** [{ stage, median, count }] in the fixed order, for the stages with at least one sample. Samples: [{ stage, ms }]. */
export function summarizeStages(samples) {
  return STAGES
    .map((stage) => {
      const ms = samples.filter((s) => s.stage === stage).map((s) => s.ms);
      return { stage, median: ms.length ? median(ms) : null, count: ms.length };
    })
    .filter((s) => s.count > 0);
}

/** `14 s`, `6 min`, `3 h`, `2 d`: seconds under 100 s, minutes under 100 min, hours under 48 h, days above; rounded. */
export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 100) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 100) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}
