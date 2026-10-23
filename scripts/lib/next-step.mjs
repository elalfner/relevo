// The next step of an issue, from one table, in the language of the repository.
// Implements "The next step comes from one source" of the issue-lifecycle specification.
//
// Every message and report that tells a person what to do next asks this table, so the command, who runs it and
// the short hint cannot drift apart. A test checks that every lifecycle state has an entry.

import { pickLanguage } from './language.mjs';

// command: the command to run (`{n}` is the issue number), or null when nobody has to act yet.
// who:     the role that runs it; the words for each role are in WHO.
const TABLE = {
  ready: {
    command: null,
    who: 'nobody',
    hint: { en: 'the agent starts it by itself', es: 'el agente la empieza solo' },
  },
  queued: {
    command: null,
    who: 'nobody',
    hint: { en: 'it starts when the assignee has capacity', es: 'empieza cuando la persona asignada tenga capacidad' },
  },
  building: {
    command: null,
    who: 'nobody',
    hint: { en: 'the agent is building it', es: 'el agente la está construyendo' },
  },
  blocked: {
    command: null,
    who: 'nobody',
    hint: { en: 'it starts when the issues it depends on are merged', es: 'empieza cuando se fusionen los issues de los que depende' },
  },
  built: {
    command: '/relevo:review {n}',
    who: 'assignee',
    hint: { en: 'review it on a device', es: 'revísala en un dispositivo' },
  },
  'in-review': {
    command: '/relevo:review {n}',
    who: 'assignee',
    hint: { en: 'continue the review; if something fails, run /relevo:fix {n}', es: 'continúa la revisión; si algo falla, ejecuta /relevo:fix {n}' },
  },
  'pr-open': {
    command: '/relevo:ship {n}',
    who: 'approver',
    hint: { en: 'after someone other than the author approves the pull request on GitHub', es: 'cuando alguien que no sea el autor apruebe el pull request en GitHub' },
  },
  'needs-spec': {
    // The reason decides what the spec writer has to do.
    missing: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: { en: 'complete what is missing, then label it ready again', es: 'completa lo que falta y vuelve a ponerle ready' },
    },
    ambiguous: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: {
        en: 'decide the open question (run /relevo:think #{n} first if you need to explore it), then label it ready again',
        es: 'decide la pregunta abierta (ejecuta antes /relevo:think #{n} si necesitas explorarla) y vuelve a ponerle ready',
      },
    },
  },
  'qa-failed': {
    // The recovery depends on what is on the branch.
    fix: {
      command: '/relevo:fix {n}',
      who: 'assignee',
      hint: { en: 'describe what QA found', es: 'describe lo que encontró QA' },
    },
    // The branch holds the work that QA rejected, committed as work in progress: correct it, or rethink the issue.
    kept: {
      command: '/relevo:fix {n}',
      who: 'assignee',
      hint: {
        en: 'it checks and corrects the work that was kept; to rethink the issue instead, use /relevo:think and then /relevo:issue {n}',
        es: 'verifica y corrige el trabajo que se guardó; para repensar el issue, usa /relevo:think y luego /relevo:issue {n}',
      },
    },
    // Nothing was built: the runner lacks a tool of the profile, and the fix is in the workflow, not a command.
    toolchain: {
      command: null,
      who: 'assignee',
      hint: {
        en: 'install the toolchain in the build job of relevo-go.yml (the template has the step for Flutter and Laravel, and /relevo:doctor checks it), then remove relevo:qa-failed and label the issue relevo:ready again',
        es: 'instala el toolchain en el job de build de relevo-go.yml (la plantilla trae el paso para Flutter y Laravel, y /relevo:doctor lo comprueba), luego quita relevo:qa-failed y vuelve a poner relevo:ready al issue',
      },
    },
    'delete-branch': {
      command: null,
      who: 'assignee',
      hint: {
        en: 'the branch holds only the specification: delete the remote branch and label the issue ready again',
        es: 'la rama solo tiene la especificación: borra la rama remota y vuelve a ponerle ready al issue',
      },
    },
  },
  'changes-requested': {
    command: '/relevo:fix {n}',
    who: 'author',
    hint: { en: 'fix what the reviewer asked for', es: 'corrige lo que pidió quien revisa' },
  },
  'needs-reviewer': {
    command: null,
    who: 'spec_writer',
    hint: { en: 'assign a reviewer or ask someone to take it', es: 'asigna a alguien que revise o pide que alguien lo tome' },
  },
  // The ship workflow is merging it; when it stops, its comment says why and the issue is back on pr-open.
  ship: {
    command: null,
    who: 'nobody',
    hint: { en: 'the ship workflow is merging it', es: 'el workflow de ship lo está fusionando' },
  },
};

const WHO = {
  en: { assignee: 'the assignee', spec_writer: 'the spec writer', author: 'the author', approver: 'whoever merges', nobody: '' },
  es: { assignee: 'la persona asignada', spec_writer: 'quien escribe las specs', author: 'el autor', approver: 'quien fusiona', nobody: '' },
};

const PREFIX = {
  en: { act: 'Your next step', wait: 'Nothing to do now' },
  es: { act: 'Tu siguiente paso', wait: 'Nada que hacer ahora' },
};

/** The states that have an entry: every lifecycle state. */
export const NEXT_STEP_STATES = Object.keys(TABLE);

/** Reasons for the states whose next step depends on one. */
export const NEXT_STEP_REASONS = {
  'needs-spec': ['missing', 'ambiguous'],
  'qa-failed': ['fix', 'kept', 'toolchain', 'delete-branch'],
};

const fill = (text, issue) => String(text).replaceAll('{n}', String(issue ?? ''));

/**
 * The next step for an issue in `state`.
 * `reason` picks the variant of `needs-spec` (`missing` by default, or `ambiguous`) and of `qa-failed`
 * (`fix` by default, `kept` when the branch holds the work that QA rejected, or `delete-branch` when the branch holds only the specification).
 * Returns { state, reason, command, who, hint, line }; `command` is null when nobody has to act yet.
 */
export function nextStep({ state, reason = null, issue = null, language = 'en' } = {}) {
  const entry = TABLE[state];
  if (!entry) throw new Error(`unknown state "${state}": expected one of ${NEXT_STEP_STATES.join(', ')}`);
  const variants = NEXT_STEP_REASONS[state];
  let chosen = entry;
  let used = null;
  if (variants) {
    used = reason ?? variants[0];
    chosen = entry[used];
    if (!chosen) throw new Error(`unknown reason "${reason}" for "${state}": expected one of ${variants.join(', ')}`);
  }
  const lang = pickLanguage(language);
  const needsIssue = [chosen.command, chosen.hint.en].some((t) => String(t).includes('{n}'));
  if (needsIssue && (issue === null || issue === undefined || issue === '')) throw new Error(`the next step of "${state}" needs the issue number`);

  const command = chosen.command === null ? null : fill(chosen.command, issue);
  const hint = fill(chosen.hint[lang], issue);
  const who = WHO[lang][chosen.who];
  const person = who ? ` (${who})` : '';
  const line = command === null
    ? `${chosen.who === 'nobody' ? PREFIX[lang].wait : PREFIX[lang].act}: ${hint}${chosen.who === 'nobody' ? '' : person}.`
    : `${PREFIX[lang].act}: ${command}${person}: ${hint}.`;
  return { state, reason: used, command, who: chosen.who, hint, line };
}

/** The words that open a next-step line in a language ("Your next step"), for messages that build their own line. */
export const nextStepPrefix = (language) => PREFIX[pickLanguage(language)].act;
