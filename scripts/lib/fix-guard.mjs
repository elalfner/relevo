// Enforces "specification first": before any code is written for a fix, the change's specification and task
// list must already describe the correction, and nothing outside the change folder may have been edited.

/**
 * changedFiles          every modified or new path in the working tree
 * changeDir             e.g. "openspec/changes/31-summary"
 * specLinesAdded        added lines in the change's specs/ (diff against HEAD)
 * taskLinesAdded        added lines in the change's tasks.md (diff against HEAD)
 * Returns { ok, reasons }.
 */
export function checkSpecFirst({ changedFiles, changeDir, specLinesAdded, taskLinesAdded }) {
  const reasons = [];
  const prefix = `${changeDir.replace(/\/+$/, '')}/`;
  const outside = changedFiles.filter((f) => !f.startsWith(prefix));
  if (outside.length > 0) {
    reasons.push(`files outside the change folder were edited before the specification was ready: ${outside.slice(0, 5).join(', ')}${outside.length > 5 ? ', ...' : ''}`);
  }
  const scenarioLines = specLinesAdded.filter((l) => /^\+\s*(####\s+Scenario:|[-*]\s+\*\*(WHEN|THEN)\*\*)/.test(l));
  if (scenarioLines.length === 0) reasons.push('no scenario describing the corrected behaviour was added to the change specification');
  const newTasks = taskLinesAdded.filter((l) => /^\+\s*- \[ \] \d+\.\d+/.test(l));
  if (newTasks.length === 0) reasons.push('no unchecked correction task was added to tasks.md');
  return { ok: reasons.length === 0, reasons };
}
