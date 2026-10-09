import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCAL_MEMBERS_FILE,
  PUBLIC_MEMBERS_FILE,
  SANDBOX_ACCOUNTS_FILE,
  findWorkspaceRoot,
  writeMembersDataset,
} from '../src/members/members-file.js';

function inRoot(root: string, relativePath: string): string {
  return join(root, ...relativePath.split('/'));
}

describe('writeMembersDataset', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ecahuil-dataset-'));
    await mkdir(join(root, 'data'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('without sandbox accounts, reproduces the committed dataset byte for byte', async () => {
    const result = await writeMembersDataset(root);

    const committed = await readFile(
      inRoot(findWorkspaceRoot(import.meta.dirname), PUBLIC_MEMBERS_FILE),
    );
    expect(result).toEqual({ file: PUBLIC_MEMBERS_FILE, memberCount: 100, sandboxEmailCount: 0 });
    expect(await readFile(inRoot(root, PUBLIC_MEMBERS_FILE))).toEqual(committed);
    expect(existsSync(inRoot(root, LOCAL_MEMBERS_FILE))).toBe(false);
  });

  it('with sandbox accounts, writes the local file and leaves the committed one alone', async () => {
    await writeFile(inRoot(root, PUBLIC_MEMBERS_FILE), 'committed dataset\n', 'utf8');
    await writeFile(
      inRoot(root, SANDBOX_ACCOUNTS_FILE),
      JSON.stringify(['sb-one@example.com', 'sb-two@example.com']),
      'utf8',
    );

    const result = await writeMembersDataset(root);

    expect(result).toEqual({ file: LOCAL_MEMBERS_FILE, memberCount: 100, sandboxEmailCount: 2 });
    expect(await readFile(inRoot(root, PUBLIC_MEMBERS_FILE), 'utf8')).toBe('committed dataset\n');
    const local = JSON.parse(await readFile(inRoot(root, LOCAL_MEMBERS_FILE), 'utf8')) as Array<{
      paypalEmail: string;
    }>;
    expect(local.slice(0, 3).map((member) => member.paypalEmail)).toEqual([
      'sb-one@example.com',
      'sb-two@example.com',
      'member-003@example.invalid',
    ]);
  });

  it('never creates the committed dataset while sandbox accounts exist, even an empty list', async () => {
    await writeFile(inRoot(root, SANDBOX_ACCOUNTS_FILE), '[]', 'utf8');

    const result = await writeMembersDataset(root);

    expect(result.file).toBe(LOCAL_MEMBERS_FILE);
    expect(existsSync(inRoot(root, PUBLIC_MEMBERS_FILE))).toBe(false);
    expect(existsSync(inRoot(root, LOCAL_MEMBERS_FILE))).toBe(true);
  });
});
