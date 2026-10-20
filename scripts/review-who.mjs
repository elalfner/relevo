#!/usr/bin/env node
// Says whether the person running the review is the assignee of the issue. Usage:
//   node scripts/review-who.mjs --assignee <login> --login <login>
// exit 0: the same person (case does not matter)   exit 1: different people, prints both   exit 2: bad arguments

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const assignee = arg('assignee');
const login = arg('login');
if (!assignee || !login) {
  console.error('usage: review-who.mjs --assignee <login> --login <login>');
  process.exit(2);
}
if (assignee.toLowerCase() === login.toLowerCase()) {
  console.log(`${login} is the assignee`);
  process.exit(0);
}
console.log(`the issue is assigned to ${assignee}, but ${login} is running the review`);
process.exit(1);
