// Node-only helpers for the generate:members script. Not exported from the package entry point, so
// browser bundles of @ecahuil/sim never pull in node:fs.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MemberSchema, type Member } from '@ecahuil/contracts';
import { generateMembers } from './generate-members.js';

/** Seed of the members dataset. */
export const MEMBERS_DATASET_SEED = 42;
/** Optional, git-ignored list of sandbox payout emails. */
export const SANDBOX_ACCOUNTS_FILE = 'data/sandbox-accounts.local.json';
/** Committed dataset: placeholder emails only. */
export const PUBLIC_MEMBERS_FILE = 'data/synthetic-members.json';
/** Git-ignored dataset, written instead when sandbox emails are present. */
export const LOCAL_MEMBERS_FILE = 'data/synthetic-members.local.json';

export interface MembersDatasetResult {
  /** Path of the file written, relative to the workspace root, with forward slashes. */
  file: string;
  memberCount: number;
  sandboxEmailCount: number;
}

/**
 * Generates the members dataset under `root`. When the sandbox accounts file exists, the result
 * goes to the git-ignored local file and the committed dataset is left untouched, so local emails
 * never reach the repository. Otherwise the committed dataset is regenerated, byte for byte.
 */
export async function writeMembersDataset(root: string): Promise<MembersDatasetResult> {
  const sandboxPath = resolveIn(root, SANDBOX_ACCOUNTS_FILE);
  const useLocal = existsSync(sandboxPath);
  const sandboxEmails = useLocal ? await readSandboxEmails(sandboxPath) : [];
  const members = generateMembers({ seed: MEMBERS_DATASET_SEED, paypalEmails: sandboxEmails });
  const file = useLocal ? LOCAL_MEMBERS_FILE : PUBLIC_MEMBERS_FILE;
  await writeFile(resolveIn(root, file), serializeMembers(members), 'utf8');
  return {
    file,
    memberCount: members.length,
    sandboxEmailCount: Math.min(sandboxEmails.length, members.length),
  };
}

function resolveIn(root: string, relativePath: string): string {
  return join(root, ...relativePath.split('/'));
}

/** Walks up from `fromDir` to the directory that holds pnpm-workspace.yaml. */
export function findWorkspaceRoot(fromDir: string): string {
  let dir = fromDir;
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`No pnpm-workspace.yaml found above ${fromDir}`);
    }
    dir = parent;
  }
  return dir;
}

/**
 * Reads payout emails from an optional local file. A missing file yields no emails. The file holds
 * a JSON array of email strings, or of objects with an `email` property.
 */
export async function readSandboxEmails(filePath: string): Promise<string[]> {
  if (!existsSync(filePath)) {
    return [];
  }
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`${filePath} must hold a JSON array`);
  }
  return parsed.map((entry: unknown, index) => {
    const candidate =
      typeof entry === 'object' && entry !== null && 'email' in entry ? entry.email : entry;
    const email = MemberSchema.shape.paypalEmail.safeParse(candidate);
    if (!email.success) {
      throw new Error(`Entry ${index} in ${filePath} is not a valid email`);
    }
    return email.data;
  });
}

/**
 * Pretty JSON with a trailing newline. Short arrays of numbers stay on one line, as Prettier
 * prints them, so the generated file passes the repository format check.
 */
export function serializeMembers(members: readonly Member[]): string {
  const json = JSON.stringify(members, null, 2).replace(
    /\[\s+(-?\d[\d\s,.-]*?)\s+\]/g,
    (_match, items: string) => `[${items.split(/,\s*/).join(', ')}]`,
  );
  return `${json}\n`;
}
