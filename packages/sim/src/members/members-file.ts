// Node-only helpers for the generate:members script. Not exported from the package entry point, so
// browser bundles of @ecahuil/sim never pull in node:fs.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MemberSchema, type Member } from '@ecahuil/contracts';

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
