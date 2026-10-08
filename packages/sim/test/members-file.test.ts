import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateMembers } from '../src/members/generate-members.js';
import {
  findWorkspaceRoot,
  readSandboxEmails,
  serializeMembers,
} from '../src/members/members-file.js';

describe('readSandboxEmails', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ecahuil-sim-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function fileWith(content: unknown): Promise<string> {
    const filePath = join(dir, 'sandbox-accounts.local.json');
    await writeFile(filePath, JSON.stringify(content), 'utf8');
    return filePath;
  }

  it('returns no emails when the file does not exist', async () => {
    expect(await readSandboxEmails(join(dir, 'missing.json'))).toEqual([]);
  });

  it('reads an array of email strings', async () => {
    const filePath = await fileWith(['sb-one@example.com', 'sb-two@example.com']);

    expect(await readSandboxEmails(filePath)).toEqual(['sb-one@example.com', 'sb-two@example.com']);
  });

  it('reads an array of objects with an email property', async () => {
    const filePath = await fileWith([{ email: 'sb-one@example.com', type: 'personal' }]);

    expect(await readSandboxEmails(filePath)).toEqual(['sb-one@example.com']);
  });

  it('rejects a file that is not an array of emails', async () => {
    await expect(readSandboxEmails(await fileWith({ emails: [] }))).rejects.toThrow(
      'must hold a JSON array',
    );
    await expect(readSandboxEmails(await fileWith(['not-an-email']))).rejects.toThrow('Entry 0');
  });
});

describe('serializeMembers', () => {
  it('round-trips and ends with a newline', () => {
    const members = generateMembers({ seed: 42, count: 5 });
    const text = serializeMembers(members);

    expect(JSON.parse(text)).toEqual(members);
    expect(text.endsWith('}\n]\n')).toBe(true);
  });

  it('prints arrays of numbers on one line', () => {
    const [member] = generateMembers({ seed: 42, count: 1 });
    const text = serializeMembers(member === undefined ? [] : [member]);

    expect(text).toContain(`"days": [${member?.workSchedule.days.join(', ')}]`);
  });
});

describe('findWorkspaceRoot', () => {
  it('finds the directory with pnpm-workspace.yaml', () => {
    const root = findWorkspaceRoot(import.meta.dirname);

    expect(findWorkspaceRoot(join(root, 'packages', 'sim', 'src'))).toBe(root);
  });
});
