# Ecahuil Network

A mutual fund that protects low-income workers, formal or informal, such as delivery couriers,
construction workers and street vendors, when they lose a day of income to a covered cause.

1. A member files a claim with evidence.
2. An AI claims analyst checks the evidence against independent sources and recommends a payout.
3. A fixed, public rule (not the AI) authorizes the payment.
4. When in doubt, the fund prefers to overpay slightly, within a public error budget.

Built for the PayPal AI Hackathon. **All data in this project is synthetic.**

## Status

Scaffolding and shared contracts. No PayPal integration yet.

## Repository layout

| Path             | Package              | Purpose                                                                       |
| ---------------- | -------------------- | ----------------------------------------------------------------------------- |
| `contracts/`     | `@ecahuil/contracts` | Shared zod schemas, TypeScript types and port interfaces                      |
| `packages/core/` | `@ecahuil/core`      | Claims pipeline, rule authorization and the only package that talks to PayPal |
| `packages/sim/`  | `@ecahuil/sim`       | Synthetic members, claims and fund simulations                                |
| `apps/web/`      | (not scaffolded yet) | Web app                                                                       |
| `data/`          |                      | Synthetic datasets                                                            |

## Getting started

Requirements: Node 22 and pnpm 11 (`corepack enable` picks the version pinned in `package.json`).

```bash
pnpm install
pnpm test        # Vitest in every workspace package
pnpm lint        # ESLint in every workspace package
pnpm typecheck   # tsc --noEmit in every workspace package
pnpm build       # emits dist/ for every workspace package, in dependency order
pnpm format      # Prettier (pnpm format:check only reports)
```

To use the PayPal sandbox later, copy `.env.example` to `.env` and fill it in. Never commit `.env`.

## Workspace imports

Packages import each other by name (`import { ClaimSchema } from '@ecahuil/contracts'`) and this
works **without building anything first**. The approach is a custom export condition:

- Each package's `exports` lists `"@ecahuil/source": "./src/index.ts"` before `types` and
  `default`, which point at `dist/`.
- TypeScript enables that condition through `customConditions` in `tsconfig.base.json`, so
  typechecking and type-aware linting read sibling packages from source.
- Vitest enables it through `resolve.conditions` in `vitest.shared.ts`, so tests also run
  against source.
- `pnpm build` uses each package's `tsconfig.build.json`, which clears the condition. A package
  then compiles against its dependencies' `dist/`, and `pnpm -r` builds dependencies first.
  Plain Node ignores the unknown condition and loads `dist/` as well.

A new package needs the same `exports` shape, a `tsconfig.json` and `tsconfig.build.json`
extending `tsconfig.base.json`, and a `vitest.config.ts` re-exporting `vitest.shared.ts`. A bundled
app (such as `apps/web`) should either add `@ecahuil/source` to its bundler's resolve conditions
or depend on the built output.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
