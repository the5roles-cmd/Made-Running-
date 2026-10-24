#!/usr/bin/env bash
# ============================================================
# PROSPECT DEMO — build and stage, for a SECOND Vercel project.
# ============================================================
# maderunning.co.uk is the club's live site. It deliberately does not show the
# CRM, the login or the registration form: the club asked for those gone from
# the public website. This builds the OTHER deployment — the complete platform,
# with a club in it — which gets emailed to prospects.
#
# Two separate Vercel projects, one repository. That is the whole design, and
# everything awkward in this file follows from keeping them apart.
#
# ── Why this STAGES to a scratch directory instead of just deploying ─────────
#
# 1. The repo's .vercel/ is linked to the club's production project. Running
#    `vercel` in the repo root deploys THAT, or relinks it, and the failure
#    mode is replacing maderunning.co.uk with a demo full of invented members.
#    A scratch directory has no link to confuse, and nothing to overwrite.
#
# 2. The demo must be uploaded PREBUILT. If Vercel builds from source it runs
#    `npm run build` with no VITE_DEMO_AUTH, which produces a correct non-demo
#    bundle pointed at no database — <SetupNotice> on eleven screens and an
#    empty CRM. The one thing a prospect demo may not be is empty, so the build
#    has to happen here, where the flags are set, and ship as static files.
#
# ── The flags, and why there are so many ─────────────────────────────────────
# VITE_DEMO_AUTH=1       fakes a signed-in owner (src/lib/demoAuth.js)
# VITE_PUBLIC_DOORS=1    restores the login/register doors the public site hides
# VITE_SUPABASE_URL=''   blank, EXPLICITLY. Without this the build inherits
# VITE_SUPABASE_ANON_KEY='' .env.local and ships the club's real project URL and
#                        anon key inside a bundle sent to strangers. Blanking
#                        them is also what makes DEMO_DATA true — it is
#                        `isDemoAuth && !supabaseConfigured`, so a demo build
#                        that kept its credentials would serve neither the
#                        fixtures nor the database.
# ALLOW_DEMO_BUILD=1     consent for assertNotDemoBuild() in vite.config.js,
#                        which otherwise refuses to build demo mode at all.
#                        The guard exists so this can never happen by accident;
#                        this line is the deliberate exception.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${DEMO_STAGE_DIR:-/tmp/made-running-demo}"

cd "$REPO"

echo "→ building demo bundle"
VITE_DEMO_AUTH=1 \
VITE_PUBLIC_DOORS=1 \
VITE_SUPABASE_URL='' \
VITE_SUPABASE_ANON_KEY='' \
ALLOW_DEMO_BUILD=1 \
  npm run build

# ── The credential check ────────────────────────────────────────────────────
# Belt and braces over the blank env vars above, and it is here rather than in
# a comment because this is the one mistake with no recovery: a Supabase URL
# and anon key in a public bundle is the club's database behind whatever RLS
# happens to allow, for anyone who opens devtools.
#
# Greps for the HOST and for JWT-shaped strings rather than for the variable
# NAMES — Vite substitutes the VALUE at build time, so searching for
# "VITE_SUPABASE_URL" finds nothing in a bundle that leaks and proves nothing
# in one that does not.
echo "→ checking the bundle for credentials"
if grep -rqE '[a-z0-9]{20}\.supabase\.co' dist/assets/*.js; then
  echo "REFUSING: a Supabase project host is in the demo bundle." >&2
  exit 1
fi
if grep -rqE 'eyJ[A-Za-z0-9_-]{30,}' dist/assets/*.js; then
  echo "REFUSING: a JWT-shaped string is in the demo bundle." >&2
  exit 1
fi
echo "  clean — no Supabase host, no JWT"

echo "→ staging to $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R dist/. "$STAGE/"

# ── Cleaning up after the drive ─────────────────────────────────────────────
# This repo lives on an exFAT volume, which cannot store macOS extended
# attributes natively and keeps them in sidecar "._name" AppleDouble files.
# They are real files to `cp`, so a plain copy of dist/ stages one alongside
# every asset — and `vercel deploy` uploads whatever it is given. The first
# staging produced ._index.html, ._assets, ._favicon.svg and the rest, which
# is both forty pointless files in a public deployment and a small information
# leak (they carry local filesystem metadata).
#
# Deleted after the copy rather than excluded during it, because `cp` has no
# exclude and reaching for rsync or tar to dodge one glob is a worse trade.
find "$STAGE" -name '._*' -delete
find "$STAGE" -name '.DS_Store' -delete

# The club's sitemap lists maderunning.co.uk's pages and exists to INVITE
# crawling — the precise opposite of what the headers above are for, served
# from a host those URLs do not belong to. Shipping both would be a deployment
# arguing with itself, so the demo drops it.
rm -f "$STAGE/sitemap.xml"

# ── Keeping the demo out of Google ──────────────────────────────────────────
# Not tidiness. The demo is a byte-identical copy of /book and /coaches, so an
# indexed demo competes with maderunning.co.uk for the club's OWN class names,
# and puts invented runners into search results under the club's brand.
#
# Both mechanisms, because they do different jobs: robots.txt asks crawlers not
# to FETCH, while X-Robots-Tag tells them not to INDEX. A URL that is only
# disallowed in robots.txt can still be indexed from a link someone posted —
# which is precisely how this URL travels.
#
# No "rewrites" for /api here, unlike the repo's vercel.json: this project has
# no serverless functions and must not have any. The assistant answers from the
# fixtures (src/lib/demoAssistant.js) specifically so that no ANTHROPIC_API_KEY
# has to sit behind an unauthenticated public link.
cat > "$STAGE/vercel.json" <<'JSON'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
    }
  ]
}
JSON

cat > "$STAGE/robots.txt" <<'TXT'
# Prospect demo. Not the club's website — see https://maderunning.co.uk
User-agent: *
Disallow: /
TXT

echo
echo "Staged. To deploy the demo (NEVER run this in the repo root):"
echo "  cd $STAGE && npx vercel deploy --prod --yes"
