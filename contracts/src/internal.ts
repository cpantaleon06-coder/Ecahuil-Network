// Helpers shared by the schema modules. Not part of the public API.
import { z } from 'zod';

/** Non-blank text of at most `max` characters. */
export function text(max: number) {
  return z.string().max(max).regex(/\S/, 'Must not be blank');
}

/** True when no value appears twice. */
export function allUnique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}
