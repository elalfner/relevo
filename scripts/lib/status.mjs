// What is waiting on whom. Implements openspec/specs/status/spec.md. Pure: data in, report out.
//
// issues  [{ number, title, labels: [names], assignees: [logins], milestone: number | null }]   open Relevo issues
// prs     [{ number, issue, url, author, reviewer, requested_at, approved, behind_by }]          open feature pull requests
// milestones [{ number, title, due_on, closed_issues }]
// me      login of the person asking (null for the team-level view)

import { resolveLabelNames } from './labels.mjs';

/** Reviews one person can complete per working day; used only for the capacity warning. */
export const REVIEWS_PER_PERSON_PER_DAY = 1;
/** A feature branch this many commits behind the base branch is reported. */
export const BEHIND_ALERT = 10;

const HOUR = 3600 * 1000;

function workingDays(from, to) {
  let days = 0;
  for (let t = new Date(from); t < to; t = new Date(t.getTime() + 24 * HOUR)) {
    const d = t.getUTCDay();
    if (d !== 0 && d !== 6) days += 1;
  }
  return days;
}

function stateOf(issue, names) {
  const order = ['needs-spec', 'qa-failed', 'changes-requested', 'blocked', 'in-review', 'pr-open', 'built', 'building', 'queued', 'ready'];
  return order.find((k) => issue.labels.includes(names[k])) ?? null;
}

export function buildStatus({ config, issues, prs = [], milestones = [], externalBlocks = {}, cloudBuilds = true, me = null, now = new Date() }) {
  const names = resolveLabelNames(config.labels);
  const entries = issues.map((i) => ({
    number: i.number, title: i.title, state: stateOf(i, names), assignee: i.assignees[0] ?? null, milestone: i.milestone ?? null,
    needsReviewer: i.labels.includes(names['needs-reviewer']),
    updatedAt: i.updated_at ?? null,
    ...(externalBlocks[i.number] ? { blockedBy: externalBlocks[i.number] } : {}),
  })).filter((e) => e.state);

  const mine = me ? entries.filter((e) => e.assignee === me) : [];
  const nextCommand = { built: 'review', 'in-review': 'review', 'qa-failed': 'fix', 'changes-requested': 'fix' };
  const onMe = [];
  ['built', 'in-review', 'qa-failed', 'changes-requested'].forEach((state) => {
    mine.filter((e) => e.state === state).forEach((e) => onMe.push({ ...e, command: `/relevo:${nextCommand[state]} ${e.number}` }));
  });
  const toReview = me
    ? prs.filter((p) => p.reviewer === me && !p.approved).map((p) => ({ number: p.issue, pr: p.url, since: p.requested_at }))
    : [];
  const toShip = me
    ? prs.filter((p) => p.approved && (config.review.merger === 'author' ? p.author === me : p.reviewer === me))
      .map((p) => ({ number: p.issue, pr: p.url, command: `/relevo:ship ${p.issue}` }))
    : [];
  const waitingOnOthers = mine.filter((e) => !['built', 'in-review', 'qa-failed', 'changes-requested'].includes(e.state));

  const specWriter = config.team.spec_writer;
  const isSpecWriter = Boolean(me) && me === specWriter;
  const specWriterView = isSpecWriter
    ? {
        needsSpec: entries.filter((e) => e.state === 'needs-spec'),
        blocked: entries.filter((e) => e.state === 'blocked'),
        needsReviewer: entries.filter((e) => e.needsReviewer),
      }
    : null;

  // Milestones: merged, in review, queued, and a capacity warning against the due date.
  const flight = new Set(['building', 'built', 'in-review', 'pr-open', 'changes-requested', 'qa-failed']);
  const summaries = milestones.map((m) => {
    const inMs = entries.filter((e) => e.milestone === m.number);
    const queued = inMs.filter((e) => ['ready', 'queued', 'blocked', 'needs-spec'].includes(e.state)).length;
    const inFlight = inMs.filter((e) => flight.has(e.state)).length;
    const out = { number: m.number, title: m.title, merged: m.closed_issues ?? 0, inReview: inMs.filter((e) => ['in-review', 'pr-open', 'changes-requested'].includes(e.state)).length, queued, inFlight, dueOn: m.due_on ?? null, capacity: null, warning: false };
    if (m.due_on) {
      const people = config.team.members.filter((x) => x !== specWriter).length;
      const days = workingDays(now, new Date(m.due_on));
      out.capacity = { people, workingDays: days, reviews: people * days * REVIEWS_PER_PERSON_PER_DAY };
      out.warning = queued + inFlight > out.capacity.reviews;
    }
    return out;
  });

  // When the cloud is not building, the ready issues assigned to the person are theirs to build.
  const readyForMe = !cloudBuilds && me
    ? mine.filter((e) => e.state === 'ready').map((e) => ({ number: e.number, title: e.title, command: `/relevo:go ${e.number}` }))
    : [];

  const alerts = [];
  // A build that stopped reporting: nothing happened on the issue for longer than limits.building_alert_hours.
  entries.filter((e) => e.state === 'building' && e.updatedAt).forEach((e) => {
    const hours = Math.floor((new Date(now).getTime() - Date.parse(e.updatedAt)) / HOUR);
    if (hours >= config.limits.building_alert_hours) alerts.push({ type: 'stuck-build', issue: e.number, hours, command: `/relevo:go ${e.number}` });
  });
  prs.forEach((p) => {
    if (!p.approved && p.reviewer && p.requested_at) {
      const hours = Math.floor((new Date(now).getTime() - Date.parse(p.requested_at)) / HOUR);
      if (hours >= config.limits.review_sla_hours) alerts.push({ type: 'stale-review', issue: p.issue, pr: p.url, reviewer: p.reviewer, hours });
    }
    if ((p.behind_by ?? 0) >= BEHIND_ALERT) alerts.push({ type: 'stale-branch', issue: p.issue, pr: p.url, behind: p.behind_by });
  });

  // Who is waiting on what, for the whole team (used by the digest).
  const waiting = {};
  const add = (login, line) => {
    if (!login) return;
    (waiting[login] ??= []).push(line);
  };
  entries.forEach((e) => {
    if (['built', 'in-review', 'qa-failed', 'changes-requested'].includes(e.state)) add(e.assignee, { number: e.number, state: e.state, command: `/relevo:${nextCommand[e.state]} ${e.number}` });
    if (e.state === 'needs-spec') add(specWriter, { number: e.number, state: e.state });
    if (e.needsReviewer) add(specWriter, { number: e.number, state: 'needs-reviewer' });
  });
  prs.forEach((p) => {
    if (!p.approved && p.reviewer) add(p.reviewer, { number: p.issue, state: 'review-requested', pr: p.url });
    if (p.approved) add(config.review.merger === 'author' ? p.author : p.reviewer, { number: p.issue, state: 'approved', command: `/relevo:ship ${p.issue}` });
  });

  return {
    me, view: isSpecWriter ? 'spec-writer' : 'person',
    onMe, toReview, toShip, readyForMe, waitingOnOthers, specWriter: specWriterView,
    milestones: summaries, alerts, waiting,
    readOnly: true,
  };
}

const T = {
  en: {
    nothing: 'Nothing is waiting on you.', onMe: 'Waiting on you', review: 'Pull requests to review', ship: 'Approved, ready to ship',
    others: 'Waiting on others', spec: 'Back with the spec writer', blocked: 'Blocked', needsReviewer: 'Need a reviewer', milestone: 'Milestone',
    noDue: 'has no due date, so no capacity warning is computed', merged: 'merged', inReview: 'in review', queued: 'queued', warn: 'capacity warning: more work than the team can review before the due date',
    alerts: 'Alerts', staleReview: 'review waiting', staleBranch: 'branch behind the base by',
    waitingFor: 'waiting for', open: 'open', closed: 'closed, not completed', unreadable: 'could not be read',
    readyForMe: 'Ready, for you to build (the cloud is not building)', stuck: 'build with no activity for', restart: 'remove relevo:building and apply relevo:ready again, or run',
  },
  es: {
    nothing: 'Nada espera por ti.', onMe: 'Esperando por ti', review: 'Pull requests por revisar', ship: 'Aprobadas, listas para entregar',
    others: 'Esperando a otros', spec: 'De vuelta con quien escribe las specs', blocked: 'Bloqueadas', needsReviewer: 'Sin revisor', milestone: 'Milestone',
    noDue: 'no tiene fecha límite, así que no se calcula la advertencia de capacidad', merged: 'fusionadas', inReview: 'en revisión', queued: 'en cola', warn: 'advertencia de capacidad: hay más trabajo del que el equipo puede revisar antes de la fecha límite',
    alerts: 'Alertas', staleReview: 'revisión esperando', staleBranch: 'rama atrasada respecto a la base por',
    waitingFor: 'esperando', open: 'abierto', closed: 'cerrado, sin completar', unreadable: 'no se pudo leer',
    readyForMe: 'Listas, para que las construyas (la nube no está construyendo)', stuck: 'construcción sin actividad desde hace', restart: 'quita relevo:building y vuelve a poner relevo:ready, o ejecuta',
  },
};

/** The report as text, in the language of relevo.yml. */
export function renderStatus(report, language = 'en') {
  const t = T[String(language).startsWith('es') ? 'es' : 'en'];
  const out = [];
  const section = (title, lines) => {
    if (lines.length) out.push(`${title}:`, ...lines.map((l) => `  ${l}`), '');
  };
  const waits = (e) => (e.blockedBy ?? []).map((b) => `${t.waitingFor} ${b.ref} (${b.state === 'unreadable' ? t.unreadable : b.lifecycle ?? t[b.state]})`).join(', ');
  const withWaits = (e, base) => (e.blockedBy ? `${base} — ${waits(e)}` : base);
  const sw = report.specWriter;
  if (sw) {
    section(t.spec, sw.needsSpec.map((e) => `#${e.number} ${e.title}`));
    section(t.blocked, sw.blocked.map((e) => withWaits(e, `#${e.number} ${e.title}`)));
    section(t.needsReviewer, sw.needsReviewer.map((e) => `#${e.number} ${e.title}`));
  }
  section(t.onMe, report.onMe.map((e) => `#${e.number} ${e.title} → ${e.command}`));
  section(t.readyForMe, report.readyForMe.map((e) => `#${e.number} ${e.title} → ${e.command}`));
  section(t.review, report.toReview.map((r) => `#${r.number} ${r.pr}`));
  section(t.ship, report.toShip.map((r) => `#${r.number} → ${r.command}`));
  section(t.others, report.waitingOnOthers.map((e) => withWaits(e, `#${e.number} ${e.title} (${e.state})`)));
  if (!sw && !report.onMe.length && !report.toReview.length && !report.toShip.length) out.unshift(t.nothing, '');
  report.milestones.forEach((m) => {
    out.push(`${t.milestone} "${m.title}": ${m.merged} ${t.merged}, ${m.inReview} ${t.inReview}, ${m.queued} ${t.queued}`);
    if (!m.dueOn) out.push(`  ${t.milestone} ${t.noDue}`);
    else if (m.warning) out.push(`  ⚠ ${t.warn} (${m.queued + m.inFlight} > ${m.capacity.reviews})`);
  });
  if (report.milestones.length) out.push('');
  section(t.alerts, report.alerts.map((a) => {
    if (a.type === 'stuck-build') return `#${a.issue} ${t.stuck} ${a.hours}h: ${t.restart} ${a.command}`;
    return a.type === 'stale-review'
      ? `#${a.issue} ${t.staleReview} ${a.hours}h (@${a.reviewer}) ${a.pr}`
      : `#${a.issue} ${t.staleBranch} ${a.behind} ${a.pr}`;
  }));
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** The daily digest: only who is waiting on what, and the alerts. Null when there is nothing to say. */
export function renderDigest(report, language = 'en') {
  const es = String(language).startsWith('es');
  const people = Object.keys(report.waiting).sort();
  if (!people.length && !report.alerts.length) return null;
  const lines = [es ? 'Resumen diario de Relevo' : 'Relevo daily digest', ''];
  people.forEach((login) => {
    lines.push(`@${login}: ${report.waiting[login].map((w) => `#${w.number} (${w.state})`).join(', ')}`);
  });
  if (report.alerts.length) {
    lines.push('', `${es ? 'Alertas' : 'Alerts'}:`);
    report.alerts.forEach((a) => {
      if (a.type === 'stuck-build') lines.push(`- #${a.issue} ${es ? 'construcción sin actividad desde hace' : 'build with no activity for'} ${a.hours}h`);
      else lines.push(a.type === 'stale-review'
        ? `- #${a.issue} ${es ? 'revisión esperando' : 'review waiting'} ${a.hours}h (@${a.reviewer})`
        : `- #${a.issue} ${es ? 'rama atrasada por' : 'branch behind the base by'} ${a.behind}`);
    });
  }
  return lines.join('\n');
}
