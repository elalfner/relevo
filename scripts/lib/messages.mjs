// Hand-off messages. Implements the hand-off requirements of
// openspec/specs/issue-lifecycle/spec.md.
//
// A line is dropped when any of its {{placeholders}} has no value, so optional
// parts (riskiest area, due time, log link) simply disappear when unknown.
// Long values are shortened: long logs are linked, never embedded.

import { pickLanguage, SUPPORTED_LANGUAGES } from './language.mjs';

// Kept here as well so that existing imports keep working.
export { pickLanguage, SUPPORTED_LANGUAGES };

const MAX_VALUE_LENGTH = 400;

const REQUIRED = {
  built: ['assignee', 'issue', 'title', 'tasks_done', 'tasks_total', 'branch', 'scenarios'],
  qa_failed: ['assignee', 'issue', 'title', 'finding', 'branch'],
  needs_spec: ['spec_writer', 'issue', 'title', 'missing'],
  changes_requested: ['author', 'issue', 'reviewer', 'summary'],
  needs_reviewer: ['spec_writer', 'issue', 'title', 'pr'],
  approved: ['recipient', 'issue', 'reviewer'],
  review_reminder: ['reviewer', 'issue', 'pr', 'hours'],
  review_escalation: ['spec_writer', 'issue', 'pr', 'reviewer', 'hours'],
  no_milestone: ['actor', 'issue'],
  no_assignee: ['actor', 'issue'],
  ready_denied: ['issue'],
  ready_denied_maintainer: ['issue'],
  blocked_notice: ['issue', 'title', 'blockers'],
  queued_capacity: ['issue', 'title', 'assignee', 'built', 'limit'],
  queued_agents: ['issue', 'title'],
  fix_done: ['issue', 'title', 'summary', 'qa', 'commit', 'iteration'],
};

const COMMANDS = {
  built: (issue) => `/relevo:review ${issue}`,
  qa_failed: (issue) => `/relevo:fix ${issue}`,
  changes_requested: (issue) => `/relevo:fix ${issue}`,
  approved: (issue) => `/relevo:ship ${issue}`,
};

const CATALOG = {
  en: {
    built: [
      '@{{assignee}} #{{issue}} "{{title}}" is built ✅',
      '',
      'What happened: {{tasks_done}} of {{tasks_total}} tasks done, QA passed.',
      'Branch: {{branch}}',
      'What to test: {{scenarios}} scenarios (checklist below)',
      'Riskiest area, check it first: {{risk}}',
      'Your next step: {{command}}',
      'Expected by: {{due}}',
      '',
      '{{checklist}}',
    ],
    qa_failed: [
      '@{{assignee}} #{{issue}} "{{title}}" failed QA ❌',
      '',
      'What happened: QA still rejected it after the retries{{reason_suffix}}.',
      'Finding: {{finding}}{{location_suffix}}',
      '{{branch_line}}',
      'Full QA report: {{log_url}}',
      'Your next step: {{command}}',
    ],
    needs_spec: [
      '@{{spec_writer}} #{{issue}} "{{title}}" is back with you: the spec needs work',
      '',
      'What is missing: {{missing}}',
      'Your next step: complete the issue, then label it ready again.',
    ],
    changes_requested: [
      '@{{author}} #{{issue}}: {{reviewer}} requested changes',
      '',
      'Summary: {{summary}}',
      'Full review: {{pr}}',
      'Your next step: {{command}}',
    ],
    approved: [
      '@{{recipient}} #{{issue}} was approved by {{reviewer}} ✅',
      '',
      'Pull request: {{pr}}',
      'Your next step: {{command}}',
    ],
    needs_reviewer: [
      '@{{spec_writer}} #{{issue}} "{{title}}" has no available reviewer',
      '',
      'Pull request: {{pr}}',
      'Your next step: assign a reviewer or ask someone to take it.',
    ],
    review_reminder: [
      '@{{reviewer}} reminder: #{{issue}} has been waiting for your review for {{hours}} hours',
      '',
      'Pull request: {{pr}}',
    ],
    review_escalation: [
      '@{{spec_writer}} #{{issue}} has waited {{hours}} hours without a review from @{{reviewer}}',
      '',
      'Pull request: {{pr}}',
      'Your next step: decide who reviews it.',
    ],
    no_milestone: [
      '#{{issue}} was not started: it has no milestone',
      '',
      '@{{actor}} your next step: add the issue to a milestone and label it ready again.',
    ],
    no_assignee: [
      '#{{issue}} was not started: it has no assignee',
      '',
      '@{{actor}} your next step: assign the issue to the person who will review it and label it ready again.',
    ],
    ready_denied: [
      '#{{issue}} was not started: only people with write access can mark an issue ready, so the label was removed',
      'Applied by: @{{actor}}',
    ],
    ready_denied_maintainer: [
      '#{{issue}} was not started: this repository is public, so only maintainers can mark an issue ready, and the label was removed',
      'Applied by: @{{actor}}',
    ],
    blocked_notice: [
      '#{{issue}} "{{title}}" is blocked',
      '',
      'Waiting for {{blockers}} to be merged. It starts automatically when they are.',
    ],
    queued_capacity: [
      '#{{issue}} "{{title}}" is queued',
      '',
      '{{assignee}} already has {{built}} built issues waiting for review (the limit is {{limit}}). It starts automatically when one of them is reviewed.',
    ],
    queued_agents: [
      '#{{issue}} "{{title}}" is queued',
      '',
      'The limit of concurrent agents is reached. It starts automatically when a run finishes.',
    ],
    fix_done: [
      '#{{issue}} "{{title}}" fixed (iteration {{iteration}})',
      '',
      'What changed: {{summary}}',
      'QA: {{qa}}',
      'Commit: {{commit}}',
      '@{{recipient}} {{ask}}',
    ],
  },
  es: {
    built: [
      '@{{assignee}} #{{issue}} "{{title}}" está construida ✅',
      '',
      'Qué pasó: {{tasks_done}} de {{tasks_total}} tareas hechas, QA aprobado.',
      'Rama: {{branch}}',
      'Qué probar: {{scenarios}} escenarios (checklist abajo)',
      'Zona más riesgosa, revísala primero: {{risk}}',
      'Tu siguiente paso: {{command}}',
      'Esperada para: {{due}}',
      '',
      '{{checklist}}',
    ],
    qa_failed: [
      '@{{assignee}} #{{issue}} "{{title}}" no pasó QA ❌',
      '',
      'Qué pasó: QA la rechazó otra vez tras los reintentos{{reason_suffix}}.',
      'Hallazgo: {{finding}}{{location_suffix}}',
      '{{branch_line}}',
      'Reporte completo de QA: {{log_url}}',
      'Tu siguiente paso: {{command}}',
    ],
    needs_spec: [
      '@{{spec_writer}} #{{issue}} "{{title}}" regresa contigo: la spec necesita trabajo',
      '',
      'Qué falta: {{missing}}',
      'Tu siguiente paso: completa el issue y márcalo como ready otra vez.',
    ],
    changes_requested: [
      '@{{author}} #{{issue}}: {{reviewer}} pidió cambios',
      '',
      'Resumen: {{summary}}',
      'Revisión completa: {{pr}}',
      'Tu siguiente paso: {{command}}',
    ],
    approved: [
      '@{{recipient}} #{{issue}} fue aprobada por {{reviewer}} ✅',
      '',
      'Pull request: {{pr}}',
      'Tu siguiente paso: {{command}}',
    ],
    needs_reviewer: [
      '@{{spec_writer}} #{{issue}} "{{title}}" no tiene revisor disponible',
      '',
      'Pull request: {{pr}}',
      'Tu siguiente paso: asigna un revisor o pide que alguien lo tome.',
    ],
    review_reminder: [
      '@{{reviewer}} recordatorio: #{{issue}} lleva {{hours}} horas esperando tu revisión',
      '',
      'Pull request: {{pr}}',
    ],
    review_escalation: [
      '@{{spec_writer}} #{{issue}} lleva {{hours}} horas sin revisión de @{{reviewer}}',
      '',
      'Pull request: {{pr}}',
      'Tu siguiente paso: decide quién lo revisa.',
    ],
    no_milestone: [
      '#{{issue}} no se inició: no tiene milestone',
      '',
      '@{{actor}} tu siguiente paso: agrega el issue a un milestone y márcalo como ready otra vez.',
    ],
    no_assignee: [
      '#{{issue}} no se inició: no tiene responsable',
      '',
      '@{{actor}} tu siguiente paso: asigna el issue a quien lo va a revisar y márcalo como ready otra vez.',
    ],
    ready_denied: [
      '#{{issue}} no se inició: solo quienes tienen acceso de escritura pueden marcar un issue como ready, así que se quitó la etiqueta',
      'Aplicada por: @{{actor}}',
    ],
    ready_denied_maintainer: [
      '#{{issue}} no se inició: este repositorio es público, así que solo quienes mantienen el proyecto pueden marcar un issue como ready, y se quitó la etiqueta',
      'Aplicada por: @{{actor}}',
    ],
    blocked_notice: [
      '#{{issue}} "{{title}}" está bloqueado',
      '',
      'Espera a que se fusionen {{blockers}}. Empieza solo cuando lo estén.',
    ],
    queued_capacity: [
      '#{{issue}} "{{title}}" está en cola',
      '',
      '{{assignee}} ya tiene {{built}} issues construidos esperando revisión (el límite es {{limit}}). Empieza solo cuando se revise uno.',
    ],
    queued_agents: [
      '#{{issue}} "{{title}}" está en cola',
      '',
      'Se alcanzó el límite de agentes simultáneos. Empieza solo cuando termine una ejecución.',
    ],
    fix_done: [
      '#{{issue}} "{{title}}" corregido (iteración {{iteration}})',
      '',
      'Qué cambió: {{summary}}',
      'QA: {{qa}}',
      'Commit: {{commit}}',
      '@{{recipient}} {{ask}}',
    ],
  },
};

export const MESSAGE_KINDS = Object.keys(REQUIRED);

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function shorten(value) {
  const text = String(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}… (truncated; see the full log)` : text;
}

export function renderMessage(kind, data = {}, language = 'en') {
  if (!REQUIRED[kind]) throw new Error(`unknown message kind "${kind}"`);
  const values = { ...data };
  REQUIRED[kind].forEach((field) => {
    if (!present(values[field])) throw new Error(`message "${kind}" needs "${field}"`);
  });
  if (!present(values.command) && COMMANDS[kind]) values.command = COMMANDS[kind](values.issue);
  if (kind === 'qa_failed') {
    const location = present(values.file) ? `${values.file}${present(values.line) ? `:${values.line}` : ''}` : '';
    values.location_suffix = location ? ` (${location})` : '';
    const pushed = values.pushed !== false;
    const es = pickLanguage(language) === 'es';
    if (pushed) {
      values.branch_line = es
        ? `La rama ${values.branch} está subida; el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} is pushed; the state did not advance and no pull request was opened.`;
    } else {
      values.branch_line = es
        ? `La rama ${values.branch} NO se subió (se encontró una posible credencial o un marcador temporal); el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} was NOT pushed (a possible credential or temporary marker was found); the state did not advance and no pull request was opened.`;
    }
    values.reason_suffix = present(values.reason) ? ` (${values.reason})` : '';
  }

  const lines = CATALOG[pickLanguage(language)][kind];
  const out = [];
  lines.forEach((template) => {
    const names = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const optionalEmpty = names.some((n) => !present(values[n]) && !n.endsWith('_suffix'));
    if (names.length > 0 && optionalEmpty) return;
    out.push(template.replace(/\{\{(\w+)\}\}/g, (_, n) => (n === 'checklist' ? String(values[n] ?? '') : shorten(values[n] ?? ''))));
  });

  // Collapse repeated blank lines and trim the ends.
  const collapsed = out.filter((l, i) => !(l === '' && (out[i - 1] === '' || i === 0)));
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === '') collapsed.pop();
  return collapsed.join('\n');
}
