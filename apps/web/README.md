# apps/web

The Ecahuil Network web app. It has not been scaffolded yet.

Until this folder has a `package.json`, pnpm skips it and the rest of the workspace keeps working.
When it is scaffolded:

- Name the package `@ecahuil/web` and depend on `"@ecahuil/contracts": "workspace:*"`.
- Provide `build`, `test`, `lint` and `typecheck` scripts so the root scripts include it.
- Resolve workspace packages from source by adding the `@ecahuil/source` condition to the bundler
  (see "Workspace imports" in the root README), or run `pnpm build` first and use `dist/`.
- Never call PayPal from here. Payments go through `packages/core`.
