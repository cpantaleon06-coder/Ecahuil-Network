// Writes data/synthetic-members.json (seed 42). Payout emails come from the optional
// data/sandbox-accounts.local.json; without it every member gets a placeholder address.
// Run with: pnpm --filter @ecahuil/sim generate:members
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMembers } from '../members/generate-members.js';
import { findWorkspaceRoot, readSandboxEmails, serializeMembers } from '../members/members-file.js';

const SEED = 42;
const OUTPUT = 'data/synthetic-members.json';
const SANDBOX_ACCOUNTS = 'data/sandbox-accounts.local.json';

const root = findWorkspaceRoot(fileURLToPath(new URL('.', import.meta.url)));
const sandboxEmails = await readSandboxEmails(join(root, ...SANDBOX_ACCOUNTS.split('/')));
const members = generateMembers({ seed: SEED, paypalEmails: sandboxEmails });
await writeFile(join(root, ...OUTPUT.split('/')), serializeMembers(members), 'utf8');

const withSandbox = Math.min(sandboxEmails.length, members.length);
console.log(
  `Wrote ${members.length} synthetic members (seed ${SEED}) to ${OUTPUT}; ` +
    `${withSandbox} use sandbox emails.`,
);
