#!/usr/bin/env bash
#
# Deploy the `lines` Storybook to the `gh-pages` branch for GitHub Pages PROJECT hosting
# at https://<owner>.github.io/StakeGamba/  (not a CI pipeline — a manual, reproducible deploy).
#
# WHY THE /sb/ + /assets/ + redirect LAYOUT (fixes the "Initialising..." hang):
# The game resolves its static assets at runtime via:
#     new URL('../../assets/<path>', import.meta.url)
# On the real stake-engine host the bundle sits at /_app/immutable/<chunk>.js, so '../../assets/'
# resolves to /assets/ (domain root) — correct there.
# But on a GitHub Pages PROJECT site served under /StakeGamba/, a Storybook deployed at the branch
# ROOT puts the bundle at /StakeGamba/assets/<chunk>.js, so '../../assets/' resolves to /assets/
# (domain root) -> 404 for EVERY game asset -> the asset loader never completes -> the canvas is
# stuck on "Initialising...".
# Serving Storybook one level deeper at /StakeGamba/sb/ puts the bundle at
# /StakeGamba/sb/assets/<chunk>.js, so '../../assets/' resolves to /StakeGamba/assets/ — where we
# place a copy of the game's static assets. A tiny index.html at the branch root redirects
# (preserving ?query#hash, so deep story links keep working) to ./sb/.
#
# Resulting gh-pages layout:
#   /.nojekyll
#   /index.html      -> redirect to ./sb/<same query+hash>
#   /assets/         -> copy of apps/lines/static/assets   (served at /StakeGamba/assets/)
#   /sb/             -> storybook-static                    (served at /StakeGamba/sb/)
#
# Usage:
#   apps/lines/scripts/deploy-storybook-ghpages.sh [--no-build] <output-dir>
# Assembles the gh-pages payload into <output-dir>. Building the actual git commit/push is done by
# the caller so this script never touches your branches.
set -euo pipefail

NO_BUILD=0
if [ "${1:-}" = "--no-build" ]; then NO_BUILD=1; shift; fi
OUT="${1:?Usage: deploy-storybook-ghpages.sh [--no-build] <output-dir>}"

ROOT="$(git rev-parse --show-toplevel)"
APP="$ROOT/apps/lines"

if [ "$NO_BUILD" -eq 0 ]; then
  ( cd "$APP" && PUBLIC_CHROMATIC=true pnpm exec storybook build -o storybook-static )
fi

rm -rf "$OUT"
mkdir -p "$OUT/sb" "$OUT/assets"
cp -r "$APP/storybook-static/." "$OUT/sb/"
cp -r "$APP/static/assets/." "$OUT/assets/"
touch "$OUT/.nojekyll"
cat > "$OUT/index.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Golden Goal Rush</title>
    <script>
      // Redirect to the Storybook (served from ./sb/) while preserving ?path=... deep links.
      location.replace('sb/' + location.search + location.hash);
    </script>
  </head>
  <body>
    <a href="sb/">Open Golden Goal Rush Storybook</a>
  </body>
</html>
HTML

echo "gh-pages payload assembled at: $OUT"
