#!/usr/bin/env bash
# ============================================================
# Copy the values in .env.local up to the linked Vercel project.
#
# Run it yourself:  bash scripts/push-env.sh
#
# Why a script instead of four `vercel env add` commands: two of these
# values (ANTHROPIC_API_KEY, VOYAGE_API_KEY) are real secrets. This way
# they go straight from your disk to Vercel without being pasted into a
# terminal, a chat window, or a shell history file.
#
# Safe to re-run — each variable is removed before being re-added, so
# rotating a key is just editing .env.local and running this again.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "✗ No .env.local found in $(pwd)" >&2
  exit 1
fi

if [ ! -d .vercel ]; then
  echo "✗ Project is not linked. Run: vercel link" >&2
  exit 1
fi

# VITE_* are inlined into the JS bundle by `vite build`, so they must exist
# BEFORE the build runs — they are build-time, not runtime, variables.
# The other two are read by the serverless functions at request time.
VARS=(
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
  VITE_TENANT
  ANTHROPIC_API_KEY
  VOYAGE_API_KEY
)

# Both environments: `production` serves the live domain, `preview` serves
# every branch/preview deployment. Miss `preview` and preview builds ship a
# bundle with no Supabase config, which looks like a broken app.
ENVIRONMENTS=(production preview)

for name in "${VARS[@]}"; do
  # Take the last assignment wins, strip inline surrounding quotes, and
  # ignore commented-out lines.
  value="$(grep -E "^[[:space:]]*${name}=" .env.local | tail -n1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')"

  if [ -z "$value" ]; then
    echo "⊘ $name — not set in .env.local, skipping"
    continue
  fi

  for env in "${ENVIRONMENTS[@]}"; do
    # Adding over an existing variable errors, so clear it first. It may not
    # exist yet, which is fine — hence the `|| true`.
    vercel env rm "$name" "$env" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | vercel env add "$name" "$env" >/dev/null 2>&1
  done

  echo "✓ $name → production, preview"
done

echo
echo "Done. Now deploy:  vercel --prod"
