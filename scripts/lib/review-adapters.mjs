// How `review` gets a log and captures for a platform and a target, and whether the agent may drive it.
// Implements "The review picks its adapter from the platform and the target" of openspec/specs/review/spec.md.

const DEFAULT_TARGET = { flutter: 'android', vue: 'web' };

const ADAPTERS = {
  'flutter/android': { kind: 'device', log: 'adb logcat', capture: 'adb screencap', driver: 'flutter_driver', needs: ['adb'] },
  'flutter/web': { kind: 'browser', log: 'the browser runner', capture: 'the browser runner', driver: 'flutter_driver', needs: ['a browser'] },
  'vue/web': { kind: 'browser', log: 'the browser runner', capture: 'the browser runner', driver: 'playwright', needs: ['playwright'] },
};

const NOT_AVAILABLE = {
  'flutter/ios': 'the review of iOS is not available yet: it needs a macOS machine with a simulator (xcrun), and nothing in Relevo has been run there',
};

/** The target a platform is reviewed on when none is given: its first target, or the usual one of its stack. */
export function targetOf({ stack, targets = [] }) {
  return targets[0] ?? DEFAULT_TARGET[stack] ?? null;
}

/**
 * Returns { supported, stack, target, kind, log, capture, driver, needs, reason }.
 * `reason` says why a combination is not supported.
 */
export function adapterFor({ stack, target }) {
  const key = `${stack}/${target}`;
  if (ADAPTERS[key]) return { supported: true, stack, target, ...ADAPTERS[key], reason: null };
  return {
    supported: false, stack, target, kind: null, log: null, capture: null, driver: null, needs: [],
    reason: NOT_AVAILABLE[key] ?? (target ? `there is no review adapter for the stack "${stack}" on the target "${target}"` : `the platform of stack "${stack}" names no target to review`),
  };
}

/** Whether a review of this adapter can run at all with the given autopilot mode: a browser has no manual way. */
export function needsAutopilot(adapter) {
  return adapter.supported && adapter.kind === 'browser';
}
