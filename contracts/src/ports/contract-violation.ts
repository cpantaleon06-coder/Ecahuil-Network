import { z } from 'zod';

/**
 * Thrown by the port guards when a request or a result breaks the contracts. When a schema
 * rejected the value, `cause` holds the ZodError.
 */
export class ContractViolationError extends Error {
  override readonly name = 'ContractViolationError';
  /** Where it happened, e.g. "PaymentsPort.sendPayouts result". */
  readonly location: string;

  constructor(location: string, detail: string, options?: ErrorOptions) {
    super(`${location}: ${detail}`, options);
    this.location = location;
  }
}

export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  value: unknown,
  location: string,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ContractViolationError(location, z.prettifyError(result.error), {
      cause: result.error,
    });
  }
  return result.data;
}
