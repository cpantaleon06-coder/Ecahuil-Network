import { describe, expect, it } from 'vitest';
import { CURRENCY, MemberSchema, type Decision } from '@ecahuil/contracts';
import { runPaymentsPortContract } from '@ecahuil/contracts/testing';

describe('workspace imports', () => {
  it('resolves @ecahuil/contracts from source without a build step', () => {
    const outcome: Decision['outcome'] = 'deny';

    expect(CURRENCY).toBe('USD');
    expect(outcome).toBe('deny');
    expect(MemberSchema.safeParse({}).success).toBe(false);
  });

  it('resolves @ecahuil/contracts/testing', () => {
    expect(runPaymentsPortContract).toBeTypeOf('function');
  });
});
