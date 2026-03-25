# Verification

## Philosophy

Verification should be meaningful without pretending the scaffold is feature-complete.

## Current Checks

- `test`
  - runs focused workspace smoke tests for shared contracts, domain helpers, and API routes
- `verify:web`
  - builds the webapp
- `verify:desktop`
  - builds desktop UI assets and runs `cargo check`
- `verify:mobile`
  - typechecks the Expo companion scaffold
- `verify:analyzer`
  - runs analyzer tests and mock output flow
- `verify:api`
  - runs the API bridge compile verification step
- `verify:all`
  - runs all of the above
- `health`
  - primary repo health command
  - runs environment check, package layout check, the workspace test suite, and full verification
- `run doctor`
  - equivalent package-script form if you specifically want the `doctor` script name
  - use `pnpm run doctor`, not `pnpm doctor`
