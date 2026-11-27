// The next step of an issue, from one table, in the language of the repository.
// Implements "The next step comes from one source" of the issue-lifecycle specification.
//
// Every message and report that tells a person what to do next asks this table, so the command, who runs it and
// the short hint cannot drift apart. A test checks that every lifecycle state has an entry.

import { LABELS, resolveLabelNames } from './labels.mjs';
import { pickLanguage } from './language.mjs';

// command: the command to run (`{n}` is the issue number), or null when nobody has to act yet.
// who:     the role that runs it; the words for each role are in WHO.
const TABLE = {
  // Not a label: an open issue with no lifecycle label.
  draft: {
    command: '/relevo:issue {n}',
    who: 'spec_writer',
    hint: { en: 'write it up; if the idea needs exploring, run /relevo:think #{n} first', es: 'redáctalo; si la idea necesita explorarse, ejecuta antes /relevo:think #{n}' },
  },
  // The approval starts nothing: someone decides where it is built.
  ready: {
    command: '/relevo:go {n}',
    who: 'assignee',
    hint: { en: 'it is approved and nothing starts by itself: build it on your machine, or apply relevo:go so that the cloud builds it', es: 'está aprobada y nada empieza sola: constrúyela en tu máquina, o ponle relevo:go para que la construya la nube' },
  },
  queued: {
    command: null,
    who: 'nobody',
    hint: { en: 'it starts when the assignee has capacity, an agent is free, or the issue that shares a file with it is merged', es: 'empieza cuando la persona asignada tenga capacidad, haya un agente libre o se fusione el issue que comparte un archivo con él' },
  },
  building: {
    agent: {
      command: null,
      who: 'nobody',
      hint: { en: 'the agent is building it', es: 'el agente la está construyendo' },
    },
    // Nobody is building it and the issue stays `building`. The `requeue` job of relevo-go.yml writes this same line with no
    // script, and a test compares them. No command: the labels come first.
    'lost-runner': {
      command: null,
      who: 'assignee',
      hint: {
        en: 'read the run, then remove relevo:building and apply relevo:ready again (it starts nothing), then apply relevo:go or run /relevo:go {n}',
        es: 'lee la ejecución, luego quita relevo:building y vuelve a poner relevo:ready (no inicia nada), luego pon relevo:go o ejecuta /relevo:go {n}',
      },
    },
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
    continue: {
      command: '/relevo:review {n}',
      who: 'assignee',
      hint: { en: 'continue the review; if something fails, run /relevo:fix {n}', es: 'continúa la revisión; si algo falla, ejecuta /relevo:fix {n}' },
    },
    // A files project whose review passed: no pull request is opened and no label moves, so the delivery is local.
    local: {
      command: '/relevo:ship {n}',
      who: 'person',
      hint: { en: 'the review passed: deliver it on this machine', es: 'la revisión pasó: entrégala en esta máquina' },
    },
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
      hint: { en: 'complete what is missing, then approve it with ready again and request the build: relevo:go, or /relevo:go {n} on your machine', es: 'completa lo que falta, luego vuelve a aprobarla con ready y pide el build: relevo:go, o /relevo:go {n} en tu máquina' },
    },
    ambiguous: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: {
        en: 'decide the open question (run /relevo:think #{n} first if you need to explore it), then approve it with ready again and request the build: relevo:go, or /relevo:go {n} on your machine',
        es: 'decide la pregunta abierta (ejecuta antes /relevo:think #{n} si necesitas explorarla), luego vuelve a aprobarla con ready y pide el build: relevo:go, o /relevo:go {n} en tu máquina',
      },
    },
    // The check before the build found that something the issue depends on is not available.
    inputs: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: {
        en: 'an input of the issue is not available: provide it, or declare it as manual in the External inputs section, then approve it with ready again and request the build: relevo:go, or /relevo:go {n} on your machine',
        es: 'un insumo del issue no está disponible: aportalo o decláralo como manual en la sección External inputs, luego vuelve a aprobarla con ready y pide el build: relevo:go, o /relevo:go {n} en tu máquina',
      },
    },
    // The check before the build found a task that an unattended run may not do.
    policy: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: {
        en: 'a task needs something an unattended run may not do: a person makes that edit (workflows, relevo.yml, skills and the project rules are never changed by a run) or the issue changes so that no task needs it; only a dependency manifest can be allowed, with an Allow-paths: line; then approve it with ready again and request the build: relevo:go, or /relevo:go {n} on your machine',
        es: 'una tarea necesita algo que una corrida sin supervisión no puede hacer: una persona hace esa edición (los workflows, relevo.yml, las skills y las reglas del proyecto no los cambia ninguna corrida) o el issue cambia para que ninguna tarea la necesite; solo un manifiesto de dependencias se puede permitir, con una línea Allow-paths:; luego vuelve a aprobarla con ready y pide el build: relevo:go, o /relevo:go {n} en tu máquina',
      },
    },
    // The check before the build found that the issue contradicts the project rules or its own scenarios.
    conflict: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: {
        en: 'the issue contradicts a project rule or its own scenarios: decide which one wins, change the issue or record a decision with an "Overrides: <file>:<line>" line, then approve it with ready again and request the build: relevo:go, or /relevo:go {n} on your machine',
        es: 'el issue contradice una regla del proyecto o sus propios escenarios: decide cuál gana, cambia el issue o registra una decisión con una línea "Overrides: <archivo>:<línea>", luego vuelve a aprobarla con ready y pide el build: relevo:go, o /relevo:go {n} en tu máquina',
      },
    },
  },
  'build-failed': {
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
    // The build stopped before it finished (a limit, a cut) and its work was kept: nothing was rejected, so the build is continued, not corrected.
    resume: {
      command: '/relevo:go {n} --resume',
      who: 'assignee',
      hint: {
        en: 'it continues the build from where it stopped and builds only the pending tasks (in the cloud, apply relevo:go); /relevo:fix {n} is for work that QA rejected',
        es: 'continúa el build desde donde se detuvo y construye solo las tareas pendientes (en la nube, ponle relevo:go); /relevo:fix {n} es para el trabajo que QA rechazó',
      },
    },
    // A resume finished no task and stopped at a limit again: resuming once more meets the same wall, so a limit or the issue changes first.
    stalled: {
      command: null,
      who: 'assignee',
      hint: {
        en: 'the last resume finished no task, so resuming again will not help: raise limits.run_max_turns, limits.run_max_minutes or limits.run_max_cost in relevo.yml, or split the issue, and then resume it',
        es: 'la última reanudación no terminó ninguna tarea, así que reanudar de nuevo no ayudará: sube limits.run_max_turns, limits.run_max_minutes o limits.run_max_cost en relevo.yml, o parte el issue, y luego reanúdalo',
      },
    },
    // Nothing was built: the runner lacks a tool of the profile, and the fix is in the workflow, not a command.
    toolchain: {
      command: null,
      who: 'assignee',
      hint: {
        en: 'install the toolchain in the build job of relevo-go.yml (the template has the step for Flutter and Laravel, and /relevo:doctor checks it), then apply relevo:go so that the cloud builds it again, or run /relevo:go {n} --retry on your machine',
        es: 'instala el toolchain en el job de build de relevo-go.yml (la plantilla trae el paso para Flutter y Laravel, y /relevo:doctor lo comprueba), luego ponle relevo:go para que la nube la construya de nuevo, o ejecuta /relevo:go {n} --retry en tu máquina',
      },
    },
    // QA rejected and no finding can be corrected by the developer agent: the retries were skipped. The work that
    // was kept stays on the branch, and what the finding needs decides the next step.
    input: {
      command: '/relevo:fix {n}',
      who: 'assignee',
      hint: {
        en: 'supply what is missing (a key, a file or access), then it checks and corrects the work that was kept; to rethink the issue instead, use /relevo:think and then /relevo:issue {n}',
        es: 'aporta lo que falta (una clave, un archivo o un acceso) y luego verifica y corrige el trabajo que se guardó; para repensar el issue, usa /relevo:think y luego /relevo:issue {n}',
      },
    },
    spec: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: {
        en: 'decide what the specification leaves open (run /relevo:think #{n} first if you need to explore it); the work that was kept stays on the branch, and /relevo:fix {n} then corrects it',
        es: 'decide lo que la especificación deja abierto (ejecuta antes /relevo:think #{n} si necesitas explorarlo); el trabajo que se guardó sigue en la rama y /relevo:fix {n} lo corrige después',
      },
    },
    policy: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: {
        en: 'the work needs something an unattended run may not do: a person makes that edit or the issue changes so that no task needs it, and only a dependency manifest can be allowed, with an Allow-paths: line; the work that was kept stays on the branch, and /relevo:fix {n} then corrects it',
        es: 'el trabajo necesita algo que una corrida sin supervisión no puede hacer: una persona hace esa edición o el issue cambia para que ninguna tarea la necesite, y solo un manifiesto de dependencias se puede permitir, con una línea Allow-paths:; el trabajo que se guardó sigue en la rama y /relevo:fix {n} lo corrige después',
      },
    },
    // The commit guard refused a protected path: QA never judged the work and nothing was pushed, so the issue has to change.
    protected: {
      command: '/relevo:issue {n}',
      who: 'spec_writer',
      hint: {
        en: 'an unattended run cannot edit that protected path and QA did not judge the work: a person makes the edit, or the issue changes so that no task needs it, then approve it with ready again and request the build: relevo:go, or /relevo:go {n} on your machine',
        es: 'una corrida sin supervisión no puede editar esa ruta protegida y QA no juzgó el trabajo: una persona hace la edición, o el issue cambia para que ninguna tarea la necesite, luego vuelve a aprobarla con ready y pide el build: relevo:go, o /relevo:go {n} en tu máquina',
      },
    },
    // Nothing was built: the dependencies of the platform were never installed, and the fix is in the workflow.
    installed: {
      command: null,
      who: 'assignee',
      hint: {
        en: 'enable the step that installs the dependencies in the build job of relevo-go.yml (/relevo:doctor checks it), then apply relevo:go so that the cloud builds it again, or run /relevo:go {n} --retry on your machine',
        es: 'activa el paso que instala las dependencias en el job de build de relevo-go.yml (/relevo:doctor lo comprueba), luego ponle relevo:go para que la nube la construya de nuevo, o ejecuta /relevo:go {n} --retry en tu máquina',
      },
    },
    'delete-branch': {
      command: null,
      who: 'assignee',
      hint: {
        en: 'the branch holds only the specification: delete the remote branch{delete}, then apply relevo:go so that the cloud builds it again, or run /relevo:go {n} --retry on your machine',
        es: 'la rama solo tiene la especificación: borra la rama remota{delete}, luego ponle relevo:go para que la nube la construya de nuevo, o ejecuta /relevo:go {n} --retry en tu máquina',
      },
    },
    // A checkpoint was refused after earlier ones were pushed: the branch holds code, so it is corrected, not built again.
    partial: {
      command: '/relevo:fix {n}',
      who: 'assignee',
      hint: {
        en: 'the pushed groups are on the branch and the refused one is not: allow the path in the issue if it is right, then it checks and corrects the work that was kept (no description of the defect is needed)',
        es: 'los grupos subidos están en la rama y el rechazado no: permite la ruta en el issue si es correcta, y luego verifica y corrige el trabajo que se guardó (no hace falta describir el defecto)',
      },
    },
    // Nothing was pushed, so there is no branch to correct: the cause is resolved first, then the issue is built again.
    rebuild: {
      command: null,
      who: 'assignee',
      hint: {
        en: 'nothing was pushed, so there is no branch to fix: resolve the cause named above, then build it again on your machine with /relevo:go {n} --retry, or apply relevo:go so that the cloud builds it again',
        es: 'no se subió nada, así que no hay rama que corregir: resuelve la causa indicada arriba, luego constrúyelo de nuevo en tu máquina con /relevo:go {n} --retry, o ponle relevo:go para que la nube lo construya de nuevo',
      },
    },
    // Nothing was built: the base branch versions a file on the restricted list, which no command of Relevo can fix.
    restricted: {
      command: null,
      who: 'assignee',
      hint: {
        en: 'a restricted file is versioned on the base branch: rotate any secret in it, remove it from the repository (git rm --cached) and keep it ignored, merge that into the base branch, then apply relevo:go so that the cloud builds it again, or run /relevo:go {n} --retry on your machine',
        es: 'un archivo restringido está versionado en la rama base: rota cualquier secreto que tenga, quítalo del repositorio (git rm --cached) y mantenlo ignorado, fusiona eso en la rama base, luego ponle relevo:go para que la nube la construya de nuevo, o ejecuta /relevo:go {n} --retry en tu máquina',
      },
    },
    // Nothing was built: the OpenSpec schema of the change is not one Relevo reads, which no command of Relevo can change.
    schema: {
      command: null,
      who: 'assignee',
      hint: {
        en: 'the OpenSpec schema is not spec-driven, which is the one Relevo builds with: set `schema: spec-driven` in openspec/config.yaml (and in the .openspec.yaml of the change if it names another), merge that into the base branch, then apply relevo:go so that the cloud builds it again, or run /relevo:go {n} --retry on your machine',
        es: 'el esquema de OpenSpec no es spec-driven, que es el que usa Relevo para construir: pon `schema: spec-driven` en openspec/config.yaml (y en el .openspec.yaml del cambio si nombra otro), fusiona eso en la rama base, luego ponle relevo:go para que la nube la construya de nuevo, o ejecuta /relevo:go {n} --retry en tu máquina',
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
  // A request next to the state, not a state: the state it travels with decides the next step.
  urgent: {
    command: null,
    who: 'nobody',
    hint: { en: 'it starts before the others; the state it is in decides the next step', es: 'empieza antes que las demás; el estado en que está decide el siguiente paso' },
  },
  // A request next to `ready`, not a state: the cloud decides about the issue and removes it.
  go: {
    command: null,
    who: 'nobody',
    hint: { en: 'the cloud was asked to build it and removes the label when it decides', es: 'se pidió a la nube que lo construya y quita la etiqueta cuando decide' },
  },
  // A mark next to `building`, not a state: the build runs on a person's machine.
  local: {
    command: null,
    who: 'nobody',
    hint: { en: 'it is being built on a machine', es: 'se está construyendo en una máquina' },
  },
  // Not a label: the issue was delivered and closed, and every Relevo label was removed.
  closed: {
    command: null,
    who: 'nobody',
    hint: { en: 'it was delivered; promoting the base branch to the release branch is a separate pull request', es: 'se entregó; promover la rama base a la rama de release es un pull request aparte' },
  },
};

// The step after `init`. It is not the state of an issue, so it is not an entry of the table.
const AFTER_INIT = {
  en: 'after the steps above, run /relevo:think to explore an idea, and then /relevo:issue to write the issue',
  es: 'después de los pasos anteriores, ejecuta /relevo:think para explorar una idea y luego /relevo:issue para escribir el issue',
};

const WHO = {
  en: { assignee: 'the assignee', spec_writer: 'the spec writer', author: 'the author', approver: 'whoever merges', person: 'the person', nobody: '' },
  es: { assignee: 'la persona asignada', spec_writer: 'quien escribe las specs', author: 'el autor', approver: 'quien fusiona', person: 'la persona', nobody: '' },
};

const PREFIX = {
  en: { act: 'Your next step', wait: 'Nothing to do now' },
  es: { act: 'Tu siguiente paso', wait: 'Nada que hacer ahora' },
};

/** The states that have an entry: every lifecycle label, and `draft` and `closed`. */
export const NEXT_STEP_STATES = Object.keys(TABLE);

/** Reasons for the states whose next step depends on one. */
export const NEXT_STEP_REASONS = {
  building: ['agent', 'lost-runner'],
  'in-review': ['continue', 'local'],
  'needs-spec': ['missing', 'ambiguous', 'inputs', 'policy', 'conflict'],
  'build-failed': ['fix', 'kept', 'resume', 'stalled', 'toolchain', 'installed', 'input', 'spec', 'policy', 'protected', 'delete-branch', 'restricted', 'rebuild', 'partial', 'schema'],
};

// `{delete}` is the command that deletes the branch when the branch is known, and nothing otherwise.
const fill = (text, issue, branch = null) => String(text).replaceAll('{n}', String(issue ?? '')).replaceAll('{delete}', branch ? ` (\`git push origin --delete ${branch}\`)` : '');

/**
 * The next step for an issue in `state`.
 * `branch` (optional) names the branch, so that `delete-branch` gives the command that deletes it.
 * `reason` picks the variant of `building` (`agent` by default, or `lost-runner`), of `in-review` (`continue` by default, or `local`
 * for a files project whose review passed), of `needs-spec` (`missing` by default, `ambiguous`, `inputs`, `policy` or `conflict`) and of `build-failed`
 * (`fix` by default, `kept` when the branch holds the work that QA rejected, `input`, `spec` or `policy` when that work was rejected for a finding that the developer agent cannot correct, `installed` when the dependencies of the platform were never installed, `delete-branch` when the branch holds only the specification, `protected` when the commit guard refused a protected path, `restricted` when the base branch versions a restricted file, `rebuild` when nothing was pushed, `partial` when a checkpoint was refused after earlier ones were pushed, or `schema` when the OpenSpec schema of the change is not one Relevo reads).
 * Returns { state, reason, command, who, hint, line }; `command` is null when nobody has to act yet.
 */
export function nextStep({ state, reason = null, issue = null, language = 'en', branch = null } = {}) {
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
  const hint = fill(chosen.hint[lang], issue, branch);
  const who = WHO[lang][chosen.who];
  const person = who ? ` (${who})` : '';
  const line = command === null
    ? `${chosen.who === 'nobody' ? PREFIX[lang].wait : PREFIX[lang].act}: ${hint}${chosen.who === 'nobody' ? '' : person}.`
    : `${PREFIX[lang].act}: ${command}${person}: ${hint}.`;
  return { state, reason: used, command, who: chosen.who, hint, line };
}

// The states whose step depends on why the issue is there, which the labels do not say.
const FROM_COMMENT = {
  'needs-spec': 'spec_writer',
  'build-failed': 'assignee',
};

/**
 * The state that the labels of an open issue give, under their configured names: the lifecycle label, else `draft`.
 * `reviewer` is true when `needs-reviewer` travels next to it. A closed issue has no labels, so `closed` is never read here.
 */
export function stateOfLabels(labels = [], overrides = {}) {
  const names = resolveLabelNames(overrides);
  const found = LABELS.find((l) => (l.kind === 'state' || l.kind === 'exit') && labels.includes(names[l.key]));
  return { state: found?.key ?? 'draft', reviewer: labels.includes(names['needs-reviewer']) };
}

/**
 * The steps of an issue read from its labels: `{ state, steps }`, with a second step when `needs-reviewer` is on it.
 * A `needs-spec` or `build-failed` issue with no `reason` gets no command: a default would be a guess, so the step points
 * to the last comment of the issue, which was written knowing why.
 */
export function stepsOfLabels({ labels = [], overrides = {}, reason = null, issue = null, language = 'en' } = {}) {
  const { state, reviewer } = stateOfLabels(labels, overrides);
  const lang = pickLanguage(language);
  let step;
  if (reason === null && FROM_COMMENT[state]) {
    const hint = lang === 'es' ? 'lee el último comentario del issue, que dice qué hacer' : 'read the last comment of the issue, which says what to do';
    const who = FROM_COMMENT[state];
    step = { state, reason: null, command: null, who, hint, line: `${PREFIX[lang].act}: ${hint} (${WHO[lang][who]}).` };
  } else {
    step = nextStep({ state, reason, issue, language: lang });
  }
  const steps = reviewer && state !== 'needs-reviewer' ? [step, nextStep({ state: 'needs-reviewer', language: lang })] : [step];
  return { state, steps };
}

/** The line that ends the report of `init`. */
export function afterInit(language = 'en') {
  const lang = pickLanguage(language);
  return `${PREFIX[lang].act}: ${AFTER_INIT[lang]}.`;
}

/** The words that open a next-step line in a language ("Your next step"), for messages that build their own line. */
export const nextStepPrefix = (language) => PREFIX[pickLanguage(language)].act;

/** The words that open the line of a wait ("Nothing to do now"). */
export const waitPrefix = (language) => PREFIX[pickLanguage(language)].wait;
