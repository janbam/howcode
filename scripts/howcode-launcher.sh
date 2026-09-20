#!/usr/bin/env bash
# howcode editable install launcher: runs the last `bun run build` output
# directly, without watchers. Code changes are ignored until the next build.
# For a fresh build: `bun run build` in the repo. For live hacking: `bun run dev`.
#
# Install (once): ln -s <repo>/scripts/howcode-launcher.sh ~/.local/bin/howcode
set -euo pipefail

HOWCODE_REPO="${HOWCODE_REPO:-$HOME/src/howcode}"
cd "$HOWCODE_REPO"

# Service runtime Node (ABI 137) and its PATH; .bashrc usually provides these.
export HOWCODE_NODE_PATH="${HOWCODE_NODE_PATH:-$HOME/.nvm/versions/node/v24.13.0/bin/node}"
export PATH="$(dirname "$HOWCODE_NODE_PATH"):$PATH"
export HOWCODE_REPO_ROOT="$HOWCODE_REPO"

# Guard: nothing built yet → clear instruction instead of an Electron crash.
for artifact in dist/index.html build/electron/main/index.cjs build/desktop/service-host.mjs; do
  if [ ! -f "$artifact" ]; then
    echo "howcode: missing $artifact — run \`bun run build\` in $HOWCODE_REPO first." >&2
    exit 1
  fi
done

# Drop any stale dev-server marker so Electron serves the static dist/ build
# instead of probing for a vite server that is not running.
rm -f build/dev-server.json

# Default user data dir (~/.config/howcode): shared with the packaged app,
# distinct from the dev loop's separate profile.
exec ./node_modules/.bin/electron build/electron/main/index.cjs
