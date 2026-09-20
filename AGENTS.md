## Runtime boundaries

- Use Bun for installs and scripts; the shipped app runs on Electron with a backend service under stock Node.
- Put cross-runtime API contracts in `shared/*`; do not add ad-hoc renderer, Electron, or desktop-service shims.
- Keep ASAR enabled. Stock-Node code and its complete native dependency trees must remain outside it.

## Workflow

- Assume the dev app is already running; do not start it. Inspect Electron through CDP at `127.0.0.1:39217`.
- Commits run `bun run ai:check`, including blocking React Doctor; keep its score at 100. Run the gate manually only when asked, when not committing, or while diagnosing a failed hook.
- Do not relax Biome or TypeScript rules merely to make checks pass; fix the code or use a narrow, justified override.
- Hardening is behaviour-preserving unless separately scoped: do not change product semantics, UI, UX, copy, layout, or interaction during structural passes.

## Builds on this machine (k10)

- `~/.npmrc` sets `ignore-scripts=true`; the packaging hook relies on node-pty's `node-gyp rebuild` during its temp `npm install`, so with scripts disabled Linux gets no compiled `pty.node` and the ABI validation fails late.
- Run packaging builds with scripts enabled for that invocation only: `npm_config_ignore_scripts=false bun run build`. Keep the global guard untouched.
- The release ABI matrix needs Node 25 and 26 (ABI 141/147) beside Node 24; the paths are exported in `~/.bashrc` (`HOWCODE_NODE_25_PATH`, `HOWCODE_NODE_26_PATH`, nvm installs `v25.9.0` / `v26.9.0`). Without them the build dies at the matrix step.
- Linux has no node-pty prebuilds; every ABI bundle compiles locally. Do not assume CI parity — CI runs with lifecycle scripts enabled.
- The dev/editable service needs the repo's `node_modules` to hold a stock-Node build of `node-pty` (ABI 137). `bun run build` restores that state, but a bare `bun install` (via `install-app-deps`) rebuilds it for the Electron ABI. If the service fails on native modules after a plain install, run `bun run build`.

## Tests

- Do not add tests whose oracle is that a feature, action, route, bridge method, or component exists.
- Do not programmatically test UI/UX, rendered markup, layout, styling, copy, or interaction flows; exercise those in the running app with disposable projects.
- If a regression is immediately obvious by launching the app or trying the workflow, use that practical check instead of a happy-path unit or integration test.
- Keep deterministic tests for security, persistence, concurrency, protocol, parsing, lifecycle, and other narrow contracts with independent failure oracles.
- Do not test Pi SDK API shape or upstream behaviour; TypeScript is the Pi compatibility check. Test only Howcode-owned policy around Pi when it has an independent oracle.

## Fork

- `upstream` = IgorWarzocha/howcode (the original); `origin` = janbam's fork. `gh` default repo stays pointed at the fork.
- The fork lives on `main` (= `origin/main`): upstream `main` is the stable line, and we pull updates from it. Never pull from or push to the `dev` branch, upstream or fork.
- Keeping `upstream` fetched matters: a plain clone via the fork only sees old refs, and `main` does not exist there until pushed.

### Fork-owned commands

- `howcode` (wrapper in `~/.local/bin`): launches the last build output without watchers — the "editable install". Ignores source changes until the next `bun run build`; uses the default profile (`~/.config/howcode`).
- `bun run build`: machine-adapted full build (vite → node/esbuild runtime → electron-builder with `npm_config_ignore_scripts=false` and the Node 25/26 path env vars baked in). Run this for a new version.
- `bun run dev`: live hacking loop (vite HMR + artifact watch + auto-relaunch), separate `dev` user profile. Runs entirely under Node via `scripts/dev-runner.mjs`; the canary Bun on k10 must not run long-lived processes.
