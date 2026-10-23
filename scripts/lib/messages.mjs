// Hand-off messages. Implements the hand-off requirements of
// openspec/specs/issue-lifecycle/spec.md.
//
// A line is dropped when any of its {{placeholders}} has no value, so optional
// parts (riskiest area, due time, log link) simply disappear when unknown.
// Long values are shortened: long logs are linked, never embedded.

import { shortHash } from './issue-hash.mjs';
import { pickLanguage, SUPPORTED_LANGUAGES } from './language.mjs';
import { nextStep, nextStepPrefix } from './next-step.mjs';

// Kept here as well so that existing imports keep working.
export { pickLanguage, SUPPORTED_LANGUAGES };

const MAX_VALUE_LENGTH = 400;

const REQUIRED = {
  built: ['assignee', 'issue', 'title', 'tasks_done', 'tasks_total', 'branch', 'scenarios'],
  qa_failed: ['assignee', 'issue', 'title', 'finding', 'branch'],
  toolchain_missing: ['assignee', 'issue', 'title', 'tools', 'platform'],
  needs_spec: ['spec_writer', 'issue', 'title', 'missing'],
  changes_requested: ['author', 'issue', 'reviewer', 'summary'],
  needs_reviewer: ['spec_writer', 'issue', 'title', 'pr'],
  approved: ['recipient', 'issue', 'reviewer'],
  review_reminder: ['reviewer', 'issue', 'pr', 'hours'],
  review_escalation: ['spec_writer', 'issue', 'pr', 'reviewer', 'hours'],
  no_milestone: ['actor', 'issue'],
  cloud_not_configured: ['actor', 'issue'],
  no_assignee: ['actor', 'issue'],
  ready_denied: ['issue'],
  ready_denied_maintainer: ['issue'],
  blocked_notice: ['issue', 'title', 'blockers'],
  queued_capacity: ['issue', 'title', 'assignee', 'built', 'limit'],
  queued_agents: ['issue', 'title'],
  fix_done: ['issue', 'title', 'summary', 'qa', 'commit', 'iteration'],
  ship_stopped: ['actor', 'issue', 'reasons'],
  ship_not_approver: ['actor', 'issue'],
  ship_no_ci: ['actor', 'issue'],
  ship_needs_app: ['actor', 'issue', 'base'],
  ship_done: ['issue', 'pr', 'base'],
  ship_failed: ['issue', 'run'],
};

// The lifecycle state whose next step each message shows (see next-step.mjs, the only place that knows the commands).
const STATE_OF = {
  built: 'built',
  qa_failed: 'qa-failed',
  toolchain_missing: 'qa-failed',
  needs_spec: 'needs-spec',
  changes_requested: 'changes-requested',
  approved: 'pr-open',
};

const CATALOG = {
  en: {
    built: [
      '@{{assignee}} #{{issue}} "{{title}}" is built ✅',
      '',
      'What happened: {{tasks_done}} of {{tasks_total}} tasks done, QA passed.',
      'Branch: {{branch}}',
      'Built from the issue text: {{issue_hash_short}}',
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
      '{{next_line}}',
    ],
    toolchain_missing: [
      '@{{assignee}} #{{issue}} "{{title}}" was not built: the runner has no {{tools}} ❌',
      '',
      'What happened: the build job checked the toolchain of platform {{platform}} before the agent started, and {{tools}} is not on the path of the runner. Nothing was built and no model turns were spent.',
      '{{next_line}}',
    ],
    needs_spec: [
      '@{{spec_writer}} #{{issue}} "{{title}}" is back with you: the spec needs work',
      '',
      'What is missing: {{missing}}',
      '{{next_line}}',
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
      'Or apply the label {{ship_label}} to this issue: it ships on GitHub, with no local copy.',
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
    cloud_not_configured: [
      '#{{issue}} is ready, but the cloud cannot build it: this repository has no model credential',
      '',
      '@{{actor}} your next step: run `/relevo:go {{issue}}` on your machine, or add the secret ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN so that the cloud can build it. The issue stays ready.',
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
    ship_stopped: [
      '@{{actor}} #{{issue}} was not shipped',
      '',
      'Why: {{reasons}}',
      'Nothing was merged and the issue keeps its state; the relevo:ship label was removed. Apply it again once this is solved, or run `/relevo:ship {{issue}}`.',
    ],
    ship_not_approver: [
      '@{{actor}} #{{issue}} was not shipped: you did not approve this pull request',
      '',
      'An eligible person who did not approve has to say so in writing, and a label cannot. Run `/relevo:ship {{issue}}`, which asks you to confirm it, or ask {{approvers}} to apply the label. The label was removed.',
    ],
    ship_no_ci: [
      '@{{actor}} #{{issue}} was not shipped: no check ran on this pull request',
      '',
      'Nothing but the review vouches for this code, and the label cannot confirm that. Run `/relevo:ship {{issue}}`, which asks you, or set `review.ship_without_ci: true` in relevo.yml to let the label merge without checks. The label was removed.',
    ],
    ship_needs_app: [
      '@{{actor}} #{{issue}} was not shipped: {{base}} requires status checks',
      '',
      'The archive commit needs its own checks, and a push with the workflow token starts none. Create a GitHub App for this repository and store its id and private key as the secrets RELEVO_SHIP_APP_ID and RELEVO_SHIP_APP_KEY (see docs/execution.md), or run `/relevo:ship {{issue}}`. Nothing was archived; the label was removed.',
    ],
    ship_done: [
      '#{{issue}} shipped ✅',
      '',
      'Pull request {{pr}} was squash-merged into {{base}} as {{commit}}.',
      'Applied by: @{{actor}}',
      '{{checks_note}}',
      'The issue is closed and its labels removed. Promoting {{base}} to the release branch is a separate pull request.',
    ],
    ship_failed: [
      '#{{issue}} was not shipped: the run ended without an outcome',
      '',
      '{{log_line}}',
      'When the cause is fixed, apply relevo:ship again: a specification already archived is not archived twice.',
    ],
  },
  es: {
    built: [
      '@{{assignee}} #{{issue}} "{{title}}" está construida ✅',
      '',
      'Qué pasó: {{tasks_done}} de {{tasks_total}} tareas hechas, QA aprobado.',
      'Rama: {{branch}}',
      'Construida con el texto del issue: {{issue_hash_short}}',
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
      '{{next_line}}',
    ],
    toolchain_missing: [
      '@{{assignee}} #{{issue}} "{{title}}" no se construyó: el runner no tiene {{tools}} ❌',
      '',
      'Qué pasó: el job de build comprobó el toolchain de la plataforma {{platform}} antes de que empezara el agente, y {{tools}} no está en el path del runner. No se construyó nada y no se gastó ningún turno del modelo.',
      '{{next_line}}',
    ],
    needs_spec: [
      '@{{spec_writer}} #{{issue}} "{{title}}" regresa contigo: la spec necesita trabajo',
      '',
      'Qué falta: {{missing}}',
      '{{next_line}}',
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
      'O pon la etiqueta {{ship_label}} a este issue: se fusiona en GitHub, sin copia local.',
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
    cloud_not_configured: [
      '#{{issue}} está listo, pero la nube no puede construirlo: este repositorio no tiene una credencial del modelo',
      '',
      '@{{actor}} tu siguiente paso: ejecuta `/relevo:go {{issue}}` en tu máquina, o agrega el secreto ANTHROPIC_API_KEY o CLAUDE_CODE_OAUTH_TOKEN para que la nube pueda construirlo. El issue sigue en ready.',
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
    ship_stopped: [
      '@{{actor}} #{{issue}} no se fusionó',
      '',
      'Por qué: {{reasons}}',
      'No se fusionó nada y el issue conserva su estado; se quitó la etiqueta relevo:ship. Vuelve a ponerla cuando esté resuelto, o ejecuta `/relevo:ship {{issue}}`.',
    ],
    ship_not_approver: [
      '@{{actor}} #{{issue}} no se fusionó: tú no aprobaste este pull request',
      '',
      'Quien es elegible pero no aprobó tiene que decirlo por escrito, y una etiqueta no puede. Ejecuta `/relevo:ship {{issue}}`, que te pide confirmarlo, o pide a {{approvers}} que ponga la etiqueta. Se quitó la etiqueta.',
    ],
    ship_no_ci: [
      '@{{actor}} #{{issue}} no se fusionó: no corrió ningún check en este pull request',
      '',
      'Solo la revisión respalda este código, y la etiqueta no puede confirmarlo. Ejecuta `/relevo:ship {{issue}}`, que te lo pregunta, o pon `review.ship_without_ci: true` en relevo.yml para que la etiqueta fusione sin checks. Se quitó la etiqueta.',
    ],
    ship_needs_app: [
      '@{{actor}} #{{issue}} no se fusionó: {{base}} exige status checks',
      '',
      'El commit del archivo necesita sus propios checks, y un push con el token del workflow no lanza ninguno. Crea una GitHub App para este repositorio y guarda su id y su clave privada como los secrets RELEVO_SHIP_APP_ID y RELEVO_SHIP_APP_KEY (ver docs/execution.es.md), o ejecuta `/relevo:ship {{issue}}`. No se archivó nada; se quitó la etiqueta.',
    ],
    ship_done: [
      '#{{issue}} fusionada ✅',
      '',
      'El pull request {{pr}} se fusionó con squash en {{base}} como {{commit}}.',
      'La pidió: @{{actor}}',
      '{{checks_note}}',
      'El issue está cerrado y sin etiquetas. Promover {{base}} a la rama de release es un pull request aparte.',
    ],
    ship_failed: [
      '#{{issue}} no se fusionó: la ejecución terminó sin resultado',
      '',
      '{{log_line}}',
      'Cuando la causa esté resuelta, vuelve a poner relevo:ship: una especificación ya archivada no se archiva dos veces.',
    ],
  },
};

export const MESSAGE_KINDS = Object.keys(REQUIRED);

// ", N of M tasks are done" for the work that was kept, when the numbers are known.
function tasksInfo(values, es) {
  if (!present(values.tasks_done) || !present(values.tasks_total)) return '';
  return es ? ` (${values.tasks_done} de ${values.tasks_total} tareas hechas)` : ` (${values.tasks_done} of ${values.tasks_total} tasks done)`;
}

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
  const language_ = pickLanguage(language);
  const es = language_ === 'es';
  // The person who applied the label is mentioned when the run knows who it was.
  if (kind === 'ship_failed') {
    const who = present(values.actor) ? `@${values.actor} ` : '';
    values.log_line = es ? `${who}${who ? 'lee' : 'Lee'} el log para ver por qué: ${values.run}` : `${who}${who ? 'read' : 'Read'} the log to see why: ${values.run}`;
  }
  if (kind === 'built' && present(values.issue_hash)) values.issue_hash_short = shortHash(values.issue_hash);

  // The next step comes from one table. needs-spec depends on why the issue came back, qa-failed on what the branch holds.
  if (STATE_OF[kind]) {
    const reason = kind === 'needs_spec' ? values.reason ?? 'missing' : kind === 'qa_failed' ? values.recovery ?? (values.branch_state === 'kept' ? 'kept' : 'fix') : kind === 'toolchain_missing' ? 'toolchain' : null;
    const step = nextStep({ state: STATE_OF[kind], reason, issue: values.issue, language: language_ });
    if (!present(values.command) && step.command) values.command = step.command;
    if (kind === 'toolchain_missing') values.next_line = `${nextStepPrefix(language_)}: ${step.hint}.`;
    if (kind === 'needs_spec') values.next_line = `${nextStepPrefix(language_)}: ${step.command}: ${step.hint}.`;
    if (kind === 'qa_failed') {
      // For kept work the next step says what the command does and the other way forward; the others are the bare command.
      const kept = step.reason === 'kept';
      values.next_line = step.command ? `${nextStepPrefix(language_)}: ${values.command ?? step.command}${kept ? ` (${step.hint})` : ''}` : `${nextStepPrefix(language_)}: ${step.hint}.`;
    }
  }
  if (kind === 'qa_failed') {
    const location = present(values.file) ? `${values.file}${present(values.line) ? `:${values.line}` : ''}` : '';
    values.location_suffix = location ? ` (${location})` : '';
    // `pushed: false` is the older way to say that the branch was not pushed because of a credential or a marker.
    const state = values.branch_state ?? (values.pushed === false ? 'unsafe' : 'pushed');
    if (!['pushed', 'unsafe', 'not_pushed', 'existing', 'kept'].includes(state)) throw new Error(`message "qa_failed" has an unknown branch_state "${state}"`);
    if (state === 'existing' && !present(values.recovery)) throw new Error('message "qa_failed" needs "recovery" when the branch already existed');
    const branchLines = {
      pushed: es
        ? `La rama ${values.branch} está subida; el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} is pushed; the state did not advance and no pull request was opened.`,
      unsafe: es
        ? `La rama ${values.branch} NO se subió (se encontró una posible credencial, un marcador temporal o una ruta protegida); el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} was NOT pushed (a possible credential, a temporary marker or a protected path was found); the state did not advance and no pull request was opened.`,
      not_pushed: es
        ? `La rama ${values.branch} no se subió; el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} was not pushed; the state did not advance and no pull request was opened.`,
      kept: es
        ? `La rama ${values.branch} tiene el trabajo que QA no aprobó${tasksInfo(values, es)}; se guardó como trabajo en curso para que no se pierda. El estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} holds the work that QA did not approve${tasksInfo(values, es)}; it was kept as work in progress so nothing is lost. The state did not advance and no pull request was opened.`,
      existing: es
        ? `La rama ${values.branch} ya existía en el remoto, así que no se tocó; el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} already existed on the remote, so it was not touched; the state did not advance and no pull request was opened.`,
    };
    values.branch_line = branchLines[state];
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
