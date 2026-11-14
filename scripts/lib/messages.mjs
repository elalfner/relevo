// Hand-off messages. Implements the hand-off requirements of
// openspec/specs/issue-lifecycle/spec.md.
//
// A line is dropped when any of its {{placeholders}} has no value, so optional
// parts (riskiest area, due time, log link) simply disappear when unknown.
// Long values are shortened: long logs are linked, never embedded.

import { shortHash } from './issue-hash.mjs';
import { pickLanguage, SUPPORTED_LANGUAGES } from './language.mjs';
import { nextStep, nextStepPrefix } from './next-step.mjs';
import { sharedWaitMarker } from './shared-wait.mjs';

// Kept here as well so that existing imports keep working.
export { pickLanguage, SUPPORTED_LANGUAGES };

const MAX_VALUE_LENGTH = 400;

const REQUIRED = {
  built: ['assignee', 'issue', 'title', 'tasks_done', 'tasks_total', 'branch', 'scenarios'],
  qa_failed: ['assignee', 'issue', 'title', 'finding', 'branch'],
  toolchain_missing: ['assignee', 'issue', 'title', 'tools', 'platform'],
  installed_missing: ['assignee', 'issue', 'title', 'paths', 'platform'],
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
  urgent_denied: ['issue'],
  urgent_denied_maintainer: ['issue'],
  blocked_notice: ['issue', 'title', 'blockers'],
  queued_capacity: ['issue', 'title', 'assignee', 'built', 'limit'],
  queued_agents: ['issue', 'title'],
  queued_shared_files: ['issue', 'title', 'file', 'other', 'hours'],
  fix_done: ['issue', 'title', 'summary', 'qa', 'commit', 'iteration'],
  ship_stopped: ['actor', 'issue', 'reasons'],
  ship_not_approver: ['actor', 'issue'],
  ship_no_ci: ['actor', 'issue'],
  ship_needs_app: ['actor', 'issue', 'base'],
  ship_done: ['issue', 'pr', 'base'],
  ship_failed: ['issue', 'run'],
  run_progress: ['phase', 'minutes'],
  run_progress_closed: [],
  run_failed_early: ['issue', 'job_status', 'run'],
  run_no_outcome: ['situation', 'issue', 'run'],
  usage_limit_retry: ['issue', 'at', 'attempt', 'max', 'reason', 'run'],
};

// The lifecycle state whose next step each message shows (see next-step.mjs, the only place that knows the commands).
const STATE_OF = {
  built: 'built',
  qa_failed: 'qa-failed',
  toolchain_missing: 'qa-failed',
  installed_missing: 'qa-failed',
  needs_spec: 'needs-spec',
  changes_requested: 'changes-requested',
  approved: 'pr-open',
};

export const CATALOG = {
  en: {
    built: [
      '@{{assignee}} #{{issue}} "{{title}}" is built ✅',
      '',
      'What happened: {{tasks_done}} of {{tasks_total}} tasks done, QA passed.',
      'Assumed, not confirmed: {{assumed}}',
      'Branch: {{branch}}',
      'Started ahead of the queue (urgent): you now have {{built_waiting}} built issues waiting for your review.',
      '{{shared_files_line}}',
      'Built from the issue text: {{issue_hash_short}}',
      'What to test: {{scenarios}} scenarios (checklist below)',
      'Riskiest area, check it first: {{risk}}',
      'Shared code touched: {{shared_code}}',
      'Inputs to confirm before you test: {{inputs_to_confirm}}',
      'Your next step: {{command}}',
      'Expected by: {{due}}',
      '{{qa_notes_line}}',
      '',
      '{{checklist}}',
      '{{qa_notes_marker}}',
    ],
    qa_failed: [
      '@{{assignee}} #{{issue}} "{{title}}" {{headline}}',
      '',
      'What happened: {{happened}}',
      'Finding: {{finding}}{{location_suffix}}',
      '{{class_line}}',
      '{{contradiction_line}}',
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
    installed_missing: [
      '@{{assignee}} #{{issue}} "{{title}}" was not built: the dependencies of platform {{platform}} are not installed ❌',
      '',
      'What happened: the build job checked platform {{platform}} before the agent started, and {{paths}} does not exist after the install step. Nothing was built and no model turns were spent.',
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
    urgent_denied: [
      '#{{issue}}: the urgent label was removed because only people with write access can ask for an early start. The issue keeps its place in the queue.',
      'Applied by: @{{actor}}',
    ],
    urgent_denied_maintainer: [
      '#{{issue}}: the urgent label was removed because this repository is public, so only maintainers can ask for an early start. The issue keeps its place in the queue.',
      'Applied by: @{{actor}}',
    ],
    blocked_notice: [
      '#{{issue}} "{{title}}" is blocked',
      '',
      'Waiting for {{blockers}} to be merged. It starts automatically when they are.',
      '{{urgent_note}}',
    ],
    queued_capacity: [
      '#{{issue}} "{{title}}" is queued',
      '',
      '{{assignee}} already has {{built}} built issues waiting for review (the limit is {{limit}}). It starts automatically when one of them is reviewed.',
      'Built issues waiting for review: {{built_issues}}',
    ],
    queued_agents: [
      '#{{issue}} "{{title}}" is queued',
      '',
      'The limit of concurrent agents is reached. It starts automatically when a run finishes.',
      'Running or starting now: {{active_text}}',
      'Ahead of it in the queue: {{ahead_text}}',
      'Recent builds: {{typical_text}}',
      'These figures are read when the issue is queued; they are not updated while it waits.',
    ],
    queued_shared_files: [
      '#{{issue}} "{{title}}" is queued',
      '',
      'It names `{{file}}`, which #{{other}} also names and has not been merged yet, so building both at once would conflict. It starts automatically when #{{other}} is merged, or after {{hours}} hours at the latest.',
      '{{wait_marker}}',
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
    run_progress: [
      'Relevo build in progress: {{phase_label}}{{attempt_suffix}}',
      'Tasks: {{tasks_done}} of {{tasks_total}}',
      'Running for {{minutes}} min',
      '',
      'This comment is updated while the run lasts and is closed when it ends.',
    ],
    run_progress_closed: [
      '{{summary_line}}',
      'Run: {{run_url}}',
    ],
    ship_failed: [
      '#{{issue}} was not shipped: the run ended without an outcome',
      '',
      '{{log_line}}',
      'When the cause is fixed, apply relevo:ship again: a specification already archived is not archived twice.',
    ],
    run_failed_early: ['{{body}}'],
    run_no_outcome: ['{{body}}'],
    usage_limit_retry: ['{{body}}', '', '{{marker}}'],
  },
  es: {
    built: [
      '@{{assignee}} #{{issue}} "{{title}}" está construida ✅',
      '',
      'Qué pasó: {{tasks_done}} de {{tasks_total}} tareas hechas, QA aprobado.',
      'Supuesto, sin confirmar: {{assumed}}',
      'Rama: {{branch}}',
      'Empezó antes que la cola (urgente): ahora tienes {{built_waiting}} issues construidos esperando tu revisión.',
      '{{shared_files_line}}',
      'Construida con el texto del issue: {{issue_hash_short}}',
      'Qué probar: {{scenarios}} escenarios (checklist abajo)',
      'Zona más riesgosa, revísala primero: {{risk}}',
      'Código compartido tocado: {{shared_code}}',
      'Insumos que debes confirmar antes de probar: {{inputs_to_confirm}}',
      'Tu siguiente paso: {{command}}',
      'Esperada para: {{due}}',
      '{{qa_notes_line}}',
      '',
      '{{checklist}}',
      '{{qa_notes_marker}}',
    ],
    qa_failed: [
      '@{{assignee}} #{{issue}} "{{title}}" {{headline}}',
      '',
      'Qué pasó: {{happened}}',
      'Hallazgo: {{finding}}{{location_suffix}}',
      '{{class_line}}',
      '{{contradiction_line}}',
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
    installed_missing: [
      '@{{assignee}} #{{issue}} "{{title}}" no se construyó: las dependencias de la plataforma {{platform}} no están instaladas ❌',
      '',
      'Qué pasó: el job de build revisó la plataforma {{platform}} antes de que empezara el agente, y {{paths}} no existe después del paso de instalación. No se construyó nada y no se gastó ningún turno del modelo.',
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
    urgent_denied: [
      '#{{issue}}: se quitó la etiqueta de urgente porque solo quienes tienen acceso de escritura pueden pedir un inicio anticipado. El issue conserva su lugar en la cola.',
      'Aplicada por: @{{actor}}',
    ],
    urgent_denied_maintainer: [
      '#{{issue}}: se quitó la etiqueta de urgente porque este repositorio es público, así que solo quienes mantienen el proyecto pueden pedir un inicio anticipado. El issue conserva su lugar en la cola.',
      'Aplicada por: @{{actor}}',
    ],
    blocked_notice: [
      '#{{issue}} "{{title}}" está bloqueado',
      '',
      'Espera a que se fusionen {{blockers}}. Empieza solo cuando lo estén.',
      '{{urgent_note}}',
    ],
    queued_capacity: [
      '#{{issue}} "{{title}}" está en cola',
      '',
      '{{assignee}} ya tiene {{built}} issues construidos esperando revisión (el límite es {{limit}}). Empieza solo cuando se revise uno.',
      'Issues construidos esperando revisión: {{built_issues}}',
    ],
    queued_agents: [
      '#{{issue}} "{{title}}" está en cola',
      '',
      'Se alcanzó el límite de agentes simultáneos. Empieza solo cuando termine una ejecución.',
      'En ejecución o por arrancar ahora: {{active_text}}',
      'Delante en la cola: {{ahead_text}}',
      'Construcciones recientes: {{typical_text}}',
      'Estas cifras se leen cuando el issue entra en la cola; no se actualizan mientras espera.',
    ],
    queued_shared_files: [
      '#{{issue}} "{{title}}" está en cola',
      '',
      'Nombra `{{file}}`, que #{{other}} también nombra y aún no se fusionó, así que construir los dos a la vez generaría un conflicto. Empieza solo cuando se fusione #{{other}}, o como máximo pasadas {{hours}} horas.',
      '{{wait_marker}}',
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
    run_progress: [
      'Construcción de Relevo en curso: {{phase_label}}{{attempt_suffix}}',
      'Tareas: {{tasks_done}} de {{tasks_total}}',
      'Lleva {{minutes}} min',
      '',
      'Este comentario se actualiza mientras dura la ejecución y se cierra al terminar.',
    ],
    run_progress_closed: [
      '{{summary_line}}',
      'Ejecución: {{run_url}}',
    ],
    ship_failed: [
      '#{{issue}} no se fusionó: la ejecución terminó sin resultado',
      '',
      '{{log_line}}',
      'Cuando la causa esté resuelta, vuelve a poner relevo:ship: una especificación ya archivada no se archiva dos veces.',
    ],
    run_failed_early: ['{{body}}'],
    run_no_outcome: ['{{body}}'],
    usage_limit_retry: ['{{body}}', '', '{{marker}}'],
  },
};

// The phrases of the usage comment that `run-usage.mjs` composes (the sentence has many optional parts, so it is built there from
// these). The same rules as the catalog: both languages have the same keys and placeholders, a missing one falls back to English,
// and tests/messages-language.test.mjs fails the build of Relevo when they differ.
export const USAGE_TEXT = {
  en: {
    used: 'This run used {{parts}}.',
    turn_one: '{{n}} turn',
    turn_many: '{{n}} turns',
    by_subagents: ' ({{n}} by subagents)',
    cost: 'about ${{cost}}',
    notional: ' (notional: a subscription is not billed per run)',
    tokens: '{{n}} tokens',
    cached: ' (plus {{n}} from the cache)',
    went_past: ' It went past {{limit}} ({{max}}) with {{used}}{{why}}.',
    subagents_not_stopped: ': the runner counts only the turns of the main agent, so the turns of the subagents were not stopped',
    by_agent: ' By agent: {{list}}.',
    minutes: ', {{n}} min',
    agent_cost: ', about ${{cost}}',
    by_replicas: ' Replicas: {{list}}.',
    replica_item: '{{id}}{{model}} {{attempts}}, {{turns}}{{cost}}{{why}}',
    replica_why: ', because {{why}}',
    attempt_one: '{{n}} attempt',
    attempt_many: '{{n}} attempts',
    replicas_total: ' Replicas together about ${{replicas}}, the rest of the run about ${{rest}}.',
    by_model: ' Cost by model: {{list}}.',
    developer: 'developer',
    lens: '{{role}} lens',
    models_chosen: ' Models chosen: {{list}}.',
    plan_notes: ' Notes on the plan: {{list}}.',
    raised: ' The developer went up on a retry: {{list}}.',
    raised_item: '{{from}} to {{to}} on attempt {{attempt}} ({{reason}})',
    gate_red: 'the gate was red',
    qa_rejected: 'QA rejected',
    by_check: ' Checks of the gate: {{list}}.',
    check_reused: '{{name}} reused ({{original}}s when it ran)',
    check_seconds: '{{name}} {{seconds}}s',
    by_quota: ' Quota: {{list}}.',
    window_five_hour: 'the 5-hour window',
    window_seven_day: 'the weekly window',
    window_other: 'the {{type}} window',
    quota_at: 'at {{pct}} %',
    quota_moved: 'went from {{before}} % to {{after}} %',
    quota_resets: ' (resets {{at}})',
  },
  es: {
    used: 'Esta ejecución usó {{parts}}.',
    turn_one: '{{n}} turno',
    turn_many: '{{n}} turnos',
    by_subagents: ' ({{n}} de subagentes)',
    cost: 'unos ${{cost}}',
    notional: ' (nocional: una suscripción no se factura por ejecución)',
    tokens: '{{n}} tokens',
    cached: ' (más {{n}} de la caché)',
    went_past: ' Superó {{limit}} ({{max}}) con {{used}}{{why}}.',
    subagents_not_stopped: ': el runner cuenta solo los turnos del agente principal, así que los turnos de los subagentes no se detuvieron',
    by_agent: ' Por agente: {{list}}.',
    minutes: ', {{n}} min',
    agent_cost: ', unos ${{cost}}',
    by_replicas: ' Réplicas: {{list}}.',
    replica_item: '{{id}}{{model}} {{attempts}}, {{turns}}{{cost}}{{why}}',
    replica_why: ', porque {{why}}',
    attempt_one: '{{n}} intento',
    attempt_many: '{{n}} intentos',
    replicas_total: ' Las réplicas juntas, unos ${{replicas}}; el resto de la ejecución, unos ${{rest}}.',
    by_model: ' Costo por modelo: {{list}}.',
    developer: 'desarrollador',
    lens: 'lente {{role}}',
    models_chosen: ' Modelos elegidos: {{list}}.',
    plan_notes: ' Notas sobre el plan: {{list}}.',
    raised: ' El desarrollador subió de modelo en un reintento: {{list}}.',
    raised_item: '{{from}} a {{to}} en el intento {{attempt}} ({{reason}})',
    gate_red: 'la puerta estaba en rojo',
    qa_rejected: 'QA la rechazó',
    by_check: ' Checks de la puerta: {{list}}.',
    check_reused: '{{name}} reutilizado ({{original}}s cuando corrió)',
    check_seconds: '{{name}} {{seconds}}s',
    by_quota: ' Cuota: {{list}}.',
    window_five_hour: 'la ventana de 5 horas',
    window_seven_day: 'la ventana semanal',
    window_other: 'la ventana {{type}}',
    quota_at: 'en {{pct}} %',
    quota_moved: 'pasó de {{before}} % a {{after}} %',
    quota_resets: ' (se restablece {{at}})',
  },
};

/** A time (milliseconds since the epoch) as `2026-11-12 18:30 UTC`: the same in every language. */
export function formatUtc(ms) {
  return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** The phrase `key` of the usage comment in `language`, with its {{placeholders}} filled; English when the language lacks it. */
export function usagePhrase(language, key, vars = {}) {
  const text = USAGE_TEXT[pickLanguage(language)]?.[key] ?? USAGE_TEXT.en[key];
  if (text === undefined) throw new Error(`unknown usage phrase "${key}"`);
  return text.replace(/\{\{(\w+)\}\}/g, (_, n) => String(vars[n] ?? ''));
}

export const MESSAGE_KINDS = Object.keys(REQUIRED);

// ", N of M tasks are done" for the work that was kept, when the numbers are known.
function tasksInfo(values, es) {
  if (!present(values.tasks_done) || !present(values.tasks_total)) return '';
  return es ? ` (${values.tasks_done} de ${values.tasks_total} tareas hechas)` : ` (${values.tasks_done} of ${values.tasks_total} tasks done)`;
}

// The next step of a qa_failed message when no recovery is given: what the branch holds decides it. When nothing was pushed
// (`unsafe`, `not_pushed` or the older `pushed: false`) there is no branch to fix, so the issue is built again.
function qaFailedReason(values) {
  if (values.branch_state === 'kept') return 'kept';
  const state = values.branch_state ?? (values.pushed === false ? 'unsafe' : 'pushed');
  return state === 'unsafe' || state === 'not_pushed' ? 'rebuild' : 'fix';
}

// The failures that the commit guard ends, not QA: the comment must not say that QA rejected the work. Only the protected path
// is covered (issue #119); another refusal of the guard is one more entry here.
const POLICY_STOPS = {
  'protected path in the diff': { next: 'protected', en: 'an unattended run cannot edit a protected path, so the commit was refused and nothing was pushed; QA did not reject the work', es: 'una corrida sin supervisión no puede editar una ruta protegida, así que se rechazó el commit y no se subió nada; QA no rechazó el trabajo' },
};
const policyStop = (values) => POLICY_STOPS[values.reason] ?? null;

// The reasons of the failure path that are a QA rejection. A comment with no reason is one too (the older callers never gave one).
// Any other reason is a stop for that reason, including one the catalog does not know: a reason added to the skill later is never
// described as a QA rejection. `fix` finds the comment by its title (scripts/lib/failure-comment.mjs), so a title changes there too.
const QA_REJECTIONS = new Set(['QA rejected after the retries', 'QA rejected: nothing the developer agent can fix', 'QA rejected: the lenses contradict each other']);
const stopsNotQa = (values) => present(values.reason) && !QA_REJECTIONS.has(values.reason);

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function shorten(value) {
  const text = String(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}… (truncated; see the full log)` : text;
}

const FINDING_CLASSES = ['fixable', 'input', 'spec', 'policy'];

// The finding classes that the developer agent cannot correct are also the reasons of the next step of `qa-failed`.
// Only work that was kept on the branch has a next step of its own for them.
function classReason(values) {
  return values.branch_state === 'kept' && ['input', 'spec', 'policy'].includes(values.finding_class) ? values.finding_class : null;
}

// One line that says what kind of finding stopped the run, when the developer agent could not correct it.
function classLine(values, es) {
  if (!present(values.finding_class)) return '';
  if (!FINDING_CLASSES.includes(values.finding_class)) throw new Error(`message "qa_failed" has an unknown finding_class "${values.finding_class}"`);
  if (values.finding_class === 'fixable') return '';
  const skipped = values.retries_skipped === true;
  const what = {
    input: es ? 'algo que el agente de desarrollo no puede aportar: un insumo del que depende el issue' : 'something the developer agent cannot supply: an input that the issue depends on',
    spec: es ? 'una decisión que la especificación no toma' : 'a decision that the specification does not make',
    policy: es ? 'algo que una corrida sin supervisión no puede hacer, como una ruta protegida o una dependencia que el issue no permitió' : 'something an unattended run may not do, such as a protected path or a dependency the issue did not allow',
  }[values.finding_class];
  if (es) return `Qué tipo de hallazgo: necesita ${what}${skipped ? ', así que se omitieron los reintentos' : ''}.`;
  return `What kind of finding: it needs ${what}${skipped ? ', so the retries were skipped' : ''}.`;
}

// Two lenses asked for fixes that cannot both be met (see scripts/lib/qa-aggregate.mjs): both lenses and both findings, quoted.
// The four values come together or not at all.
const CONTRADICTION_KEYS = ['contradiction_first_lens', 'contradiction_first_finding', 'contradiction_then_lens', 'contradiction_then_finding'];
function contradicted(values) {
  const given = CONTRADICTION_KEYS.filter((k) => present(values[k]));
  if (given.length === 0) return false;
  if (given.length !== CONTRADICTION_KEYS.length) throw new Error(`message "qa_failed" needs all of ${CONTRADICTION_KEYS.join(', ')} or none`);
  return true;
}
const quoteOf = (text) => `“${String(text).replace(/\s+/g, ' ').trim().slice(0, 300)}”`;
function contradictionLine(values, es) {
  if (!contradicted(values)) return '';
  const a = values.contradiction_first_lens;
  const b = values.contradiction_then_lens;
  return es
    ? `Los hallazgos se contradicen: el lente ${a} pidió ${quoteOf(values.contradiction_first_finding)} y, hecho eso, el lente ${b} lo rechazó con ${quoteOf(values.contradiction_then_finding)}. Un reintento no puede cumplir las dos cosas.`
    : `The findings contradict each other: the ${a} lens asked for ${quoteOf(values.contradiction_first_finding)} and, once that was done, the ${b} lens rejected it with ${quoteOf(values.contradiction_then_finding)}. A retry cannot meet both.`;
}

// The comments of a run that ended without telling anyone. They were written inline in the go workflow, which is why a repository
// with `language: es` got English: they now come from here. The labels and commands in the text are the same in both languages.
const RETRY = '`relevo:qa-failed`';
const mention = (values) => (present(values.assignee) ? `@${values.assignee} ` : '');

function runFailedEarly(values, es) {
  return es
    ? `${mention(values)}La ejecución falló antes de poder decidir qué hacer (estado del job: ${values.job_status}), así que no se construyó nada. Lee el log para ver por qué: ${values.run}. Cuando la causa esté resuelta, quita ${RETRY} y pon \`relevo:ready\` otra vez.`
    : `${mention(values)}The run failed before it could decide what to do (job status: ${values.job_status}), so nothing was built. Read the log to see why: ${values.run}. When the cause is fixed, remove ${RETRY} and apply \`relevo:ready\` again.`;
}

// What the rescue step did with the work, for the situations where the work was not kept.
function keptNote(values, es) {
  const detail = present(values.rescue_detail) ? shorten(values.rescue_detail) : '';
  const branch = values.rescue_branch;
  if (values.rescue_state === 'unsafe') return es ? ` El trabajo hecho antes de detenerse no se guardó: ${detail}` : ` The work done before the stop was not kept: ${detail}`;
  if (values.rescue_state === 'not_pushed') return es ? ` El trabajo hecho antes de detenerse no se pudo subir: ${detail}` : ` The work done before the stop could not be pushed: ${detail}`;
  if (values.rescue_state === 'existing') return es ? ` La rama \`${branch}\` está en el remoto con commits que esta ejecución no tiene, así que no se tocó.` : ` The branch \`${branch}\` is on the remote with commits this run does not have, so it was not touched.`;
  return '';
}

const SITUATIONS = ['kept', 'usage_limit', 'usage_limit_stopped', 'no_result'];

function runNoOutcome(values, es) {
  if (!SITUATIONS.includes(values.situation)) throw new Error(`message "run_no_outcome" has an unknown situation "${values.situation}"`);
  const usageLimit = values.usage_limit === true || values.usage_limit === 'true';
  if (values.situation === 'kept') {
    if (!present(values.rescue_branch)) throw new Error('message "run_no_outcome" needs "rescue_branch" when the work was kept');
    let why = es ? 'el runner la cortó, o el job se canceló o agotó su tiempo' : 'the runner cut it, or the job was cancelled or timed out';
    if (values.cut === 'turns') why = es ? 'el runner la detuvo en su límite de turnos (--max-turns)' : 'the runner stopped it at its turn limit (--max-turns)';
    if (values.cut === 'cost') why = es ? 'el runner la detuvo en su límite de costo (--max-budget-usd)' : 'the runner stopped it at its cost limit (--max-budget-usd)';
    if (usageLimit) why = es ? 'se alcanzó el límite de uso (o el crédito) de la cuenta del modelo' : 'the usage limit (or the credit) of the model account was reached';
    // The work of a run that was not on the branch of the issue is on a branch of its own: it is not the branch fix reads.
    const own = String(values.rescue_branch).startsWith('rescue/');
    // On the branch of the issue a later run resumes (resume-check): from the last checkpoint, or from the work kept at the stop.
    // `checkpoints` is optional: the report says what it knows and never "from the start" there.
    const saved = Number(values.checkpoints);
    const resume = present(values.checkpoints) && Number.isInteger(saved) && saved >= 1
      ? { en: `resume from the last checkpoint (${saved} saved) and build only the pending tasks`, es: `reanudar desde el último checkpoint (${saved} ${saved === 1 ? 'guardado' : 'guardados'}) y construir solo las tareas pendientes` }
      : present(values.checkpoints) && saved === 0
        ? { en: 'resume from the work kept on the branch (no checkpoint was saved yet)', es: 'reanudar desde el trabajo guardado en la rama (todavía no hay ningún checkpoint)' }
        : { en: 'resume from the last point saved on the branch', es: 'reanudar desde el último punto guardado en la rama' };
    const next = own
      ? (es ? ' La ejecución no estaba en la rama del issue, así que el trabajo está en una rama aparte: cámbiate a ella y revísalo, o quita `relevo:qa-failed` y pon `relevo:ready` otra vez para construir desde el principio:' : ' The run was not on the branch of the issue, so the work is on a branch of its own: check it out and review it, or remove `relevo:qa-failed` and apply `relevo:ready` again to build from the start:')
      : (es ? ` Ejecuta \`/relevo:fix ${values.issue}\` para verificarlo y continuar, o quita \`relevo:qa-failed\` y pon \`relevo:ready\` otra vez para ${resume.es}. Si el texto del issue cambió o una persona hizo un commit en la rama, la ejecución se detiene con \`branch already exists\`; borra la rama remota para empezar de cero:` : ` Run \`/relevo:fix ${values.issue}\` to verify it and continue, or remove \`relevo:qa-failed\` and apply \`relevo:ready\` again to ${resume.en}. If the text of the issue changed or a person committed to the branch, the run stops with \`branch already exists\`; delete the remote branch to start over:`);
    return es
      ? `${mention(values)}La ejecución se detuvo antes de terminar (${why}). El trabajo hecho antes de detenerse se guardó en la rama \`${values.rescue_branch}\` como un commit de trabajo en curso.${next} ${values.run}`
      : `${mention(values)}The run stopped before it finished (${why}). The work done before the stop was kept on the branch \`${values.rescue_branch}\` as a work-in-progress commit.${next} ${values.run}`;
  }
  const kept = keptNote(values, es);
  // The retries after a usage limit were used up: the issue is not queued again and a person is asked.
  if (values.situation === 'usage_limit_stopped') {
    const max = present(values.max) ? values.max : 3;
    const keptBranch = values.rescue_state === 'kept' && present(values.rescue_branch)
      ? (es ? ` El trabajo hecho está en la rama \`${values.rescue_branch}\`: \`/relevo:fix ${values.issue}\` continúa desde ahí.` : ` The work done is on the branch \`${values.rescue_branch}\`: \`/relevo:fix ${values.issue}\` continues from it.`)
      : kept;
    return es
      ? `${mention(values)}La ejecución volvió a detenerse por el límite de uso (o el crédito) de la cuenta del modelo, tras ${max} reintentos automáticos. Los reintentos se detuvieron aquí para no gastar la cuota que esperan. El código no tiene ningún problema: cuando la cuota esté disponible, quita ${RETRY} y pon \`relevo:ready\` otra vez, o constrúyelo en tu máquina con \`/relevo:go ${values.issue} --local\`. ${values.run}${keptBranch}`
      : `${mention(values)}The run stopped at the usage limit (or the credit) of the model account again, after ${max} automatic retries. The retries stopped here so that they do not use the quota they wait for. Nothing is wrong with the code: when the quota is back, remove ${RETRY} and apply \`relevo:ready\` again, or build it on your machine with \`/relevo:go ${values.issue} --local\`. ${values.run}${keptBranch}`;
  }
  // A usage limit, a quota or an empty credit balance is not a failure of the code: say so.
  if (values.situation === 'usage_limit') {
    return es
      ? `${mention(values)}La ejecución se detuvo porque se alcanzó el límite de uso (o el crédito) de la cuenta del modelo, así que no se construyó nada. El código no tiene ningún problema. Vuelve a poner \`relevo:ready\` al issue más tarde, después de quitar \`relevo:qa-failed\`: ${values.run}${kept}`
      : `${mention(values)}The run stopped because the usage limit (or the credit) of the model account was reached, so nothing was built. Nothing is wrong with the code. Label the issue \`relevo:ready\` again later, after removing \`relevo:qa-failed\`: ${values.run}${kept}`;
  }
  if (!present(values.job_status)) throw new Error('message "run_no_outcome" needs "job_status" when the run ended without a result');
  const cutnote = values.cut === 'turns'
    ? (es ? ' El runner la detuvo en su límite de turnos (--max-turns).' : ' The runner stopped it at its turn limit (--max-turns).')
    : values.cut === 'cost'
      ? (es ? ' El runner la detuvo en su límite de costo (--max-budget-usd).' : ' The runner stopped it at its cost limit (--max-budget-usd).')
      : '';
  return es
    ? `${mention(values)}La ejecución terminó sin resultado (estado del job: ${values.job_status}), así que no se construyó ni se informó nada.${cutnote} Lee el log para ver por qué: ${values.run}. Cuando la causa esté resuelta, quita ${RETRY} y pon \`relevo:ready\` otra vez.${kept}`
    : `${mention(values)}The run ended without a result (job status: ${values.job_status}), so nothing was built or reported.${cutnote} Read the log to see why: ${values.run}. When the cause is fixed, remove ${RETRY} and apply \`relevo:ready\` again.${kept}`;
}

// The comment of an issue that goes back to the queue after a usage limit. `at` is an ISO time: the log's reset time plus a minute
// (reason `reset`) or a back-off (reason `backoff`), which the comment says is a guess. The work kept on the branch is named.
function usageLimitRetry(values, es) {
  const when = Date.parse(values.at);
  if (!Number.isFinite(when)) throw new Error('message "usage_limit_retry" needs "at" to be an ISO time');
  const at = formatUtc(when);
  if (!Number.isInteger(Number(values.attempt)) || !['reset', 'backoff'].includes(values.reason)) throw new Error('message "usage_limit_retry" needs a whole "attempt" and a "reason" of reset or backoff');
  // The marker is built here from the checked fields, never taken from the data. Its format is the one of limit-retry.mjs.
  values.marker = `<!-- relevo:retry ${JSON.stringify({ at: new Date(when).toISOString(), attempt: Number(values.attempt), reason: values.reason })} -->`;
  const why = values.reason === 'reset'
    ? (es ? `La cuenta recupera su cuota después de ${at}, según el log de la ejecución.` : `The quota of the account resets at ${at}, according to the log of the run.`)
    : (es ? `El log de la ejecución no dice cuándo se restablece la cuota, así que el reintento es después de ${at}: es una espera creciente (30 minutos, 2 horas, 5 horas), no una predicción.` : `The log of the run does not say when the quota resets, so the retry is after ${at}: it is a growing wait (30 minutes, 2 hours, 5 hours), not a prediction.`);
  const keptBranch = values.rescue_state === 'kept' && present(values.rescue_branch)
    ? (es ? ` El trabajo hecho antes de detenerse está en la rama \`${values.rescue_branch}\` y el reintento continúa desde ahí.` : ` The work done before the stop is on the branch \`${values.rescue_branch}\` and the retry continues from it.`)
    : '';
  return es
    ? `${mention(values)}La ejecución se detuvo porque se alcanzó el límite de uso (o el crédito) de la cuenta del modelo. El código no tiene ningún problema. El issue volvió a la cola y se reintenta solo (reintento ${values.attempt} de ${values.max}). ${why} La cola lo mira cada 30 minutos, así que puede empezar un poco después.${keptBranch} ${values.run}`
    : `${mention(values)}The run stopped because the usage limit (or the credit) of the model account was reached. Nothing is wrong with the code. The issue is back in the queue and retries by itself (retry ${values.attempt} of ${values.max}). ${why} The queue looks every 30 minutes, so it can start a little later.${keptBranch} ${values.run}`;
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
  if (kind === 'run_progress') {
    const labels = es
      ? { planning: 'planificación', specification: 'especificación', development: 'desarrollo', qa: 'QA', delivery: 'entrega' }
      : { planning: 'planning', specification: 'specification', development: 'development', qa: 'QA', delivery: 'delivery' };
    values.phase_label = labels[values.phase] ?? values.phase;
    const of = present(values.of) ? ` ${es ? 'de' : 'of'} ${values.of}` : '';
    values.attempt_suffix = present(values.attempt) ? ` (${es ? 'intento' : 'attempt'} ${values.attempt}${of})` : '';
  }
  if (kind === 'run_progress_closed') {
    const after = present(values.minutes) ? (es ? ` tras ${values.minutes} min` : ` after ${values.minutes} min`) : '';
    const none = values.outcome === 'none';
    values.summary_line = es
      ? `La construcción de Relevo terminó${none ? ' sin resultado' : ''}${after}. ${none ? 'El motivo está' : 'El resultado está'} en el último comentario de este issue.`
      : `The Relevo build ended${none ? ' without an outcome' : ''}${after}. ${none ? 'The reason is' : 'The result is'} in the latest comment of this issue.`;
  }
  if (kind === 'built' && present(values.issue_hash)) values.issue_hash_short = shortHash(values.issue_hash);
  // Advisory notes of the QA lenses: how many, the lens of the first three, and all of them in a hidden marker for the review.
  if (kind === 'built' && Array.isArray(values.qa_notes) && values.qa_notes.length > 0) {
    const notes = values.qa_notes.filter((n) => n && present(n.lens) && present(n.text)).map((n) => ({ lens: String(n.lens), text: String(n.text).replace(/\s+/g, ' ').trim() }));
    if (notes.length > 0) {
      // No markup in the visible line: a note is text, never HTML or the end of a comment.
      const short = (t) => { const c = t.replace(/[<>]/g, ''); return c.length > 90 ? `${c.slice(0, 89).trimEnd()}…` : c; };
      const named = notes.slice(0, 3).map((n) => `${n.lens}: ${short(n.text)}`).join('; ');
      const more = notes.length > 3 ? (es ? ` y ${notes.length - 3} más` : ` and ${notes.length - 3} more`) : '';
      values.qa_notes_line = es
        ? `QA dejó ${notes.length} ${notes.length === 1 ? 'nota' : 'notas'} para ti (${named}${more}); están en el checklist.`
        : `QA left ${notes.length} advisory ${notes.length === 1 ? 'note' : 'notes'} for you (${named}${more}); they are in the checklist.`;
      // JSON that cannot close the comment: < and > are escaped.
      values.qa_notes_marker = `<!-- relevo:qa-notes ${JSON.stringify(notes).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')} -->`;
    }
  }
  // A wait for a file shared with another issue carries the hidden marker that dates the wait.
  if (kind === 'queued_shared_files') values.wait_marker = sharedWaitMarker(values.file, values.other);
  // An issue that started after the bound, sharing files with issues that were not merged yet, says which.
  if (kind === 'built' && Array.isArray(values.shared_files) && values.shared_files.length > 0) {
    const shared = values.shared_files.filter((s) => s && present(s.file) && present(s.issue)).map((s) => `${String(s.file).replace(/[`<>]/g, '')} (#${s.issue})`);
    if (shared.length > 0) {
      values.shared_files_line = es
        ? `Comparte archivos con issues que aún no se fusionaban cuando empezó: ${shared.join(', ')}. Puede haber conflictos al fusionar.`
        : `It shares files with issues that were not merged when it started: ${shared.join(', ')}. Expect conflicts when merging.`;
    }
  }
  // Urgent does not skip dependencies: an urgent issue that is blocked says so.
  if (kind === 'blocked_notice' && values.urgent === true) {
    values.urgent_note = es ? 'La etiqueta de urgente no salta las dependencias: empieza primero en la cola cuando se fusionen.' : 'The urgent label does not skip dependencies: it goes first in the queue once they are merged.';
  }

  // What the queue knows when an issue waits for a free agent. A figure the workflow could not read is written as unknown, never guessed.
  if (kind === 'queued_agents') {
    const unknown = es ? 'desconocido' : 'unknown';
    values.active_text = present(values.active) ? `${values.active}${present(values.active_issues) ? ` (${values.active_issues})` : ''}` : unknown;
    values.ahead_text = present(values.ahead) ? String(values.ahead) : unknown;
    values.typical_text = present(values.typical_minutes) && present(values.typical_samples)
      ? (es ? `unos ${values.typical_minutes} min (mediana de las últimas ${values.typical_samples} construcciones)` : `about ${values.typical_minutes} min (median of the last ${values.typical_samples} builds)`)
      : unknown;
  }
  if (kind === 'run_failed_early') values.body = runFailedEarly(values, es);
  if (kind === 'run_no_outcome') values.body = runNoOutcome(values, es);
  if (kind === 'usage_limit_retry') values.body = usageLimitRetry(values, es);

  // The next step comes from one table. needs-spec depends on why the issue came back, qa-failed on what the branch holds.
  if (STATE_OF[kind]) {
    const reason = kind === 'needs_spec' ? values.reason ?? 'missing' : kind === 'qa_failed' ? values.recovery ?? classReason(values) ?? policyStop(values)?.next ?? qaFailedReason(values) : kind === 'toolchain_missing' ? 'toolchain' : kind === 'installed_missing' ? 'installed' : null;
    const step = nextStep({ state: STATE_OF[kind], reason, issue: values.issue, language: language_ });
    if (!present(values.command) && step.command) values.command = step.command;
    if (kind === 'toolchain_missing' || kind === 'installed_missing') values.next_line = `${nextStepPrefix(language_)}: ${step.hint}.`;
    if (kind === 'needs_spec') values.next_line = `${nextStepPrefix(language_)}: ${step.command}: ${step.hint}.`;
    if (kind === 'qa_failed') {
      // For kept work the next step says what the command does and the other way forward; the others are the bare command.
      const kept = ['kept', 'input', 'spec', 'policy', 'protected'].includes(step.reason);
      values.next_line = step.command ? `${nextStepPrefix(language_)}: ${values.command ?? step.command}${kept ? ` (${step.hint})` : ''}` : `${nextStepPrefix(language_)}: ${step.hint}.`;
    }
  }
  if (kind === 'qa_failed') {
    values.class_line = classLine(values, es);
    values.contradiction_line = contradictionLine(values, es);
    const location = present(values.file) ? `${values.file}${present(values.line) ? `:${values.line}` : ''}` : '';
    values.location_suffix = location ? ` (${location})` : '';
    // `pushed: false` is the older way to say that the branch was not pushed because of a credential or a marker.
    const state = values.branch_state ?? (values.pushed === false ? 'unsafe' : 'pushed');
    if (!['pushed', 'unsafe', 'not_pushed', 'existing', 'kept'].includes(state)) throw new Error(`message "qa_failed" has an unknown branch_state "${state}"`);
    if (state === 'existing' && !present(values.recovery)) throw new Error('message "qa_failed" needs "recovery" when the branch already existed');
    // A run that stopped at a limit was not judged by QA: the text says so instead of saying that QA rejected it.
    const stoppedAtLimit = values.reason === 'run limit reached';
    values.headline = stopsNotQa(values) ? (es ? 'se detuvo ❌' : 'stopped ❌') : (es ? 'no pasó QA ❌' : 'failed QA ❌');
    const branchLines = {
      pushed: es
        ? `La rama ${values.branch} está subida; el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} is pushed; the state did not advance and no pull request was opened.`,
      unsafe: es
        ? `La rama ${values.branch} NO se subió (se encontró una posible credencial, un marcador temporal, una ruta protegida o un archivo restringido); el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} was NOT pushed (a possible credential, a temporary marker, a protected path or a restricted file was found); the state did not advance and no pull request was opened.`,
      not_pushed: es
        ? `La rama ${values.branch} no se subió; el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} was not pushed; the state did not advance and no pull request was opened.`,
      kept: stoppedAtLimit
        ? (es
          ? `La rama ${values.branch} tiene el trabajo hecho antes de detenerse${tasksInfo(values, es)}; se guardó como trabajo en curso para que no se pierda. El estado no avanzó y no se abrió ningún pull request.`
          : `The branch ${values.branch} holds the work done before the stop${tasksInfo(values, es)}; it was kept as work in progress so nothing is lost. The state did not advance and no pull request was opened.`)
        : (es
          ? `La rama ${values.branch} tiene el trabajo que QA no aprobó${tasksInfo(values, es)}; se guardó como trabajo en curso para que no se pierda. El estado no avanzó y no se abrió ningún pull request.`
          : `The branch ${values.branch} holds the work that QA did not approve${tasksInfo(values, es)}; it was kept as work in progress so nothing is lost. The state did not advance and no pull request was opened.`),
      existing: es
        ? `La rama ${values.branch} ya existía en el remoto, así que no se tocó; el estado no avanzó y no se abrió ningún pull request.`
        : `The branch ${values.branch} already existed on the remote, so it was not touched; the state did not advance and no pull request was opened.`,
    };
    values.branch_line = branchLines[state];
    values.reason_suffix = present(values.reason) ? ` (${values.reason})` : '';
    // When no finding could be corrected by the developer agent the retries were never run, so the line says that.
    // QA passed, but the base branch could not be integrated before the hand-off, or the checks failed once it was.
    const integration = {
      'conflict with the base branch': es
        ? 'QA aprobó, pero no se pudo fusionar la rama base en esta rama sin conflictos (el detalle está en el hallazgo). La rama se subió sin la fusión.'
        : 'QA passed, but the base branch could not be merged into this branch cleanly (the details are in the finding). The branch was pushed without the merge.',
      'automated validation failed after merging the base branch': es
        ? 'QA aprobó, pero tras fusionar la rama base las comprobaciones automáticas fallaron. La rama se subió con la fusión hecha.'
        : 'QA passed, but the automated checks failed after the base branch was merged. The branch was pushed with the merge done.',
    }[values.reason];
    values.happened = integration ?? (stoppedAtLimit
      ? (es ? `La ejecución se detuvo en un límite antes de terminar${values.reason_suffix}.` : `The run stopped at a limit before it finished${values.reason_suffix}.`)
      : policyStop(values)
      ? `${es ? 'La ejecución se detuvo' : 'The run stopped'}${values.reason_suffix}: ${policyStop(values)[es ? 'es' : 'en']}.`
      : stopsNotQa(values)
      ? (es ? `La ejecución se detuvo${values.reason_suffix}. QA no rechazó el trabajo.` : `The run stopped${values.reason_suffix}. QA did not reject the work.`)
      : contradicted(values)
      ? (es ? `QA la rechazó y los hallazgos de dos lentes se contradicen, así que no se hicieron más reintentos${values.reason_suffix}.` : `QA rejected it and the findings of two lenses contradict each other, so there were no more retries${values.reason_suffix}.`)
      : values.retries_skipped === true
      ? (es ? 'QA la rechazó y ningún hallazgo lo puede corregir el agente de desarrollo, así que no se hicieron reintentos.' : 'QA rejected it and no finding can be corrected by the developer agent, so there were no retries.')
      : (es ? `QA la rechazó otra vez tras los reintentos${values.reason_suffix}.` : `QA still rejected it after the retries${values.reason_suffix}.`));
  }

  // A language that lacks a kind uses the English text; tests/messages-language.test.mjs fails the build of Relevo before that happens.
  const lines = CATALOG[language_]?.[kind] ?? CATALOG.en[kind];
  const out = [];
  lines.forEach((template) => {
    const names = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const optionalEmpty = names.some((n) => !present(values[n]) && !n.endsWith('_suffix'));
    if (names.length > 0 && optionalEmpty) return;
    out.push(template.replace(/\{\{(\w+)\}\}/g, (_, n) => (n === 'checklist' || n === 'qa_notes_marker' || n === 'body' || n === 'wait_marker' ? String(values[n] ?? '') : shorten(values[n] ?? ''))));
  });

  // Collapse repeated blank lines and trim the ends.
  const collapsed = out.filter((l, i) => !(l === '' && (out[i - 1] === '' || i === 0)));
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === '') collapsed.pop();
  return collapsed.join('\n');
}
