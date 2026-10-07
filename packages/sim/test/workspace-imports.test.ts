import { describe, expect, it } from 'vitest';
import * as contracts from '@ecahuil/contracts';

describe('workspace imports', () => {
  it('resolves @ecahuil/contracts from source without a build step', () => {
    expect(contracts).toBeTypeOf('object');
  });
});
