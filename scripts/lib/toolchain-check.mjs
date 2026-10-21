// Which of the tools that a profile lists are not on the path. `probe(tool)` says whether one answers; it is injected
// so that a test does not need the tools. An empty list checks nothing.

/** The tools that are missing, in the order of the profile and without repeats. */
export function missingTools(tools, probe) {
  const seen = new Set();
  return (tools ?? []).filter((tool) => {
    if (seen.has(tool)) return false;
    seen.add(tool);
    return !probe(tool);
  });
}
