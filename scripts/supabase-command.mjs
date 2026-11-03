#!/usr/bin/env node
// Says whether a command may be run by a Supabase review. Usage: supabase-command.mjs "<command line>"
//   exit 0: allowed   exit 1: refused (the reason is printed)   exit 2: bad usage
import { checkSupabaseCommand } from './lib/supabase-commands.mjs';

const command = process.argv.slice(2).join(' ');
if (!command) {
  console.error('usage: supabase-command.mjs "<command line>"');
  process.exit(2);
}
const { allowed, reason } = checkSupabaseCommand(command);
console.log(JSON.stringify({ allowed, reason }));
process.exit(allowed ? 0 : 1);
