# Tasks

## 1. Scope resolution and update

- [ ] 1.1 `parseArgs` returns `scope: null` when none is given; `resolveScope` as a pure function with the three outcomes (given, ask, default with a reason)
- [ ] 1.2 `update` passes `--scope` only when given; test both with a fake `claude`
- [ ] 1.3 Tests of `resolveScope`: given, interactive in and out of a repository, non-interactive in and out of a repository, `git` missing

## 2. The selector

- [ ] 2.1 `scripts/lib/select.mjs`: draws the choices, handles up, down, Enter, Esc, Ctrl-C and the digits, restores the terminal on every exit
- [ ] 2.2 Tests with a simulated stream: each key, wrap-around, cancel resolves null and restores raw mode, a non-terminal stream is refused

## 3. The command

- [ ] 3.1 `scripts/cli.mjs` and `execute`: ask when needed, print the one-line reason when not, say the scope used and where it was written, and stop without changes on a cancel
- [ ] 3.2 Tests with a fake `claude` and a fake terminal: the list is shown with the project selected, a choice reaches the commands, a cancel runs nothing, no terminal never waits
- [ ] 3.3 The usage text names the list

## 4. Documentation

- [ ] 4.1 README, Install and Get started (English and Spanish) say that `relevo install` asks and the project is the default; the `claude plugin` commands keep `--scope project` written out; changelog under Unreleased

## 5. Check

- [ ] 5.1 Run `relevo install` in a real pseudo-terminal in a clean folder and in a git repository, and see the list, the default and a cancel
