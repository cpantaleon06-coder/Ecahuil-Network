// Regenerates the synthetic members dataset (seed 42). Without data/sandbox-accounts.local.json it
// writes data/synthetic-members.json with placeholder emails. With it, it writes the git-ignored
// data/synthetic-members.local.json instead and leaves the committed dataset untouched.
// Run with: pnpm --filter @ecahuil/sim generate:members
import { fileURLToPath } from 'node:url';
import {
  MEMBERS_DATASET_SEED,
  findWorkspaceRoot,
  writeMembersDataset,
} from '../members/members-file.js';

const root = findWorkspaceRoot(fileURLToPath(new URL('.', import.meta.url)));
const result = await writeMembersDataset(root);

console.log(
  `Wrote ${result.memberCount} synthetic members (seed ${MEMBERS_DATASET_SEED}) to ` +
    `${result.file}; ${result.sandboxEmailCount} use sandbox emails.`,
);
