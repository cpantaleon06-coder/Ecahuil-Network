import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// Must match "customConditions" in tsconfig.base.json. It makes Vitest load
// workspace packages from their TypeScript sources, so no build is needed.
const SOURCE_CONDITION = '@ecahuil/source';

export default defineConfig({
  resolve: {
    conditions: [SOURCE_CONDITION, ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: [SOURCE_CONDITION, ...defaultServerConditions],
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
